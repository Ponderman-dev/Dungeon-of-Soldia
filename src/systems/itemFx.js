// Item effects (user's choice: the FULL version, each item its own effect, AND the item's icon pops over the
// holder; which item plays which effect is in src/data/itemFx.json). Ported from the effects proposal page
// (docs/proposals/fx-effects.js, "Item procs"). No Phaser here: character pixels (world / CHAR_SCALE).
//   q = 0..1 over the effect's time in ITEM_MS. Points are { x, y }; a body u = { x, y (feet), top, mid, bot, hw }.
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const fly = (a, b, p, arc = 0) => [a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p - Math.sin(p * Math.PI) * arc];
const BOMB = 0x4a4a5a, KNIFE = 0xe4e8f0, HILT = 0x6b4a2a, BANNER = 0xf2d03a, GREEN = 0x3aa84a, GREEN2 = 0xc8ffd0;

export const ITEM_MS = { bomb: 800, lightning: 320, greenfire: 700, battleCry: 800, shatter: 600, knifeBurst: 450, plague: 600, thunderbolt: 560, aegisBlast: 400, thorns: 320, lifesteal: 520 };
export const ITEM_FX = Object.keys(ITEM_MS);

function burst(g, x, y, n, cols, p, dist = 12, seed = 1, grav = 0) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.6; const d = dist * easeOut(p) * (0.5 + rnd(seed + i * 3) * 0.6);
    g.px(x + Math.cos(a) * d, y + Math.sin(a) * d + grav * p * p * 10, cols[i % cols.length], 1 - p);
  }
}
function bolt(g, a, b, c, seed, segs = 5, jag = 3) {
  let px = a.x, py = a.y;
  for (let i = 1; i <= segs; i++) {
    const p = i / segs;
    const nx = a.x + (b.x - a.x) * p + (i < segs ? (rnd(seed + i) - 0.5) * jag * 2 : 0);
    const ny = a.y + (b.y - a.y) * p + (i < segs ? (rnd(seed + i * 7) - 0.5) * jag * 2 : 0);
    g.line(px, py + 1, nx, ny + 1, c); g.line(px, py, nx, ny, C.white); px = nx; py = ny;
  }
}
// Spikes jabbing out all around a body (thorns, Spiked Aegis). size 1 = thorns, bigger = a blast.
function spikes(g, u, p, size = 1) {
  if (p <= 0 || p >= 1) return;
  const n = Math.round(8 * size);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; const rx = u.hw + 2, ry = (u.bot - u.top) / 2 + 1; const k = 1 + 0.5 * size * Math.sin(p * Math.PI);
    g.line(u.x + Math.cos(a) * rx, u.mid + Math.sin(a) * ry, u.x + Math.cos(a) * rx * k + Math.cos(a) * 3 * size, u.mid + Math.sin(a) * ry * k + Math.sin(a) * 3 * size, C.grey);
  }
}

