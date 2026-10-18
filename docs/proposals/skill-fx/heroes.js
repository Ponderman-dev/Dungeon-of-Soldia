// PROPOSED skill looks for the heroes after the Knight (demo page only, not game code yet). The recipes are written in
// the SAME format as src/systems/skillFx.js (q 0..1, c = { caster, targets, squad, enemies, hitMs, radius }, t) so
// moving an approved one into the game is a copy into CAST + CAST_MS there.
// SPECS says how the demo plays each skill: the NOW look (today's game) and the NEW look (charge, move, cast recipe, hit).
import { pen, rnd, FX_COLORS as C } from '../../../src/systems/statusFx.js';
import { shotFx } from '../../../src/systems/skillFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);

// ---- Cleric ----
const CLER = { light: 0xfff4c0, gold: 0xffd86a, deep: 0xc89a2a };
// A vertical column of light from y0 down to y1: white core, gold edges, `w` wide.
function beam(g, x, y0, y1, w, a) {
  if (a <= 0 || w <= 0) return;
  const half = Math.max(0.5, w / 2);
  for (let y = Math.round(y0); y <= y1; y++) for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) { const e = Math.abs(dx) / (half + 0.5); g.px(x + dx, y, e < 0.45 ? C.white : CLER.gold, a * (e < 0.45 ? 1 : 0.75) * Math.min(1, (y - y0) / 8 + 0.2)); }
}

// ---- Necromancer: green + purple, smoke, skulls, souls ----
const NEC = { green: 0x6dff8a, green2: 0x2fbf5a, purple: 0x9b4dff, purple2: 0x4a2470, bone: 0xebe5cf, bone2: 0xb8b09a };
const SKULL = ['.###.', '#####', '#g#g#', '.###.', '.#.#.'];
function skullPx(g, x, y, a, s = 1) {
  SKULL.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.rect(x + (i - 2) * s, y + (j - 2) * s, s, s, ch === 'g' ? NEC.green : NEC.bone, a); }));
}
// A soul: a small green glowing orb with a fading tail behind it (from `from` towards where it is now).
function soulPx(g, x, y, tx, ty, a) {
  g.rect(x - 1, y - 1, 3, 3, NEC.green, a); g.px(x, y, C.white, a);
  const dx = x - tx, dy = y - ty, d = Math.hypot(dx, dy) || 1;
  for (let k = 1; k < 5; k++) g.px(x + (dx / d) * k * 1.5, y + (dy / d) * k * 1.5, k % 2 ? NEC.green2 : NEC.green, a * (1 - k / 5));
}
// A small bone: a bar with knobs at both ends.
function bonePx(g, x, y, ang, a) {
  const cx = Math.cos(ang), sy = Math.sin(ang);
  for (let k = -2; k <= 2; k++) g.px(x + cx * k, y + sy * k, NEC.bone, a);
  g.px(x + cx * 3 + 0.5, y + sy * 3 - 0.5, NEC.bone2, a); g.px(x - cx * 3 - 0.5, y - sy * 3 + 0.5, NEC.bone2, a);
}

// ---- Berserker: red, blood splatter, ground cracks, rubble -----------------------------------------
const BERS = { light: 0xffb0a0, mid: 0xff4a3a, deep: 0xb01e1e, dark: 0x4a0c0c };
const CRACK = 0x1a120e, RUBBLE = [0x8a7a68, 0x6a5d50, 0x9a9488];

// Red drops bursting out of a body (blood splatter), falling.
function splatter(g, x, y, p, n, seed, dist = 10) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i) * Math.PI * 2, d = (3 + rnd(seed + i * 3) * dist) * easeOut(p);
    const s = i % 3 ? 2 : 1;
    g.rect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 + p * p * 12, s, s, i % 2 ? BERS.mid : BERS.deep, 1 - p * p);
  }
}


