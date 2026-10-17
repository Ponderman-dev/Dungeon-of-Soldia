// Builds the NEW ITEM EFFECTS proposal page: for each new item without an effect of its own, what it shows NOW and
// 2 proposed effects (recipes.js, same format as src/systems/itemFx.js), all playing live on the game's effect stage.
// The user picks one per item + writes a note; saved in the page's db, collection `picks` (doc = item id:
// { pick: 'now' | 'A' | 'B', note, updatedAt }). Read with ArtifactData `list` of `picks`, then move the picked
// recipes into itemFx.js.   node docs/proposals/new-item-fx/make-page.mjs <out.html>
import fs from 'fs';
import { execSync } from 'child_process';
import { framedIconPixels } from '../../../src/systems/itemIcons.js';
import { PROPOSALS } from './recipes.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../../src/data/${f}`, import.meta.url)));
const items = read('items.json'), icons = read('itemIcons.json'), rarities = read('rarities.json'), itemFxData = read('itemFx.json');
const show = JSON.parse(fs.readFileSync(new URL('../item-review/item-fx-show.json', import.meta.url), 'utf8'));
const rulesSrc = fs.readFileSync(new URL('../../../src/systems/BattleState.js', import.meta.url), 'utf8');
const popIds = new Set([...rulesSrc.matchAll(/itemId: '([a-z_]+)'/g)].map((m) => m[1]).concat(['sucker_punch_glove', 'executioners_axe']));
for (const [id, it] of Object.entries(items)) for (const e of it.effects || []) if (e.proc && !e.silent) popIds.add(id);
for (const [id, v] of Object.entries(itemFxData)) if (v && v.noPop) popIds.delete(id);

const L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function packGrid(grid) {
  const pal = [];
  const rows = grid.map((row) => row.map((c) => { if (c === null) return '.'; const h = '#' + c.toString(16).padStart(6, '0'); let i = pal.indexOf(h); if (i < 0) { pal.push(h); i = pal.length - 1; } return L[i]; }).join(''));
  return { p: pal, r: rows };
}
const hex = (n) => '#' + Number(n).toString(16).padStart(6, '0');
const list = PROPOSALS.map((pr) => {
  const it = items[pr.item];
  return { id: pr.item, name: it.name, rarity: it.rarity, rarityLabel: rarities[it.rarity].label, rarityColor: hex(rarities[it.rarity].color), desc: it.description, when: pr.when,
    pop: popIds.has(pr.item), now: show[pr.item] || [], icon: packGrid(framedIconPixels(icons[pr.item], rarities[it.rarity].frame)),
    options: pr.options.map((o) => ({ id: o.id, name: o.name, desc: o.desc })) };
});
execSync('npx vite build --config docs/proposals/new-item-fx/vite.fx.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const fxBundle = fs.readFileSync(new URL('./dist/fx.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const template = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const out = template.replace('/*DATA*/null', () => JSON.stringify(list).replaceAll('</', '<\\/')).replace('/*FXBUNDLE*/', () => fxBundle);
fs.writeFileSync(process.argv[2] || 'new-item-fx.html', out);
console.log(`wrote ${process.argv[2]}: ${list.length} items, ${list.reduce((n, x) => n + x.options.length, 0)} proposed effects`);
