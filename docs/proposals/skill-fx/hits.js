// HIT + SHOT REVIEW (proposal page, not game code; session 54, user: 'melee hits and ranged shots are too plain /
// samey': new looks per hero weapon (melee) and per damage type (shots)). Each row = TODAY (the game's own hitFx code)
// + options A / B / C drawn here with the game's pixel pen at game size (characters x3). The picked option is then
// moved into src/systems/hitFx.js. ROWS lists the page; drawRow(ctx, rowId, optKey, t) draws one frame.
import heroes from '../../../src/data/heroes.json';
import enemies from '../../../src/data/enemies.json';
import combat from '../../../src/data/combat.json';
import { artPixels, partArt } from '../../../src/systems/pixelArt.js';
import { bodyBox, pen, rnd, FX_COLORS as C } from '../../../src/systems/statusFx.js';
import { projectileFx, impactFx, IMPACT_MS } from '../../../src/systems/hitFx.js';

export const Z = 3, W = 130, H = 96;
const FLY = combat.attackTiming.hero.rangedHitMs, SWING = combat.attackTiming.hero.swingMs, PAUSE = 650;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const hero = (id) => heroes.find((h) => h.id === id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const fade = (q, from = 0.55) => 1 - ph(q, from, 1);
// extra colours (hero colours from their art, plus a few)
const K = { steel: 0xdfe8f5, steel2: 0x9fb0c8, spark: 0xffc46b, red: 0xff4a4a, cyan: 0x6ff0ff, cyan2: 0xc9fbff, samurai: 0xe04848,
  wood: 0xc68a5e, wood2: 0x8a5a32, pink: 0xff8ad8, green: 0x7dffb0, crack: 0x2a2236, dust: 0xa89880 };

// ---- fighters ------------------------------------------------------------------------------------
function actor(def, fx, fy, faceLeft) {
  const box = bodyBox(def.parts, def.height);
  const parts = Object.values(def.parts).map((p) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { px, left: p.x - w / 2, top: p.y - h / 2 };
  });
  return { def, fx, fy, faceLeft, parts, box };
}
const mix = (a, b, k) => { const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
function drawActor(ctx, a, tint, dx = 0) {
  for (const p of a.parts) p.px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    const relX = p.left + x;
    const gx = Math.round((a.faceLeft ? a.fx - relX - 1 : a.fx + relX) + dx), gy = Math.round(a.fy + p.top + y);
    ctx.fillStyle = hex(tint ? mix(c, tint[0], tint[1]) : c); ctx.fillRect(gx * Z, gy * Z, Z, Z);
  }));
}
function body(a, side = 1) {
  const x = a.fx + (a.faceLeft ? -a.box.cx : a.box.cx), y = a.fy;
  return { x, y, top: y + a.box.top, mid: y + a.box.mid, bot: y + a.box.bot, hw: a.box.hw, side };
}
const centre = (a) => { const b = body(a); return { x: b.x, y: b.mid }; };
function room(ctx) {
  ctx.fillStyle = '#1b1624'; ctx.fillRect(0, 0, W * Z, H * Z);
  ctx.fillStyle = '#231d2e';
  for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) ctx.fillRect(x * Z, y * Z, 11 * Z, 7 * Z);
}
function paint(ctx, draws) {
  for (const [x, y, w, h, c, a] of draws) { ctx.globalAlpha = a ?? 1; ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x) * Z - Math.floor(Z / 2), Math.round(y) * Z, w * Z, h * Z); }
  ctx.globalAlpha = 1;
}

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

