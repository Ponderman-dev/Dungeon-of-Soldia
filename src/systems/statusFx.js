// Status effects that loop ON a fighter while a status lasts (stun stars, ice, snow, sparks, flames,
// bubbles, drops, brackets...). EVERY status plays its own effect at the same time (user's choice).
// Ported from the effects proposal page (docs/proposals/fx-effects.js, "Statuses").
// No Phaser here: `statusLook()` returns what to draw, in CHARACTER pixels around the fighter's feet
// (x = 0 is the body's middle, y = 0 the feet, up is negative). The scene multiplies by CHAR_SCALE.
import { partArt, artSize } from './pixelArt.js';
import { NO_TUNE } from './fxTune.js';

const C = {
  white: 0xffffff, gold: 0xf2c544, gold2: 0xfff7c0, ice: 0x9fe0ff, ice2: 0xbfefff, elec: 0xffe94d,
  dark: 0xb07cff, dark2: 0x5a2d8a, fire: 0xff9a2e, fire2: 0xffe066, blood: 0xd9452b, blood2: 0x8e2a2a,
  poison: 0x6de07a, heal: 0x6dff8f, shield: 0x6fd0ff, grey: 0xc8ccd6, grey2: 0x8c909c, smoke: 0x333333,
  smoke2: 0x4a4a5a, mark: 0xff3d6e, red: 0xff4a4a, brown: 0x9a6b3a, bone: 0xebe5cf, petal: 0xf6a8c8,
  holy: 0xffe08a, outline: 0x1a1020,
};
export const FX_COLORS = C;

// Same little random numbers as the proposal page (fixed per seed, so effects do not flicker randomly).
export const rnd = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);

// A pen that collects pixels: [x, y, w, h, colour, alpha]. Also used by hitFx.js.
export function pen() {
  const out = [];
  const g = { out };
  g.px = (x, y, c, a = 1) => { if (a > 0) out.push([Math.round(x), Math.round(y), 1, 1, c, Math.min(1, a)]); };
  g.rect = (x, y, w, h, c, a = 1) => { if (a > 0) out.push([Math.round(x), Math.round(y), w, h, c, Math.min(1, a)]); };
  g.line = (x0, y0, x1, y1, c, a = 1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let i = 0; i < 100; i++) {
      g.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  g.disc = (cx, cy, r, c, a = 1) => { for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) if ((x * x + y * y) / (r * r + 0.6) <= 1) g.px(cx + x, cy + y, c, a); };
  g.ring = (cx, cy, r, c, a = 1, ry = r) => {
    if (r < 0.5) return g.px(cx, cy, c, a);
    const n = Math.max(8, Math.round(r * 7)); const seen = new Set();
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2; const x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * ry);
      if (!seen.has(x + ',' + y)) { seen.add(x + ',' + y); g.px(x, y, c, a); }
    }
  };
  return g;
}

// Four L-shaped corner brackets around the body, pulled out by `pad`.
function brackets(g, u, pad, col) {
  const x0 = Math.round(-u.hw - pad), x1 = Math.round(u.hw + pad), y0 = Math.round(u.top - pad), y1 = Math.round(u.bot + pad);
  for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) for (let k = 0; k < 3; k++) { g.px(cx + dx * k, cy, col); g.px(cx, cy + dy * k, col); }
}
// A flame tuft standing on (x, y), h tall, flickering.
function flame(g, x, y, h, t, seed) {
  for (let j = 0; j < h; j++) {
    const w = j < h * 0.4 ? 1 : 0; const sway = Math.round(Math.sin(t / 90 + seed + j) * (j / h));
    for (let k = -w; k <= w; k++) g.px(x + k + sway, y - j, j >= h - 1 ? C.white : j > h * 0.5 ? C.fire2 : C.fire, 0.95);
  }
}
// Ice crystals sticking out of the body (top and upper sides), `grow` 0..1.
function crystals(g, u, grow) {
  const H = u.bot - u.top;
  const spots = [[0, u.top, 0, -1, 4], [-u.hw, u.top + H * 0.3, -1, -0.6, 3], [u.hw, u.top + H * 0.3, 1, -0.6, 3], [-u.hw, u.mid, -1, -0.15, 3], [u.hw, u.mid, 1, -0.15, 3]];
  for (const [x, y, dx, dy, n] of spots) {
    const d = Math.hypot(dx, dy); const len = Math.round(n * grow);
    for (let k = 1; k <= len; k++) g.px(x + (dx / d) * k, y + (dy / d) * k, k === len ? C.white : C.ice2);
  }
}
// The 3x5 "!" drawn s times bigger with a dark outline, its middle at x, its top at y.
function bang(g, x, y, s, col) {
  const cells = [[1, 0], [1, 1], [1, 2], [1, 4]];
  const left = Math.round(x - (3 * s) / 2);
  for (const [cx, cy] of cells) g.rect(left + cx * s - 1, y + cy * s - 1, s + 2, s + 2, C.outline);
  for (const [cx, cy] of cells) g.rect(left + cx * s, y + cy * s, s, s, col);
}

