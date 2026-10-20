// Hit effects (user's choice: the FULL version, every damage type its own hit), ported from the effects
// proposal page (docs/proposals/fx-effects.js, "Hits"). Two parts:
//   projectileFx(): the shot while it flies (arrow, fire bolt, ice shard, lightning, dark orb, holy mote)
//   impactFx():     what happens where it lands (slash, sparks, fire burst, frost star, implosion, light pillar),
//                   plus a crit layer (crossing slashes and a star of rays).
// No Phaser here: everything is in CHARACTER pixels (screen pixels / CHAR_SCALE); the scene multiplies.
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const ARROW = 0xc68a5e, PALE = 0xe6e6b8;

// How long each impact plays (ms). A crit adds its own layer on top.
export const IMPACT_MS = { melee: 300, ranged: 240, fire: 380, ice: 400, electric: 300, dark: 480, holy: 480 };
export const CRIT_MS = 340;
export const HIT_TYPES = Object.keys(IMPACT_MS);

// ---- drawing pieces (the proposal engine's slash / burst / rays / bolt) ----
function slash(g, x, y, r, c, p, dir) {
  if (p <= 0 || p >= 1) return;
  const a0 = -2.2, a1 = 0.6; const end = a0 + (a1 - a0) * easeOut(Math.min(1, p * 1.6));
  for (let a = a0; a <= end; a += 0.08) { g.px(x + Math.cos(a) * r * dir, y + Math.sin(a) * r, c, 1 - p); g.px(x + Math.cos(a) * (r - 1) * dir, y + Math.sin(a) * (r - 1), C.white, (1 - p) * 0.8); }
}
function burst(g, x, y, n, cols, p, dist = 12, seed = 1, grav = 0) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.6; const d = dist * easeOut(p) * (0.5 + rnd(seed + i * 3) * 0.6);
    g.px(x + Math.cos(a) * d, y + Math.sin(a) * d + grav * p * p * 10, cols[i % cols.length], 1 - p);
  }
}
function rays(g, x, y, n, len, c, p, rot = 0) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot; const r0 = len * easeOut(p) * 0.4, r1 = len * easeOut(p); g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, c, 1 - p); }
}
function bolt(g, x0, y0, x1, y1, c, seed, segs = 6, jag = 4) {
  let px = x0, py = y0;
  for (let i = 1; i <= segs; i++) {
    const p = i / segs;
    const nx = x0 + (x1 - x0) * p + (i < segs ? (rnd(seed + i) - 0.5) * jag * 2 : 0);
    const ny = y0 + (y1 - y0) * p + (i < segs ? (rnd(seed + i * 7) - 0.5) * jag * 2 : 0);
    g.line(px, py + 1, nx, ny + 1, c); g.line(px, py, nx, ny, C.white); px = nx; py = ny;
  }
}

// The shot in the air. start = where it left, head = where it is now (both {x, y}), t = clock (ms).
// Returns pixel draws. Unknown types fly as an arrow.
export function projectileFx(type, start, head, t, seed = 0) {
  const g = pen();
  const dx = head.x - start.x, dy = head.y - start.y; const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d; // flying direction
  const back = (k) => [head.x - ux * k, head.y - uy * k];
  if (type === 'fire') {
    for (let i = 1; i < 6; i++) { const [x, y] = back(i * 1.2); g.px(x, y + (rnd(i + Math.floor(t / 50)) - 0.5) * 2, i < 3 ? C.fire2 : C.fire, 1 - i / 6); }
    g.disc(head.x, head.y, 2, C.fire); g.px(head.x, head.y, C.fire2);
  } else if (type === 'ice') {
    const r = Math.floor(t / 40) % 2; // it spins
    g.px(head.x, head.y, C.white); g.px(head.x + (r ? 1 : 0), head.y + (r ? 0 : 1), C.ice); g.px(head.x - (r ? 1 : 0), head.y - (r ? 0 : 1), C.ice);
    const [tx, ty] = back(2); g.px(tx, ty, C.ice2, 0.5);
  } else if (type === 'electric') {
    if (Math.floor(t / 70) % 2 === 0) bolt(g, start.x, start.y, head.x, head.y, C.elec, seed + Math.floor(t / 70), Math.max(2, Math.round(d / 6)), 3);
    g.px(head.x, head.y, C.white);
  } else if (type === 'dark') {
    for (let i = 1; i < 7; i++) { const [x, y] = back(i * 1.1); g.px(x, y + Math.sin(t / 60 + i) * 1.5, C.dark2, 1 - i / 7); }
    g.disc(head.x, head.y, 2, C.dark); g.px(head.x, head.y, C.white);
  } else if (type === 'holy') {
    for (let i = 1; i < 4; i++) { const [x, y] = back(i * 1.5); g.px(x, y, C.holy, 1 - i / 4); }
    g.disc(head.x, head.y, 1, C.gold); g.px(head.x, head.y, C.white);
  } else { // ranged: an arrow, shaft trailing behind a white tip
    const [x, y] = back(5); g.line(x, y, head.x - ux, head.y - uy, ARROW); g.px(head.x, head.y, C.white);
  }
  return g.out;
}

