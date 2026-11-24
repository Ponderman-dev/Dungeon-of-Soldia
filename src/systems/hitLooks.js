// Hit looks (session 54, user picks on the hit look review page, docs/proposals/skill-fx/hits.js):
// MELEE_LOOKS = a basic melee hit per hero weapon / enemy kind (heroes.json / enemies.json `hitLook`):
//   steelArc (Knight), chop (Berserker), glint (Rogue), iaido (Samurai), claws / thump / bite (enemies).
// SHOT_LOOKS = the shot in the air + its hit, per damage type (+ `note` = the Bard, heroes.json `shotLook`): ranged = a real arrow that sticks, fire = fireball,
//   holy = light spear, dark = soul wisp, ice = frost orb, electric = ball lightning.
// No Phaser: character pixels, the same pen as statusFx / hitFx. Melee: fn(q, u, t) -> { draws, tint, dx }.
// Shots: shot(start, head, t) -> draws; hit(q, u, t, from) -> { draws, tint, dx } (from may be null).
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const fade = (q, from = 0.55) => 1 - ph(q, from, 1);
const K = { steel: 0xdfe8f5, steel2: 0x9fb0c8, spark: 0xffc46b, red: 0xff4a4a, cyan: 0x6ff0ff, cyan2: 0xc9fbff, samurai: 0xe04848,
  wood: 0xc68a5e, wood2: 0x8a5a32, pink: 0xff8ad8, green: 0x7dffb0, crack: 0x2a2236, dust: 0xa89880 };

// ---- drawing pieces ------------------------------------------------------------------------------
// A sweeping blade: the arc grows from a0 to a1 with a bright head and a fading tail. Points: (cx + cos(a)*r*f, cy + sin(a)*r).
function swoosh(g, cx, cy, r, a0, a1, p, f, cols, thick = 2, speed = 1.8, tail = 1.6) {
  if (p <= 0 || p >= 1) return;
  const head = a0 + (a1 - a0) * easeOut(Math.min(1, p * speed)); const out = fade(p, 0.5);
  const step = Math.sign(a1 - a0) * 0.04;
  for (let a = a0; (a1 > a0 ? a <= head : a >= head); a += step) {
    const k = 1 - Math.abs(head - a) / tail; if (k <= 0) continue;
    for (let i = 0; i < thick; i++) g.px(cx + Math.cos(a) * (r - i) * f, cy + Math.sin(a) * (r - i), cols[Math.min(i, cols.length - 1)], k * out);
  }
}
function sparks(g, x, y, n, cols, p, dist, seed, grav = 0, dir = 0) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = dir ? (dir > 0 ? 0 : Math.PI) + (rnd(seed + i) - 0.5) * 2.2 - 0.5 : (i / n) * Math.PI * 2 + rnd(seed + i) * 0.6;
    const d = dist * easeOut(p) * (0.5 + rnd(seed + i * 3) * 0.6);
    g.px(x + Math.cos(a) * d, y + Math.sin(a) * d + grav * p * p * 10, cols[i % cols.length], 1 - p);
  }
}
function star(g, x, y, r, c, a, c2 = C.white) { // a little 4-point twinkle
  for (let i = 1; i <= r; i++) { const k = a * (1 - (i - 1) / (r + 1)); g.px(x + i, y, c, k); g.px(x - i, y, c, k); g.px(x, y + i, c, k); g.px(x, y - i, c, k); }
  g.px(x, y, c2, a);
}
function bolt(g, x0, y0, x1, y1, c, seed, segs = 3, jag = 2, a = 1) {
  let px = x0, py = y0;
  for (let i = 1; i <= segs; i++) {
    const p = i / segs;
    const nx = x0 + (x1 - x0) * p + (i < segs ? (rnd(seed + i) - 0.5) * jag * 2 : 0), ny = y0 + (y1 - y0) * p + (i < segs ? (rnd(seed + i * 7) - 0.5) * jag * 2 : 0);
    g.line(px, py, nx, ny, c, a); px = nx; py = ny;
  }
}
const front = (u) => ({ x: u.x + u.side * u.hw, y: u.mid, f: -u.side }); // f = +1 when the hit travels to the right
// (user, session 54: 'the hits are not centered to the enemies') melee looks land on the MIDDLE of the body.
const centre = (u) => ({ x: u.x, y: u.mid, f: -u.side });

