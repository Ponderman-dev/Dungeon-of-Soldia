// The title screen's pixel art (no Phaser): a night sky with a full moon and drifting clouds over a thick forest seen
// from above, with the dungeon tower far away. Look numbers: data/title.json.
// Every function returns a layer { w, h, ax, ay, pixels (0xrrggbb or -1), optional alpha } (see entities/pixelLayer.js).
import { shade } from './floorArt.js';

const num = (c) => (typeof c === 'number' ? c : Number(c));

// A small seeded random (the same seed always draws the same picture).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Solid rings of soft light (no dither), brighter towards the middle.
function rings(r, steps, alpha, color, squash = 1) {
  const w = r * 2 + 1, h = Math.ceil(w / squash);
  const pixels = new Int32Array(w * h).fill(-1), a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - r, (y - h / 2) * squash) / r;
    if (d >= 1) continue;
    pixels[y * w + x] = num(color);
    a[y * w + x] = (alpha * (Math.floor((1 - d) * steps) + 1)) / steps;
  }
  return { w, h, ax: r, ay: Math.floor(h / 2), pixels, alpha: a };
}

// The sky: colour bands from the top down to the horizon, and dim fixed stars.
export function skyLayer(T, { width, height }) {
  const rnd = seeded(T.seed);
  const S = T.sky, pixels = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    const band = Math.min(S.colors.length - 1, Math.floor((y / S.horizon) * S.colors.length));
    for (let x = 0; x < width; x++) pixels[y * width + x] = num(S.colors[band]);
  }
  for (let i = 0; i < T.stars.count; i++) {
    const x = Math.floor(rnd() * width), y = Math.floor(rnd() * T.stars.maxY);
    pixels[y * width + x] = num(T.stars.colors[Math.floor(rnd() * T.stars.colors.length)]);
  }
  return { w: width, h: height, ax: 0, ay: 0, pixels };
}

// Where the twinkling stars go (art px), away from the moon.
export function twinkleSpots(T, width) {
  const rnd = seeded(T.seed + 7), M = T.moon, out = [];
  while (out.length < T.twinkle.count) {
    const x = Math.floor(rnd() * width), y = Math.floor(rnd() * T.twinkle.maxY);
    if (Math.hypot(x - M.x, y - M.y) > M.glow.r) out.push({ x, y, big: rnd() < 0.3 });
  }
  return out;
}

// The full moon: lit edge on the upper left, a shaded lower right, a few craters; and its glow.
export function moonLayers(T) {
  const M = T.moon, C = M.colors, r = M.r, w = r * 2 + 1;
  const pixels = new Int32Array(w * w).fill(-1);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = x - r, dy = y - r, d = Math.hypot(dx, dy) / (r + 0.5);
    if (d > 1) continue;
    let c = num(C.base);
    if (d > 0.82 && dx + dy < 0) c = num(C.rim);
    else if (dx + dy > r * 0.9) c = num(C.shade);
    pixels[y * w + x] = c;
  }
  const k = r / 12; // craters were drawn for a moon of radius 12
  for (const [cx, cy, cr] of M.craters.map(([a, b, c]) => [Math.round(a * k), Math.round(b * k), Math.max(1, Math.round(c * k))])) for (let y = -cr; y <= cr; y++) for (let x = -cr; x <= cr; x++) {
    if (Math.hypot(x, y) > cr + 0.2) continue;
    const i = (cy + y + r) * w + (cx + x + r);
    if (pixels[i] >= 0) pixels[i] = x + y < 0 ? num(C.crater) : shade(num(C.crater), 14);
  }
  return { moon: { w, h: w, ax: r, ay: r, pixels }, glow: rings(M.glow.r, M.glow.steps, M.glow.alpha, M.glow.color) };
}

// A cloud: a few puffs on a flat bottom, moonlit on top, darker underneath.
export function cloudLayer(T, cl, seed) {
  const K = T.clouds;
  const rnd = seeded(seed), w = cl.w, h = cl.h;
  const puffs = [];
  for (let i = 0, n = Math.max(3, Math.round(w / 5)); i < n; i++) {
    const t = (i + 0.5) / n;
    puffs.push({ x: t * w, r: h * (0.3 + 0.7 * Math.sin(t * Math.PI)) * (0.55 + rnd() * 0.5) });
  }
  const inside = (x, y) => y < h && puffs.some((p) => Math.hypot(x - p.x, (y - h) * 1.1) <= p.r + 1);
  const pixels = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const top = !inside(x + 0.5, y - 0.5);
    pixels[y * w + x] = num(top ? K.light : y >= h - 2 ? K.dark : K.body);
  }
  return { w, h, ax: 0, ay: 0, pixels };
}