// ---- Archer: leaf green, real arrows (wooden shaft, steel tip, white feathers) ----
const ARCH = { leaf: 0x8ee05a, deep: 0x3f9a4a, wood: 0xc68a5e, tip: 0xe4e8f0, red: 0xff3a3a, red2: 0xb01e1e, dust: 0x8a7a68 };
// An arrow with its tip at (x, y) pointing along `ang`: steel tip, wooden shaft `len` long, two white feathers at the tail.
function arrowPx(g, x, y, ang, len, a, glow) {
  if (a <= 0) return;
  const cx = Math.cos(ang), sy = Math.sin(ang);
  for (let k = 1; k < len; k++) g.px(x - cx * k, y - sy * k, ARCH.wood, a);
  g.px(x, y, glow ? C.white : ARCH.tip, a); g.px(x - cx, y - sy, ARCH.tip, a);
  const tx = x - cx * len, ty = y - sy * len;
  for (const s of [-1, 1]) { g.px(tx - cx + sy * s, ty - sy - cx * s, C.white, a); g.px(tx + sy * s, ty - cx * s, C.white, a); }
}
// Where her bow is (the weapon part sits in front of her chest) and the drawn arrow on it.
const bowAt = (u) => ({ x: u.x + u.hw + 1, y: u.mid - 1 });
function drawnArrow(g, u, ang, pull, a, t, glint) {
  const b = bowAt(u), cx = Math.cos(ang), sy = Math.sin(ang);
  const tip = { x: b.x + cx * (5 - pull), y: b.y + sy * (5 - pull) };
  arrowPx(g, tip.x, tip.y, ang, 9, a, glint);
  // the string pulled back to the arrow's tail: two lines from the bow's ends to the nock
  const nx = tip.x - cx * 9, ny = tip.y - sy * 9;
  g.line(b.x - 1, b.y - 7, nx, ny, 0xe8e0d0, a * 0.8); g.line(b.x - 1, b.y + 7, nx, ny, 0xe8e0d0, a * 0.8);
  if (glint) { const on = Math.sin(t / 40) > 0 ? 1 : 0.5; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) g.px(tip.x + cx + dx, tip.y + sy + dy, ARCH.leaf, on * a); g.px(tip.x + cx, tip.y + sy, C.white, on * a); }
}
// Wind and leaves pulled in towards her while she draws (the wind-up).
function chargeAround(g, u, q, t) {
  for (let i = 0; i < 7; i++) {
    const s = (q * 1.6 + i / 7) % 1, an = rnd(i * 11) * Math.PI * 2, r = 20 * (1 - easeOut(s));
    const x = u.x + Math.cos(an) * r, y = u.mid + Math.sin(an) * r * 0.7;
    g.rect(x, y, 2, 1, i % 2 ? ARCH.leaf : ARCH.deep, s * 0.9); if (i % 3 === 0) g.px(x + 2, y - 1, ARCH.leaf, s * 0.6);
  }
}
// Where each arrow of an Arrow Rain wave lands, around the target (seeded, the same every loop). Some land ON an enemy.
function rainSpots(c, w) {
  const u = c.targets[0]; const R = (c.radius || 36) * 0.8, out = [];
  for (let i = 0; i < 6; i++) {
    const s = w * 13 + i * 7;
    if (i < c.enemies.length) { const e = c.enemies[i]; out.push({ x: e.x + (rnd(s) - 0.5) * 4, y: e.mid - 2 + rnd(s + 1) * 4, foe: i }); continue; }
    out.push({ x: u.x + (rnd(s) - 0.5) * 2 * R, y: u.y - 2 + rnd(s + 3) * 8, foe: -1 });
  }
  return out;
}