// ---- melee looks: (q 0..1, u body, t) -> { draws, tint, dx } ----
export const MELEE_LOOKS = {
  steelArc(q, u) { // (user, session 54: 'make the knight slash a bit different, it doesn't look centered') one curved sword
    // slash mark right through the middle of the body: high on the attacker's side to low on the far side, thick in the
    // middle and thin at the ends (white edge, steel body), drawn fast, then it fades; metal sparks fly from the middle.
    const g = pen(), { x, y, f } = centre(u);
    const ax = x - 8 * f, ay = y - 8, bx = x + 8 * f, by = y + 7, nx = 0.7 * f, ny = -0.7; // ends + the bulge direction
    const head = easeOut(Math.min(1, q * 2.4)), a = fade(q, 0.45);
    if (q > 0 && a > 0) for (let s = 0; s <= head; s += 0.025) {
      const bend = Math.sin(Math.PI * s) * 3, px = ax + (bx - ax) * s + nx * bend, py = ay + (by - ay) * s + ny * bend;
      const thick = 1 + Math.round(2 * Math.sin(Math.PI * s));
      for (let k = 0; k < thick; k++) g.px(px - nx * k, py - ny * k, k === 0 ? C.white : k === 1 ? K.steel : K.steel2, a * (k ? 0.9 : 1));
    }
    sparks(g, x, y, 6, [K.spark, C.white, C.fire2], ph(q, 0.25, 1), 9, 3, 1.2);
    return { draws: g.out, tint: q < 0.3 ? [C.white, 0.35] : null, dx: q < 0.25 ? f : 0 }; },
  chop(q, u) { const g = pen(), { x, f } = centre(u); const p = ph(q, 0, 0.22), a = fade(q, 0.4);
    const x0 = x - 4 * f, y0 = u.top - 2, x1 = x + 6 * f, y1 = u.y - 3; const ex = x0 + (x1 - x0) * easeOut(p), ey = y0 + (y1 - y0) * easeOut(p);
    if (p > 0 && a > 0) { g.line(x0 - f, y0, ex - f, ey, K.red, a); g.line(x0, y0, ex, ey, C.white, a); g.line(x0 + f, y0, ex + f, ey, K.red, a); g.line(x0 + f, y0 + 1, ex + f, ey + 1, C.blood2, a * 0.8); }
    sparks(g, x + 1 * f, u.mid, 7, [C.blood, C.red, C.blood2], ph(q, 0.2, 1), 9, 11, 2.2, f);
    return { draws: g.out, tint: q > 0.15 && q < 0.5 ? [C.red, 0.35 * (1 - ph(q, 0.15, 0.5))] : null, dx: q > 0.15 && q < 0.5 ? Math.round(3 * f * (1 - ph(q, 0.15, 0.5))) : 0 }; },
  glint(q, u) { const g = pen(), { x, y, f } = centre(u); const p = ph(q, 0, 0.25), a = fade(q, 0.45);
    if (p > 0 && a > 0) { const e = easeOut(p); g.line(x - 5 * f, y - 5, x - 5 * f + 11 * f * e, y - 5 + 9 * e, C.white, a); }
    const s = ph(q, 0.2, 0.7); if (s > 0 && s < 1) star(g, x + 1 * f, y, 3 + Math.round(Math.sin(s * Math.PI) * 2), C.white, Math.sin(s * Math.PI), K.cyan2);
    sparks(g, x, y + 1, 5, [C.blood, C.blood2], ph(q, 0.3, 1), 6, 9, 2, f);
    return { draws: g.out, tint: q > 0.25 && q < 0.8 ? [C.red, 0.3 * (1 - ph(q, 0.25, 0.8))] : null, dx: 0 }; },
  iaido(q, u) { const g = pen(), { x, y, f } = centre(u);
    const x0 = x - 11 * f, y0 = y - 4, x1 = x + 11 * f, y1 = y + 3;
    const show = q < 0.45 ? 1 : 0, thin = ph(q, 0.45, 0.75); // the line flashes across at once, holds, then shrinks to its middle
    if (show) { g.line(x0, y0, x1, y1, C.white); if (q > 0.12) g.line(x0 + 2 * f, y0 + 1, x1 - 2 * f, y1 + 1, K.samurai, 0.9); }
    else if (thin < 1) { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, k = 1 - thin; g.line(mx - (mx - x0) * k, my - (my - y0) * k, mx + (x1 - mx) * k, my + (y1 - my) * k, C.white, k); }
    sparks(g, (x0 + x1) / 2, (y0 + y1) / 2, 6, [K.samurai, C.blood], ph(q, 0.3, 1), 8, 4, 1.5, f);
    return { draws: g.out, tint: q > 0.28 && q < 0.5 ? [C.white, 0.55] : null, dx: q > 0.28 && q < 0.4 ? f : 0 }; },
  claws(q, u) { const g = pen(), { x, y, f } = centre(u);
    for (let i = 0; i < 3; i++) { const p = ph(q, i * 0.08, i * 0.08 + 0.25), a = fade(q, 0.45); if (p <= 0 || a <= 0) continue;
      const x0 = x - 3 * f + (i - 1) * 3 * f, y0 = y - 6, e = easeOut(p); const x1 = x0 + 5 * f * e, y1 = y0 + 10 * e;
      g.line(x0, y0, x1, y1, C.red, a); g.line(x0 + f, y0, x1 + f, y1, C.white, a * (1 - ph(q, 0.2, 0.4))); }
    sparks(g, x + 2 * f, y + 2, 4, [C.blood, C.blood2], ph(q, 0.3, 1), 6, 8, 2, f);
    return { draws: g.out, tint: q > 0.15 && q < 0.45 ? [C.red, 0.3] : null, dx: 0 }; },
  thump(q, u) { const g = pen(), { x, y, f } = centre(u); const p = ph(q, 0, 0.45);
    if (p > 0 && p < 1) { const r0 = 2 + 3 * easeOut(p), r1 = r0 + 4; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, i % 2 ? C.fire2 : C.white, 1 - p); } }
    if (q < 0.2) g.disc(x, y, 3 * (1 - q / 0.2) + 0.5, C.white, 1);
    const d = ph(q, 0.1, 1); if (d > 0 && d < 1) for (let i = 0; i < 4; i++) g.px(u.x + (i < 2 ? -1 : 1) * (u.hw + 1 + d * (3 + (i % 2) * 3)), u.y - 1 - Math.sin(d * Math.PI) * 2, K.dust, 1 - d);
    return { draws: g.out, tint: q < 0.3 ? [C.white, 0.4] : null, dx: q < 0.4 ? Math.round(3 * f * (1 - q / 0.4)) : 0 }; },
  bite(q, u) { const g = pen(), { x, y, f } = centre(u); const c = easeOut(ph(q, 0, 0.3)), a = fade(q, 0.5);
    if (a > 0) { const gap = 4 * (1 - c); for (let i = 0; i < 4; i++) { const tx = x - 3 * f + i * 2 * f; g.px(tx, y - 1 - gap, C.white, a); g.px(tx, y - 2 - gap, C.white, a); g.px(tx + f, y - 2 - gap, C.white, a * 0.6);
      g.px(tx + f, y + 1 + gap, C.white, a); g.px(tx + f, y + 2 + gap, C.white, a); g.px(tx, y + 2 + gap, C.white, a * 0.6); } }
    sparks(g, x, y, 6, [C.blood, C.red, C.blood2], ph(q, 0.3, 1), 7, 13, 2.2);
    return { draws: g.out, tint: q > 0.25 && q < 0.6 ? [C.red, 0.35] : null, dx: q > 0.25 && q < 0.4 ? f : 0 }; },
};
export const MELEE_LOOK_MS = 420;