// The forest seen from above: a thick roof of round tree tops from the horizon down to the bottom of the screen,
// small and hazy far away, big and dark up close. Each top is a cluster of round lumps, lit on the moon's side,
// with a dark edge where it overlaps the trees behind. Far mountains and a band of mist sit on the horizon, and a
// lone dungeon tower pokes out of the trees far away. Returns { layer, tower: { x, y } (art px, tower door) }.
export function canopyLayer(T, { width, height }) {
  const K = T.canopy, rnd = seeded(T.seed + 101), mixc = (a, b, t) => {
    const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const pixels = new Int32Array(width * height).fill(-1);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = c; };
  const get = (x, y) => pixels[y * width + x];
  // Far mountains: a soft ridge line above the horizon.
  const Mo = K.mountains;
  for (let x = 0; x < width; x++) {
    const top = Math.round(K.horizon - Mo.h * (0.55 + 0.45 * Math.sin(x * Mo.freq + 1.7) * Math.sin(x * Mo.freq * 0.47 + 0.4)));
    for (let y = top; y < height; y++) set(x, y, num(y === top ? Mo.rim : Mo.color));
  }
  for (let y = K.horizon; y < height; y++) for (let x = 0; x < width; x++) set(x, y, num(K.ground));
  const C = K.colors, haze = num(K.haze);
  const tints = K.tints.map(num);
  const lx = -0.55, ly = -0.85; // light from the upper right: (dx, dy) toward the moon is lit
  const tw = K.tower;
  let towerDrawn = false;
  const drawTower = () => {
    // A thin stone tower on a rock, a pointed roof, two lit windows; its outline lit on the moon side.
    const x0 = tw.x - Math.floor(tw.w / 2), base = tw.base;
    for (let y = base - tw.h; y < base + 3; y++) for (let x = x0; x < x0 + tw.w; x++) {
      const edgeR = x === x0 + tw.w - 1, edgeL = x === x0;
      set(x, y, num(edgeR ? tw.lit : edgeL ? tw.dark : (base - y) % 3 === 0 ? tw.mortar : tw.stone));
    }
    for (let k = 1; k <= tw.roofH; k++) {
      const half = Math.floor(((tw.roofH - k) / tw.roofH) * (tw.w / 2 + 1));
      for (let x = tw.x - half - 1; x <= tw.x + half + 1 - (tw.w % 2 ? 0 : 1); x++) set(x, base - tw.h - k, num(x >= tw.x ? tw.roofLit : tw.roof));
    }
    for (const wy of tw.windows) { set(tw.x, base - wy, num(tw.warmBright)); set(tw.x, base - wy + 1, num(tw.warm)); }
    towerDrawn = true;
  };
  // Rows of tree tops, far to near.
  let y = K.horizon + 1;
  while (y < height + K.rMax) {
    const t = Math.min(1, (y - K.horizon) / (height - K.horizon)); // 0 far .. 1 near
    if (!towerDrawn && y >= tw.base + tw.behind) drawTower();
    const r = K.rMin + (K.rMax - K.rMin) * t ** K.growth;
    for (let x = -rnd() * r; x < width + r; x += r * K.spacing * (0.8 + rnd() * 0.4)) {
      if (rnd() < K.holes * (1 - t)) continue;
      const rr = r * (0.75 + rnd() * 0.5), cx = x, cy = y + (rnd() - 0.5) * r * 0.4;
      const tint = tints[Math.floor(rnd() * tints.length)];
      const pal = [C.shadow, C.mid, C.lit, C.highlight].map((c) => mixc(mixc(num(c), tint, K.tintShare), haze, K.hazeFar * (1 - t) ** 1.4));
      const lumps = [{ x: 0, y: 0, r: rr }];
      for (let i = 0, n = rr < 4 ? 0 : 2 + Math.floor(rnd() * 3); i < n; i++) {
        const ang = Math.PI * (0.15 + rnd() * 0.7);
        lumps.push({ x: Math.cos(ang) * rr * 0.55, y: -Math.sin(ang) * rr * 0.45, r: rr * (0.45 + rnd() * 0.2) });
      }
      const inLump = (px, py) => {
        for (let i = lumps.length - 1; i >= 0; i--) {
          const L = lumps[i];
          if (Math.hypot(px - L.x, (py - L.y) * 1.1) <= L.r) return i;
        }
        return -1;
      };
      const span = Math.ceil(rr * 1.5);
      // Its shadow on whatever is behind and below it (down-left), so every tree top stands apart.
      const sh = Math.max(1, Math.round(rr * K.shadowDrop));
      for (let py = -span; py <= span; py++) for (let px = -span; px <= span; px++) {
        if (inLump(px + 0.5 + sh, py + 0.5 - sh) < 0) continue;
        const X = Math.round(cx + px), Y = Math.round(cy + py);
        if (X >= 0 && Y >= 0 && X < width && Y < height && get(X, Y) >= 0) set(X, Y, mixc(get(X, Y), 0, K.shadowAlpha));
      }
      // Round shading: each lump is a little dome lit from the moon's side and from above.
      const Lx = K.light[0], Ly = K.light[1], Lz = K.light[2];
      for (let py = -span; py <= span; py++) for (let px = -span; px <= span; px++) {
        const i = inLump(px + 0.5, py + 0.5);
        if (i < 0) continue;
        const L = lumps[i];
        const nx = (px + 0.5 - L.x) / L.r, ny = (py + 0.5 - L.y) / L.r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lit = nx * Lx + ny * Ly + nz * Lz;
        let band = lit > K.bands[2] ? 3 : lit > K.bands[1] ? 2 : lit > K.bands[0] ? 1 : 0;
        if (inLump(px + 0.5, py + 1.5) < 0) band = 0; // dark lower edge
        set(Math.round(cx + px), Math.round(cy + py), pal[band]);
      }
    }
    y += Math.max(1, r * K.rowGap);
  }
  // Mist lying on the far trees.
  const Mi = K.mist;
  for (let y2 = K.horizon; y2 < K.horizon + Mi.h; y2++) for (let x = 0; x < width; x++) {
    const a = Mi.alpha * (1 - (y2 - K.horizon) / Mi.h);
    const c = get(x, y2);
    if (c >= 0) set(x, y2, mixc(c, num(Mi.color), a));
  }
  return { layer: { w: width, h: height, ax: 0, ay: 0, pixels }, tower: { x: tw.x, y: tw.base - tw.windows[0] } };
}