// ---- MELEE options: (q 0..1, u body, t) -> { draws, tint, dx } ------------------------------------
const M = {
  // Knight
  steelArc(q, u) { const g = pen(), { x, y, f } = front(u);
    swoosh(g, x - 3 * f, y - 2, 9, -1.8, 1.25, q, f, [C.white, K.steel, K.steel2], 3);
    sparks(g, x, y + 1, 6, [K.spark, C.white, C.fire2], ph(q, 0.25, 1), 9, 3, 1.2, -f);
    return { draws: g.out, tint: q < 0.3 ? [C.white, 0.35] : null, dx: q < 0.25 ? f : 0 }; },
  stabClang(q, u) { const g = pen(), { x, y, f } = front(u); const p = ph(q, 0, 0.25), a = fade(q, 0.45);
    if (p > 0 && a > 0) { const tip = x - 9 * f + 12 * f * easeOut(p); g.line(x - 11 * f, y, tip - f, y, K.steel2, a); g.line(x - 6 * f, y, tip - f, y, K.steel, a); g.px(tip, y, C.white, a); }
    const s = ph(q, 0.2, 0.6); if (s > 0 && s < 1) star(g, x, y, Math.round(4 * (1 - s)) + 1, C.fire2, 1 - s);
    sparks(g, x, y, 7, [K.spark, C.white], ph(q, 0.2, 1), 10, 7, 1.5, -f);
    return { draws: g.out, tint: q > 0.2 && q < 0.4 ? [C.white, 0.4] : null, dx: q > 0.2 && q < 0.45 ? 2 * f : 0 }; },
  overhead(q, u) { const g = pen(), { x, f } = front(u); const p = ph(q, 0, 0.35), a = fade(q, 0.5);
    const x0 = x + 1 * f, top = u.top - 4, len = (u.y - top) * easeOut(p);
    for (let i = 0; i <= len; i++) { const k = (1 - (len - i) / 12) * a; if (k <= 0) continue; g.px(x0, top + i, C.white, k); g.px(x0 - f, top + i, K.steel, k * 0.8); g.px(x0 + f, top + i, K.steel2, k * 0.5); }
    const d = ph(q, 0.3, 1); if (d > 0 && d < 1) for (let i = 0; i < 6; i++) g.px(x0 + (i - 2.5) * 2 * d * 2, u.y - 1 - Math.sin(d * Math.PI) * (2 + rnd(i) * 2), K.dust, 1 - d);
    return { draws: g.out, tint: q > 0.25 && q < 0.45 ? [C.white, 0.35] : null, dx: 0 }; },
  // Berserker
  chop(q, u) { const g = pen(), { x, f } = front(u); const p = ph(q, 0, 0.22), a = fade(q, 0.4);
    const x0 = x - 4 * f, y0 = u.top - 2, x1 = x + 6 * f, y1 = u.y - 3; const ex = x0 + (x1 - x0) * easeOut(p), ey = y0 + (y1 - y0) * easeOut(p);
    if (p > 0 && a > 0) { g.line(x0 - f, y0, ex - f, ey, K.red, a); g.line(x0, y0, ex, ey, C.white, a); g.line(x0 + f, y0, ex + f, ey, K.red, a); g.line(x0 + f, y0 + 1, ex + f, ey + 1, C.blood2, a * 0.8); }
    sparks(g, x + 1 * f, u.mid, 7, [C.blood, C.red, C.blood2], ph(q, 0.2, 1), 9, 11, 2.2, f);
    return { draws: g.out, tint: q > 0.15 && q < 0.5 ? [C.red, 0.35 * (1 - ph(q, 0.15, 0.5))] : null, dx: q > 0.15 && q < 0.5 ? Math.round(3 * f * (1 - ph(q, 0.15, 0.5))) : 0 }; },
  cleave(q, u) { const g = pen(), { x, y, f } = front(u);
    swoosh(g, x - 5 * f, y - 2, 11, -1.9, 1.15, q, f, [C.white, C.fire2, K.red, C.blood2], 4, 2.2, 1.3);
    sparks(g, x + 2 * f, y, 6, [C.bone, K.wood2, C.blood], ph(q, 0.25, 1), 12, 5, 2, f);
    return { draws: g.out, tint: q > 0.2 && q < 0.45 ? [C.red, 0.3] : null, dx: q > 0.2 && q < 0.5 ? 2 * f : 0 }; },
  crush(q, u) { const g = pen(), { x, f } = front(u); const fl = 1 - ph(q, 0, 0.3);
    if (fl > 0 && fl < 1) { star(g, x, u.mid - 2, 5, C.fire2, fl); star(g, x, u.mid - 2, 2, C.white, fl); }
    const c = ph(q, 0.05, 0.25), ca = fade(q, 0.5); // a crack in the floor under it
    if (c > 0 && ca > 0) for (let i = -Math.round(8 * c); i <= Math.round(8 * c); i++) { const cy = u.y + (Math.abs(i) % 4 === 2 ? 1 : 0); g.px(u.x + i, cy, K.crack, ca); if (Math.abs(i) % 5 === 3) g.px(u.x + i, cy + 1, K.crack, ca * 0.7); }
    const d = ph(q, 0.1, 1); if (d > 0 && d < 1) for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, k = i % 4; g.px(u.x + s * (u.hw + 1 + d * (4 + k * 3)), u.y - 1 - Math.sin(d * Math.PI) * (2 + k), K.dust, 1 - d); }
    return { draws: g.out, tint: q < 0.3 ? [C.white, 0.4] : null, dx: 0, dy: q < 0.25 ? 1 : 0 }; },
  // Rogue
  quickX(q, u) { const g = pen(), { x, y, f } = front(u);
    for (const [k, s] of [[0, 1], [0.22, -1]]) { const p = ph(q, k, k + 0.45), a = fade(p, 0.4); if (p <= 0 || p >= 1) continue;
      const L = 5, e = easeOut(Math.min(1, p * 2.2)); const x0 = x - L * f + 1 * f, y0 = y - L * s, x1 = x0 + 2 * L * f * e, y1 = y0 + 2 * L * s * e;
      g.line(x0, y0, x1, y1, K.cyan, a); g.line(x0, y0 + s, x1, y1 + s, K.cyan2, a * 0.6); g.px(x1, y1, C.white, a); }
    sparks(g, x, y, 4, [C.blood, C.red], ph(q, 0.35, 1), 6, 2, 1.5, f);
    return { draws: g.out, tint: null, dx: q > 0.1 && q < 0.5 ? (Math.floor(q * 12) % 2 ? 1 : -1) : 0 }; },
  flurry(q, u) { const g = pen(), { x, y, f } = front(u);
    [[0, -3], [0.2, 2], [0.4, -1]].forEach(([k, dy], i) => { const p = ph(q, k, k + 0.35); if (p <= 0 || p >= 1) return; const a = 1 - p, e = easeOut(Math.min(1, p * 3));
      const tip = x - 6 * f + 9 * f * e; g.line(x - 7 * f, y + dy, tip, y + dy, K.cyan, a * 0.8); g.px(tip, y + dy, C.white, a);
      if (p > 0.3) star(g, x + 1 * f, y + dy, 1, K.cyan2, a, C.white); });
    return { draws: g.out, tint: null, dx: [0.05, 0.25, 0.45].some((k) => q > k && q < k + 0.08) ? f : 0 }; },
  glint(q, u) { const g = pen(), { x, y, f } = front(u); const p = ph(q, 0, 0.25), a = fade(q, 0.45);
    if (p > 0 && a > 0) { const e = easeOut(p); g.line(x - 5 * f, y - 5, x - 5 * f + 11 * f * e, y - 5 + 9 * e, C.white, a); }
    const s = ph(q, 0.2, 0.7); if (s > 0 && s < 1) star(g, x + 1 * f, y, 3 + Math.round(Math.sin(s * Math.PI) * 2), C.white, Math.sin(s * Math.PI), K.cyan2);
    sparks(g, x, y + 1, 5, [C.blood, C.blood2], ph(q, 0.3, 1), 6, 9, 2, f);
    return { draws: g.out, tint: q > 0.25 && q < 0.8 ? [C.red, 0.3 * (1 - ph(q, 0.25, 0.8))] : null, dx: 0 }; },
  // Samurai
  iaido(q, u) { const g = pen(), { x, y, f } = front(u);
    const x0 = x - 9 * f, y0 = y - 4, x1 = x + 13 * f, y1 = y + 3;
    const show = q < 0.45 ? 1 : 0, thin = ph(q, 0.45, 0.75); // the line flashes across at once, holds, then shrinks to its middle
    if (show) { g.line(x0, y0, x1, y1, C.white); if (q > 0.12) g.line(x0 + 2 * f, y0 + 1, x1 - 2 * f, y1 + 1, K.samurai, 0.9); }
    else if (thin < 1) { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, k = 1 - thin; g.line(mx - (mx - x0) * k, my - (my - y0) * k, mx + (x1 - mx) * k, my + (y1 - my) * k, C.white, k); }
    sparks(g, (x0 + x1) / 2, (y0 + y1) / 2, 6, [K.samurai, C.blood], ph(q, 0.3, 1), 8, 4, 1.5, f);
    return { draws: g.out, tint: q > 0.28 && q < 0.5 ? [C.white, 0.55] : null, dx: q > 0.28 && q < 0.4 ? f : 0 }; },
  crimson(q, u) { const g = pen(), { x, y, f } = front(u);
    swoosh(g, x - 3 * f, y - 1, 10, -2.3, 0.95, q, f, [C.white, K.samurai, C.blood2], 2, 2.6, 2.4);
    sparks(g, x, y, 4, [K.samurai, C.white], ph(q, 0.3, 1), 8, 6, 1, f);
    return { draws: g.out, tint: q > 0.2 && q < 0.4 ? [K.samurai, 0.3] : null, dx: 0 }; },
  petals(q, u) { const g = pen(), { x, y, f } = front(u);
    swoosh(g, x - 3 * f, y - 1, 9, -2.0, 0.95, q, f, [C.white, C.petal], 2, 2.4);
    const p = ph(q, 0.15, 1); if (p > 0 && p < 1) for (let i = 0; i < 6; i++) {
      const px = x + f * (rnd(i * 3) * 6 - 1 + p * 8 * (0.5 + rnd(i))), py = y - 4 + rnd(i * 7) * 6 + p * 9 + Math.sin(p * 9 + i) * 1.5;
      g.px(px, py, i % 2 ? C.petal : 0xffd3e6, 1 - p); if (i % 3 === 0) g.px(px + 1, py, C.petal, (1 - p) * 0.7); }
    return { draws: g.out, tint: q > 0.2 && q < 0.4 ? [C.petal, 0.25] : null, dx: 0 }; },
  // Enemies
  claws(q, u) { const g = pen(), { x, y, f } = front(u);
    for (let i = 0; i < 3; i++) { const p = ph(q, i * 0.08, i * 0.08 + 0.25), a = fade(q, 0.45); if (p <= 0 || a <= 0) continue;
      const x0 = x - 3 * f + (i - 1) * 3 * f, y0 = y - 6, e = easeOut(p); const x1 = x0 + 5 * f * e, y1 = y0 + 10 * e;
      g.line(x0, y0, x1, y1, C.red, a); g.line(x0 + f, y0, x1 + f, y1, C.white, a * (1 - ph(q, 0.2, 0.4))); }
    sparks(g, x + 2 * f, y + 2, 4, [C.blood, C.blood2], ph(q, 0.3, 1), 6, 8, 2, f);
    return { draws: g.out, tint: q > 0.15 && q < 0.45 ? [C.red, 0.3] : null, dx: 0 }; },
  thump(q, u) { const g = pen(), { x, y, f } = front(u); const p = ph(q, 0, 0.45);
    if (p > 0 && p < 1) { const r0 = 2 + 3 * easeOut(p), r1 = r0 + 4; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, i % 2 ? C.fire2 : C.white, 1 - p); } }
    if (q < 0.2) g.disc(x, y, 3 * (1 - q / 0.2) + 0.5, C.white, 1);
    const d = ph(q, 0.1, 1); if (d > 0 && d < 1) for (let i = 0; i < 4; i++) g.px(u.x + (i < 2 ? -1 : 1) * (u.hw + 1 + d * (3 + (i % 2) * 3)), u.y - 1 - Math.sin(d * Math.PI) * 2, K.dust, 1 - d);
    return { draws: g.out, tint: q < 0.3 ? [C.white, 0.4] : null, dx: q < 0.4 ? Math.round(3 * f * (1 - q / 0.4)) : 0 }; },
  bite(q, u) { const g = pen(), { x, y, f } = front(u); const c = easeOut(ph(q, 0, 0.3)), a = fade(q, 0.5);
    if (a > 0) { const gap = 4 * (1 - c); for (let i = 0; i < 4; i++) { const tx = x - 3 * f + i * 2 * f; g.px(tx, y - 1 - gap, C.white, a); g.px(tx, y - 2 - gap, C.white, a); g.px(tx + f, y - 2 - gap, C.white, a * 0.6);
      g.px(tx + f, y + 1 + gap, C.white, a); g.px(tx + f, y + 2 + gap, C.white, a); g.px(tx, y + 2 + gap, C.white, a * 0.6); } }
    sparks(g, x, y, 6, [C.blood, C.red, C.blood2], ph(q, 0.3, 1), 7, 13, 2.2);
    return { draws: g.out, tint: q > 0.25 && q < 0.6 ? [C.red, 0.35] : null, dx: q > 0.25 && q < 0.4 ? f : 0 }; },
};