// ---- one recipe per status: (g, u, t, s) with s = { stacks, age } -------------------------------
const LOOPS = {
  stun(g, u, t) { // stars circle round the head (just above it sit the bar and the icons)
    for (let i = 0; i < 3; i++) {
      const a = t / 300 + (i * Math.PI * 2) / 3; const x = Math.cos(a) * (u.hw + 2), y = u.top + 1 + Math.sin(a) * 2; const al = Math.sin(a) > 0 ? 1 : 0.55;
      g.px(x, y, C.white, al); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + dx, y + dy, C.gold, al);
    }
  },
  freeze(g, u, t, s) {
    const form = ph(s.age, 0, 600);
    for (let x = -9; x <= 9; x++) if (Math.abs(x) < 9 * form) g.px(x, 0, Math.abs(x) % 3 ? C.ice : C.white, 0.7); // frost on the floor
    if (form > 0.6) crystals(g, u, form >= 1 ? 1 : (form - 0.6) / 0.4);
  },
  chill(g, u, t, s) {
    const n = Math.min(5, s.stacks);
    for (let i = 0; i < 3 + n; i++) g.px((rnd(i) - 0.5) * 16 + Math.sin(t / 300 + i) * 2, u.top - 8 + ((t / 18 + i * 13) % 24), C.white, 0.8);
  },
  shock(g, u, t) {
    for (let i = 0; i < 3; i++) {
      const k = Math.floor(t / 110) * 3 + i;
      if (rnd(k) < 0.7) { const x = (rnd(k + 1) - 0.5) * u.hw * 2.4, y = u.top + rnd(k + 2) * (u.bot - u.top); g.line(x, y, x + 2, y + 1, C.elec); g.line(x + 2, y + 1, x + 1, y + 3, C.white); }
    }
  },
  fear(g, u, t) {
    const H = Math.max(1, u.bot - u.top);
    for (let i = 0; i < 4; i++) { const k = (t / 30 + i * 4) % H; g.px(-u.hw - 3, u.bot - k, C.dark, 0.7); g.px(u.hw + 3, u.bot - ((k + H / 2) % H), C.dark, 0.7); }
    const d = (t % 800) / 800; g.px(-2, u.top + d * 6, C.ice, 1 - d); g.px(-2, u.top + 1 + d * 6, C.white, 1 - d); // sweat drop
  },
  taunt(g, u, t) { bang(g, u.hw + 4, Math.round(u.top - 1 + Math.sin(t / 150)), 2, C.red); }, // beside the head
  silence(g, u, t) {
    const y = Math.round(u.top - 2 + Math.sin(t / 250)), x = Math.round(-u.hw - 5); // a padlock beside the head
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.3) g.px(x + Math.cos(a) * 2.5, y + 2 + Math.sin(a) * 2.5, C.grey);
    g.rect(x - 3, y + 2, 7, 5, C.grey2); g.rect(x - 3, y + 2, 7, 1, C.grey); g.px(x, y + 4, C.outline); g.px(x, y + 5, C.outline);
  },
  weaken(g, u, t) { for (let i = 0; i < 6; i++) { const q = (t / 1600 + i / 6) % 1; g.px((rnd(i) - 0.5) * u.hw * 2.6, u.top + q * (-u.top + 3), C.brown, 1 - q); } },
  armorBreak(g, u, t) {
    for (let i = 0; i < 4; i++) {
      const q = (t / 1400 + i / 4) % 1; const side = i % 2 ? 1 : -1;
      const x = side * (u.hw + q * 6), y = u.mid - 3 + i + q * q * (-u.mid + 3);
      g.rect(x, y, 2, 1, C.grey, 1 - q); g.px(x, y + 1, C.grey2, 1 - q);
    }
    const a = 0.5 + 0.4 * Math.sin(t / 200);
    g.line(-2, u.mid - 4, 0, u.mid - 1, C.white, a); g.line(0, u.mid - 1, -1, u.mid + 2, C.white, a); g.line(0, u.mid - 1, 2, u.mid, C.white, a);
  },
  curse(g, u, t) {
    for (let k = 6; k >= 0; k--) {
      const a = (t - k * 45) / 330; const x = Math.cos(a) * (u.hw + 6), y = u.mid + Math.sin(a) * 4 - 2;
      if (k === 0) { g.rect(x - 2, y - 2, 5, 4, C.bone); g.rect(x - 1, y + 2, 3, 1, C.bone); g.px(x - 1, y - 1, C.dark2); g.px(x + 1, y - 1, C.dark2); }
      else g.px(x, y, C.dark, 1 - k / 7);
    }
  },
  blind(g, u, t) { for (let i = 0; i < 6; i++) g.disc(-8 + i * 3.2 + Math.sin(t / 200 + i) * 1.2, u.top + 3 + Math.cos(t / 250 + i), 2, i % 2 ? C.smoke : C.smoke2, 0.9); },
  mark(g, u, t) { brackets(g, u, 3 + Math.round(Math.sin(t / 220) + 1), C.mark); g.px(0, u.mid, C.mark, 0.5 + 0.5 * Math.sin(t / 100)); },
  bleed(g, u, t, s) {
    const n = Math.min(6, 2 + s.stacks); // more stacks = more drops
    for (let i = 0; i < n; i++) {
      const q = (t / 700 + i / n) % 1; const x = Math.round((i - (n - 1) / 2) * 3); const y = u.mid + q * -u.mid;
      g.px(x, y, C.blood); g.px(x, y + 1, C.blood2);
      if (q > 0.9) { g.px(x - 1, 0, C.blood, 0.7); g.px(x + 1, 0, C.blood, 0.7); }
    }
  },
  burn(g, u, t) {
    [[-4, 0.55], [0, 0.85], [4, 0.6], [-2, 0.25], [3, 0.35]].forEach(([dx, f], i) => flame(g, dx, Math.round(u.top + f * (u.bot - u.top)), 3 + Math.round((Math.sin(t / 80 + i * 2) + 1) * 1.5), t, i));
    for (let i = 0; i < 4; i++) { const q = (t / 900 + i / 4) % 1; g.px((rnd(i) - 0.5) * 12 + Math.sin(t / 150 + i) * 2, u.top - q * 10, C.fire2, 1 - q); }
  },
  poison(g, u, t) {
    for (let i = 0; i < 5; i++) {
      const q = (t / 1200 + i / 5) % 1; const x = (rnd(i * 5) - 0.5) * u.hw * 2.4, y = u.mid - q * 16;
      if (q < 0.85) g.ring(x, y, 1 + (i % 2), C.poison, 0.9);
      else { const p = (q - 0.85) / 0.15; for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.6; g.px(x + Math.cos(a) * 3 * p, y + Math.sin(a) * 3 * p, C.poison, 1 - p); } }
    }
  },
  buff(g, u, t) { for (let i = 0; i < 6; i++) { const q = (t / 1400 + i / 6) % 1; const a = q * Math.PI * 4 + i; g.px(Math.cos(a) * (u.hw + 4), -2 - q * 26, i % 2 ? C.gold : C.gold2, 1 - q); } },
  regenBoost(g, u, t) {
    for (let i = 0; i < 3; i++) { const q = (t / 1600 + i / 3) % 1; const x = (i - 1) * 6, y = -4 - q * 22; for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + a, y + b, C.heal, 1 - q); }
  },
  shield(g, u, t) {
    const R = u.hw + 7, RY = (u.bot - u.top) / 2 + 4; g.ring(0, u.mid, R, C.shield, 0.45, RY);
    const a = t / 300; for (let k = 0; k < 5; k++) g.px(Math.cos(a - k * 0.12) * R, u.mid + Math.sin(a - k * 0.12) * RY, C.white, 1 - k / 5);
  },
  invulnerable(g, u, t) {
    const R = Math.round(u.hw + 4);
    for (let y = Math.round(u.top - 6); y <= 0; y++) { const a = 0.35 + 0.35 * Math.sin(t / 120 + y * 0.4); g.px(-R, y, C.holy, a); g.px(R, y, C.holy, a); }
    for (let i = 0; i < 5; i++) { const q = (t / 1200 + i / 5) % 1; g.px((rnd(i) - 0.5) * R * 1.6, -q * (-u.top + 8), C.gold2, 1 - q); }
  },
  parry(g, u, t) {
    for (let i = 0; i < 6; i++) {
      const q = (t / 2000 + i / 6) % 1; const x = 16 - q * 32, y = u.top - 4 + q * -u.top + Math.sin(t / 200 + i) * 2; const a = Math.sin(q * Math.PI);
      g.rect(x, y, 2, 1, C.petal, a); g.px(x + 1, y + 1, C.petal, a * 0.7);
    }
  },
};
export const LOOPING = Object.keys(LOOPS);

