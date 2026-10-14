// Hero skill effects (user's choice: the FULL version, every skill its own effect), ported from the effects
// proposal page (docs/proposals/fx-effects.js, "Hero skills"). Which skill plays which recipe is in
// src/data/skillFx.json. No Phaser here: character pixels (world / CHAR_SCALE).
//   Cast recipes: (q, c, t) with q = 0..1 over CAST_MS[name] and c = where everyone is right now:
//     { caster, targets: [bodies], squad: [bodies], enemies: [bodies] }   (body = { x, y, top, mid, bot, hw })
//   They return { draws, tints: [[listName, index, [colour, amount] | null]] } or just draws.
//   Shot recipes: (q, a, b, t, seed) with a = from, b = to ({ x, y }), q = 0..1 over SHOT_MS[kind].
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const fly = (a, b, p, arc = 0) => [a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p - Math.sin(p * Math.PI) * arc];
const DUST = 0xc9b18a, KNIFE = 0xe4e8f0, ARROW = 0xc68a5e, NOTE = 0xf06ab4, RUNE = 0x9b4dff, ROAR = 0xff4a4a, DULL = 0x6f6890, GREENEYE = 0x6dff8a, BONE = 0xebe5cf, PETAL = 0xf6a8c8, STANCE = 0xffd27a;

export const CAST_MS = { groundPound: 700, rallyCry: 1100, smokeBomb: 1400, huntersMark: 900, savageLeap: 750, warCry: 900, windCutter: 500, focusStance: 700, frostNova: 800, arcaneWard: 1200, divineShield: 700, boneWard: 1200, ballad: 1600 };
export const SHOT_MS = { knife: 200, rain: 300, note: 320, fireball: 720, darkbolt: 520, holybolt: 520, flask: 900 };

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
const mean = (list, k) => list.reduce((s, u) => s + u[k], 0) / Math.max(1, list.length);