export const RECIPES = {
  // CHARGE: he shakes with rage (the demo trembles him), glows red with a fast heartbeat, hot breath puffs rise from
  // his head, little pebbles hop at his feet.
  berserkerCharge(q, c, t) {
    const g = pen(); const u = c.caster;
    for (let i = 0; i < 3; i++) { const s = (q * 1.5 + i / 3) % 1; g.disc(u.x + (i - 1) * 3 + Math.sin(t / 90 + i) * 1.5, u.top - 1 - s * 9, 1 + s * 1.5, i % 2 ? 0xd8b0a8 : 0xb89088, (1 - s) * 0.7 * q); }
    for (let i = 0; i < 5; i++) { const up = Math.max(0, Math.sin(t / 45 + i * 1.7)) * 2 * q; g.px(u.x - 7 + i * 3.5, u.y - up, RUBBLE[i % 3], 0.9); }
    const beat = Math.pow(Math.max(0, Math.sin(t / (90 - 40 * q))), 6);
    return { draws: g.out, tints: [['caster', 0, [BERS.mid, Math.round((0.12 + 0.3 * q + 0.2 * beat) * 20) / 20]]] };
  },
  // SAVAGE LEAP (round 2, user: 'dust and cracks should stay at the impact zone, not follow the hero', 'more energy').
  // In the air: red speed streaks trail behind him. Landing (c.hitMs) at c.land (the spot he lands on, it never moves):
  // a white slam flash at his feet, the floor CRACKS open (long jagged cracks that stay ~1s), lots of rubble flies high,
  // a big dust ring rolls out, blood bursts from every enemy inside the landing area (c.radius) and they flash.
  savageLeapNew(q, c, t) {
    const g = pen(); const k = c.caster; const ms = q * CAST_MS_NEW.savageLeapNew, hit = ms - (c.hitMs || 0);
    if (!k) return { draws: g.out, tints: [] };
    if (hit < 0) { // in the air: red streaks behind him
      for (let i = 0; i < 5; i++) { const off = (i - 2) * 3, len = 8 + rnd(i) * 8; g.line(k.x - k.hw - 2, k.mid + off, k.x - k.hw - 2 - len, k.mid + off + len * 0.5, i % 2 ? BERS.mid : BERS.light, 0.8); }
      return { draws: g.out, tints: [] };
    }
    const L = c.land || { x: k.x, y: k.y };
    if (hit < 90) { const r = 2 + hit / 12; g.disc(L.x, L.y - 2, r, C.white, 1 - hit / 90); }
    const life = 1 - ph(hit, 900, 1300);
    for (let i = 0; i < 9; i++) { // jagged cracks along the floor, growing fast
      const a = (i / 9) * Math.PI * 2 + rnd(i) * 0.5, len = (12 + rnd(i * 5) * 16) * easeOut(ph(hit, 0, 110));
      let x = L.x, y = L.y;
      for (let s = 0; s < len; s += 2) {
        const nx = L.x + Math.cos(a) * (s + 2) + (rnd(i * 31 + s) - 0.5) * 2.5, ny = L.y + Math.sin(a) * (s + 2) * 0.35 + (rnd(i * 17 + s) - 0.5) * 1.2;
        g.line(x, y, nx, ny, CRACK, life); g.px(nx, ny - 1, BERS.deep, life * 0.7);
        x = nx; y = ny;
      }
    }
    for (let i = 0; i < 18; i++) { // rubble, flying high
      const p = ph(hit, 0, 550 + rnd(i) * 250); if (p <= 0 || p >= 1) continue;
      const a = -Math.PI / 2 + (rnd(i * 3) - 0.5) * 2.8, v = 16 + rnd(i * 7) * 20;
      g.rect(L.x + Math.cos(a) * v * p, L.y - 2 + Math.sin(a) * v * p + p * p * 34, i % 3 ? 1 : 2, i % 3 ? 1 : 2, RUBBLE[i % 3], 1);
    }
    const dp = ph(hit, 0, 600); if (dp > 0 && dp < 1) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 4 + 30 * easeOut(dp); g.disc(L.x + Math.cos(a) * r, L.y - 1 + Math.sin(a) * r * 0.35, 2 + dp * 2, i % 2 ? 0x8a7a68 : 0x6a5d50, 0.75 * (1 - dp)); }
    const hitList = c.enemies.filter((e) => Math.hypot(e.x - L.x, (e.y - L.y) * 1.4) <= (c.radius || 30));
    hitList.forEach((e, i) => splatter(g, e.x, e.mid, ph(hit, 0, 600), 14, 11 + i * 7, 14));
    const tints = c.enemies.map((e, i) => ['enemies', i, hitList.includes(e) ? (hit < 90 ? [C.white, 0.85] : hit < 300 ? [BERS.mid, 0.4] : null) : null]);
    return { draws: g.out, tints };
  },
  // BLOOD FEAST: blood drops spiral in from around him and into his mouth, a red mist bursts at his head, his eyes
  // glow red, two heavy heartbeats (red thumps) and the red stays faint while the lifesteal lasts.
  bloodFeast(q, c, t) {
    const g = pen(); const u = c.caster; const ms = q * CAST_MS_NEW.bloodFeast;
    const mouth = { x: u.x + 1, y: u.top + 5 };
    for (let i = 0; i < 12; i++) {
      const p = ph(ms, i * 25, 380 + i * 25); if (p <= 0 || p >= 1) continue;
      const a = (i / 12) * Math.PI * 2 + p * 3, r = 22 * (1 - easeOut(p));
      g.rect(mouth.x + Math.cos(a) * r, mouth.y + Math.sin(a) * r * 0.8, 2, 2, i % 2 ? BERS.mid : BERS.deep, 1);
    }
    const mp = ph(ms, 420, 900); if (mp > 0 && mp < 1) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = 3 + 9 * easeOut(mp); g.disc(mouth.x + Math.cos(a) * r, mouth.y + Math.sin(a) * r * 0.7 - mp * 3, 1.5 + mp, i % 2 ? BERS.light : BERS.mid, 0.6 * (1 - mp)); }
    if (ms > 420) { const a = ms < 1300 ? 1 : 1 - ph(ms, 1300, 1600); g.px(u.x - 1, u.top + 3, 0xff2020, a); g.px(u.x + 2, u.top + 3, 0xff2020, a); }
    const thump = (at) => Math.max(0, 1 - Math.abs(ms - at) / 70);
    const tint = Math.max(thump(460) * 0.6, thump(640) * 0.55, ms > 640 ? 0.15 : 0);
    return { draws: g.out, tints: [['caster', 0, tint > 0.02 ? [BERS.deep, Math.round(tint * 20) / 20] : null]] };
  },
  // ---- Cleric: gold, light from above, a halo, angel wings ----
  // CHARGE: a golden halo appears over her head and brightens, motes of light drift down onto her, a soft gold glow.
  clericCharge(q, c, t) {
    const g = pen(); const u = c.caster;
    const hy = u.top - 3; for (let x = -4; x <= 4; x++) { const y = Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / 16)) * 1.2); g.px(u.x + x, hy - y, CLER.gold, 0.4 + 0.6 * q); g.px(u.x + x, hy + y, CLER.gold, 0.4 + 0.6 * q); }
    for (let i = 0; i < 8; i++) { const s = (q * 1.4 + i / 8) % 1; g.px(u.x + (rnd(i * 7) - 0.5) * 16 + Math.sin(t / 200 + i) * 1.5, u.top - 22 + s * 26, i % 2 ? C.white : CLER.light, s * (1 - s) * 3 * q); }
    const pulse = 0.6 + 0.4 * Math.sin(t / 120);
    return { draws: g.out, tints: [['caster', 0, [CLER.gold, Math.round((0.1 + 0.25 * q) * pulse * 20) / 20]]] };
  },
  // HOLY NOVA: a column of light comes down onto the healed hero (white core, gold edges), a flash and a gold glow on
  // the floor; then a thin pillar of light SMITES every enemy around that hero (sparks, they flash); gold sparkles rise.
  holyNovaNew(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const ms = q * CAST_MS_NEW.holyNovaNew, land = c.hitMs || 220, hit = ms - land;
    const top = u.top - 30; // short beam (user: 'shorter light beam')
    if (hit < 0) { const p = ms / land, bottom = top + (u.y - top) * easeOut(p); beam(g, u.x, top, bottom, 2 + p * 3, 0.9); }
    else {
      const w = 7 * (1 - ph(hit, 0, 500)); if (w > 0.5) beam(g, u.x, top, u.y, w, 1 - ph(hit, 300, 500));
      if (hit < 80) g.disc(u.x, u.mid, 4 + hit / 16, C.white, 1 - hit / 80);
      const gl = 1 - ph(hit, 0, 700); for (let x = -12; x <= 12; x++) { const hh = Math.round(Math.sqrt(1 - (x * x) / 144) * 2.5); for (let y = -hh; y <= hh; y++) g.px(u.x + x, u.y + y, Math.abs(x) < 6 ? CLER.light : CLER.gold, 0.6 * gl * (1 - Math.abs(x) / 14)); }
      for (let i = 0; i < 8; i++) { const s = ph(hit, 100 + i * 60, 700 + i * 60); if (s > 0 && s < 1) g.px(u.x + (rnd(i * 3) - 0.5) * 14, u.mid - s * 18, i % 2 ? C.white : CLER.gold, 1 - s); }
    }
    const R = c.radius || 36;
    const hitList = c.enemies.filter((e) => Math.hypot(e.x - u.x, (e.y - u.y) * 1.4) <= R);
    hitList.forEach((e, i) => {
      const s = ph(hit, 60 + i * 70, 300 + i * 70); if (s <= 0 || s >= 1) return;
      beam(g, e.x, e.top - 18, e.y, 2.5 * (1 - s), 1 - s * 0.5);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, r = 3 + 8 * easeOut(s); g.px(e.x + Math.cos(a) * r, e.mid + Math.sin(a) * r * 0.7, k % 2 ? C.white : CLER.gold, 1 - s); }
    });
    const tints = [['targets', 0, hit >= 0 && hit < 400 ? [CLER.gold, 0.45 * (1 - hit / 400)] : null], ...c.enemies.map((e, i) => ['enemies', i, hitList.includes(e) && hit > 60 + hitList.indexOf(e) * 70 && hit < 200 + hitList.indexOf(e) * 70 ? [0xfff4c0, 0.8] : null])];
    return { draws: g.out, tints };
  },
  // SANCTUARY: a soft column of light comes down onto the hurt hero, angel WINGS unfold from their back, then fold
  // around them and fade (the shield); the hero glows gold and little green-gold "+" rise (the regen).
  sanctuaryNew(q, c, t) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const ms = q * CAST_MS_NEW.sanctuaryNew, land = c.hitMs || 200, hit = ms - land, top = u.top - 26;
    if (hit < 0) beam(g, u.x, top, top + (u.y - top) * easeOut(ms / land), 3, 0.7);
    else if (hit < 300) beam(g, u.x, top, u.y, 4 * (1 - hit / 300), 0.7 * (1 - hit / 300));
    if (hit >= 0 && hit < 1000) { // wings: unfold (0-300), hold, fold forward around the body (600-1000) and fade
      const open = easeOut(ph(hit, 0, 300)) * (1 - easeOut(ph(hit, 600, 1000))), a = 1 - ph(hit, 800, 1000);
      for (const side of [-1, 1]) for (let f = 0; f < 6; f++) { // 6 feathers fan up and out from the shoulder
        const ang = 0.15 + open * (0.35 + f * 0.24), len = 11 - f * 0.8;
        const sx = u.x + side * 2, sy = u.top + 8;
        g.line(sx, sy, sx + side * Math.sin(ang) * len, sy - Math.cos(ang) * len * 0.85 + f * 0.6, f % 2 ? C.white : CLER.light, 0.9 * a);
      }
    }
    for (let i = 0; i < 6; i++) { const s = ((ms - 300) / 900 + i / 6) % 1; if (ms < 300 || ms > CAST_MS_NEW.sanctuaryNew - 150) break; const x = u.x + (rnd(i * 5) - 0.5) * 14, y = u.mid + 4 - s * 16; g.px(x, y, 0x9cffb0, 1 - s); g.px(x - 1, y, 0x9cffb0, 1 - s); g.px(x + 1, y, 0x9cffb0, 1 - s); g.px(x, y - 1, 0x9cffb0, 1 - s); g.px(x, y + 1, 0x9cffb0, 1 - s); }
    const glow = hit < 0 ? 0 : 0.18 + 0.12 * Math.sin(t / 150);
    return { draws: g.out, tints: [['targets', 0, glow ? [CLER.gold, Math.round(glow * 20) / 20] : null]] };
  },
  // ---- Necromancer ----
  // CHARGE: green and purple smoke swirls around his hands, his eyes glow green, he pulses purple.
  necroCharge(q, c, t) {
    const g = pen(); const u = c.caster;
    for (let i = 0; i < 6; i++) { const a = t / 160 + (i / 6) * Math.PI * 2, r = 5 + 3 * Math.sin(t / 200 + i); g.disc(u.x + u.hw + 1 + Math.cos(a) * r * 0.6, u.mid + Math.sin(a) * r * 0.5, 1 + q, i % 2 ? NEC.purple : NEC.green2, (0.4 + 0.5 * q) * (0.6 + 0.4 * Math.sin(t / 90 + i))); }
    g.px(u.x - 1, u.top + 4, NEC.green, 0.5 + 0.5 * q); g.px(u.x + 2, u.top + 4, NEC.green, 0.5 + 0.5 * q);
    const pulse = 0.6 + 0.4 * Math.sin(t / 110);
    return { draws: g.out, tints: [['caster', 0, [NEC.purple, Math.round((0.1 + 0.3 * q) * pulse * 20) / 20]]] };
  },
  // DEATH COIL: a glowing green SKULL flies at the enemy, coiling (wobbling) with a purple smoke trail; it bursts in
  // green ghost-fire and purple smoke on the enemy, who goes sickly green for a moment.
  deathCoilNew(q, c, t) {
    const g = pen(); const u = c.targets[0], k = c.caster; if (!u || !k) return g.out;
    const ms = q * CAST_MS_NEW.deathCoilNew, fly = c.hitMs || 420;
    const a = { x: k.x + k.hw + 3, y: k.mid - 2 }, b = { x: u.x, y: u.mid };
    if (ms < fly) {
      const p = ms / fly, x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p + Math.sin(p * Math.PI * 3) * 4 * (1 - p);
      for (let i = 1; i <= 7; i++) { const pp = Math.max(0, p - i * 0.035), tx = a.x + (b.x - a.x) * pp, ty = a.y + (b.y - a.y) * pp + Math.sin(pp * Math.PI * 3) * 4 * (1 - pp); g.disc(tx, ty, 2.4 - i * 0.2, i % 2 ? NEC.purple : NEC.purple2, 0.75 * (1 - i / 8)); }
      for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6], [-4, -4], [4, 4], [4, -4], [-4, 4]]) g.px(x + dx, y + dy, NEC.green2, 0.6);
      skullPx(g, x, y, 1, 2);
      return g.out;
    }
    const hit = ms - fly; // round 2 (user: 'the hit should be bright like the projectile and bigger')
    if (hit < 90) g.disc(b.x, b.y, 4 + hit / 10, C.white, 1 - hit / 90); // white flash
    const kp = ph(hit, 0, 420); // the skull bursts BIG and bright: white, then glowing green, rising a little and fading
    if (kp < 1) { const sc = kp < 0.15 ? 3 : 4; skullPx(g, b.x, b.y - 2 - kp * 6, kp < 0.5 ? 1 : 1 - (kp - 0.5) / 0.5, sc); for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; g.px(b.x + Math.cos(an) * (11 + kp * 4), b.y - 2 - kp * 6 + Math.sin(an) * (10 + kp * 4), NEC.green, 0.8 * (1 - kp)); } }
    for (let i = 0; i < 22; i++) { // bright green ghost-fire licking upwards, bigger
      const p = ph(hit, i * 15, 450 + i * 15); if (p <= 0 || p >= 1) continue;
      const x = b.x + (rnd(i * 3) - 0.5) * 20 + Math.sin(t / 60 + i) * 1.2, y = b.y + 6 - p * 26, s = i % 3 ? 2 : 1;
      g.rect(x, y, s, s, i % 4 === 0 ? C.white : i % 2 ? NEC.green : 0xb8ffc8, 1 - p);
    }
    for (let i = 0; i < 6; i++) { // souls burst out of the hit
      const p = ph(hit, 30, 520); if (p <= 0 || p >= 1) break;
      const an = (i / 6) * Math.PI * 2 + 0.3, r = 4 + 16 * easeOut(p), x = b.x + Math.cos(an) * r, y = b.y + Math.sin(an) * r * 0.8, r2 = 4 + 16 * easeOut(Math.max(0, p - 0.1));
      soulPx(g, x, y, b.x + Math.cos(an) * r2, b.y + Math.sin(an) * r2 * 0.8, 1 - p);
    }
    const sp = ph(hit, 80, 650); if (sp > 0 && sp < 1) for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2, r = 5 + 12 * easeOut(sp); g.disc(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r * 0.7 - sp * 4, 2 + sp * 2, i % 2 ? NEC.purple : NEC.purple2, 0.55 * (1 - sp)); }
    return { draws: g.out, tints: [['targets', 0, hit < 80 ? [C.white, 0.8] : hit < 450 ? [NEC.green, 0.6 * (1 - (hit - 80) / 370)] : null]] };
  },
  // BONE SACRIFICE: his skeletons glow green and shake, then CRUMBLE (bones scatter on the floor); a green soul flies
  // out of each one into every hero; each hero gets three spectral bones circling them and a green glow (the shield).
  boneSacrificeNew(q, c, t) {
    const g = pen(); const ms = q * CAST_MS_NEW.boneSacrificeNew, mins = c.minions || [], heroes = c.targets;
    const crumble = 150;
    mins.forEach((m, j) => {
      const p = ph(ms, crumble, crumble + 600); if (p <= 0 || p >= 1) return;
      for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + (rnd(j * 9 + i) - 0.5) * 2.6, v = 6 + rnd(i * 5 + j) * 8; bonePx(g, m.x + Math.cos(an) * v * p, Math.min(m.y - 1, m.mid + Math.sin(an) * v * p + p * p * 18), an + p * 6 * (i % 2 ? 1 : -1), 1 - ph(p, 0.7, 1)); }
      if (p < 0.4) g.disc(m.x, m.mid, 3 + p * 10, 0x9a9488, 0.5 * (1 - p / 0.4));
    });
    mins.forEach((m, j) => heroes.forEach((h, i) => { // souls fly from each skeleton to each hero
      const p = ph(ms, crumble + 100 + i * 60, crumble + 650 + i * 60); if (p <= 0 || p >= 1) return;
      const x = m.x + (h.x - m.x) * easeOut(p), y = m.mid + (h.mid - m.mid) * easeOut(p) - Math.sin(p * Math.PI) * 12, px = m.x + (h.x - m.x) * easeOut(Math.max(0, p - 0.08)), py = m.mid + (h.mid - m.mid) * easeOut(Math.max(0, p - 0.08)) - Math.sin(Math.max(0, p - 0.08) * Math.PI) * 12;
      soulPx(g, x, y, px, py, 1);
    }));
    const arrive = crumble + 650;
    heroes.forEach((h, i) => {
      const p = ph(ms, arrive + i * 60, CAST_MS_NEW.boneSacrificeNew); if (p <= 0 || p >= 1) return;
      for (let k = 0; k < 3; k++) { const an = t / 180 + (k / 3) * Math.PI * 2; bonePx(g, h.x + Math.cos(an) * (h.hw + 5), h.mid + Math.sin(an) * 5, an + Math.PI / 2, 1 - ph(p, 0.7, 1)); }
    });
    const tints = [...mins.map((m, j) => ['minions', j, ms < crumble ? [NEC.green, 0.6] : null]), ...heroes.map((h, i) => ['targets', i, ms > arrive + i * 60 ? [NEC.green, 0.25 + 0.1 * Math.sin(t / 150)] : null])];
    return { draws: g.out, tints };
  },
  // ---- Archer ----
  // CHARGE (Arrow Rain): she draws her bow and aims HIGH, the string creaks back, the arrowhead glints green, leaves
  // and wind are pulled in around her, a soft green pulse.
  archerChargeUp(q, c, t) {
    const g = pen(); const u = c.caster;
    chargeAround(g, u, q, t); drawnArrow(g, u, -1.05, 3 * easeOut(q), 1, t, q > 0.55);
    const pulse = 0.6 + 0.4 * Math.sin(t / 110);
    return { draws: g.out, tints: [['caster', 0, [ARCH.leaf, Math.round((0.08 + 0.25 * q) * pulse * 20) / 20]]] };
  },
  // CHARGE (Hunter's Mark): the same, but she aims STRAIGHT at the enemy and the tip glints red.
  archerChargeAim(q, c, t) {
    const g = pen(); const u = c.caster;
    chargeAround(g, u, q, t); drawnArrow(g, u, 0, 3 * easeOut(q), 1, t, false);
    if (q > 0.5) { const b = bowAt(u), on = Math.sin(t / 40) > 0 ? 1 : 0.5; g.px(b.x + 1, b.y, C.white, on); for (const [dx, dy] of [[0, -1], [0, 1], [1, 0]]) g.px(b.x + 1 + dx, b.y + dy, ARCH.red, on); }
    const pulse = 0.6 + 0.4 * Math.sin(t / 110);
    return { draws: g.out, tints: [['caster', 0, [ARCH.leaf, Math.round((0.08 + 0.25 * q) * pulse * 20) / 20]]] };
  },
  // ARROW RAIN: she looses 3 arrows straight UP (they streak off the top), then 6 waves of arrows rain down on the area
  // (c.radius) around the target, steep, with white streaks. Arrows that hit an enemy burst in a bright white-green
  // spark (the enemy flashes and jitters, see the spec), the rest STICK in the floor with a puff of dust and stay a
  // moment after the rain, so you see where it fell. The last wave lands harder (bigger sparks).
  arrowRainNew(q, c, t) {
    const g = pen(); const k = c.caster, u = c.targets[0]; if (!k || !u) return g.out;
    const ms = q * CAST_MS_NEW.arrowRainNew, first = c.hitMs || 300, every = c.every || 333, waves = c.waves || 6, FALL = 150;
    for (let i = 0; i < 3; i++) { // the shot up
      const p = ph(ms, i * 40, 220 + i * 40); if (p <= 0 || p >= 1) continue;
      const b = bowAt(k), ang = -1.05 - (i - 1) * 0.12, d = 6 + 110 * p * p;
      const x = b.x + Math.cos(ang) * d, y = b.y + Math.sin(ang) * d;
      arrowPx(g, x, y, ang, 8, 1, true); g.line(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9, x - Math.cos(ang) * 20, y - Math.sin(ang) * 20, ARCH.leaf, 0.6 * (1 - p));
    }
    const end = first + (waves - 1) * every + 700, fade = 1 - ph(ms, end, end + 300);
    for (let w = 0; w < waves; w++) {
      const land = first + w * every, last = w === waves - 1;
      rainSpots(c, w).forEach((s, i) => {
        const ft = ms - (land - FALL) - i * 12; if (ft < 0) return;
        const ang = 1.25; // steep, falling a little to the right
        if (ft < FALL) { // falling, with a white streak above
          const p = ft / FALL, x = s.x - Math.cos(ang) * 60 * (1 - p), y = s.y - Math.sin(ang) * 60 * (1 - p);
          g.line(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9, x - Math.cos(ang) * 22, y - Math.sin(ang) * 22, C.white, 0.5);
          arrowPx(g, x, y, ang, 8, 1); return;
        }
        const ht = ft - FALL;
        if (s.foe >= 0) { // hit: a bright spark burst on the enemy
          const p = ph(ht, 0, last ? 320 : 240); if (p >= 1) return; const big = last ? 1.5 : 1;
          if (p < 0.3) g.disc(s.x, s.y, (2 + p * 8) * big, C.white, 1 - p / 0.3);
          for (let r = 0; r < 7; r++) { const an = (r / 7) * Math.PI * 2 + w, d = (2 + 9 * easeOut(p)) * big; g.rect(s.x + Math.cos(an) * d, s.y + Math.sin(an) * d * 0.8, r % 2 ? 1 : 2, 1, r % 3 ? ARCH.leaf : C.white, 1 - p); }
          return;
        }
        arrowPx(g, s.x, s.y, ang, 6, fade); // stuck in the floor (the tip is in the ground)
        const dp = ph(ht, 0, 260); if (dp < 1) for (let d = 0; d < 4; d++) g.px(s.x + (d - 1.5) * (1 + dp * 3), s.y - dp * 3 - (d % 2), ARCH.dust, 1 - dp);
      });
    }
    const tints = c.enemies.map((e, i) => {
      for (let w = 0; w < waves; w++) { const ht = ms - (first + w * every) - i * 12; if (ht >= 0 && ht < 70) return ['enemies', i, [C.white, 0.8]]; }
      return ['enemies', i, null];
    });
    return { draws: g.out, tints };
  },
  // HUNTER'S MARK: one arrow with a RED RIBBON flies straight and fast at the enemy (a thin red streak), a white flash
  // and red sparks where it hits; the arrow STAYS stuck in the enemy, its red ribbon fluttering (that is the mark);
  // the enemy flushes red for a moment. (+25% DMG text: the spec.)
  huntersMarkNew(q, c, t) {
    const g = pen(); const k = c.caster, u = c.targets[0]; if (!k || !u) return g.out;
    const ms = q * CAST_MS_NEW.huntersMarkNew, fly = c.hitMs || 140;
    const a = bowAt(k), b = { x: u.x - u.hw + 2, y: u.mid - 1 };
    const ribbon = (x, y, al) => { for (let i = 1; i <= 5; i++) g.px(x - i, y + 1 + Math.round(Math.sin(t / 70 + i * 0.9) * (i / 3)), i % 2 ? ARCH.red : ARCH.red2, al); };
    if (ms < fly) {
      const p = ms / fly, x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p;
      g.line(a.x, a.y, x - 9, y, ARCH.red, 0.5); arrowPx(g, x, y, 0, 9, 1, true); ribbon(x - 5, y, 1);
      return g.out;
    }
    const hit = ms - fly, fade = 1 - ph(ms, CAST_MS_NEW.huntersMarkNew - 300, CAST_MS_NEW.huntersMarkNew);
    if (hit < 80) g.disc(b.x, b.y, 3 + hit / 14, C.white, 1 - hit / 80);
    const sp = ph(hit, 0, 300); if (sp < 1) for (let r = 0; r < 8; r++) { const an = (r / 8) * Math.PI * 2, d = 3 + 9 * easeOut(sp); g.rect(b.x + Math.cos(an) * d, b.y + Math.sin(an) * d * 0.8, r % 2 ? 1 : 2, 1, r % 2 ? ARCH.red : C.white, 1 - sp); }
    arrowPx(g, b.x, b.y, 0, 8, fade); ribbon(b.x - 4, b.y, fade); // stuck in the enemy, the ribbon fluttering
    return { draws: g.out, tints: [['targets', 0, hit < 70 ? [C.white, 0.85] : hit < 500 ? [ARCH.red, 0.45 * (1 - (hit - 70) / 430)] : null]] };
  },
  // Today's Arrow Rain: the game's 'rain' shot on every enemy each wave (the yellow ring per wave is the spec's `rings`).
  nowArrowRain(q, c, t) {
    const out = []; const ms = q * CAST_MS_NEW.nowArrowRain;
    for (let w = 0; w < 6; w++) { const wt = ms - w * 333; if (wt < 0 || wt > 300) continue; c.enemies.forEach((e, i) => out.push(...shotFx('rain', wt / 300, { x: e.x, y: e.y - 45 }, { x: e.x, y: e.y }, t, w * 5 + i))); }
    return out;
  },
  // Today's Death Coil: just the game's dark bolt shot.
  nowDarkbolt(q, c, t) {
    const k = c.caster, u = c.targets[0]; if (!k || !u) return [];
    return shotFx('darkbolt', q, { x: k.x + k.hw + 2, y: k.mid }, { x: u.x, y: u.mid }, t, 3);
  },
  // Today's Smoke Bomb (before the Rogue's new look), kept so the demo can show what it replaced.
  oldSmokeBomb(q, c, t) {
    const g = pen(); const p = easeOut(ph(q, 0, 0.35)), out = ph(q, 0.75, 1);
    c.enemies.forEach((u) => { for (let k = 0; k < 5; k++) if (out < 1) g.disc(u.x + (k - 2) * 3 + Math.sin(t / 300 + k) * 1.2, u.top + 2 + Math.cos(t / 250 + k) * 1.5, 1.5 + p * 1.5, k % 2 ? C.grey2 : C.grey, 0.8 * p * (1 - out)); });
    return g.out;
  },
};
export const CAST_MS_NEW = { necroCharge: 700, deathCoilNew: 1100, boneSacrificeNew: 1700, nowDarkbolt: 520, clericCharge: 700, holyNovaNew: 1300, sanctuaryNew: 1800, berserkerCharge: 600, savageLeapNew: 1300, bloodFeast: 1700, oldSmokeBomb: 1400, archerChargeUp: 500, archerChargeAim: 400, arrowRainNew: 3000, huntersMarkNew: 1900, nowArrowRain: 2300 };
// Name colours for heroes the game has none for yet (combat.json skillFx.name.heroColors gets them when they are built).
export const NAME_COLORS = { archer: '#b8f07a' };

