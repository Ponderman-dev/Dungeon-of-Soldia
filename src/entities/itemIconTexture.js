// Makes (once) the texture of an item's framed icon and returns its key. Draw it with
// scene.add.image(x, y, key).setScale(n) (pixel art: keep whole-number scales).
import icons from '../data/itemIcons.json';
import rarities from '../data/rarities.json';
import { framedIconPixels, FRAMED_SIZE, ICON_SIZE } from '../systems/itemIcons.js';
import { artPixels } from '../systems/pixelArt.js';

export function itemIconKey(scene, itemId, rarity) {
  const key = `icon-${itemId}-${rarity}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, FRAMED_SIZE, FRAMED_SIZE);
    const grid = framedIconPixels(icons[itemId], rarities[rarity] && rarities[rarity].frame);
    grid.forEach((row, y) => row.forEach((c, x) => {
      if (c === null) return;
      tex.context.fillStyle = '#' + c.toString(16).padStart(6, '0');
      tex.context.fillRect(x, y, 1, 1);
    }));
    tex.refresh();
  }
  return key;
}

// The bare 16x16 item picture (no rarity frame), e.g. the Profile's medals. Returns its texture key.
export function bareIconKey(scene, itemId) {
  const key = `icon-bare-${itemId}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    if (icons[itemId]) artPixels(icons[itemId]).forEach((row, y) => row.forEach((c, x) => {
      if (c === null) return;
      tex.context.fillStyle = '#' + c.toString(16).padStart(6, '0');
      tex.context.fillRect(x, y, 1, 1);
    }));
    tex.refresh();
  }
  return key;
}