// ---- shot looks per damage type ----
const dirOf = (a, b) => { if (!a) return [-1, 0]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
const LOOKS = {
  realArrow: { ms: 300,
    shot(s, h) { const g = pen(), [ux, uy] = dirOf(s, h), bk = (k) => [h.x - ux * k, h.y - uy * k];
      const [tx, ty] = bk(7); g.line(tx, ty, h.x - ux * 2, h.y - uy * 2, K.wood); // shaft
      g.px(h.x, h.y, C.white); g.px(h.x - ux, h.y - uy, C.grey); g.px(h.x - ux * 1.5 - uy, h.y - uy * 1.5 + ux, C.grey2); g.px(h.x - ux * 1.5 + uy, h.y - uy * 1.5 - ux, C.grey2); // head + barbs
      g.px(tx - uy, ty + ux, C.white); g.px(tx + uy, ty - ux, C.white); g.px(tx - ux - uy, ty - uy + ux, K.red); g.px(tx - ux + uy, ty - uy - ux, K.red); // fletching
      const [sx, sy] = bk(11); g.line(sx, sy, tx - ux * 2, ty - uy * 2, C.white, 0.25); return g.out; },
    hit(q, u, t, from) { const g = pen(), { x, y } = front(u), [ux, uy] = dirOf(from, { x, y }); const a = fade(q, 0.6), wob = q < 0.4 ? Math.round(Math.sin(t / 25) * (1 - q / 0.4)) : 0;
      if (a > 0) { const hx = x + ux * 2, hy = y + uy * 2, tx = hx - ux * 8 - uy * wob, ty = hy - uy * 8 + ux * wob; g.line(hx, hy, tx, ty, K.wood, a); for (const k of [0, 1]) { g.px(tx - uy + ux * k, ty + ux + uy * k, k ? K.red : C.white, a); g.px(tx + uy + ux * k, ty - ux + uy * k, k ? K.red : C.white, a); } }
      sparks(g, x, y, 5, [K.wood, C.white, K.wood2], ph(q, 0, 0.7), 6, 3, 1); return { draws: g.out, tint: q < 0.2 ? [C.white, 0.3] : null, dx: q < 0.25 ? Math.sign(ux) : 0 }; } },
  fireball: { ms: 460,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h), k = Math.floor(t / 45);
      for (let i = 1; i < 10; i++) { const w = Math.sin(i * 0.9 + t / 40) * (i / 6) * 1.6; const x = h.x - ux * i * 1.1 - uy * w, y = h.y - uy * i * 1.1 + ux * w;
        g.px(x, y, i < 3 ? C.fire2 : i < 6 ? C.fire : i < 8 ? C.blood : C.smoke2, 1 - i / 10); if (i < 5) g.px(x - uy, y + ux, C.fire, 0.7 - i * 0.12); }
      for (let i = 0; i < 2; i++) { const e = (k + i * 3) % 6; g.px(h.x - ux * (4 + e * 1.5) + (rnd(k + i) - 0.5) * 3, h.y - uy * (4 + e * 1.5) + e * 0.6, C.fire2, 0.8 - e * 0.12); }
      g.disc(h.x, h.y, 2.6, C.fire); g.disc(h.x + ux * 0.4, h.y + uy * 0.4, 1.6, C.fire2); g.px(h.x + ux, h.y + uy, C.white); return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u);
      if (q < 0.18) g.disc(x, y, 4 - q * 12, C.fire2); if (q > 0.05 && q < 0.6) g.ring(x, y, 3 + q * 12, C.fire, 1 - q / 0.6);
      sparks(g, x, y, 10, [C.fire, C.fire2, C.blood], ph(q, 0, 0.8), 10, 5, 0.8);
      for (let i = 0; i < 4; i++) { const p = ph(q, 0.25 + i * 0.06, 1); if (p > 0 && p < 1) g.disc(x + (i - 1.5) * 3, y - 2 - p * 8, 1 + p, C.smoke2, (1 - p) * 0.7); }
      return { draws: g.out, tint: [C.fire, 0.45 * (1 - q)], dx: 0 }; } },
  spear: { ms: 400,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h); g.line(h.x - ux * 7, h.y - uy * 7, h.x - ux * 3, h.y - uy * 3, C.holy); g.line(h.x - ux * 3, h.y - uy * 3, h.x, h.y, C.white);
      g.px(h.x - ux * 3 - uy, h.y - uy * 3 + ux, C.gold, 0.8); g.px(h.x - ux * 3 + uy, h.y - uy * 3 - ux, C.gold, 0.8); star(g, h.x, h.y, Math.floor(t / 70) % 2 ? 2 : 1, C.gold2, 0.9);
      for (let i = 0; i < 3; i++) g.px(h.x - ux * (9 + i * 2) + (rnd(i + Math.floor(t / 60)) - 0.5) * 2, h.y - uy * (9 + i * 2), C.holy, 0.6 - i * 0.18); return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); const p = 1 - ph(q, 0, 0.4);
      if (p > 0 && p < 1) { g.line(x, y - 6 * p, x, y + 6 * p, C.white, p); g.line(x - 4 * p, y - 1, x + 4 * p, y - 1, C.gold2, p); }
      for (let i = 0; i < 5; i++) { const w = ph(q, 0.1 + i * 0.07, 0.8 + i * 0.04); if (w > 0 && w < 1) g.px(x - 4 + i * 2, y - w * 11, i % 2 ? C.holy : C.white, 1 - w); }
      return { draws: g.out, tint: q < 0.35 ? [C.white, 0.45] : null, dx: 0 }; } },
  soulWisp: { ms: 520,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h);
      for (let i = 1; i < 11; i++) { const w = Math.sin(i * 0.7 - t / 50) * (i / 10) * 2.5; g.px(h.x - ux * i - uy * w, h.y - uy * i + ux * w, i < 4 ? K.green : i < 7 ? C.dark : C.dark2, 1 - i / 11); }
      g.disc(h.x, h.y, 2.2, C.dark); g.disc(h.x, h.y, 1.2, K.green); g.px(h.x - 1, h.y - 1, C.white); return g.out; },
    hit(q, u, t) { const g = pen(); const p = ph(q, 0, 0.9);
      for (let i = 0; i < 3; i++) { const a = p * Math.PI * 3 + i * 2.1, r = u.hw + 2 - p * 2; const x = u.x + Math.cos(a) * r, y = u.mid + 3 - p * 12 + Math.sin(a) * 1.5;
        if (p > 0 && p < 1) { g.px(x, y, K.green, 1 - p); g.px(x, y + 1, C.dark, (1 - p) * 0.8); g.px(x, y + 2, C.dark2, (1 - p) * 0.5); } }
      if (q < 0.2) g.disc(u.x + u.side * u.hw, u.mid, 2.5, K.green, 1 - q / 0.2);
      return { draws: g.out, tint: [C.dark2, 0.5 * (1 - q)], dx: 0 }; } },
  frostOrb: { ms: 460,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h);
      for (let i = 1; i < 6; i++) g.px(h.x - ux * i * 1.6 + (rnd(i + Math.floor(t / 60)) - 0.5) * 2, h.y - uy * i * 1.6 + (rnd(i * 3 + Math.floor(t / 60)) - 0.5) * 2, i % 2 ? C.white : C.ice2, 0.8 - i * 0.14);
      g.disc(h.x, h.y, 2.2, C.ice); g.disc(h.x - 0.4, h.y - 0.4, 1.1, C.white); if (Math.floor(t / 90) % 2) star(g, h.x, h.y, 3, C.white, 0.5); return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); const p = ph(q, 0, 0.55);
      if (p > 0 && p < 1) { const L = 2 + 6 * easeOut(p); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 2; const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
        g.line(x, y, ex, ey, C.white, 1 - p); const mx = x + Math.cos(a) * L * 0.6, my = y + Math.sin(a) * L * 0.6; g.px(mx + Math.cos(a + 1) * 1.5, my + Math.sin(a + 1) * 1.5, C.ice, 1 - p); g.px(mx + Math.cos(a - 1) * 1.5, my + Math.sin(a - 1) * 1.5, C.ice, 1 - p); } }
      sparks(g, x, y, 8, [C.ice, C.white, C.ice2], ph(q, 0.1, 1), 9, 3, 0.6);
      return { draws: g.out, tint: [C.ice, 0.55 * (1 - q)], dx: 0 }; } },
  ballLightning: { ms: 400,
    shot(s, h, t) { const g = pen(); const k = Math.floor(t / 60);
      for (let i = 0; i < 3; i++) { const a = rnd(k * 3 + i) * Math.PI * 2; bolt(g, h.x, h.y, h.x + Math.cos(a) * 4, h.y + Math.sin(a) * 4, C.elec, k * 5 + i, 2, 1.5); }
      g.disc(h.x, h.y, 1.6, C.elec); g.px(h.x, h.y, C.white); return g.out; },
    hit(q, u, t) { const g = pen(), { x, y } = front(u); const k = Math.floor(t / 60);
      if (q < 0.45) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + rnd(k + i); bolt(g, x, y, x + Math.cos(a) * 7, y + Math.sin(a) * 7, i % 2 ? C.white : C.elec, k * 7 + i, 3, 2, 1 - q / 0.45); }
      if (q < 0.15) g.disc(x, y, 2.5, C.white);
      sparks(g, x, y, 6, [C.elec, C.white], ph(q, 0.2, 1), 9, 11, 1);
      return { draws: g.out, tint: q < 0.45 ? (Math.floor(t / 50) % 2 ? [C.white, 0.6] : [C.elec, 0.3]) : null, dx: q < 0.45 ? (Math.floor(t / 40) % 2 ? 1 : -1) : 0 }; } },
  note: { ms: 420,
    shot(s, h) { // wobbles up and down along the way (by distance flown: about 3 waves over a normal shot)
      const g = pen(), [ux, uy] = dirOf(s, h), d = Math.hypot(h.x - s.x, h.y - s.y), wv = (k) => Math.sin(k * 0.17) * 3;
      const w = wv(d), x = h.x - uy * w, y = h.y + ux * w;
      g.disc(x, y + 1, 1.2, K.pink); g.px(x, y + 1, C.white); g.line(x + 1, y + 1, x + 1, y - 3, K.pink); g.px(x + 2, y - 3, K.pink); g.px(x + 2, y - 2, K.pink, 0.8);
      for (let i = 1; i < 4; i++) { const k = d - i * 4; if (k < 0) break; const wb = wv(k); g.px(s.x + ux * k - uy * wb, s.y + uy * k + ux * wb + 1, i % 2 ? C.gold : K.pink, 0.6 - i * 0.15); }
      return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); if (q > 0 && q < 0.6) g.ring(x, y, 2 + q * 8, K.pink, 1 - q / 0.6);
      for (let i = 0; i < 3; i++) { const p = ph(q, i * 0.12, 0.7 + i * 0.1); if (p <= 0 || p >= 1) continue; const nx = x + (i - 1) * 4 + Math.sin(p * 6 + i) , ny = y - 2 - p * 10; g.px(nx, ny, i % 2 ? C.gold : K.pink, 1 - p); g.px(nx + 1, ny, i % 2 ? C.gold : K.pink, 1 - p); g.line(nx + 1, ny, nx + 1, ny - 3, i % 2 ? C.gold : K.pink, 1 - p); }
      return { draws: g.out, tint: q < 0.3 ? [K.pink, 0.3] : null, dx: 0 }; } },
};
export const SHOT_LOOKS = { note: LOOKS.note, ranged: LOOKS.realArrow, fire: LOOKS.fireball, holy: LOOKS.spear, dark: LOOKS.soulWisp, ice: LOOKS.frostOrb, electric: LOOKS.ballLightning };