// ---- cast recipes -------------------------------------------------------------------------------
const CAST = {
  // Knight: Ground Pound. A dust shockwave ripples out along the floor from where he slams.
  groundPound(q, c) {
    const g = pen(); const u = c.caster;
    if (q > 0 && q < 1) g.ring(u.x, u.y, 4 + q * 60, DUST, 1 - q, 1 + q * 6);
    burst(g, u.x, u.y, 10, [DUST, C.grey2], q, 10, 1, 0.5);
    return g.out;
  },
  // Knight: Rally Cry. A green ring rolls over the squad, a little blue shield pops over each hero's head.
  rallyCry(q, c) {
    const g = pen(); const u = c.caster; const p = ph(q, 0, 0.65);
    if (p > 0 && p < 1) g.ring(u.x, u.mid, 3 + p * 34, C.heal, 1 - p, 2 + p * 22);
    c.targets.forEach((h, i) => {
      const s = ph(q, 0.3 + i * 0.08, 0.95 + i * 0.05);
      if (s > 0 && s < 1) { const y = h.top - 5 - s * 5; g.rect(h.x - 2, y, 5, 3, C.shield, 1 - s); g.rect(h.x - 1, y + 3, 3, 1, C.shield, 1 - s); g.px(h.x, y + 4, C.shield, 1 - s); }
    });
    return { draws: g.out, tints: c.targets.map((h, i) => ['targets', i, q > 0.3 + i * 0.08 && q < 0.95 ? [C.shield, 0.25] : null]) };
  },
  // Rogue: Smoke Bomb. Grey smoke blooms over every enemy's head (Blind).
  smokeBomb(q, c, t) {
    const g = pen(); const p = easeOut(ph(q, 0, 0.35)), out = ph(q, 0.75, 1);
    c.enemies.forEach((u) => { for (let k = 0; k < 5; k++) if (out < 1) g.disc(u.x + (k - 2) * 3 + Math.sin(t / 300 + k) * 1.2, u.top + 2 + Math.cos(t / 250 + k) * 1.5, 1.5 + p * 1.5, k % 2 ? C.grey2 : C.grey, 0.8 * p * (1 - out)); });
    return g.out;
  },
  // Archer: Hunter's Mark. A big red reticle drops onto the target, snaps tight and pulses once.
  huntersMark(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const p = ph(q, 0, 0.45); const R = Math.max(u.hw, (u.bot - u.top) / 2) + 4; const r = R + (1 - easeOut(p)) * 8, yy = u.mid - (1 - easeOut(p)) * 20;
    if (p > 0 && q < 1) {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4 + (1 - p) * 2; const cx = u.x + Math.cos(a) * r, cy = yy + Math.sin(a) * r; const ta = a + Math.PI / 2;
        for (let k = -2; k <= 2; k++) g.px(cx + Math.cos(ta) * k, cy + Math.sin(ta) * k, C.mark);
        for (let k = 1; k <= 2; k++) g.px(cx - Math.cos(a) * k, cy - Math.sin(a) * k, C.mark);
      }
      g.px(u.x, yy, C.mark);
    }
    const s = ph(q, 0.45, 0.8); if (s > 0 && s < 1) g.ring(u.x, u.mid, R + s * 6, C.mark, 1 - s);
    return g.out;
  },
  // Berserker: Savage Leap. He crashes down in front of the enemy: a red impact star and dust (after the leap).
  savageLeap(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const p = ph(q, 0.3, 1); const fx = u.x - u.hw, fy = u.mid;
    rays(g, fx, fy, 10, 16, C.blood, p); burst(g, fx - 6, u.y, 8, [DUST], p, 10, 2);
    return g.out;
  },
  // Berserker: War Cry. Red rings blast out; the squad glows red (+attack), the enemies sag grey (Weakened).
  warCry(q, c) {
    const g = pen(); const u = c.caster;
    for (let k = 0; k < 2; k++) { const p = ph(q, k * 0.15, 0.85 + k * 0.15); if (p > 0 && p < 1) g.ring(u.x, u.mid, 4 + p * 40, ROAR, (1 - p) * 0.9, 3 + p * 24); }
    const on = q > 0.3 && q < 1;
    return { draws: g.out, tints: [...c.squad.map((h, i) => ['squad', i, on ? [C.blood, 0.25] : null]), ...c.enemies.map((e, i) => ['enemies', i, q > 0.5 && q < 1 ? [DULL, 0.4] : null])] };
  },
  // Samurai: Wind Cutter. One swift white crescent sweeps across the whole enemy line at body height.
  windCutter(q, c) {
    const g = pen(); if (!c.enemies.length) return g.out;
    const x0 = c.caster.x, x1 = Math.max(...c.enemies.map((e) => e.x)) + 20; const cx = x0 + (x1 - x0) * q; const midY = mean(c.enemies, 'mid');
    const dir = x1 >= x0 ? 1 : -1;
    if (q > 0 && q < 1) for (let a = -1.2; a <= 1.2; a += 0.05) { g.px(cx + dir * Math.cos(a) * 10, midY + Math.sin(a) * 16, C.white); g.px(cx + dir * Math.cos(a) * 9, midY + Math.sin(a) * 16, C.grey, 0.6); }
    return { draws: g.out, tints: c.enemies.map((e, i) => ['enemies', i, Math.abs(e.x - cx) < 6 ? [C.white, 1] : null]) };
  },
  // Samurai: Focus Stance. A gold ring closes in on his body, petals swirl, he takes a gold edge.
  focusStance(q, c, t) {
    const g = pen(); const u = c.caster;
    if (q < 1) g.ring(u.x, u.mid, 22 - q * 12, STANCE, 1 - q * 0.3, 18 - q * 6);
    for (let i = 0; i < 6; i++) { const a = t / 400 + i; g.rect(u.x + Math.cos(a) * 12, u.mid + Math.sin(a) * 8, 2, 1, PETAL, 1 - q); }
    return { draws: g.out, tints: [['caster', 0, [STANCE, Math.round(q * 0.25 * 20) / 20]]] };
  },
  // Mage: Frost Nova. A ring of ice bursts out from the middle of the enemy group, ice sparks on each.
  frostNova(q, c) {
    const g = pen(); if (!c.enemies.length) return g.out;
    const cx = mean(c.enemies, 'x'), cy = mean(c.enemies, 'y'); const p = ph(q, 0, 0.75);
    if (p > 0 && p < 1) { g.ring(cx, cy, 2 + p * 30, C.ice, 1 - p, 1 + p * 14); g.ring(cx, cy, p * 26, C.white, (1 - p) * 0.7, p * 12); }
    c.enemies.forEach((u, i) => burst(g, u.x, u.mid, 6, [C.ice, C.white], ph(q, 0.25 + i * 0.07, 0.75 + i * 0.07), 6, i));
    return { draws: g.out, tints: c.enemies.map((e, i) => ['enemies', i, q > 0.35 && q < 1 ? [C.ice, 0.4] : null]) };
  },
  // Mage: Arcane Ward. A glowing rune circle spins on the floor under the squad (the shields show by themselves).
  arcaneWard(q, c, t) {
    const g = pen(); if (!c.squad.length) return g.out;
    const cx = mean(c.squad, 'x'), cy = mean(c.squad, 'y') + 3; const p = easeOut(ph(q, 0, 0.4)), a0 = 1 - ph(q, 0.75, 1);
    for (let k = 0; k < 2; k++) g.ring(cx, cy, (16 + k * 6) * p, k ? RUNE : C.shield, 0.8 * a0, (6 + k * 2) * p);
    for (let i = 0; i < 6; i++) { const a = t / 500 + (i * Math.PI) / 3; g.px(cx + Math.cos(a) * 19 * p, cy + Math.sin(a) * 7 * p, C.white, a0); }
    return g.out;
  },
  // Cleric: Divine Shield. A golden dome drops over the ally, sitting on the floor around it.
  divineShield(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const p = easeOut(ph(q, 0, 0.45)), a = 1 - ph(q, 0.7, 1); const R = u.hw + 6, HH = u.y - u.top + 4;
    for (let an = Math.PI; an <= Math.PI * 2; an += 0.05) g.px(u.x + Math.cos(an) * R, u.y + Math.sin(an) * HH * p, C.holy, 0.85 * a);
    for (let x = -R; x <= R; x++) g.px(u.x + x, u.y, C.holy, 0.6 * a);
    return g.out;
  },
  // Necromancer: Bone Ward. Small bones orbit each shielded body.
  boneWard(q, c, t) {
    const g = pen(); const a = 1 - ph(q, 0.75, 1);
    c.targets.forEach((u) => { for (let k = 0; k < 4; k++) { const an = t / 300 + (k * Math.PI) / 2; g.rect(u.x + Math.cos(an) * (u.hw + 4) - 1, u.mid + Math.sin(an) * 5, 3, 1, BONE, a); } });
    return g.out;
  },
  // Bard: Ballad of Rest. Soft green notes drift up from each hero.
  ballad(q, c, t) {
    const g = pen();
    c.targets.forEach((u, j) => { for (let i = 0; i < 2; i++) { const s = (q * 1.6 + i / 2 + j * 0.13) % 1; const x = u.x + (i ? u.hw + 3 : -u.hw - 3) + Math.sin(t / 400 + i + j) * 2, y = u.mid - s * 22; const a = (1 - s) * (1 - ph(q, 0.8, 1)); g.rect(x - 1, y, 2, 2, C.heal, a); g.line(x, y, x, y - 3, C.heal, a); } });
    return g.out;
  },
};
export const CAST_FX = Object.keys(CAST);

