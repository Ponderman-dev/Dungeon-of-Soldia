// Makes (once) the pixel-art texture of a floor (systems/floorArt.js) and returns its key. Draw it with
// scene.add.image(0, 0, key).setOrigin(0).setScale(floorArt.pixel). One texture per tile colour and variant.
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import floorArt from '../data/floorArt.json';
import { floorArtPixels } from '../systems/floorArt.js';

export const FLOOR_PIXEL = floorArt.pixel;

export function floorTextureKey(scene, tint, variant, wallH) {
  const key = `floorArt-${tint}-${variant}`;
  if (scene.textures.exists(key)) return key;
  const width = Math.ceil(GAME_WIDTH / floorArt.pixel);
  const height = Math.ceil(GAME_HEIGHT / floorArt.pixel);
  const seed = (Number(tint) ^ Math.imul(variant + 1, 2654435761)) >>> 0;
  const { pixels } = floorArtPixels(floorArt, { width, height, wallH: Math.round(wallH / floorArt.pixel), tint, seed });
  const tex = scene.textures.createCanvas(key, width, height);
  const img = tex.context.createImageData(width, height);
  pixels.forEach((c, i) => {
    img.data[i * 4] = (c >> 16) & 255;
    img.data[i * 4 + 1] = (c >> 8) & 255;
    img.data[i * 4 + 2] = c & 255;
    img.data[i * 4 + 3] = 255;
  });
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}

// A window-sized piece of the battle floor (below the wall), as an image cropped to (x, y, w, h) on screen.
// wallH must be the battle floors' wall height: the texture is shared by key.
export function floorCrop(scene, tint, wallH, x, y, w, h) {
  const P = floorArt.pixel;
  const img = scene.add.image(0, y - Math.round(GAME_HEIGHT / 2 / P) * P, floorTextureKey(scene, tint, 0, wallH)).setOrigin(0).setScale(P);
  img.setCrop(x / P, (y - img.y) / P, w / P, h / P);
  return img;
}