// Body colour per status (the whole sprite is mixed towards it). The first one in this list that the
// fighter has wins. Pulsing ones change with time; amounts are rounded to steps of 0.05 (textures are cached).
const TINTS = [
  ['fear', () => [C.dark2, 0.25]],
  ['invulnerable', (t) => [C.holy, 0.3 + 0.2 * Math.sin(t / 150)]],
  ['poison', (t) => [C.poison, t % 1000 < 160 ? 0.45 : 0.15]],
  ['burn', () => [C.fire, 0.2]],
  ['weaken', () => [0x6f6890, 0.45]],
  ['curse', () => [C.dark2, 0.2]],
  ['chill', (t, s) => [C.ice, 0.1 * Math.min(5, s.stacks)]],
  ['parry', () => [0xffd27a, 0.2]],
  ['buff', (t) => [C.gold, t % 1000 < 150 ? 0.35 : 0.08]],
];

// Everything a fighter's statuses look like right now.
//   kinds: { [statusType]: { stacks, age } } (age = ms since the newest one began)
//   u: the body in character pixels around the feet: { hw, top, mid, bot } (top/mid/bot are negative)
//   t: a clock in ms (keeps loops running)
// Returns { draws: [[x, y, w, h, colour, alpha]], tint: [colour, amount] | null, ice: 0..1, dx }
//   ice = how far up the body the sprite has turned to ice (Freeze), dx = a small shake in pixels.
//   tune: effect settings from the Studio (systems/fxTune.js): each status its own speed and colour swaps.
export function statusLook(kinds, u, t, tune = NO_TUNE) {
  const g = pen();
  let out = [];
  for (const k of LOOPING) {
    if (!kinds[k]) continue;
    g.out.length = 0;
    LOOPS[k](g, u, t * tune.speed('status', k), kinds[k]);
    out = out.concat(tune.paint('status', k, g.out));
  }
  let tint = null;
  for (const [k, fn] of TINTS) {
    if (!kinds[k]) continue;
    const [c, a] = fn(t * tune.speed('status', k), kinds[k]);
    tint = [tune.color('status', k, c), Math.round(clamp(a) * 20) / 20];
    break;
  }
  if (kinds.shock && Math.floor(t / 90) % 5 === 0) tint = [C.white, 0.4]; // the shock twitch flashes
  const ice = kinds.freeze ? Math.ceil(easeOut(ph(kinds.freeze.age, 0, 600)) * 4) / 4 : 0;
  let dx = 0;
  if (kinds.shock && Math.floor(t / 90) % 5 === 0) dx = 1;
  if (kinds.fear) dx += Math.floor(t / 50) % 2;
  if (ice > 0) dx = 0;
  return { draws: out, tint: ice > 0 ? null : tint, ice, dx };
}

