// Makes (once) the textures of skill / passive icons (skillIcons.json, 16x16) and of the recoloured skill book
// picture per page type (skillBooks.json pageColors), and returns their keys. Pixel art: whole-number scales.
import skillIcons from '../data/skillIcons.json';
import itemIcons from '../data/itemIcons.json';
import rarities from '../data/rarities.json';
import bookData from '../data/skillBooks.json';
import { framedIconPixels, FRAMED_SIZE, ICON_SIZE } from '../systems/itemIcons.js';
import { artPixels } from '../systems/pixelArt.js';

const PASSIVE_FRAME = rarities.legendary && rarities.legendary.frame; // gold, like the passive badge

function paint(scene, key, grid) {
  const tex = scene.textures.createCanvas(key, grid[0].length, grid.length);
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    tex.context.fillStyle = '#' + c.toString(16).padStart(6, '0');
    tex.context.fillRect(x, y, 1, 1);
  }));
  tex.refresh();
}

// A skill's icon (key = skill id), or a passive's (key = passive_<heroId>). `framed` = inside a gold 20x20 frame.
// Returns null when there is no icon for it.
export function skillIconKey(scene, id, framed = false) {
  const icon = skillIcons[id];
  if (!icon || !icon.rows) return null;
  const key = `skillIcon-${id}${framed ? '-f' : ''}`;
  if (!scene.textures.exists(key)) paint(scene, key, framed ? framedIconPixels(icon, PASSIVE_FRAME) : artPixels(icon));
  return key;
}

// The skill book picture for a page (framed like the item icon): coloured by its kind / tag; the golden book stays gold.
export function bookPageIconKey(scene, page, golden = false) {
  if (golden) return framedKey(scene, 'golden_book', itemIcons.golden_book, 'legendary');
  const tag = page.kind === 'stat' ? 'stat' : page.tag;
  const cols = bookData.pageColors[tag] || bookData.pageColors.stat;
  const base = itemIcons.skill_book;
  const palette = base.palette.slice();
  [palette[1], palette[2], palette[5]] = cols;
  return framedKey(scene, `book-${tag}`, { ...base, palette }, 'rare');
}

function framedKey(scene, name, icon, rarity) {
  const key = `bookIcon-${name}`;
  if (!scene.textures.exists(key)) paint(scene, key, framedIconPixels(icon, rarities[rarity].frame));
  return key;
}

export { FRAMED_SIZE, ICON_SIZE };