// Where it lands. q = 0..1 over IMPACT_MS[type]; u = the target's body in character pixels:
// { x (body middle), y (feet), top, mid, hw, side } where side = -1 if the attacker is on its left (the
// hit lands on that side). from = where an electric bolt comes from (the attacker), or null.
// Returns { draws, tint: [colour, amount] | null, dx (a twitch) }.
export function impactFx(type, q, u, t, seed = 0, from = null) {
  const g = pen();
  const fx = u.x + u.side * u.hw, fy = u.mid; // the front of the body, facing the attacker
  let tint = null, dx = 0;
  if (type === 'melee') {
    slash(g, fx, fy, 8, C.grey, q, u.side);
    burst(g, fx, fy, 6, [C.white, C.grey], ph(q, 0.15, 1), 7, 3 + seed);
  } else if (type === 'ranged') {
    burst(g, fx, fy, 5, [C.white, PALE], q, 6, 9 + seed);
  } else if (type === 'fire') {
    if (q > 0 && q < 1) g.ring(fx, fy, 2 + q * 7, C.fire, 1 - q);
    burst(g, fx, fy, 10, [C.fire, C.fire2, C.blood], q, 10, 5 + seed, 1);
    tint = [C.fire, 0.4 * (1 - q)];
  } else if (type === 'ice') {
    if (q > 0 && q < 0.6) {
      const L = 2 + q * 9, a = 1 - q / 0.6;
      for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) g.line(fx, fy, fx + ax * L, fy + ay * L, C.ice, a);
      for (const [ax, ay] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.line(fx, fy, fx + ax * L * 0.5, fy + ay * L * 0.5, C.white, a);
    }
    tint = [C.ice, 0.5 * (1 - q)];
  } else if (type === 'electric') {
    if (from && q < 1 && Math.floor(t / 70) % 2 === 0) bolt(g, from.x, from.y, fx, fy, C.elec, seed + Math.floor(t / 70), 6, 4);
    burst(g, fx, fy, 8, [C.elec, C.white], ph(q, 0.05, 1), 8, 7 + seed);
    if (q < 1) { tint = Math.floor(t / 60) % 2 ? [C.white, 0.8] : null; dx = Math.floor(t / 50) % 2 ? 1 : -1; }
  } else if (type === 'dark') {
    const r = ph(q, 0, 0.5); if (r > 0 && r < 1) g.ring(u.x, u.mid, 8 * (1 - r), C.dark);
    for (let i = 0; i < 4; i++) { const w = ph(q, 0.15 + i * 0.1, 0.8 + i * 0.05); if (w > 0 && w < 1) g.px(u.x - 4 + i * 3, u.mid - w * 12, i % 2 ? C.dark : C.dark2, 1 - w); }
    tint = [C.dark2, 0.5 * (1 - q)];
  } else if (type === 'holy') {
    if (q > 0 && q < 1) {
      const w = Math.round(4 * (1 - q)) + 1; const top = q < 0.2 ? u.mid - (q / 0.2) * 60 : u.mid - 60;
      for (let y = Math.round(top); y < u.y; y++) for (let x = -w; x <= w; x++) g.px(u.x + x, y, Math.abs(x) < w / 2 ? C.white : C.holy, 0.8 * (1 - q));
      g.ring(u.x, u.y, 4 + q * 10, C.gold, 1 - q, 1 + q * 3);
      tint = [C.white, 0.8 * (1 - q)];
    }
    burst(g, u.x, u.mid, 8, [C.holy, C.white], ph(q, 0.08, 1), 9, 4 + seed);
  }
  if (tint) tint = [tint[0], Math.round(clamp(tint[1]) * 20) / 20];
  if (tint && tint[1] <= 0) tint = null;
  return { draws: g.out, tint, dx };
}

// The crit layer on top of any hit: a gold slash and a white one crossing it, and a star of rays.
// q = 0..1 over CRIT_MS.
export function critFx(q, u, t) {
  const g = pen();
  const fx = u.x + u.side * u.hw, fy = u.mid;
  slash(g, fx, fy, 10, C.gold, q, u.side);
  slash(g, fx, fy, 10, C.white, ph(q, 0.2, 1), -u.side);
  rays(g, fx, fy, 8, 14, C.gold, ph(q, 0.1, 1), t / 400);
  return g.out;
}

