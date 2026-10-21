// Item effects (user's choice: the FULL version, each item its own effect, AND the item's icon pops over the
// holder; which item plays which effect is in src/data/itemFx.json). Ported from the effects proposal page
// (docs/proposals/fx-effects.js, "Item procs"). No Phaser here: character pixels (world / CHAR_SCALE).
//   q = 0..1 over the effect's time in ITEM_MS. Points are { x, y }; a body u = { x, y (feet), top, mid, bot, hw }.
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const fly = (a, b, p, arc = 0) => [a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p - Math.sin(p * Math.PI) * arc];
const BOMB = 0x4a4a5a, KNIFE = 0xe4e8f0, HILT = 0x6b4a2a, BANNER = 0xf2d03a, GREEN = 0x3aa84a, GREEN2 = 0xc8ffd0;

export const ITEM_MS = { bomb: 800, lightning: 320, greenfire: 800, battleCry: 800, shatter: 600, knifeBurst: 450, plague: 600, thunderbolt: 560, aegisBlast: 400, thorns: 320, lifesteal: 520, suckerPunch: 320, executioner: 420, dice: 650, mimic: 700, spiritAxe: 700, moon: 420, spiritfire: 900, soulLantern: 700, ghastlyFire: 340, thunderstruck: 520 };
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
// (user: bigger) a big ball with a pale core, flickering flame tongues on top and a trail of green embers.
export function greenfireFx(q, a, b) {
  const g = pen();
  const p = ph(q, 0, 0.55);
  if (p > 0 && p < 1) {
    for (let k = 1; k <= 5; k++) { const [tx, ty] = fly(a, b, Math.max(0, p - k * 0.05), 10); g.disc(tx, ty, Math.max(0.8, 5 - k * 0.8), GREEN, 0.55 - k * 0.09); }
    const [x, y] = fly(a, b, p, 10);
    g.disc(x, y, 8, GREEN, 0.25); g.disc(x, y, 6, GREEN); g.disc(x, y, 4.2, C.poison); g.disc(x - 1, y - 1, 2, GREEN2);
    for (let i = -4; i <= 4; i++) { const h = 3 + Math.round(rnd(i + Math.round(q * 20)) * 5); for (let j = 1; j <= h; j++) g.px(x + i, y - 5 - j, j === h ? GREEN2 : C.poison, 1 - j / (h + 1)); }
  }
  const e = ph(q, 0.55, 1);
  if (e > 0 && e < 1) { g.disc(b.x, b.y, 7 * (1 - e), GREEN2, 1 - e); g.ring(b.x, b.y, 4 + e * 17, C.poison, 1 - e); g.ring(b.x, b.y, 2 + e * 11, GREEN2, (1 - e) * 0.7); }
  burst(g, b.x, b.y, 18, [C.poison, GREEN2, GREEN], e, 15, 5, -0.3);
  return g.out;
}
// War Banner battle cry (user: look like a SHOUT): sound waves burst out of the holder's head to both sides, three
// arcs one after another, with short shout rays above; then a faint ring rolls over the squad (colour can change).
export function battleCryFx(q, holder, color = BANNER) {
  const g = pen();
  const hx = holder.x, hy = holder.top + 3;
  for (let k = 0; k < 3; k++) {
    const p = ph(q, k * 0.14, 0.55 + k * 0.14);
    if (p <= 0 || p >= 1) continue;
    const r = 4 + easeOut(p) * 16;
    for (const side of [-1, 1]) for (let i = -5; i <= 5; i++) { const a = (i / 5) * 0.9; g.px(hx + side * Math.cos(a) * r, hy + Math.sin(a) * r, i === 0 ? C.white : color, (1 - p) * (1 - Math.abs(i) * 0.08)); }
  }
  const rays = ph(q, 0, 0.4);
  if (rays > 0 && rays < 1) for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.4; g.line(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5, hx + Math.cos(a) * (8 + rays * 5), hy + Math.sin(a) * (8 + rays * 5), color, 1 - rays); }
  const p = ph(q, 0.3, 1);
  if (p > 0 && p < 1) g.ring(holder.x, holder.mid, 6 + p * 30, color, (1 - p) * 0.4, 3 + p * 18);
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
// (user: add static) short electric crackles flicker inside the frost ring.
export function thunderboltFx(q, u) {
  const g = pen();
  if (q > 0 && q < 1) {
    g.ring(u.x, u.mid, 2 + q * 18, C.ice, 1 - q, 1 + q * 10);
    const flick = Math.floor(q * 14);
    for (let k = 0; k < 4; k++) {
      if ((flick + k) % 2) continue;
      const a = rnd(flick * 7 + k) * Math.PI * 2, r = 3 + q * 14 * (0.5 + rnd(k + flick) * 0.5);
      const x = u.x + Math.cos(a) * r, y = u.mid + Math.sin(a) * r * 0.6;
      bolt(g, { x, y }, { x: x + Math.cos(a + 1) * 4, y: y + Math.sin(a + 1) * 3 }, C.elec, flick * 3 + k, 3, 1.5);
    }
  }
  burst(g, u.x, u.mid, 10, [C.ice, C.white, C.elec], q, 16, 3);
  return g.out;
}
// Spiked Aegis: the broken shield bursts into big spikes all around the holder.
export function aegisBlastFx(q, u) { const g = pen(); spikes(g, u, q, 1.6); burst(g, u.x, u.mid, 10, [C.grey, C.shield], q, 14, 4); return g.out; }
// Spirit Axe (user: spin flat on the screen, so you see it hit; v2: it spins ONCE): a big ghostly green axe makes one
// fast full turn around the holder like a wheel (wide enough to reach the enemies it hits), its blade leading, with a
// fading trail of past positions and sparks at the blade tip.
export function spiritAxeFx(q, u, t) {
  const g = pen();
  const fade = q < 0.08 ? q / 0.08 : q > 0.9 ? (1 - q) / 0.1 : 1;
  const cx = u.x, cy = u.mid, R = 24, RY = 15; // R = sweep radius (character px), flattened a little for the floor view
  const spin = -Math.PI / 2 + (1 - (1 - q) * (1 - q)) * Math.PI * 2; // one turn, fast then easing out
  for (let k = 7; k >= 0; k--) { // the trail: older positions fade
    const a = spin - k * 0.13; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * RY;
    if (k) { g.px(x, y, C.poison, fade * (0.5 - k * 0.06)); g.px(x, y + 1, C.heal, fade * (0.3 - k * 0.04)); continue; }
    // the axe: handle from near the holder out to the head, a wide crescent blade on the leading side
    const ux = Math.cos(a), uy = Math.sin(a) * (RY / R);
    g.line(cx + ux * 8, cy + uy * 8, x, y, C.heal, fade * 0.85);
    const tx = -Math.sin(a), ty = Math.cos(a) * (RY / R); // the way it is turning
    for (let j = -3; j <= 3; j++) for (let w = 0; w <= 2 - Math.floor(Math.abs(j) / 2); w++) g.px(x + ux * j + tx * w, y + uy * j + ty * w, w === 2 - Math.floor(Math.abs(j) / 2) ? C.white : C.poison, fade);
    burst(g, x + tx * 3, y + ty * 3, 3, [C.white, C.heal], (t % 200) / 200, 4, Math.floor(t / 200));
  }
  return g.out;
}
// Moonlight Twinblade: a pale blue crescent spins from a to b.
export function moonFx(q, a, b, t, seed) {
  const g = pen();
  if (q >= 1) return g.out;
  const p = easeInOut(Math.min(1, q * 1.15));
  const [x, y] = fly(a, b, p, 3);
  const spin = t / 45 + seed;
  // (user: way bigger) a wide crescent, three pixels thick, white edge, with a glowing trail
  for (let i = -9; i <= 9; i++) {
    const ang = spin + i * 0.17; const thick = 3 - Math.floor(Math.abs(i) / 4);
    for (let w = 0; w < thick; w++) { const r = 12 - w; g.px(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.75, w === 0 ? C.white : Math.abs(i) < 5 ? C.ice2 : C.ice, 1 - Math.abs(i) * 0.04); }
  }
  for (let k = 1; k <= 5; k++) { const [tx, ty] = fly(a, b, Math.max(0, p - k * 0.05), 3); g.disc(tx, ty, Math.max(0.6, 2.5 - k * 0.4), C.ice2, 0.45 / k); }
  return g.out;
}
// Flame Spirit (user: way bigger and darker, slow and swaying, like a spirit going to haunt its enemy): a big dark-
// purple fireball drifts from a to b in a slow wavy line, flames streaming back off it, a faint face of two pale eyes,
// then it bursts in dark flames. Its hit lands when it arrives (BattleState waits 900ms).
const SPIRIT_DEEP = 0x2a1040; // the spirit's darkest purple
export function spiritFireFx(q, a, b, t, seed = 0) {
  const g = pen();
  const p = ph(q, 0, 0.85);
  if (p > 0 && p < 1) {
    const e = p * p * (3 - 2 * p); // slow start and end
    const sway = Math.sin(p * Math.PI * 3 + seed) * 6 * Math.sin(p * Math.PI);
    const x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e) - Math.sin(p * Math.PI) * 10 + sway;
    for (let k = 1; k <= 6; k++) { const pk = Math.max(0, p - k * 0.035); const ek = pk * pk * (3 - 2 * pk); const sk = Math.sin(pk * Math.PI * 3 + seed) * 6 * Math.sin(pk * Math.PI);
      g.disc(lerp(a.x, b.x, ek), lerp(a.y, b.y, ek) - Math.sin(pk * Math.PI) * 10 + sk, Math.max(1, 7 - k * 0.9), k < 3 ? C.dark2 : SPIRIT_DEEP, 0.8 - k * 0.1); }
    g.disc(x, y, 10, SPIRIT_DEEP, 0.35); g.disc(x, y, 8, SPIRIT_DEEP); g.disc(x, y, 6.5, C.dark2); g.disc(x, y + 1, 4, C.dark); g.disc(x, y + 1, 1.8, 0xc8a0ff);
    for (let i = -6; i <= 6; i++) { const h = 3 + Math.round(rnd(i + Math.floor(t / 90)) * 6) - Math.round(Math.abs(i) / 2); for (let j = 1; j <= h; j++) g.px(x + i + Math.round(Math.sin(t / 110 + i + j * 0.4) * (j / 3)), y - 7 - j, j === h ? C.dark : j > h / 2 ? C.dark2 : SPIRIT_DEEP, 1 - j / (h + 1)); }
    for (const ex of [-3, 2]) { g.rect(x + ex, y - 3, 2, 2, C.white); g.px(x + ex, y - 1, 0xc8a0ff, 0.7); } // two pale, haunting eyes
  }
  const e = ph(q, 0.85, 1);
  if (e > 0 && e < 1) { g.disc(b.x, b.y, 9 * (1 - e), SPIRIT_DEEP, 1 - e); g.ring(b.x, b.y, 5 + e * 14, C.dark, 1 - e); g.ring(b.x, b.y, 3 + e * 9, C.dark2, 1 - e); burst(g, b.x, b.y, 16, [C.dark, C.dark2, 0xe0c8ff], e, 16, seed, -0.4); }
  return g.out;
}
// Soul Lantern (user: glowy green lines around the hero): when a kill feeds it, glowing green lines swirl up and
// around the holder's body, then fade.
export function soulLanternFx(q, u, t) {
  const g = pen();
  const H = u.bot - u.top;
  for (let k = 0; k < 3; k++) {
    const p = ph(q, k * 0.12, 0.7 + k * 0.1); if (p <= 0 || p >= 1) continue;
    for (let i = 0; i < 14; i++) {
      const s = p - i * 0.02; if (s <= 0) continue;
      const a = s * Math.PI * 3 + k * 2.1; const y = u.bot - s * (H + 6);
      const x = u.x + Math.cos(a) * (u.hw + 3), al = Math.min(1, 1.6 * (1 - p)) * (1 - i * 0.07);
      g.rect(x - 1, y - 1, 3, 3, C.heal, al * 0.3); // the glow
      g.rect(x, y, 2, 1, i === 0 ? C.white : i < 4 ? GREEN2 : C.heal, al);
    }
  }
  return g.out;
}
// Ghastly Fire (user: ONE bigger purple fire hit instead of fire + dark): the normal fire impact, made 1.5x as big
// around the body's middle and recoloured to purple ghost fire.
const GHASTLY = { [C.fire]: C.dark, [C.fire2]: 0xe0c8ff, [C.white]: 0xf4ecff, 0xff7a3d: C.dark, 0xffd24d: 0xc8a0ff, 0xff9a2e: C.dark };
export function ghastlyDraws(draws, u, k = 1.5) {
  return draws.map(([x, y, w, h, c, a]) => [Math.round(u.x + (x - u.x) * k), Math.round(u.mid + (y - u.mid) * k), Math.ceil(w * k), Math.ceil(h * k), GHASTLY[c] ?? (c === C.white ? 0xf4ecff : C.dark2), a]);
}

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
// Excalibur tornado: a big swirling grey-blue funnel standing on (x, y), t = clock. Wide at the top,
// thin at the floor, with dust kicked up around its base.
export function tornadoFx(x, y, t) {
  const g = pen();
  for (let j = 0; j < 24; j++) {
    const w = 1 + j * 0.55; const a = t / 60 + j * 0.7; const sway = Math.sin(t / 300 + j * 0.15) * (j / 24) * 2;
    const cx = x + sway;
    g.px(cx + Math.cos(a) * w, y - j, j % 3 ? C.grey : C.ice, 0.9);
    g.px(cx + Math.cos(a + Math.PI) * w, y - j, j % 2 ? C.grey2 : C.grey, 0.75);
    g.px(cx + Math.cos(a + Math.PI / 2) * w, y - j, C.white, 0.45);
    if (j % 4 === 0) g.line(cx - w * 0.6, y - j, cx + w * 0.6, y - j, C.grey, 0.25);
  }
  for (let i = 0; i < 6; i++) { const q = (t / 500 + i / 6) % 1; const a = (i / 6) * Math.PI * 2 + t / 200; g.px(x + Math.cos(a) * (4 + q * 6), y - q * 3, 0xc9b18a, 1 - q); }
  return g.out;
}

