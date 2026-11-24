// Makes (once) the pixel-art texture of a floor (systems/floorArt.js) and returns its key. Draw it with
// scene.add.image(0, 0, key).setOrigin(0).setScale(floorArt.pixel). One texture per tile colour and variant.
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import floorArt from '../data/floorArt.json';
import { floorArtPixels } from '../systems/floorArt.js';

export const FLOOR_PIXEL = floorArt.pixel;

// CLOSE-UP (session 55, user: the squad screen is a close-up view): the same floor drawn with bigger pixels (`pixel`
// screen px per art px). Pillars and torches are moved so they stay at the same screen spot; no props (user).
export function floorArtAt(pixel) {
  if (pixel === floorArt.pixel) return floorArt;
  const k = floorArt.pixel / pixel, at = (v) => Math.round(v * k);
  const D = floorArt.decor;
  return { ...floorArt, pillars: { ...floorArt.pillars, x: floorArt.pillars.x.map(at) }, torchPillars: floorArt.torchPillars.map(at),
    decor: { ...D, props: null } }; // no barrels / crates on the squad screen (user)
}

export function floorTextureKey(scene, tint, variant, wallH, pixel = floorArt.pixel) {
  const art = floorArtAt(pixel);
  const key = `floorArt-${tint}-${variant}${pixel === floorArt.pixel ? '' : `-x${pixel}`}`;
  if (scene.textures.exists(key)) return key;
  const width = Math.ceil(GAME_WIDTH / pixel);
  const height = Math.ceil(GAME_HEIGHT / pixel);
  const seed = (Number(tint) ^ Math.imul(variant + 1, 2654435761)) >>> 0;
  const { pixels } = floorArtPixels(art, { width, height, wallH: Math.round(wallH / pixel), tint, seed });
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