// How the demo plays each skill (besides the Knight, who has his own code in demo.js).
//   now: { recipe, ms, move: 'lunge'|'leap'|'hop'|null, rings: per-wave yellow rings, number }
//   new: { charge, recipe, ms, move: { type: 'dash'|'leap'|'hop', ... }, waves, tremble, hit: { at, shake (screen px), shakeMs, stopMs }, number }
export const SPECS = {
  multistrike: { hero: 'rogue', now: { recipe: 'eviscerate', ms: 600, move: 'lunge', rings: true, number: '6' }, new: { charge: 'rogueCharge', recipe: 'rogueDash', move: { type: 'dash', config: 'multistrike' }, waves: 'multistrike', number: '6' } },
  smoke_bomb: { hero: 'rogue', now: { recipe: 'oldSmokeBomb', move: 'hop' }, new: { charge: 'rogueCharge', recipe: 'smokeBomb', move: { type: 'hop' }, squadTint: true } },
  brawl_leap: { hero: 'berserker', now: { recipe: 'savageLeap', move: 'leap', number: '70', numberAll: true },
    new: { charge: 'berserkerCharge', tremble: true, recipe: 'savageLeapNew', move: { type: 'leap', upMs: 260, holdMs: 200, backMs: 320, liftPx: 54, share: 0.8, slam: true }, hit: { at: 260, shake: 9, shakeMs: 280, stopMs: 120, knockPx: 15 }, number: '70', numberAll: true, radius: 'landSplash' } },
  holy_nova: { hero: 'cleric', ally: true, now: { recipe: 'holyNova', move: null, heal: '+24', number: '15', radius: 'holyNova' },
    new: { charge: 'clericCharge', recipe: 'holyNovaNew', move: { type: 'hop', liftPx: 8 }, hit: { at: 220, shake: 2, shakeMs: 120, stopMs: 0 }, heal: '+24', number: '15', radius: 'holyNova' } },
  sanctuary: { hero: 'cleric', ally: true, now: { recipe: 'divineShield', move: 'hop', heal: '', shield: true },
    new: { charge: 'clericCharge', recipe: 'sanctuaryNew', move: { type: 'hop', liftPx: 10 }, hit: { at: 200, shake: 0, shakeMs: 0, stopMs: 0 }, heal: '', shield: true } },
  death_coil3: { hero: 'necromancer', now: { recipe: 'nowDarkbolt', move: null, number: '50', numberAt: 520 },
    new: { charge: 'necroCharge', recipe: 'deathCoilNew', move: null, hit: { at: 420, shake: 3, shakeMs: 160, stopMs: 60 }, number: '50' } },
  bone_sacrifice: { hero: 'necromancer', ally: true, minions: true, squadTargets: true, now: { recipe: 'boneWard', move: 'hop', minionsGone: 0, minionsFade: true },
    new: { charge: 'necroCharge', recipe: 'boneSacrificeNew', move: { type: 'hop', liftPx: 8 }, minionsGone: 150, minionsShake: true } },
  arrow_rain: { hero: 'archer', now: { recipe: 'nowArrowRain', move: null, rings: true, number: '10' },
    new: { charge: 'archerChargeUp', recipe: 'arrowRainNew', move: { type: 'recoil', px: 9 }, hit: { at: 300, shake: 2, shakeMs: 90, stopMs: 0 }, radius: 'area',
      rain: { every: 333, shake: 2, lastShake: 4, shakeMs: 90, jitterPx: 5, lastJitterPx: 10, jitterMs: 150 }, number: '10' } },
  hunters_mark: { hero: 'archer', now: { recipe: 'huntersMark', move: 'hop' },
    new: { charge: 'archerChargeAim', recipe: 'huntersMarkNew', move: { type: 'recoil', px: 6 }, hit: { at: 140, shake: 1.5, shakeMs: 100, stopMs: 40 },
      text: { s: '+25% DMG', at: 300, color: '#ff7a7a' } } },
  blood_feast: { hero: 'berserker', now: { recipe: 'bloodPact', move: 'hop' }, new: { charge: 'berserkerCharge', tremble: true, recipe: 'bloodFeast', move: { type: 'hop', liftPx: 10 } } },
};