// ---- SHOT options: shot(start, head, t, p) -> draws; hit(q, u, t, from) -> { draws, tint, dx } -----------
const dirOf = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
const S = {
  realArrow: { ms: 300,
    shot(s, h) { const g = pen(), [ux, uy] = dirOf(s, h), bk = (k) => [h.x - ux * k, h.y - uy * k];
      const [tx, ty] = bk(7); g.line(tx, ty, h.x - ux * 2, h.y - uy * 2, K.wood); // shaft
      g.px(h.x, h.y, C.white); g.px(h.x - ux, h.y - uy, C.grey); g.px(h.x - ux * 1.5 - uy, h.y - uy * 1.5 + ux, C.grey2); g.px(h.x - ux * 1.5 + uy, h.y - uy * 1.5 - ux, C.grey2); // head + barbs
      g.px(tx - uy, ty + ux, C.white); g.px(tx + uy, ty - ux, C.white); g.px(tx - ux - uy, ty - uy + ux, K.red); g.px(tx - ux + uy, ty - uy - ux, K.red); // fletching
      const [sx, sy] = bk(11); g.line(sx, sy, tx - ux * 2, ty - uy * 2, C.white, 0.25); return g.out; },
    hit(q, u, t, from) { const g = pen(), { x, y } = front(u), [ux, uy] = dirOf(from, { x, y }); const a = fade(q, 0.6), wob = q < 0.4 ? Math.round(Math.sin(t / 25) * (1 - q / 0.4)) : 0;
      if (a > 0) { const hx = x + ux * 2, hy = y + uy * 2, tx = hx - ux * 8 - uy * wob, ty = hy - uy * 8 + ux * wob; g.line(hx, hy, tx, ty, K.wood, a); for (const k of [0, 1]) { g.px(tx - uy + ux * k, ty + ux + uy * k, k ? K.red : C.white, a); g.px(tx + uy + ux * k, ty - ux + uy * k, k ? K.red : C.white, a); } }
      sparks(g, x, y, 5, [K.wood, C.white, K.wood2], ph(q, 0, 0.7), 6, 3, 1); return { draws: g.out, tint: q < 0.2 ? [C.white, 0.3] : null, dx: q < 0.25 ? Math.sign(ux) : 0 }; } },
  whistle: { ms: 260,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h); const d = Math.hypot(h.x - s.x, h.y - s.y);
      for (let i = 5; i < Math.min(18, d); i++) g.px(h.x - ux * i - uy * Math.sin(i * 0.8 - t / 30) * (i / 18), h.y - uy * i + ux * Math.sin(i * 0.8 - t / 30) * (i / 18), C.white, 0.55 * (1 - i / 18));
      g.line(h.x - ux * 5, h.y - uy * 5, h.x - ux, h.y - uy, K.wood); g.px(h.x, h.y, C.white); return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); const p = ph(q, 0, 0.5);
      if (p > 0 && p < 1) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.line(x + ax * 2 * p, y + ay * 2 * p, x + ax * (2 + 5 * p), y + ay * (2 + 5 * p), C.white, 1 - p);
      sparks(g, x, y, 6, [C.white, 0xe6e6b8], q, 8, 9); return { draws: g.out, tint: q < 0.25 ? [C.white, 0.35] : null, dx: 0 }; } },
  note: { ms: 420,
    shot(s, h, t, p) { const g = pen(), [ux, uy] = dirOf(s, h), w = Math.sin(p * Math.PI * 3) * 3; const x = h.x - uy * w, y = h.y + ux * w;
      g.disc(x, y + 1, 1.2, K.pink); g.px(x, y + 1, C.white); g.line(x + 1, y + 1, x + 1, y - 3, K.pink); g.px(x + 2, y - 3, K.pink); g.px(x + 2, y - 2, K.pink, 0.8);
      for (let i = 1; i < 4; i++) { const q = p - i * 0.07; if (q < 0) break; const wb = Math.sin(q * Math.PI * 3) * 3; g.px(s.x + (h.x - s.x) * q / p - uy * wb, s.y + (h.y - s.y) * q / p + ux * wb + 1, i % 2 ? C.gold : K.pink, 0.6 - i * 0.15); }
      return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); if (q > 0 && q < 0.6) g.ring(x, y, 2 + q * 8, K.pink, 1 - q / 0.6);
      for (let i = 0; i < 3; i++) { const p = ph(q, i * 0.12, 0.7 + i * 0.1); if (p <= 0 || p >= 1) continue; const nx = x + (i - 1) * 4 + Math.sin(p * 6 + i) , ny = y - 2 - p * 10; g.px(nx, ny, i % 2 ? C.gold : K.pink, 1 - p); g.px(nx + 1, ny, i % 2 ? C.gold : K.pink, 1 - p); g.line(nx + 1, ny, nx + 1, ny - 3, i % 2 ? C.gold : K.pink, 1 - p); }
      return { draws: g.out, tint: q < 0.3 ? [K.pink, 0.3] : null, dx: 0 }; } },
  waves: { ms: 380,
    shot(s, h, t, p) { const g = pen(), [ux, uy] = dirOf(s, h), ang = Math.atan2(uy, ux);
      for (let i = 0; i < 3; i++) { const back = i * 3, r = 2 + i + (Math.floor(t / 80) % 2), a = 1 - i * 0.28; const cx = h.x - ux * (back + r), cy = h.y - uy * (back + r);
        for (let k = -3; k <= 3; k++) { const aa = ang + k * 0.28; g.px(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r, i ? K.pink : C.white, a); } }
      return g.out; },
    hit(q, u, t) { const g = pen(), { x, y } = front(u);
      for (let i = 0; i < 2; i++) { const p = ph(q, i * 0.2, 0.7 + i * 0.2); if (p > 0 && p < 1) g.ring(x, y, 2 + p * 9, i ? K.pink : C.white, 1 - p, (2 + p * 9) * 1.3); }
      return { draws: g.out, tint: q < 0.3 ? [K.pink, 0.3] : null, dx: q < 0.45 ? (Math.floor(t / 40) % 2 ? 1 : -1) : 0 }; } },
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
  dart: { ms: 520,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h);
      g.px(h.x, h.y, C.white); for (let i = 1; i < 8; i++) { const x = h.x - ux * i, y = h.y - uy * i; g.px(x, y, i < 3 ? C.fire2 : i < 6 ? C.fire : C.blood, 1 - i / 9); if (i > 1 && i < 5) { g.px(x - uy, y + ux, C.fire, 0.8); g.px(x + uy, y - ux, C.fire, 0.8); } }
      for (let i = 0; i < 2; i++) { const a = t / 60 + i * Math.PI; g.px(h.x - ux * 3 + Math.cos(a) * 3 * -uy, h.y - uy * 3 + Math.cos(a) * 3 * ux, C.fire2, 0.9); }
      return g.out; },
    hit(q, u, t) { const g = pen(), { x } = front(u);
      for (let i = 0; i < 5; i++) { const p = ph(q, i * 0.07, 0.6 + i * 0.08); if (p <= 0 || p >= 1) continue; const fx = u.x - u.hw + 1 + i * (u.hw * 2 - 2) / 4, base = u.mid + 2 - (i % 2) * 2, hgt = 2 + Math.sin(p * Math.PI) * 5 + (Math.floor(t / 50 + i) % 2);
        for (let k = 0; k < hgt; k++) g.px(fx + (k > 2 ? (Math.floor(t / 70 + i) % 2 ? 1 : 0) : 0), base - k, k < 2 ? C.fire2 : k < 4 ? C.fire : C.blood, 1 - k / (hgt + 1)); }
      if (q < 0.15) g.disc(x, u.mid, 2, C.fire2);
      return { draws: g.out, tint: [C.fire, 0.45 * (1 - q)], dx: 0 }; } },
  spear: { ms: 400,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h); g.line(h.x - ux * 7, h.y - uy * 7, h.x - ux * 3, h.y - uy * 3, C.holy); g.line(h.x - ux * 3, h.y - uy * 3, h.x, h.y, C.white);
      g.px(h.x - ux * 3 - uy, h.y - uy * 3 + ux, C.gold, 0.8); g.px(h.x - ux * 3 + uy, h.y - uy * 3 - ux, C.gold, 0.8); star(g, h.x, h.y, Math.floor(t / 70) % 2 ? 2 : 1, C.gold2, 0.9);
      for (let i = 0; i < 3; i++) g.px(h.x - ux * (9 + i * 2) + (rnd(i + Math.floor(t / 60)) - 0.5) * 2, h.y - uy * (9 + i * 2), C.holy, 0.6 - i * 0.18); return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); const p = 1 - ph(q, 0, 0.4);
      if (p > 0 && p < 1) { g.line(x, y - 6 * p, x, y + 6 * p, C.white, p); g.line(x - 4 * p, y - 1, x + 4 * p, y - 1, C.gold2, p); }
      for (let i = 0; i < 5; i++) { const w = ph(q, 0.1 + i * 0.07, 0.8 + i * 0.04); if (w > 0 && w < 1) g.px(x - 4 + i * 2, y - w * 11, i % 2 ? C.holy : C.white, 1 - w); }
      return { draws: g.out, tint: q < 0.35 ? [C.white, 0.45] : null, dx: 0 }; } },
  starMote: { ms: 420,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h); const k = Math.floor(t / 80) % 2;
      if (k) { for (let i = 1; i <= 3; i++) { const a = 1 - i * 0.2; g.px(h.x + i, h.y, C.holy, a); g.px(h.x - i, h.y, C.holy, a); g.px(h.x, h.y + i, C.holy, a); g.px(h.x, h.y - i, C.holy, a); } }
      else { for (let i = 1; i <= 2; i++) { const a = 1 - i * 0.25; g.px(h.x + i, h.y + i, C.holy, a); g.px(h.x - i, h.y - i, C.holy, a); g.px(h.x - i, h.y + i, C.holy, a); g.px(h.x + i, h.y - i, C.holy, a); } }
      g.disc(h.x, h.y, 1, C.gold2); g.px(h.x, h.y, C.white);
      for (let i = 1; i < 5; i++) g.px(h.x - ux * i * 2.2 + (rnd(i + Math.floor(t / 50)) - 0.5) * 3, h.y - uy * i * 2.2 + (rnd(i * 5 + Math.floor(t / 50)) - 0.5) * 3, i % 2 ? C.white : C.holy, 0.8 - i * 0.17);
      return g.out; },
    hit(q, u, t) { const g = pen(), { x, y } = front(u); const p = ph(q, 0, 0.6);
      if (p > 0 && p < 1) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t / 500, r0 = 1 + 4 * easeOut(p), r1 = r0 + (i % 2 ? 2 : 4); g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, i % 2 ? C.white : C.holy, 1 - p); }
      if (q < 0.2) star(g, x, y, 2, C.gold2, 1);
      return { draws: g.out, tint: q < 0.35 ? [C.holy, 0.4] : null, dx: 0 }; } },
  soulWisp: { ms: 520,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h);
      for (let i = 1; i < 11; i++) { const w = Math.sin(i * 0.7 - t / 50) * (i / 10) * 2.5; g.px(h.x - ux * i - uy * w, h.y - uy * i + ux * w, i < 4 ? K.green : i < 7 ? C.dark : C.dark2, 1 - i / 11); }
      g.disc(h.x, h.y, 2.2, C.dark); g.disc(h.x, h.y, 1.2, K.green); g.px(h.x - 1, h.y - 1, C.white); return g.out; },
    hit(q, u, t) { const g = pen(); const p = ph(q, 0, 0.9);
      for (let i = 0; i < 3; i++) { const a = p * Math.PI * 3 + i * 2.1, r = u.hw + 2 - p * 2; const x = u.x + Math.cos(a) * r, y = u.mid + 3 - p * 12 + Math.sin(a) * 1.5;
        if (p > 0 && p < 1) { g.px(x, y, K.green, 1 - p); g.px(x, y + 1, C.dark, (1 - p) * 0.8); g.px(x, y + 2, C.dark2, (1 - p) * 0.5); } }
      if (q < 0.2) g.disc(u.x + u.side * u.hw, u.mid, 2.5, K.green, 1 - q / 0.2);
      return { draws: g.out, tint: [C.dark2, 0.5 * (1 - q)], dx: 0 }; } },
  spiral: { ms: 480,
    shot(s, h, t, p) { const g = pen(), [ux, uy] = dirOf(s, h), d = Math.hypot(h.x - s.x, h.y - s.y);
      for (const [ph0, col] of [[0, C.dark], [Math.PI, C.dark2]]) for (let i = 0; i < 6; i++) { const back = i * 1.3; if (back > d) break; const w = Math.sin((d - back) * 0.45 + ph0) * 2.5;
        const x = h.x - ux * back - uy * w, y = h.y - uy * back + ux * w; if (i === 0) { g.disc(x, y, 1.4, col); g.px(x, y, C.white, 0.8); } else g.px(x, y, col, 1 - i / 6); }
      return g.out; },
    hit(q, u) { const g = pen(), { x, y } = front(u); const r = ph(q, 0, 0.5);
      if (r > 0 && r < 1) { g.ring(u.x, u.mid, 9 * (1 - r), C.dark); g.ring(u.x, u.mid, 6 * (1 - r), C.dark2); }
      const c = ph(q, 0.4, 0.8); if (c > 0 && c < 1) for (const [ax, ay] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, 1], [0, -1]]) g.line(u.x, u.mid, u.x + ax * 5 * easeOut(c), u.mid + ay * 5 * easeOut(c), C.dark, 1 - c);
      return { draws: g.out, tint: [C.dark2, 0.55 * (1 - q)], dx: 0 }; } },
  icicle: { ms: 440,
    shot(s, h, t) { const g = pen(), [ux, uy] = dirOf(s, h);
      g.px(h.x, h.y, C.white); g.line(h.x - ux, h.y - uy, h.x - ux * 6, h.y - uy * 6, C.ice); g.line(h.x - ux * 2, h.y - uy * 2, h.x - ux * 4, h.y - uy * 4, C.ice2);
      for (const s2 of [1, -1]) g.line(h.x - ux * 3 + uy * s2, h.y - uy * 3 - ux * s2, h.x - ux * 6 + uy * s2, h.y - uy * 6 - ux * s2, C.ice, 0.8);
      for (let i = 0; i < 3; i++) { const k = (Math.floor(t / 70) + i * 2) % 6; g.px(h.x - ux * (7 + k * 2) + (rnd(i * 4) - 0.5) * 3, h.y - uy * (7 + k * 2) + k, C.white, 0.7 - k * 0.1); }
      return g.out; },
    hit(q, u, t, from) { const g = pen(), { x, y } = front(u), [ux] = dirOf(from, { x, y });
      for (let i = 0; i < 7; i++) { const p = ph(q, 0, 0.85); if (p <= 0 || p >= 1) continue; const a = (rnd(i * 9) - 0.5) * 2.4 + (ux > 0 ? Math.PI : 0), d = (3 + rnd(i) * 7) * easeOut(p);
        const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.7 + p * p * 10; g.px(sx, sy, i % 2 ? C.white : C.ice, 1 - p); if (i % 3 === 0) g.px(sx, sy + 1, C.ice2, 1 - p); }
      if (q < 0.18) { g.disc(x, y, 2.5, C.white); }
      return { draws: g.out, tint: [C.ice, 0.55 * (1 - q)], dx: 0 }; } },
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
  hopSpark: { ms: 360,
    shot(s, h, t, p) { const g = pen(); const step = 0.2, p0 = Math.max(0, Math.floor(p / step) * step), p1 = Math.max(0, p0 - step);
      const at = (k) => ({ x: s.x + (h.x - s.x) * (k / Math.max(p, 0.001)), y: s.y + (h.y - s.y) * (k / Math.max(p, 0.001)) });
      const a = at(p1), b = at(p0); bolt(g, a.x, a.y, b.x, b.y, C.elec, Math.floor(t / 50), 4, 3); bolt(g, a.x, a.y - 1, b.x, b.y - 1, C.white, Math.floor(t / 50) + 9, 4, 2, 0.6);
      star(g, b.x, b.y, 2, C.elec, 1); return g.out; },
    hit(q, u, t) { const g = pen(), { x, y } = front(u);
      if (q < 0.35) { const L = 3 + Math.round(q * 10); for (const [ax, ay] of [[1, -1], [-1, 1], [1, 1], [-1, -1], [1, 0], [-1, 0]]) bolt(g, x, y, x + ax * L, y + ay * L * 0.7, C.elec, Math.floor(t / 60) + ax * 3 + ay, 2, 1.5, 1 - q / 0.35); }
      sparks(g, x, y, 8, [C.elec, C.white], ph(q, 0.05, 1), 10, 7, 0.8);
      return { draws: g.out, tint: q < 0.35 ? (Math.floor(t / 60) % 2 ? [C.white, 0.5] : null) : null, dx: q < 0.35 ? (Math.floor(t / 50) % 2 ? 1 : -1) : 0 }; } },
};