// ---- recipes: (q, ...) -> draws ----
// Fire Bombs: a black bomb with a sputtering fuse lobs over in an arc (first 60%), then explodes.
export function bombFx(q, a, b, t) {
  const g = pen();
  const p = ph(q, 0, 0.6);
  if (p > 0 && p < 1) { const [x, y] = fly(a, b, p, 18); g.disc(x, y, 2, BOMB); g.px(x + 1, y - 3, Math.floor(t / 60) % 2 ? C.fire2 : C.fire); }
  const e = ph(q, 0.6, 1);
  if (e > 0 && e < 1) { g.disc(b.x, b.y, 3 + e * 6, C.fire2, (1 - e) * 0.9); g.ring(b.x, b.y, 4 + e * 10, C.fire, 1 - e); }
  burst(g, b.x, b.y, 14, [C.fire, C.fire2, C.blood, BOMB], e, 14, 2, 1);
  return g.out;
}
// Static Crystal / chain lightning: a flickering bolt from a to b, sparks on b.
export function lightningFx(q, a, b, t, seed = 0) {
  const g = pen();
  if (q < 0.7 && Math.floor(t / 60) % 2 === 0) bolt(g, a, b, C.elec, seed + Math.floor(t / 60));
  burst(g, b.x, b.y, 6, [C.elec, C.white], ph(q, 0.1, 1), 6, seed);
  return g.out;
}
// Lost Cleric's Grimoire: a green ghost-fire ball flies at the enemy and bursts in green flames.
export function greenfireFx(q, a, b) {
  const g = pen();
  const p = ph(q, 0, 0.5);
  if (p > 0 && p < 1) { const [x, y] = fly(a, b, p, 10); g.disc(x, y, 2, GREEN); g.px(x, y, GREEN2); }
  const e = ph(q, 0.5, 1);
  if (e > 0 && e < 1) g.ring(b.x, b.y, 2 + e * 8, C.poison, 1 - e);
  burst(g, b.x, b.y, 8, [C.poison, GREEN2], e, 9, 5);
  return g.out;
}
// War Banner battle cry: a shout ring ripples out from the holder over the squad (colour can change).
export function battleCryFx(q, holder, color = BANNER) {
  const g = pen();
  const p = ph(q, 0, 0.9);
  if (p > 0 && p < 1) g.ring(holder.x, holder.mid, 3 + p * 30, color, 1 - p, 2 + p * 20);
  return g.out;
}
// ... and each hero it reaches gets speed lines for a moment (in its own colour).
export function speedLinesFx(q, u, t, color = BANNER) {
  const g = pen();
  const p = ph(q, 0.35, 1);
  if (p > 0 && p < 1) for (let k = 0; k < 3; k++) { const s = (t / 40 + k * 3) % 8; g.line(u.x - u.hw - 3 - s, u.mid - 3 + k * 3, u.x - u.hw - s, u.mid - 3 + k * 3, color, 1 - p); }
  return g.out;
}
// Shatter Hammer: the frozen enemy's ice smashes: big white-blue shards blow outward and fall.
export function shatterFx(q, u) {
  const g = pen();
  if (q > 0 && q < 1) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd(i); const r = 4 + easeOut(q) * (12 + rnd(i * 2) * 8);
    g.rect(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r + q * q * 10, 2, 2, i % 2 ? C.ice : C.white, 1 - q);
  }
  return g.out;
}
// Thousand Cuts: a ring of small knives bursts out of the dying enemy (at x, mid).
export function knifeBurstFx(q, x, mid) {
  const g = pen();
  if (q > 0 && q < 1) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2; const r = 2 + q * 16; const kx = x + Math.cos(a) * r, ky = mid + Math.sin(a) * r * 0.7;
    g.line(kx, ky, kx + Math.cos(a) * 2, ky + Math.sin(a) * 2, KNIFE); g.px(kx - Math.cos(a), ky - Math.sin(a), HILT);
  }
  burst(g, x, mid, 6, [C.blood], q, 6, 1, 1);
  return g.out;
}
// Plague Flask: a green wisp leaps from the dead enemy (a) to the next one (b).
export function plagueFx(q, a, b) {
  const g = pen();
  const p = ph(q, 0, 0.85);
  if (p > 0 && p < 1) { const [x, y] = fly(a, b, p, 10); g.disc(x, y, 1.5, C.poison); g.px(x - 2, y + 1, C.poison, 0.5); }
  return g.out;
}
// Frozen Thunderbolt: a frost ring spreads from the target to its neighbours, with ice sparks.
export function thunderboltFx(q, u) {
  const g = pen();
  if (q > 0 && q < 1) g.ring(u.x, u.mid, 2 + q * 18, C.ice, 1 - q, 1 + q * 10);
  burst(g, u.x, u.mid, 10, [C.ice, C.white], q, 16, 3);
  return g.out;
}
// Spiked Aegis: the broken shield bursts into big spikes all around the holder.
export function aegisBlastFx(q, u) { const g = pen(); spikes(g, u, q, 1.6); burst(g, u.x, u.mid, 10, [C.grey, C.shield], q, 14, 4); return g.out; }
// Bulwark Plate thorns: grey spikes jab out around the holder when it is hit.
export function thornsFx(q, u) { const g = pen(); spikes(g, u, q, 1); return g.out; }
// Lifesteal: red drops pull out of the enemy (a) and curve back into the hero (b).
export function lifestealFx(q, a, b) {
  const g = pen();
  for (let i = 0; i < 5; i++) {
    const p = ph(q, i * 0.08, 0.68 + i * 0.08);
    if (p > 0 && p < 1) { const [x, y] = fly({ x: a.x, y: a.y + (i - 2) }, b, easeInOut(p), 3 + i); g.px(x, y, C.blood); g.px(x + 1, y, C.blood2, 0.6); }
  }
  return g.out;
}
// Excalibur tornado: a swirling grey-blue funnel standing on (x, y), t = clock.
export function tornadoFx(x, y, t) {
  const g = pen();
  for (let j = 0; j < 16; j++) { const w = 1 + j * 0.45; const a = t / 60 + j * 0.9; g.px(x + Math.cos(a) * w, y - j, j % 3 ? C.grey : C.ice, 0.85); g.px(x - Math.cos(a) * w, y - j, C.white, 0.4); }
  return g.out;
}
