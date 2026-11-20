// Makes (once) the textures of skill / passive icons (skillIcons.json, 16x16) and of the skill book page icons
// (pageIcons.json), and returns their keys. Pixel art: whole-number scales.
import skillIcons from '../data/skillIcons.json';
import rarities from '../data/rarities.json';
import { framedIconPixels, FRAMED_SIZE, ICON_SIZE } from '../systems/itemIcons.js';
import { artPixels } from '../systems/pixelArt.js';
import pageIcons from '../data/pageIcons.json';
import { pageIconArt } from '../systems/pageIcon.js';

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

// A skill book page's icon: its own coloured spell tome (systems/pageIcon.js) in its tier's frame. `R` = the tier's
// look ({ frame }: rarities.json, or skillBooks.json heroFrame for hero-only pages).
export function bookPageIconKey(scene, page, R) {
  const key = `pageIcon-${page.id}-${R.label || 'x'}`;
  if (!scene.textures.exists(key)) paint(scene, key, framedIconPixels(pageIconArt(pageIcons, page.id, R.frame), R.frame));
  return key;
}

export { FRAMED_SIZE, ICON_SIZE };
