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

export const CAST_MS = { rogueDash: 160, rogueSlash: 260, rogueCharge: 400, shieldBash: 800, challenge: 1200, knightCharge: 500, bloodPact: 1000, eviscerate: 600, changeSong: 1100, groundPound: 700, rallyCry: 1100, smokeBomb: 1600, huntersMark: 900, savageLeap: 750, warCry: 900, windCutter: 500, focusStance: 700, frostNova: 800, arcaneWard: 1200, divineShield: 700, holyNova: 800, boneWard: 1200, ballad: 1600 };
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
// The Rogue's colours (cyan).
const ROGUE = { light: 0xc8f8ff, mid: 0x5fe0f0, deep: 0x1f6f80 };
// The Knight's colours (steel blue) and his little pixel shield: rim, face, white cross glint.
const KNIGHT = { white: 0xffffff, light: 0xcfe4ff, mid: 0x6fa8ff, deep: 0x3b6fd4 };
const SHIELD = ['.#####.', '#xxxxx#', '#xx+xx#', '#x+++x#', '.#x+x#.', '.#xxx#.', '..#x#..', '...#...'];
function shieldPx(g, cx, cy, rim, face, a, s = 1) {
  if (a <= 0) return;
  SHIELD.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.rect(Math.round(cx + (x - 3.5) * s), Math.round(cy + (y - 4) * s), s, s, ch === '#' ? rim : ch === '+' ? 0xffffff : face, a); }));
}
// A little dust kicked up at someone's feet.
function dustPx(g, x, y, p, seed = 1, size = 1) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < 8 * size; i++) { const side = i % 2 ? 1 : -1, d = (3 + rnd(seed + i) * 7 * size) * easeOut(p); g.rect(x + side * d, y - 1 - rnd(seed + i * 5) * 3 * p, i % 3 ? 1 : 2, 1, i % 3 ? 0x8a7a68 : 0x6a5d50, 1 - p); }
}
// A shout: a curved sound wave (2 px thick) of radius r around (x, y), facing `ang`.
function shoutPx(g, x, y, r, ang, c, a, th = 2) {
  for (let k = -12; k <= 12; k++) { const t = ang + k * 0.06; for (let j = 0; j < th; j++) g.px(x + Math.cos(t) * (r + j), y + Math.sin(t) * (r + j) * 1.3, c, a); }
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
  // Rogue: Smoke Bomb (3-beat look, 2026-10-18). She lobs a little black bomb over the enemies; it bursts into a big
  // grey smoke cloud on each of them (the Blind status keeps its own small smoke loop after); her squad flickers cyan
  // for a moment (+evasion).
  smokeBomb(q, c, t) {
    const g = pen(); const u = c.caster; const foes = c.enemies;
    if (!foes.length) return g.out;
    const mx = mean(foes, 'x'), my = mean(foes, 'mid');
    const fp = ph(q, 0, 0.3); // the bomb flies
    if (fp > 0 && fp < 1) { const [x, y] = fly({ x: u.x, y: u.mid }, { x: mx, y: my }, easeInOut(fp), 22); g.rect(x - 1, y - 1, 3, 3, 0x22222a); g.px(x + 1, y - 2, ROGUE.light); g.px(x + 2, y - 3, 0xffb84d, Math.sin(t / 30) > 0 ? 1 : 0.4); }
    const sp = ph(q, 0.3, 1);
    if (sp > 0 && sp < 1) {
      if (sp < 0.12) g.disc(mx, my, 3 + sp * 30, C.white, 1 - sp / 0.12); // the pop
      foes.forEach((e, j) => {
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2 + j, r = (3 + rnd(k + j * 9) * 7) * easeOut(Math.min(1, sp * 2.5));
          const x = e.x + Math.cos(a) * r * 1.3 + Math.sin(t / 300 + k) * 1.2, y = e.mid - 3 + Math.sin(a) * r * 0.8 - sp * 6;
          g.disc(x, y, 2 + easeOut(Math.min(1, sp * 2)) * 2.5, k % 3 ? C.grey2 : k % 2 ? C.grey : ROGUE.deep, 0.85 * (1 - ph(sp, 0.55, 1)));
        }
      });
    }
    const on = q > 0.3 && q < 0.75 && Math.sin(t / 45) > 0;
    return { draws: g.out, tints: c.targets.map((h, i) => ['targets', i, on ? [ROGUE.mid, 0.45] : null]) };
  },
  // Rogue: Multistrike, the cast moment: she shoots in (cyan streaks behind her). The 5 hits are rogueSlash (per wave).
  rogueDash(q, c) {
    const g = pen(); const u = c.targets[0], k = c.caster; if (!u || !k) return g.out;
    const dx = k.x - u.x, dy = k.mid - u.mid, d = Math.hypot(dx, dy) || 1, p = ph(q, 0, 1);
    if (p < 1) for (let i = 0; i < 5; i++) { const off = (i - 2) * 2.5, len = 8 + rnd(i) * 8, bx = k.x + (dx / d) * (k.hw + 1) - (dy / d) * off, by = k.mid + (dx / d) * off; g.line(bx, by, bx + (dx / d) * len, by + (dy / d) * len, i % 2 ? ROGUE.mid : ROGUE.light, 0.8 * (1 - p)); }
    return g.out;
  },
  // Rogue: one hit of Multistrike (c.wave of c.waves): a quick cyan knife slash across the target, the way alternating
  // each hit, blood drops (Bleed); the LAST hit is a bigger X of two slashes.
  rogueSlash(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const w = c.wave || 0, last = w === (c.waves || 1) - 1;
    const slash = (dir, len, p, off = 0) => {
      if (p <= 0 || p >= 1) return;
      const grow = easeOut(Math.min(1, p * 2.5)), a = 1 - ph(p, 0.4, 1);
      const x0 = u.x - (len / 2) * dir, y0 = u.mid - len / 2 + off;
      for (let k = 0; k < len * grow; k++) {
        const x = x0 + k * dir, y = y0 + k, edge = Math.abs(k - len / 2) / (len / 2);
        g.px(x, y, edge < 0.6 ? C.white : ROGUE.light, a); g.px(x + dir, y, ROGUE.mid, a * 0.9); if (edge < 0.3) g.px(x - dir, y, ROGUE.mid, a * 0.7);
      }
    };
    const dir = w % 2 ? -1 : 1;
    if (last) { slash(1, 22, ph(q, 0, 0.8)); slash(-1, 22, ph(q, 0.12, 0.92)); } else slash(dir, 14, ph(q, 0, 1), (w % 3) - 1);
    for (let i = 0; i < (last ? 6 : 3); i++) { const p = ph(q, 0.1, 1); if (p > 0 && p < 1) g.rect(u.x + (rnd(w * 7 + i) - 0.5) * 10, u.mid + (rnd(w * 3 + i * 5) - 0.5) * 6 + p * p * 10, 1, 2, C.blood, 1 - p); }
    return { draws: g.out, tints: [['targets', 0, q < 0.2 ? [C.white, last ? 0.8 : 0.5] : null]] };
  },
  // Rogue: the CHARGE beat of her skills (wind-up): she flickers cyan, faster and faster, specks streak into her from
  // the sides, her two knives glint in turn.
  rogueCharge(q, c, t) {
    const g = pen(); const u = c.caster;
    for (let i = 0; i < 8; i++) {
      const s = (q * 2 + i / 8) % 1, side = i % 2 ? 1 : -1, y = u.top + 3 + rnd(i * 5) * (u.bot - u.top - 4), x = u.x + side * (u.hw + 2 + 18 * (1 - easeOut(s)));
      g.rect(x, y, 2, 1, i % 3 ? ROGUE.light : ROGUE.mid, s * 0.9);
    }
    const blink = Math.floor(t / (110 - 60 * q)) % 2;
    for (const [side, on] of [[-1, blink], [1, 1 - blink]]) if (on) { const x = u.x + side * (u.hw + 2), y = u.mid; g.px(x, y, C.white); g.px(x, y - 1, ROGUE.light); g.px(x, y + 1, ROGUE.light); g.px(x - 1, y, ROGUE.light); g.px(x + 1, y, ROGUE.light); }
    const pulse = 0.5 + 0.5 * Math.sin(t / (60 - 30 * q));
    return { draws: g.out, tints: [['caster', 0, [ROGUE.mid, Math.round((0.1 + 0.3 * q) * pulse * 20) / 20]]] };
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
  // Cleric: Holy Nova. A golden ring bursts out from the healed hero, with sparks rising on it.
  holyNova(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const p = easeOut(ph(q, 0, 0.7));
    if (p > 0 && p < 1) { g.ring(u.x, u.y, 3 + p * 34, C.holy, 1 - p, 1 + p * 14); g.ring(u.x, u.y, p * 28, C.white, (1 - p) * 0.6, p * 11); }
    burst(g, u.x, u.mid, 10, [C.holy, C.gold, C.white], ph(q, 0, 0.6), 10, 3, 1);
    return g.out;
  },
  // Necromancer: Bone Ward. Small bones orbit each shielded body.
  boneWard(q, c, t) {
    const g = pen(); const a = 1 - ph(q, 0.75, 1);
    c.targets.forEach((u) => { for (let k = 0; k < 4; k++) { const an = t / 300 + (k * Math.PI) / 2; g.rect(u.x + Math.cos(an) * (u.hw + 4) - 1, u.mid + Math.sin(an) * 5, 3, 1, BONE, a); } });
    return g.out;
  },
  // Knight: Defense Bash (calm 3-beat look, user-approved demo docs/proposals/skill-fx, 2026-10-18). IMPACT: the print of
  // his blue shield flashes on the target where he hits it (white, then steel blue), a few steel chips fly away from
  // him, the target skids back in a little dust. (The stun stars are the stun status's own loop.)
  shieldBash(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const k = c.caster || u, dx = k.x - u.x, dy = k.mid - u.mid, d = Math.hypot(dx, dy) || 1;
    const ms = q * CAST_MS.shieldBash, hit = ms - (c.hitMs || 0); // hitMs: when his dash lands (combat.json skillFx.dash)
    // the dash: steel streaks behind him while he shoots in
    if (hit < 60) for (let i = 0; i < 4; i++) { const off = (i - 1.5) * 3, len = 6 + rnd(i) * 6, bx = k.x + (dx / d) * (k.hw + 2) - (dy / d) * off, by = k.mid + (dy / d) * 4 + (dx / d) * off; g.line(bx, by, bx + (dx / d) * len, by + (dy / d) * len, i % 2 ? KNIGHT.light : KNIGHT.white, 0.7); }
    if (hit < 0) return g.out;
    const px = u.x + (dx / d) * (u.hw + 1), py = u.mid + (dy / d) * 4; // the side of the target facing him
    const sp = ph(hit, 0, 380);
    if (sp < 1) shieldPx(g, px, py, hit < 70 ? KNIGHT.white : KNIGHT.light, hit < 70 ? KNIGHT.white : KNIGHT.mid, sp < 0.35 ? 1 : 1 - (sp - 0.35) / 0.65, 2);
    const away = Math.atan2(-dy, -dx);
    for (let i = 0; i < 8; i++) {
      const p = ph(hit, 0, 380 + rnd(i) * 140); if (p <= 0 || p >= 1) continue;
      const a = away + (rnd(i * 3) - 0.5) * 2.2, r = (8 + rnd(i * 7) * 12) * easeOut(p);
      g.rect(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.8 + p * p * 10, i % 3 ? 1 : 2, i % 3 ? 1 : 2, [KNIGHT.light, KNIGHT.mid, KNIGHT.deep][i % 3], 1 - p);
    }
    dustPx(g, u.x, u.y, ph(hit, 0, 450), 3);
    return { draws: g.out, tints: [['targets', 0, hit < 70 ? [C.white, 0.75] : null]] };
  },
  // Knight: Challenge (calm 3-beat look). He lands in a puff of dust and SHOUTS: three sound waves roll out towards
  // the enemies, each taunted enemy flashes red (the taunt status draws its own "!"), a little blue shield pops up
  // beside him (+defense).
  challenge(q, c) {
    const g = pen(); const u = c.caster; const ms = q * CAST_MS.challenge;
    const foes = c.targets.length ? c.targets : c.enemies;
    const ang = foes.length ? Math.atan2(mean(foes, 'mid') - (u.top + 4), mean(foes, 'x') - u.x) : 0;
    for (let k = 0; k < 3; k++) { const p = ph(ms, k * 70, k * 70 + 420); if (p > 0 && p < 1) shoutPx(g, u.x + Math.cos(ang) * u.hw, u.top + 4, 4 + 42 * easeOut(p), ang, k === 2 ? KNIGHT.light : KNIGHT.white, 1 - p * p, k === 0 ? 3 : 2); }
    dustPx(g, u.x, u.y, ph(ms, 0, 450), 9, 1.5);
    const bp = ph(ms, 60, 900);
    if (bp > 0 && bp < 1) shieldPx(g, u.x - u.hw - 10, u.mid - 4 - Math.round(easeOut(bp) * 5), bp < 0.12 ? KNIGHT.white : KNIGHT.light, bp < 0.12 ? KNIGHT.white : KNIGHT.mid, bp < 0.7 ? 1 : 1 - (bp - 0.7) / 0.3, 2);
    return { draws: g.out, tints: [['caster', 0, ms < 420 ? [KNIGHT.light, 0.55 * (1 - ms / 420)] : null], ...c.targets.map((e, i) => ['targets', i, ms > 80 + i * 60 && ms < 180 + i * 60 ? [ROAR, 0.4] : null])] };
  },
  // Knight: the CHARGE beat of both his skills (plays during the wind-up, q = wind-up progress): he glows steel blue,
  // more and more, little specks get pulled into him, a soft glow under his feet, a glint on his weapon at the end.
  knightCharge(q, c, t) {
    const g = pen(); const u = c.caster;
    for (let i = 0; i < 8; i++) {
      const s = (q * 1.7 + i / 8) % 1, a = rnd(i * 13) * Math.PI * 2, r = 22 * (1 - easeOut(s));
      g.rect(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r * 0.8, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 2 ? KNIGHT.light : KNIGHT.mid, s * 0.9);
    }
    g.ring(u.x, u.y, 4 + 5 * q, 1.5 + q, KNIGHT.mid, 0.3 + 0.5 * q);
    if (q > 0.6) { const b = Math.sin(t / 30) > 0 ? 1 : 0.4, x = u.x + u.hw + 2, y = u.mid - 4; g.px(x, y, KNIGHT.white, b); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.px(x + dx, y + dy, KNIGHT.light, b); }
    const pulse = 0.6 + 0.4 * Math.sin(t / 40);
    return { draws: g.out, tints: [['caster', 0, [KNIGHT.mid, Math.round((0.12 + 0.28 * q) * pulse * 20) / 20]]] };
  },
  // Berserker: Blood Pact. Red drops fly from him to every hero, who glow red for a moment.
  bloodPact(q, c) {
    const g = pen(); const u = c.caster;
    c.squad.forEach((h, i) => { const p = ph(q, 0.1 + i * 0.05, 0.7 + i * 0.05); if (p > 0 && p < 1) { const [x, y] = fly({ x: u.x, y: u.mid }, { x: h.x, y: h.mid }, easeInOut(p), 10); g.rect(x - 1, y - 1, 2, 3, C.blood); } });
    return { draws: g.out, tints: [['caster', 0, q < 0.4 ? [C.blood, 0.5] : null], ...c.squad.map((h, i) => ['squad', i, q > 0.6 && q < 1 ? [C.blood, 0.2] : null])] };
  },
  // Rogue: Eviscerate. Two quick purple slashes cross over the target.
  eviscerate(q, c) {
    const g = pen(); const u = c.targets[0]; if (!u) return g.out;
    const s1 = ph(q, 0, 0.35), s2 = ph(q, 0.2, 0.55);
    const slash = (p, dir) => { if (p <= 0 || p >= 1) return; for (let k = 0; k < 14 * p; k++) g.px(u.x - 7 * dir + k * dir, u.top + 2 + k, 0xc06bff, 1 - p * 0.5); };
    slash(s1, 1); slash(s2, -1);
    burst(g, u.x, u.mid, 8, [C.blood, 0xc06bff], ph(q, 0.4, 1), 9, 3, 0.4);
    return g.out;
  },
  // Bard: Change Song. Notes swirl around him in the new song's colour (gold March, green Ballad).
  changeSong(q, c, t) {
    const g = pen(); const u = c.caster; const col = c.song === 'ballad' ? C.heal : 0xffb84d;
    for (let i = 0; i < 5; i++) { const a = t / 300 + (i * Math.PI * 2) / 5; const r = 6 + q * 12; const x = u.x + Math.cos(a) * r, y = u.mid + Math.sin(a) * r * 0.6 - q * 6; g.rect(x - 1, y, 2, 2, col, 1 - q); g.line(x + 1, y, x + 1, y - 3, col, 1 - q); }
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