// ---- the rows ------------------------------------------------------------------------------------
// melee: attacker steps in beside the target. opts: key -> { name, desc, fn (M key) | today: true, attacker? }
const mel = (fn, name, desc, attacker) => ({ fn, name, desc, attacker });
const sh = (fn, name, desc) => ({ fn, name, desc });
export const ROWS = [
  { id: 'knight', group: 'melee', name: 'Knight: sword', users: 'Knight basic hit', attacker: 'knight', type: 'melee',
    opts: { A: mel('steelArc', 'Steel arc', 'A wide steel-blue sword arc with a bright edge; orange sparks fly off like metal on metal.'),
      B: mel('stabClang', 'Stab + clang', 'A straight sword thrust into the target, a small gold star where it lands, sparks; the target is pushed back a bit.'),
      C: mel('overhead', 'Overhead cut', 'A straight cut from above down to the feet, then a little dust on the floor.') } },
  { id: 'berserker', group: 'melee', name: 'Berserker: axe', users: 'Berserker basic hit', attacker: 'berserker', type: 'melee',
    opts: { A: mel('chop', 'Heavy chop', 'A thick red-and-white diagonal chop, blood drops fall, the target is knocked back.'),
      B: mel('cleave', 'Big cleave', 'A huge fiery red crescent, bone and wood chips fly.'),
      C: mel('crush', 'Crushing blow', 'A gold flash, the floor cracks under the target and dust puffs out both sides.') } },
  { id: 'rogue', group: 'melee', name: 'Rogue: daggers', users: 'Rogue basic hit', attacker: 'rogue', type: 'melee',
    opts: { A: mel('quickX', 'Quick X', 'Two fast cyan dagger cuts that cross in an X, a few drops of blood, a jitter.'),
      B: mel('flurry', 'Stab flurry', 'Three quick stabs at different heights, one after the other.'),
      C: mel('glint', 'Backstab glint', 'One thin cut, a bright white twinkle on the blade, the target goes a bit red (bleeding).') } },
  { id: 'samurai', group: 'melee', name: 'Samurai: katana', users: 'Samurai basic hit', attacker: 'samurai', type: 'melee',
    opts: { A: mel('iaido', 'Iaido line', 'One long white cut appears all at once, a red line follows, THEN the target flashes (the classic late hit).'),
      B: mel('crimson', 'Crimson crescent', 'A thin, very fast red crescent with a long tail.'),
      C: mel('petals', 'Petal cut', 'A pink-white slash and a few pink petals drift down.') } },
  { id: 'enemy', group: 'melee', name: 'Enemies: melee', users: 'All enemy melee hits (today they all share one grey slash). Each look could go to a kind of enemy: claws for beasts, thump for brutes, bite for rats / spiders...', attacker: 'goblin', who: 'enemy', type: 'melee',
    opts: { A: mel('claws', 'Claws', 'Three red claw scratches one after the other (shown on the Hound).', 'hound'),
      B: mel('thump', 'Thump', 'A blunt hit: white burst of short rays, the hero is knocked back, dust (shown on the Orc Brute).', 'orcBrute'),
      C: mel('bite', 'Bite', 'Two rows of white teeth snap shut, then blood (shown on the Rat).', 'rat') } },
  { id: 'arrow', group: 'ranged', name: 'Arrow', users: 'Archer, Skeleton / Goblin Archer, Quiver of Plenty', shooter: 'archer', type: 'ranged',
    opts: { A: sh('realArrow', 'Real arrow', 'A proper arrow (steel head, red-white feathers); it STICKS in the target and wobbles, then splinters.'),
      B: sh('whistle', 'Whistling arrow', 'A fast arrow with a long white wind trail; a sharp white burst when it hits.') } },
  { id: 'bard', group: 'ranged', name: 'Bard', users: 'Bard basic shot (today he shoots the same arrow as the Archer)', shooter: 'bard', type: 'ranged',
    opts: { A: sh('note', 'Music note', 'A pink music note that wobbles up and down as it flies; it pops into little notes.'),
      B: sh('waves', 'Sound waves', 'Three sound arcs fly out; the target shakes as rings of sound hit it.') } },
  { id: 'fire', group: 'ranged', name: 'Fire', users: 'Mage, Fire Imp, fire elites', shooter: 'mage', type: 'fire',
    opts: { A: sh('fireball', 'Fireball', 'A bigger fireball with wavy flame tongues and falling embers; a small explosion and smoke puffs.'),
      B: sh('dart', 'Flame dart', 'A long thin flame with embers circling it; the target catches fire (flames lick up its body).') } },
  { id: 'holy', group: 'ranged', name: 'Holy', users: 'Cleric (today: the round orb you picked in round 1)', shooter: 'cleric', type: 'holy',
    opts: { A: sh('spear', 'Light spear', 'A short gold spear of light with a twinkling tip; a gold cross flash and rising motes.'),
      B: sh('starMote', 'Star', 'A spinning gold star with a sparkle trail; it bursts into a ring of gold rays.') } },
  { id: 'dark', group: 'ranged', name: 'Dark', users: 'Necromancer, Cultist, Shaman, Banshee, dark elites', shooter: 'necromancer', type: 'dark',
    opts: { A: sh('soulWisp', 'Soul wisp', 'A ghostly green-and-purple wisp with a wavy tail; three wisps spiral up round the target.'),
      B: sh('spiral', 'Shadow spiral', 'Two dark orbs twist round each other; the target is pulled in by shrinking rings, then a dark crack.') } },
  { id: 'ice', group: 'ranged', name: 'Ice', users: 'Frost Wisp, ice elites', shooter: 'frostWisp', who: 'enemy', type: 'ice',
    opts: { A: sh('icicle', 'Icicle', 'A pointed icicle with frost falling behind; it shatters into shards that fall.'),
      B: sh('frostOrb', 'Frost orb', 'A round frost orb with snow trailing; a big snowflake flashes where it hits.') } },
  { id: 'electric', group: 'ranged', name: 'Electric', users: 'Storm Sprite, electric elites', shooter: 'stormSprite', who: 'enemy', type: 'electric',
    opts: { A: sh('ballLightning', 'Ball lightning', 'A crackling ball with little arcs round it; a zap of 5 bolts, the target flickers.'),
      B: sh('hopSpark', 'Hopping spark', 'The spark jumps in steps along the way (a bolt between each jump); a bigger crackle when it hits.') } },
];
for (const r of ROWS) r.opts = { today: { today: true, name: 'Today', desc: 'What the game shows now.' }, ...r.opts };