// Sucker Punch Glove: the first hit lands with a red-and-yellow impact star on the enemy's front (side = -1:
// the attacker is on its left).
export function suckerPunchFx(q, u, side) {
  const g = pen();
  if (q > 0 && q < 1) {
    const x = u.x + side * u.hw, y = u.mid, r = 3 + q * 6;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rr = i % 2 ? r : r * 0.5; g.line(x, y, x + Math.cos(a) * rr, y + Math.sin(a) * rr, i % 2 ? C.blood : C.fire2, 1 - q); }
  }
  return g.out;
}
// Executioner's Axe: a heavy red chop falls straight through the nearly dead enemy, blood bursts out.
export function executionerFx(q, u) {
  const g = pen();
  const p = ph(q, 0, 0.5);
  if (p > 0 && p < 1) { const y = u.top - 14 + p * (u.y - u.top + 14); for (let i = -1; i <= 1; i++) g.line(u.x + i, y - 8, u.x + i, y, i ? C.blood : C.white, 1 - p * 0.3); }
  burst(g, u.x, u.mid, 10, [C.blood, C.blood2], ph(q, 0.35, 1), 10, 4, 1);
  return g.out;
}
// Gambler's Dice: a little white die tumbles above the enemy's head and lands (the debuff it rolled appears).
export function diceFx(q, u, t) {
  const g = pen();
  if (q > 0 && q < 1) {
    const p = ph(q, 0, 0.75); const y = u.top - 12 - Math.sin(p * Math.PI) * 5; const a = q > 0.85 ? 1 - (q - 0.85) / 0.15 : 1;
    g.rect(u.x - 3, y - 1, 7, 7, C.outline, a); g.rect(u.x - 2, y, 5, 5, C.white, a);
    const face = p < 1 ? Math.floor(t / 80) % 3 : 2;
    g.px(u.x, y + 2, C.outline, a); if (face >= 1) { g.px(u.x - 1, y + 1, C.outline, a); g.px(u.x + 1, y + 3, C.outline, a); }
  }
  return g.out;
}
// Mimic Chest: a chest pops out of the floor beside the holder (x, y = that spot) and chomps open and shut.
export function mimicFx(q, x, y, t) {
  const g = pen();
  if (q > 0 && q < 1) {
    const up = easeOut(ph(q, 0, 0.3)); const open = Math.floor(t / 150) % 2 === 1; const yy = y + Math.round((1 - up) * 6); const a = q > 0.8 ? 1 - (q - 0.8) / 0.2 : 1;
    g.rect(x - 4, yy - 7 - (open ? 1 : 0), 9, 4, 0x5e3a1a, a); g.rect(x - 4, yy - 3, 9, 3, 0x8b5a2b, a);
    if (open) { g.rect(x - 4, yy - 4, 9, 1, C.blood, a); for (const k of [-3, -1, 1, 3]) g.px(x + k, yy - 3, C.white, a); }
    g.px(x, yy - 5 - (open ? 1 : 0), C.gold, a);
  }
  return g.out;
}

