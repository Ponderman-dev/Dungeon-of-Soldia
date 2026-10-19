// A wall torch as pixel art (no Phaser): the iron bracket and wooden handle, a flame in a few frames (it flickers by
// switching frames) and a warm glow on the wall (a few solid rings). Colours / sizes: floorArt.json `torch`.
// Each layer: { w, h, ax, ay, pixels } with (ax, ay) = the top of the handle; pixels = 0xrrggbb or -1, glow also alpha.
const num = (c) => (typeof c === 'number' ? c : Number(c));

function grid(rows, colors, ax, ay) {
  const h = rows.length, w = rows[0].length;
  const pixels = new Int32Array(w * h).fill(-1);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') pixels[y * w + x] = num(colors[ch]); }));
  return { w, h, ax, ay, pixels };
}

export function torchLayers(T) {
  const col = T.colors;
  const holder = grid(T.holder, col, Math.floor(T.holder[0].length / 2), 0);
  const flames = T.flames.map((f) => grid(f, col, Math.floor(f[0].length / 2), f.length));
  // The glow: a few solid rings of warm light (no dither), each step a little brighter towards the flame.
  const r = T.glowRadius, w = r * 2 + 1;
  const pixels = new Int32Array(w * w).fill(-1), alpha = new Float32Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - r, (y - r) * 1.15) / r;
    if (d >= 1) continue;
    pixels[y * w + x] = num(col.glow);
    alpha[y * w + x] = T.glowAlpha * (Math.floor((1 - d) * T.glowSteps) + 1) / T.glowSteps;
  }
  return { holder, flames, glow: { w, h: w, ax: r, ay: r + T.glowDrop, pixels, alpha } };
}
