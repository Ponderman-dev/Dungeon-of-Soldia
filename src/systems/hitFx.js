// Hit effects (user's choice: the FULL version, every damage type its own hit), ported from the effects
// proposal page (docs/proposals/fx-effects.js, "Hits"). Two parts:
//   projectileFx(): the shot while it flies, impactFx(): what happens where it lands (since session 54 both per
//                   damage type in hitLooks.js SHOT_LOOKS; melee looks per hero / enemy = hitLooks.js MELEE_LOOKS,
//                   picked by the attacker's `hitLook`), plus a crit layer (crossing slashes and a star of rays).
// No Phaser here: everything is in CHARACTER pixels (screen pixels / CHAR_SCALE); the scene multiplies.
import { pen, rnd, FX_COLORS as C } from './statusFx.js';
import { MELEE_LOOKS, MELEE_LOOK_MS, SHOT_LOOKS } from './hitLooks.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);

// How long each impact plays (ms). A crit adds its own layer on top.
// (session 54, user picks) shots + their hits per damage type and the melee looks live in hitLooks.js.
export const IMPACT_MS = { melee: 300, ranged: 300, fire: 460, ice: 460, electric: 400, dark: 520, holy: 400,
  ...Object.fromEntries(Object.keys(MELEE_LOOKS).map((k) => [k, MELEE_LOOK_MS])) };
export const MELEE_LOOK_NAMES = Object.keys(MELEE_LOOKS);
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

// The shot in the air. start = where it left, head = where it is now (both {x, y}), t = clock (ms).
// Returns pixel draws. Unknown types fly as an arrow.
export function projectileFx(type, start, head, t) {
  return (SHOT_LOOKS[type] || SHOT_LOOKS.ranged).shot(start, head, t);
}

// Where it lands. q = 0..1 over IMPACT_MS[type]; u = the target's body in character pixels:
// { x (body middle), y (feet), top, mid, hw, side } where side = -1 if the attacker is on its left (the
// hit lands on that side). from = where an electric bolt comes from (the attacker), or null.
// melee = true: an elemental MELEE hit (a fire elite's sword...): the melee slash in the element's colour.
// Returns { draws, tint: [colour, amount] | null, dx (a twitch) }.
export const ELEMENT_SLASH = { fire: [C.fire, C.fire2], ice: [C.ice, C.white], electric: [C.elec, C.white], dark: [C.dark, C.dark2], holy: [C.holy, C.gold] };
export function impactFx(type, q, u, t, seed = 0, from = null, melee = false) {
  const g = pen();
  const fx = u.x + u.side * u.hw, fy = u.mid; // the front of the body, facing the attacker
  let tint = null, dx = 0;
  if (MELEE_LOOKS[type] || (!melee && SHOT_LOOKS[type])) { // (session 54) a hero / enemy melee look, or a shot's own hit
    const o = MELEE_LOOKS[type] ? MELEE_LOOKS[type](q, u, t) : SHOT_LOOKS[type].hit(q, u, t, from || { x: u.x + u.side * 30, y: u.mid });
    ({ tint = null, dx = 0 } = o); g.out.push(...o.draws);
  } else if (melee && ELEMENT_SLASH[type]) { // (user, session 39) recoloured slash + a few bits of the element + its tint
    const [c1, c2] = ELEMENT_SLASH[type];
    slash(g, fx, fy, 8, c1, q, u.side);
    burst(g, fx, fy, 5, [c1, c2], ph(q, 0.15, 1), 7, 3 + seed, type === 'fire' ? 1 : 0);
    if (type !== 'holy' && type !== 'electric') tint = [c1, 0.3 * (1 - q)];
  } else if (type === 'melee') {
    slash(g, fx, fy, 8, C.grey, q, u.side);
    burst(g, fx, fy, 6, [C.white, C.grey], ph(q, 0.15, 1), 7, 3 + seed);
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
export const MOMENT_MS = { dodge: 600, block: 320, soak: 460, shieldBreak: 660, heal: 900, puff: 570, grace: 900 };

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
// The Cleric's GRACE heal (user, session 40: 'a shiny healing buff, not a projectile', then 'too fancy, bring it
// down'): three small gold twinkles round the body one after another, a few gold motes drift up, a faint gold glow.
// Returns { draws, tint }.
export function graceFx(q, u, t) {
  const g = pen();
  const STARS = [[-0.9, 0.25], [0.9, 0.45], [-0.4, 0.75]]; // [x across the body, height 0 top .. 1 feet]
  STARS.forEach(([sx, sy], i) => {
    const p = ph(q, 0.05 + i * 0.15, 0.4 + i * 0.15);
    if (p <= 0 || p >= 1) return;
    const r = Math.round(Math.sin(p * Math.PI) * 2), x = u.x + sx * (u.hw + 1), y = u.top + sy * (u.bot - u.top);
    g.px(x, y, C.white, 0.9);
    for (let k = 1; k <= r; k++) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + a * k, y + b * k, C.holy, 0.8 - k * 0.25);
  });
  for (let i = 0; i < 4; i++) {
    const p = ph(q, 0.2 + i * 0.1, 0.75 + i * 0.06);
    if (p > 0 && p < 1) g.px(u.x + (rnd(i * 7 + 1) - 0.5) * (u.hw * 2 + 2), u.y - 4 - p * 16, C.holy, (1 - p) * 0.8);
  }
  const glow = q > 0 && q < 0.8 ? 0.18 * Math.sin((q / 0.8) * Math.PI) : 0;
  return { draws: g.out, tint: glow > 0.02 ? [C.holy, Math.round(glow * 20) / 20] : null };
}
// The grey puff where an enemy died (x, y = its feet).
export function deathPuffFx(q, x, y) {
  const g = pen();
  if (q > 0 && q < 1) for (let i = 0; i < 5; i++) g.disc(x + (i - 2) * 3, y - 3 - q * (6 + (i % 3) * 3), 2 + (i % 2), C.grey2, (1 - q) * 0.8);
  return g.out;
}
