// PROPOSED skill looks for the heroes after the Knight (demo page only, not game code yet). The recipes are written in
// the SAME format as src/systems/skillFx.js (q 0..1, c = { caster, targets, squad, enemies, hitMs, radius }, t) so
// moving an approved one into the game is a copy into CAST + CAST_MS there.
// SPECS says how the demo plays each skill: the NOW look (today's game) and the NEW look (charge, move, cast recipe, hit).
import { pen, rnd, FX_COLORS as C } from '../../../src/systems/statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);

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
  // SAVAGE LEAP impact (he lands at c.hitMs): the floor cracks open under him, rubble flies, a dust ring rolls out,
  // blood splatters from every enemy inside the landing area (c.radius) and they flash.
  savageLeapNew(q, c, t) {
    const g = pen(); const k = c.caster; const ms = q * CAST_MS_NEW.savageLeapNew, hit = ms - (c.hitMs || 0);
    if (hit < 0 || !k) return { draws: g.out, tints: [] };
    const L = { x: k.x, y: k.y };
    const life = 1 - ph(hit, 700, 1100);
    for (let i = 0; i < 7; i++) { // jagged cracks along the floor
      const a = (i / 7) * Math.PI * 2 + rnd(i) * 0.5, len = (8 + rnd(i * 5) * 12) * easeOut(ph(hit, 0, 90));
      let x = L.x, y = L.y;
      for (let s = 0; s < len; s += 2) {
        const nx = L.x + Math.cos(a) * (s + 2) + (rnd(i * 31 + s) - 0.5) * 2.5, ny = L.y + Math.sin(a) * (s + 2) * 0.35 + (rnd(i * 17 + s) - 0.5) * 1.2;
        g.line(x, y, nx, ny, CRACK, life); g.px(nx, ny - 1, BERS.dark, life * 0.6);
        x = nx; y = ny;
      }
    }
    for (let i = 0; i < 10; i++) { // rubble
      const p = ph(hit, 0, 450 + rnd(i) * 200); if (p <= 0 || p >= 1) continue;
      const a = -Math.PI / 2 + (rnd(i * 3) - 0.5) * 2.6, v = 10 + rnd(i * 7) * 12;
      g.rect(L.x + Math.cos(a) * v * p, L.y - 2 + Math.sin(a) * v * p + p * p * 22, i % 3 ? 1 : 2, i % 3 ? 1 : 2, RUBBLE[i % 3], 1);
    }
    const dp = ph(hit, 0, 500); if (dp > 0 && dp < 1) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r = 4 + 20 * easeOut(dp); g.disc(L.x + Math.cos(a) * r, L.y - 1 + Math.sin(a) * r * 0.35, 1.5 + dp * 1.5, i % 2 ? 0x8a7a68 : 0x6a5d50, 0.7 * (1 - dp)); }
    const hitList = c.enemies.filter((e) => Math.hypot(e.x - L.x, (e.y - L.y) * 1.4) <= (c.radius || 30));
    hitList.forEach((e, i) => splatter(g, e.x, e.mid, ph(hit, 0, 600), 14, 11 + i * 7, 14));
    const tints = c.enemies.map((e, i) => ['enemies', i, hitList.includes(e) ? (hit < 80 ? [C.white, 0.8] : hit < 260 ? [BERS.mid, 0.35] : null) : null]);
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
  // Today's Smoke Bomb (before the Rogue's new look), kept so the demo can show what it replaced.
  oldSmokeBomb(q, c, t) {
    const g = pen(); const p = easeOut(ph(q, 0, 0.35)), out = ph(q, 0.75, 1);
    c.enemies.forEach((u) => { for (let k = 0; k < 5; k++) if (out < 1) g.disc(u.x + (k - 2) * 3 + Math.sin(t / 300 + k) * 1.2, u.top + 2 + Math.cos(t / 250 + k) * 1.5, 1.5 + p * 1.5, k % 2 ? C.grey2 : C.grey, 0.8 * p * (1 - out)); });
    return g.out;
  },
};
export const CAST_MS_NEW = { berserkerCharge: 600, savageLeapNew: 1300, bloodFeast: 1700, oldSmokeBomb: 1400 };

// How the demo plays each skill (besides the Knight, who has his own code in demo.js).
//   now: { recipe, ms, move: 'lunge'|'leap'|'hop'|null, rings: per-wave yellow rings, number }
//   new: { charge, recipe, ms, move: { type: 'dash'|'leap'|'hop', ... }, waves, tremble, hit: { at, shake (screen px), shakeMs, stopMs }, number }
export const SPECS = {
  multistrike: { hero: 'rogue', now: { recipe: 'eviscerate', ms: 600, move: 'lunge', rings: true, number: '6' }, new: { charge: 'rogueCharge', recipe: 'rogueDash', move: { type: 'dash', config: 'multistrike' }, waves: 'multistrike', number: '6' } },
  smoke_bomb: { hero: 'rogue', now: { recipe: 'oldSmokeBomb', move: 'hop' }, new: { charge: 'rogueCharge', recipe: 'smokeBomb', move: { type: 'hop' }, squadTint: true } },
  brawl_leap: { hero: 'berserker', now: { recipe: 'savageLeap', move: 'leap', number: '70', numberAll: true },
    new: { charge: 'berserkerCharge', tremble: true, recipe: 'savageLeapNew', move: { type: 'leap', upMs: 230, holdMs: 160, backMs: 320, liftPx: 34, share: 0.8 }, hit: { at: 230, shake: 6, shakeMs: 220, stopMs: 90 }, number: '70', numberAll: true, radius: 'landSplash' } },
  blood_feast: { hero: 'berserker', now: { recipe: 'bloodPact', move: 'hop' }, new: { charge: 'berserkerCharge', tremble: true, recipe: 'bloodFeast', move: { type: 'hop', liftPx: 10 } } },
};
