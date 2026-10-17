// Builds the ITEM REVIEW page: every item of the game (items.json) with its real framed icon (itemIcons.json +
// rarities.json frames, drawn exactly like the game: systems/itemIcons.js), its text, a NEW tag for the items that
// were never on the old icon page, and a notes box per item. The notes are saved in the page's database
// (collection `notes`, doc id = item id: { note, updatedAt }); read them with ArtifactData `list` of `notes`.
// node docs/proposals/item-review/make-item-review.mjs <out.html>
import fs from 'fs';
import { framedIconPixels } from '../../../src/systems/itemIcons.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../../src/data/${f}`, import.meta.url)));
const items = read('items.json');
const icons = read('itemIcons.json');
const rarities = read('rarities.json');
const oldPage = fs.readFileSync(new URL('../items-meta.js', import.meta.url), 'utf8'); // the 72 items of the old icon page

// A framed icon as { p: palette of '#rrggbb', r: rows of palette letters ('.' = empty) }.
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function packGrid(grid) {
  const pal = [];
  const rows = grid.map((row) => row.map((c) => {
    if (c === null) return '.';
    const hex = '#' + c.toString(16).padStart(6, '0');
    let i = pal.indexOf(hex);
    if (i < 0) { pal.push(hex); i = pal.length - 1; }
    return LETTERS[i];
  }).join(''));
  return { p: pal, r: rows };
}

const ORDER = ['common', 'rare', 'epic', 'legendary'];
const list = Object.entries(items)
  .filter(([, it]) => it.kind !== 'potion')
  .map(([id, it]) => ({
    id, name: it.name, rarity: it.rarity, type: it.type || '', desc: it.description || '', perStack: it.perStack || '',
    isNew: !oldPage.includes(`"${id}"`),
    icon: packGrid(framedIconPixels(icons[id], rarities[it.rarity] && rarities[it.rarity].frame)),
  }))
  .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
const rar = Object.fromEntries(ORDER.map((r) => [r, { label: rarities[r].label, color: '#' + Number(rarities[r].color).toString(16).padStart(6, '0') }]));

const template = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const data = JSON.stringify({ items: list, rarities: rar }).replaceAll('</', '<\\/');
const out = template.replace('/*DATA*/null', data);
fs.writeFileSync(process.argv[2] || 'item-review.html', out);
console.log(`wrote ${process.argv[2]}: ${list.length} items, ${list.filter((x) => x.isNew).length} new`);
