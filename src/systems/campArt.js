// The pixel art of the Base (no Phaser): a campfire camp on the battle floors' flagstones, with no wall (the top of
// the screen is the way deeper). Look numbers: data/camp.json.
// openFloor(...) -> the floor layer; darkLayer(...) -> the dark over it, see-through near the fire.
// lightTint(art, x, y) -> the tint for a prop standing at screen (x, y). fireLayers(art) -> the campfire's pixel layers.
// propLayer(def) -> a prop's rows as a layer. Layers: { w, h, ax, ay, pixels (0xrrggbb or -1), optional alpha }.
import { shade, mix, floorArtPixels } from './floorArt.js';

const num = (c) => (typeof c === 'number' ? c : Number(c));

// A small seeded random (the same seed always draws the same camp).
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

// The campfire light at an ART pixel: 0..1 in solid steps (rings, no dither).
function lightBand(L, x, y) {
  const d = Math.hypot(x - L.x, (y - L.y) * L.squash) / L.radius;
  return Math.ceil(Math.max(0, 1 - d) * L.steps) / L.steps;
}
// A colour lit by the fire: warmer near it, darker far away (down to `ambient`).
function lit(L, c, band) {
  const warm = mix(c, num(L.warm), L.warmShare * band);
  const k = L.ambient + (1 - L.ambient) * band;
  return mix(0, warm, k);
}

export function lightTint(art, x, y) {
  const P = art.pixel;
  return lit(art.light, 0xffffff, lightBand(art.light, x / P, y / P));
}

// The battle floors' flagstones with NO wall: a taller floor is drawn (wall on top) and the wall part cut off, so the
// top of the screen stays open floor (the way deeper). Returns a layer.
export function openFloor(floorArt, art, { width, height, tint }) {
  const R = art.room, cut = R.wallArt + R.cutBelow;
  const look = { ...floorArt, floor: { ...floorArt.floor, ...R.floor } }; // a tidier floor (less dirt and grass)
  const full = floorArtPixels(look, { width, height: height + cut, wallH: R.wallArt, tint, seed: R.seed });
  return { w: width, h: height, ax: 0, ay: 0, pixels: Int32Array.from(full.pixels.subarray(cut * width, (cut + height) * width)) };
}

// Firelight over a dungeon room (the same stone room as the battle floors): a dark layer, see-through near the fire.
export function darkLayer(art, { width, height }) {
  const L = art.light, pixels = new Int32Array(width * height).fill(0), alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    alpha[y * width + x] = (1 - L.ambient) * (1 - lightBand(L, x, y));
  }
  return { w: width, h: height, ax: 0, ay: 0, pixels, alpha };
}

// A prop's rows (camp.json props) as a layer, anchored at its bottom centre; `flip` mirrors it.
export function propLayer(def, flip = false) {
  const h = def.rows.length, w = def.rows[0].length;
  const pixels = new Int32Array(w * h).fill(-1);
  def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '.') pixels[y * w + (flip ? w - 1 - x : x)] = num(def.palette[Number(ch)]);
  }));
  return { w, h, ax: Math.floor(w / 2), ay: h, pixels };
}