// The ice breaking off when a Freeze ends: p = 0..1 over ~0.4s.
export function iceBreak(u, p) {
  const g = pen();
  if (p > 0 && p < 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd(i); const r = 4 + easeOut(p) * 12;
      g.rect(Math.cos(a) * r, u.mid + Math.sin(a) * r * 0.8 + p * p * 10, 2, 1, i % 2 ? C.white : C.ice, 1 - p);
    }
  }
  return g.out;
}

// Turns one pixel colour to ice (Freeze): light parts become pale ice, darker parts deeper blue,
// the dark outline becomes a bright rim.
export function iceColor(c) {
  if (c === C.outline) return 0xe8fbff;
  const r = (c >> 16) & 255, gr = (c >> 8) & 255, b = c & 255;
  const lum = (r * 0.3 + gr * 0.59 + b * 0.11) / 255;
  return lum > 0.6 ? 0xdff6ff : lum > 0.35 ? 0x9fe0ff : 0x5aaee0;
}

// The body box of a character def (weapon left out), in character pixels around the feet:
// { cx (the body's middle, sideways), hw (half its width), top, mid, bot }.
export function bodyBox(parts, height) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [name, p] of Object.entries(parts || {})) {
    if (name === 'weapon') continue;
    const { w, h } = artSize(partArt(p));
    x0 = Math.min(x0, p.x - w / 2); x1 = Math.max(x1, p.x + w / 2);
    y0 = Math.min(y0, p.y - h / 2); y1 = Math.max(y1, p.y + h / 2);
  }
  if (!isFinite(x0)) { x0 = -6; x1 = 6; y0 = -(height || 20); y1 = 0; }
  return { cx: (x0 + x1) / 2, hw: Math.max(3, (x1 - x0) / 2), top: y0, bot: y1, mid: (y0 + y1) / 2 };
}