const isMelee = (r) => r.group === 'melee';
function optMs(r, o) {
  if (isMelee(r)) return o.today ? IMPACT_MS.melee : 420;
  return o.today ? IMPACT_MS[r.type] : S[o.fn].ms;
}
export function loopMs(rowId, key) { const r = ROWS.find((x) => x.id === rowId), o = r.opts[key]; return (isMelee(r) ? SWING : FLY) + optMs(r, o) + PAUSE; }

const cache = {};
function cast(r, key) {
  const id = r.id + ':' + key; if (cache[id]) return cache[id];
  const o = r.opts[key]; let from, to;
  if (isMelee(r)) {
    if (r.who === 'enemy') { from = actor(enemies[o.attacker || r.attacker], 78, 70, true); to = actor(hero('knight'), 52, 70, false); }
    else { from = actor(hero(r.attacker), 50, 70, false); to = actor(enemies.goblin, 74, 70, true); }
  } else if (r.who === 'enemy') { from = actor(enemies[r.shooter], 96, 40, true); to = actor(hero('knight'), 34, 86, false); }
  else { from = actor(hero(r.shooter), 34, 86, false); to = actor(enemies.goblin, 96, 40, true); }
  return (cache[id] = { from, to });
}

export function drawRow(ctx, rowId, key, t) {
  const r = ROWS.find((x) => x.id === rowId), o = r.opts[key];
  const { from, to } = cast(r, key);
  ctx.imageSmoothingEnabled = false; room(ctx);
  const loop = loopMs(rowId, key), k = t % loop, lead = isMelee(r) ? SWING : FLY, ms = optMs(r, o);
  const side = from.fx < to.fx ? -1 : 1, u = body(to, side), a = centre(from), b = centre(to);
  const draws = []; let tint = null, dx = 0, step = 0;
  if (isMelee(r)) { // the attacker steps in and back (like the game's swing lunge)
    const f = -side, p = k < lead ? k / lead : 1 - ph(k - lead, 0, 200);
    step = Math.round(f * 4 * Math.sin(Math.min(1, p) * Math.PI / 2));
  } else if (k < lead) {
    const p = k / lead, head = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    draws.push(...(o.today ? projectileFx(r.type, a, head, t, 1) : S[o.fn].shot(a, head, t, p)));
  }
  if (k >= lead && k < lead + ms) {
    const q = (k - lead) / ms;
    const out = o.today ? impactFx(r.type, q, u, t, 1, r.type === 'electric' ? a : null) : isMelee(r) ? M[o.fn](q, u, t) : S[o.fn].hit(q, u, t, a);
    draws.push(...out.draws); tint = out.tint || null; dx = out.dx || 0;
  }
  drawActor(ctx, from, null, step);
  drawActor(ctx, to, tint, dx);
  paint(ctx, draws);
}
