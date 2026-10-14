// Makes (once) the texture of a status icon (statusIcons.json, 7x7) and returns its key. Draw it with
// scene.add.image(x, y, key).setScale(CHAR_SCALE) (pixel art: whole-number scales only).
import icons from '../data/statusIcons.json';
import { artPixels } from '../systems/pixelArt.js';

export function statusIconKey(scene, id) {
  const key = `status-icon-${id}`;
  if (!scene.textures.exists(key) && icons[id]) {
    const px = artPixels(icons[id]);
    const tex = scene.textures.createCanvas(key, px[0].length, px.length);
    px.forEach((row, y) => row.forEach((c, x) => {
      if (c === null) return;
      tex.context.fillStyle = '#' + c.toString(16).padStart(6, '0');
      tex.context.fillRect(x, y, 1, 1);
    }));
    tex.refresh();
  }
  return key;
}