// THUNDERSTRUCK, part 1 (drawn every frame while it charges, not an ITEM_MS effect): an electric circle on the floor
// under the marked enemy that grows from a dot to full size (p 0..1), with a filling glow and a few sparks crawling on it.
// f = the enemy's feet (pen pixels), r = full radius.
export function thunderMarkFx(p, f, r, t, seed = 0) {
  const g = pen();
  const ry = r * 0.4, k = 0.2 + 0.8 * easeOut(p), rr = r * k, rry = ry * k;
  for (let y = -Math.ceil(rry); y <= rry; y++) { // a glow on the floor that fills in and brightens
    const w = Math.round(rr * Math.sqrt(Math.max(0, 1 - (y * y) / (rry * rry + 0.01))));
    if (w > 0) g.rect(f.x - w, f.y + y, w * 2, 1, C.elec, 0.12 + 0.3 * p);
  }
  g.ring(f.x, f.y, r, C.elec, 0.3, ry); // where it will end
  g.ring(f.x, f.y, rr, C.elec, 0.7 + 0.3 * p, rry); // the edge: double, bright
  g.ring(f.x, f.y, rr + 1, C.elec, 0.5 + 0.5 * p, rry + 1);
  g.ring(f.x, f.y, Math.max(0.5, rr - 1), C.white, 0.3 + 0.6 * p, Math.max(0.5, rry - 1));
  for (let i = 0; i < 6; i++) {
    const a = t / 220 + (i / 6) * Math.PI * 2 + rnd(seed + i);
    const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rry;
    g.px(x, y, C.white, 1); g.px(x, y - 1 - (Math.floor(t / 70 + i) % 3), C.elec, 0.8); // sparks jumping up off the edge
  }
  return g.out;
}
// THUNDERSTRUCK, part 2: a GIANT bolt from the top of the screen onto the enemy (three bolts side by side = thick, with a
// white core), a flash on its body, a ring rolling out on the floor and sparks. u = the enemy's body (fxBody).
export function thunderstruckFx(q, u, t, seed = 0) {
  const g = pen();
  const top = { x: u.x + (rnd(seed) - 0.5) * 10, y: -4 }, hit = { x: u.x, y: u.y };
  if (q < 0.55 && Math.floor(t / 50) % 3 !== 2) {
    const s = seed + Math.floor(t / 100);
    bolt(g, { x: top.x - 1, y: top.y }, { x: hit.x - 1, y: hit.y }, C.elec, s, 10, 5);
    bolt(g, { x: top.x + 1, y: top.y }, { x: hit.x + 1, y: hit.y }, C.elec, s, 10, 5);
    bolt(g, top, hit, C.white, s, 10, 5);
    bolt(g, { x: top.x + 9, y: top.y }, { x: (top.x + hit.x) / 2 + 12, y: hit.y * 0.55 }, C.elec, s + 9, 4, 4); // a side branch
  }
  const f = ph(q, 0, 0.3);
  if (f > 0 && f < 1) { g.disc(u.x, u.mid, (u.hw + 4) * (1 - f * 0.5), C.white, 0.7 * (1 - f)); }
  const e = ph(q, 0.05, 0.9);
  if (e > 0 && e < 1) { g.ring(hit.x, hit.y, 4 + e * 26, C.elec, 1 - e, (4 + e * 26) * 0.4); g.ring(hit.x, hit.y, 2 + e * 16, C.white, (1 - e) * 0.7, (2 + e * 16) * 0.4); }
  burst(g, hit.x, hit.y - 4, 16, [C.elec, C.white], ph(q, 0.05, 0.8), 18, seed + 3, -0.2);
  return g.out;
}