// The campfire: the back of the stone ring with ash and logs, the flames (frames), the front stones, the glow.
// All anchored at the fire's centre on the ground.
export function fireLayers(art) {
  const Fi = art.fire, Pt = Fi.pit, Lg = Fi.logs, Fl = Fi.flame, G = Fi.glow;
  const rnd = seeded(art.room.seed + 1);
  const w = Pt.rx * 2 + 5, h = Pt.ry * 2 + 14, ax = Math.floor(w / 2), ay = h - Pt.ry - 3;
  const back = new Int32Array(w * h).fill(-1), front = new Int32Array(w * h).fill(-1);
  const put = (lay, x, y, c) => { const X = x + ax, Y = y + ay; if (X >= 0 && Y >= 0 && X < w && Y < h) lay[Y * w + X] = num(c); };
  // Ash bed with a few glowing embers.
  for (let y = -Pt.ry; y <= Pt.ry; y++) for (let x = -Pt.rx; x <= Pt.rx; x++) {
    if ((x / (Pt.rx - 1)) ** 2 + (y / (Pt.ry - 0.5)) ** 2 <= 1) put(back, x, y, rnd() < 0.15 ? shade(num(Pt.ash), 10) : Pt.ash);
  }
  for (let i = 0; i < Pt.embers; i++) put(back, Math.round((rnd() * 2 - 1) * (Pt.rx - 3)), Math.round((rnd() * 2 - 1) * (Pt.ry - 1)), Pt.ember);
  // Logs leaning together (a small teepee): thick lines, lit on the left.
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      put(back, x - 1, y, Lg.light); put(back, x, y, Lg.mid); put(back, x + 1, y, Lg.dark);
    }
    put(back, x0, y0, Lg.end);
  };
  const k = Pt.rx / 10, L = (a, b, c, d) => line(Math.round(a * k), b, Math.round(c * k), Math.round(d * k));
  L(-7, 1, -1, -7); L(7, 1, 1, -7); L(-2, 2, 0, -8); L(3, 2, 0, -8);
  // Stones round the ring: the back half behind the flames, the front half in front of them.
  for (let i = 0; i < Pt.stones; i++) {
    const a = (i / Pt.stones) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * Pt.rx), y = Math.round(Math.sin(a) * Pt.ry);
    const lay = y > 0 ? front : back, big = y > 0 ? 1 : 0;
    for (let j = 0; j <= 1 + big; j++) for (let k = -1; k <= 1 + big; k++) {
      put(lay, x + k, y + j - 1, j === 0 ? Pt.stoneLight : j === 1 + big || k === 1 + big ? Pt.stoneDark : Pt.stone);
    }
  }
  const layer = (pixels) => ({ w, h, ax, ay, pixels });

  // Flames: each frame a fresh flicker of the same shape (taller in the middle), red tips, yellow inside, pale core.
  const fr = seeded(Fl.seed), fc = (Fl.w - 1) / 2;
  const flames = [];
  for (let f = 0; f < Fl.frames; f++) {
    const pixels = new Int32Array(Fl.w * Fl.h).fill(-1);
    for (let x = 0; x < Fl.w; x++) {
      const e = Math.abs(x - fc) / (fc + 1);
      const top = Math.max(0, Math.round(Fl.h * (1 - e) ** 0.9 + (fr() * 2 - 1) * 2.2 * (1 - e * 0.5)));
      for (let k = 0; k < Math.min(top, Fl.h); k++) {
        const y = Fl.h - 1 - k, t = k / Math.max(1, top);
        if (k === 0 && e > 0.8) continue; // round the bottom corners
        let c = Fl.colors.o;
        if (t < 0.65 && e < 0.7) c = Fl.colors.y;
        if (t < 0.35 && e < 0.35) c = Fl.colors.Y;
        if (k === top - 1 && top > 4 && fr() < 0.6) c = Fl.colors.r;
        pixels[y * Fl.w + x] = num(c);
      }
    }
    // Now and then a lick of flame broken off above.
    if (fr() < 0.7) pixels[Math.floor(fr() * 3) * Fl.w + Math.round(fc + (fr() * 2 - 1) * 3)] = num(Fl.colors.r);
    flames.push({ w: Fl.w, h: Fl.h, ax: Math.floor(Fl.w / 2), ay: Fl.h - 1, pixels });
  }

  // The glow: a few solid rings of warm light (like the torches), lying flat on the floor.
  const r = G.radius, gw = r * 2 + 1, gh = Math.ceil(gw / G.squash);
  const gp = new Int32Array(gw * gh).fill(-1), ga = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const d = Math.hypot(x - r, (y - gh / 2) * G.squash) / r;
    if (d >= 1) continue;
    gp[y * gw + x] = num(G.color);
    ga[y * gw + x] = (G.alpha * (Math.floor((1 - d) * G.steps) + 1)) / G.steps;
  }
  return { back: layer(back), front: layer(front), flames, glow: { w: gw, h: gh, ax: r, ay: Math.floor(gh / 2), pixels: gp, alpha: ga } };
}