// ---- the other hit moments (miss, block, shield, heal, death) ----------------------------------
// Each takes q = 0..1 over its own time in MOMENT_MS and the unit's body u (as impactFx, plus bot).
export const MOMENT_MS = { dodge: 600, block: 320, soak: 460, shieldBreak: 660, heal: 900, puff: 570 };

// Dodge: it side-steps away from the attacker and comes back; grey speed lines where it stood.
// Returns { draws, dx } (dx = how far it is pushed sideways, in character pixels).
export function dodgeFx(q, u) {
  const g = pen();
  const out = easeOut(ph(q, 0, 0.2)), back = ph(q, 0.6, 0.95);
  const dx = Math.round(-u.side * 6 * out * (1 - back));
  const a = 1 - ph(q, 0.1, 0.5);
  if (a > 0) for (const [k, dy] of [[0, -4], [1, 0], [2, 4]]) g.line(u.x - 3 + k, u.mid + dy, u.x + 3 - k, u.mid + dy, C.grey, a * 0.8);
  return { draws: g.out, dx };
}
// Block / parry: a bright shield shape flashes on the side that was hit, sparks fly back.
// (user: bigger) a tall shield shape, a white flash ring and a wide spray of sparks.
export function blockFx(q, u) {
  const g = pen();
  const fx = u.x + u.side * (u.hw + 3);
  if (q > 0 && q < 1) {
    for (let y = -10; y <= 9; y++) { const w = y < 3 ? 4 : y < 6 ? 3 : y < 8 ? 2 : 1; for (let k = 0; k <= w; k++) g.px(fx + u.side * k, u.mid + y, k === 0 ? C.white : k === w ? 0x3a8ad0 : C.shield, 1 - q); }
    const r = ph(q, 0, 0.6); if (r < 1) g.ring(fx + u.side * 2, u.mid, 4 + r * 10, C.white, 1 - r, (4 + r * 10) * 1.2);
  }
  burst(g, fx + u.side * 2, u.mid, 14, [C.shield, C.white, C.gold2], q, 16, 2);
  return g.out;
}
// A shield soaks a hit: the bubble lights up, a white ripple where it was hit.
export function soakFx(q, u) {
  const g = pen();
  const R = u.hw + 7, RY = (u.bot - u.top) / 2 + 4;
  if (q > 0 && q < 1) { g.ring(u.x, u.mid, R, C.shield, 0.3 + 0.6 * (1 - q), RY); g.ring(u.x + u.side * R, u.mid, 1 + q * 5, C.white, 1 - q); }
  return g.out;
}
// The shield breaks: the bubble cracks into blue shards that fly out and fall.
export function shieldBreakFx(q, u) {
  const g = pen();
  const R = u.hw + 7, RY = (u.bot - u.top) / 2 + 4;
  if (q > 0 && q < 1) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const k = 1 + easeOut(q) * 0.7; g.px(u.x + Math.cos(a) * R * k, u.mid + Math.sin(a) * RY * k + q * q * 14, i % 2 ? C.shield : C.white, 1 - q); }
  return g.out;
}
// A heal: soft green motes rise around the body (some are little plus signs), a quick green glow.
// Returns { draws, tint }.
export function healFx(q, u, seed = 0) {
  const g = pen();
  for (let i = 0; i < 8; i++) {
    const p = ph(q, i * 0.05, 0.6 + i * 0.05);
    if (p <= 0 || p >= 1) continue;
    const x = u.x + (rnd(i + seed * 3) - 0.5) * (u.hw * 2 + 6), y = u.y - 2 - p * 22;
    g.px(x, y, C.heal, 1 - p);
    if (i % 3 === 0) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + a, y + b, C.heal, 1 - p);
  }
  const glow = q > 0 && q < 0.75 ? 0.35 * Math.sin((q / 0.75) * Math.PI) : 0;
  return { draws: g.out, tint: glow > 0.02 ? [C.heal, Math.round(glow * 20) / 20] : null };
}
// The grey puff where an enemy died (x, y = its feet).
export function deathPuffFx(q, x, y) {
  const g = pen();
  if (q > 0 && q < 1) for (let i = 0; i < 5; i++) g.disc(x + (i - 2) * 3, y - 3 - q * (6 + (i % 3) * 3), 2 + (i % 2), C.grey2, (1 - q) * 0.8);
  return g.out;
}