// One cast effect: always { draws, tints } (tints = [listName, index, tint | null], listName = caster/targets/squad/enemies).
export function castFx(name, q, c, t) {
  const fn = CAST[name];
  if (!fn) return { draws: [], tints: [] };
  const out = fn(q, c, t);
  return Array.isArray(out) ? { draws: out, tints: [] } : { draws: out.draws || [], tints: out.tints || [] };
}

// ---- shots (skill projectiles) ------------------------------------------------------------------
const SHOT = {
  // Fan of Knives: a small spinning knife.
  knife(q, a, b, t) { const g = pen(); if (q < 1) { const [x, y] = fly(a, b, q, 4); const an = t / 30; g.line(x - Math.cos(an) * 2, y - Math.sin(an) * 2, x + Math.cos(an) * 2, y + Math.sin(an) * 2, KNIFE); g.px(x, y, C.white); } return g.out; },
  // Rain of Arrows: arrows drop from high above onto the target's spot, a dust puff where they land.
  rain(q, a, b, t, seed) {
    const g = pen();
    for (let i = 0; i < 3; i++) {
      const p = ph(q, i * 0.12, 0.7 + i * 0.12); const x = b.x + (rnd(seed * 3 + i) - 0.5) * 14; const y = b.y - 45 + p * 45;
      if (p > 0 && p < 1) { g.line(x - 1, y - 5, x, y, ARROW); g.px(x, y + 1, C.white); }
      const d = ph(q, 0.7 + i * 0.12, 1); if (d > 0 && d < 1) g.px(x, b.y, DUST, 1 - d);
    }
    return g.out;
  },
  // Crescendo: a music note flies to the target.
  note(q, a, b) { const g = pen(); if (q < 1) { const [x, y] = fly(a, b, q, 6); g.rect(x - 1, y, 2, 2, NOTE); g.line(x, y, x, y - 4, NOTE); } return g.out; },
  // Mage Fireball: a big fireball with a long flame trail (first half), then it explodes on the target.
  fireball(q, a, b, t) {
    const g = pen(); const p = ph(q, 0, 0.45);
    if (p > 0 && p < 1) {
      const [x, y] = fly(a, b, p, 8);
      for (let i = 1; i < 9; i++) { const [tx, ty] = fly(a, b, Math.max(0, p - i * 0.025), 8); g.px(tx, ty + (rnd(i + Math.floor(t / 40)) - 0.5) * 3, i < 4 ? C.fire2 : C.fire, 1 - i / 9); }
      g.disc(x, y, 3, C.fire); g.disc(x, y, 1.5, C.fire2);
    }
    const e = ph(q, 0.45, 1);
    if (e > 0 && e < 1) { g.disc(b.x, b.y, 3 + e * 8, C.fire2, (1 - e) * 0.8); g.ring(b.x, b.y, 4 + e * 14, C.fire, 1 - e); }
    return g.out;
  },
  // Death Coil: a spiralling skull bolt with green and purple wisps.
  darkbolt(q, a, b, t) {
    const g = pen(); const p = ph(q, 0, 0.65);
    if (p > 0 && p < 1) {
      const [x, y] = fly(a, b, p, 6);
      for (let i = 1; i < 6; i++) { const [tx, ty] = fly(a, b, Math.max(0, p - i * 0.04), 6); const an = t / 40 + i; g.px(tx + Math.cos(an) * 1.5, ty + Math.sin(an) * 2, i % 2 ? GREENEYE : C.dark, 1 - i / 6); }
      g.rect(x - 1, y - 1, 3, 3, BONE); g.px(x - 1, y, C.outline); g.px(x + 1, y, C.outline);
    }
    const e = ph(q, 0.65, 1); if (e > 0 && e < 1) g.ring(b.x, b.y, 8 * (1 - e), C.dark);
    return g.out;
  },
  // Smite: a holy pillar crashes straight onto the enemy (no flight).
  holybolt(q, a, b) {
    const g = pen();
    if (q > 0 && q < 1) { const w = Math.round(5 * (1 - q)) + 1; const top = b.y - 70; for (let y = Math.round(top); y < b.y + 8; y++) for (let x = -w; x <= w; x++) g.px(b.x + x, y, Math.abs(x) < w / 2 ? C.white : C.holy, 0.85 * (1 - q)); }
    return g.out;
  },
  // Alchemist flasks: a flask lobs over (first half) and splashes in its colour; a green one leaves a cloud.
  flask(q, a, b, t, seed, color = C.fire) {
    const g = pen(); const p = ph(q, 0, 0.5);
    if (p > 0 && p < 1) { const [x, y] = fly(a, b, p, 16); g.rect(x - 1, y - 1, 3, 3, color); g.px(x, y - 2, C.grey); }
    const e = ph(q, 0.5, 1);
    burst(g, b.x, b.y, 10, [color, C.white], e, 10, seed, 1);
    if (e > 0 && e < 1) g.ring(b.x, b.y, 2 + e * 6, color, 1 - e);
    return g.out;
  },
};
export const SHOT_FX = Object.keys(SHOT);
export function shotFx(kind, q, a, b, t, seed = 0, color) { return SHOT[kind] ? SHOT[kind](q, a, b, t, seed, color) : []; }
