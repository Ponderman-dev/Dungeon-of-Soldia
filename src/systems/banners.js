// Profile banners (no Phaser): built-in banners are crops of the title screen's night forest (systems/titleArt.js):
// sky + moon glow + moon + forest, cut out at a banner's `crop` [x, y] (title art px). Data: profile.json banners.
// Returns a layer { w, h, ax, ay, pixels } for entities/pixelLayer.js.
import { skyLayer, moonLayers, canopyLayer } from './titleArt.js';

const cache = new Map();
function scene(T, width, height) {
  const key = `${width}x${height}`;
  if (!cache.has(key)) cache.set(key, { sky: skyLayer(T, { width, height }), moon: moonLayers(T), forest: canopyLayer(T, { width, height }).layer });
  return cache.get(key);
}

const mix = (a, b, t) => {
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// The banner picture: `w` x `h` title art px. width / height = the title screen's size in art px.
export function bannerLayer(T, banner, { w, h, width, height }) {
  const S = scene(T, width, height), [cx, cy] = banner.crop, M = T.moon;
  const pixels = new Int32Array(w * h);
  // Paints layer `lay` (anchor at sx, sy in title art px) over the banner; soft alpha is blended in.
  const paint = (lay, sx, sy) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const lx = cx + x - sx + lay.ax, ly = cy + y - sy + lay.ay;
      if (lx < 0 || ly < 0 || lx >= lay.w || ly >= lay.h) continue;
      const i = ly * lay.w + lx, c = lay.pixels[i];
      if (c < 0) continue;
      const a = lay.alpha ? lay.alpha[i] : 1;
      pixels[y * w + x] = a >= 1 ? c : mix(pixels[y * w + x], c, a);
    }
  };
  paint(S.sky, 0, 0);
  paint(S.moon.glow, M.x, M.y);
  paint(S.moon.moon, M.x, M.y);
  paint(S.forest, 0, 0);
  return { w, h, ax: 0, ay: 0, pixels };
}
