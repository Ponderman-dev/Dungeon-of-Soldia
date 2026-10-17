// The EFFECT STAGE: plays any effect of the game with the game's own recipe code (systems/statusFx, hitFx, itemFx,
// skillFx) on a little scene at game size: the Knight against a Goblin and a Slime, plain canvas. Used by the
// Studio's Effects section (effects.js) and by the item review page (docs/proposals/item-review).
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import statuses from '../data/statuses.json';
import { artPixels, partArt, mixColor } from '../systems/pixelArt.js';
import { statusLook, LOOPING, bodyBox, iceColor } from '../systems/statusFx.js';
import { projectileFx, impactFx, critFx, IMPACT_MS, CRIT_MS, MOMENT_MS, HIT_TYPES, dodgeFx, blockFx, soakFx, shieldBreakFx, healFx, deathPuffFx } from '../systems/hitFx.js';
import * as itemFx from '../systems/itemFx.js';
import { castFx, shotFx, CAST_MS, SHOT_MS, CAST_FX, SHOT_FX } from '../systems/skillFx.js';

export const W = 120, H = 60; // the stage in character pixels
export const GROUPS = [['status', 'Status effects'], ['hit', 'Hits'], ['shot', 'Shots'], ['item', 'Item effects'], ['skill', 'Skill effects']];
const HERO_STATUSES = ['buff', 'regenBoost', 'shield', 'invulnerable', 'parry'];
const nice = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const HERO_ITEM_FX = ['battleCry', 'aegisBlast', 'thorns', 'mimic', 'spiritAxe']; // item effects drawn on the hero

// Every effect the game has, with how to play it on the stage.
export function catalog() {
  const list = [];
  for (const k of LOOPING) list.push({ group: 'status', name: k, label: (statuses[k] && statuses[k].label ? nice(k) : nice(k)), ms: 2400, on: HERO_STATUSES.includes(k) ? 'hero' : 'enemy' });
  for (const k of HIT_TYPES) list.push({ group: 'hit', name: k, label: `${nice(k)} hit`, ms: IMPACT_MS[k] });
  list.push({ group: 'hit', name: 'crit', label: 'Critical hit', ms: CRIT_MS });
  for (const [k, l] of [['dodge', 'Miss / dodge'], ['block', 'Block'], ['soak', 'Shield soaks a hit'], ['shieldBreak', 'Shield breaks'], ['heal', 'Heal'], ['puff', 'Enemy dies (smoke)']]) list.push({ group: 'hit', name: k, label: l, ms: MOMENT_MS[k] });
  for (const k of ['ranged', 'firearrow', 'fire', 'ice', 'electric', 'dark', 'holy']) list.push({ group: 'shot', name: k, label: `${nice(k)} shot`, ms: 300 });
  for (const k of SHOT_FX) list.push({ group: 'shot', name: k, label: `${nice(k)} (skill)`, ms: SHOT_MS[k] });
  for (const k of itemFx.ITEM_FX) list.push({ group: 'item', name: k, label: nice(k), ms: itemFx.ITEM_MS[k], on: HERO_ITEM_FX.includes(k) ? 'hero' : 'enemy' });
  list.push({ group: 'item', name: 'tornado', label: 'Excalibur tornado', ms: 2000 });
  for (const k of CAST_FX) list.push({ group: 'skill', name: k, label: nice(k), ms: CAST_MS[k] });
  return list;
}

// A character standing on the stage (feet at fx, fy), mirrored when it faces left.
function actor(def, fx, fy, faceLeft) {
  const box = bodyBox(def.parts, def.height);
  const parts = Object.values(def.parts).map((p) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { px, left: p.x - w / 2, top: p.y - h / 2, w };
  });
  const cx = faceLeft ? -box.cx : box.cx;
  return { def, fx, fy, faceLeft, parts, body: () => ({ x: fx + cx, y: fy, top: fy + box.top, mid: fy + box.mid, bot: fy + box.bot, hw: box.hw }), box: { ...box, cx: 0 } };
}

export class FxStage {
  constructor() {
    const knight = heroes.find((h) => h.id === 'knight');
    this.hero = actor(knight, 30, 50, false);
    this.foe = actor(enemies.goblin, 82, 50, true);
    this.foe2 = actor(enemies.slime, 104, 51, true);
  }

  // One frame of an effect: { draws, tint (on its target), on ('hero'|'enemy'), ice, dx }.
  frame(e, q, t, tune) {
    const H0 = this.hero.body(), E0 = this.foe.body(), E1 = this.foe2.body();
    const at = (u) => ({ x: u.x, y: u.mid });
    const g = e.group, n = e.name;
    const tq = (fn) => tune.paint(g, n, fn);
    if (g === 'status') {
      const u = e.on === 'hero' ? H0 : E0;
      const look = statusLook({ [n]: { stacks: 3, age: t % 2400 } }, { ...u, x: 0, y: 0, top: u.top - u.y, mid: u.mid - u.y, bot: u.bot - u.y }, t, tune);
      return { draws: look.draws.map((d) => [d[0] + u.x, d[1] + u.y, d[2], d[3], d[4], d[5]]), tint: look.tint, on: e.on, ice: look.ice, dx: look.dx };
    }
    if (g === 'hit') {
      if (n === 'crit') return { draws: tq(critFx(q, { ...E0, side: -1 }, t)), on: 'enemy' };
      if (n === 'dodge') { const o = dodgeFx(q, { ...E0, side: -1 }); return { draws: tq(o.draws), on: 'enemy', dx: o.dx }; }
      if (n === 'block') return { draws: tq(blockFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'soak') return { draws: tq(soakFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'shieldBreak') return { draws: tq(shieldBreakFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'heal') { const o = healFx(q, H0, 2); return { draws: tq(o.draws), tint: o.tint && [tune.color(g, n, o.tint[0]), o.tint[1]], on: 'hero' }; }
      if (n === 'puff') return { draws: tq(deathPuffFx(q, E0.x, E0.y)), on: 'enemy', gone: true };
      const o = impactFx(n, q, { ...E0, side: -1 }, t, 1, at(H0));
      return { draws: tq(o.draws), tint: o.tint && [tune.color(g, n, o.tint[0]), o.tint[1]], on: 'enemy', dx: o.dx };
    }
    if (g === 'shot') {
      const a = { x: H0.x + H0.hw + 2, y: H0.mid }, b = at(E0);
      if (SHOT_MS[n]) return { draws: tq(shotFx(n, q, a, b, t, 3, n === 'flask' ? 0x6de07a : undefined)), on: 'enemy' };
      const head = { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q };
      return { draws: q < 1 ? tq(projectileFx(n, a, head, t, 2)) : [], on: 'enemy' };
    }
    if (g === 'item') {
      const a = { x: H0.x + H0.hw + 2, y: H0.mid }, b = at(E0);
      const map = {
        bomb: () => itemFx.bombFx(q, a, b, t), lightning: () => [...itemFx.lightningFx(q, a, b, t, 3), ...itemFx.lightningFx(q, b, at(E1), t, 9)], greenfire: () => itemFx.greenfireFx(q, a, b),
        battleCry: () => [...itemFx.battleCryFx(q, H0), ...itemFx.speedLinesFx(q, H0, t)], shatter: () => itemFx.shatterFx(q, E0), knifeBurst: () => itemFx.knifeBurstFx(q, E0.x, E0.mid),
        plague: () => itemFx.plagueFx(q, b, at(E1)), thunderbolt: () => itemFx.thunderboltFx(q, E0), aegisBlast: () => itemFx.aegisBlastFx(q, H0), thorns: () => itemFx.thornsFx(q, H0),
        lifesteal: () => itemFx.lifestealFx(q, b, at(H0)), suckerPunch: () => itemFx.suckerPunchFx(q, E0, -1), executioner: () => itemFx.executionerFx(q, E0), dice: () => itemFx.diceFx(q, E0, t),
        mimic: () => itemFx.mimicFx(q, H0.x + H0.hw + 6, H0.y, t), spiritAxe: () => itemFx.spiritAxeFx(q, H0, t), moon: () => itemFx.moonFx(q, a, b, t, 3), tornado: () => itemFx.tornadoFx(E0.x + Math.sin(t / 500) * 12, E0.y, t * tune.speed(g, n)),
      };
      return { draws: map[n] ? tq(map[n]()) : [], on: e.on || 'enemy' };
    }
    if (g === 'skill') {
      const support = ['rallyCry', 'arcaneWard', 'divineShield', 'boneWard', 'ballad', 'focusStance'].includes(n);
      const c = { caster: H0, targets: support ? [H0] : [E0, E1], squad: [H0], enemies: [E0, E1] };
      const o = castFx(n, q, c, t);
      const tint = (o.tints.find(([l, , tt]) => tt && (l === 'enemies' || l === 'targets')) || o.tints.find(([, , tt]) => tt) || [])[2];
      return { draws: tq(o.draws), tint: tint && [tune.color(g, n, tint[0]), tint[1]], on: support ? 'hero' : 'enemy' };
    }
    return { draws: [] };
  }

  drawActor(ctx, a, tint, ice, dx = 0, hide = false) {
    if (hide) return;
    const S = this.Z;
    for (const p of a.parts) {
      p.px.forEach((row, y) => row.forEach((c, x) => {
        if (c === null) return;
        const relX = p.left + x;
        const gx = a.faceLeft ? a.fx - relX - 1 : a.fx + relX;
        const gy = a.fy + p.top + y;
        let col = ice > 0 && gy > a.fy - ice * ((a.def.height || 24) + 2) ? iceColor(c) : c;
        if (tint) col = mixColor(col, tint[0], tint[1]);
        ctx.fillStyle = hex(col); ctx.fillRect((gx + dx) * S, gy * S, S, S);
      }));
    }
  }

  // The whole scene for one moment of an effect, at Z screen pixels per character pixel. `t` = ms since it started.
  // `extra(ctx)` draws on top (the review page's icon pop). Returns the effect's progress q (1 = done).
  drawScene(ctx, e, t, tuner, Z, extra = null) {
    this.Z = Z;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1629'; ctx.fillRect(0, 0, W * Z, H * Z);
    ctx.fillStyle = '#221b33'; ctx.fillRect(0, 36 * Z, W * Z, (H - 36) * Z);
    ctx.fillStyle = '#2e2542'; for (let x = 0; x < W; x += 20) ctx.fillRect(x * Z, 36 * Z, Z, (H - 36) * Z); ctx.fillRect(0, 36 * Z, W * Z, Z);
    if (!e) { for (const a of [this.hero, this.foe2, this.foe]) this.drawActor(ctx, a, null, 0); if (extra) extra(ctx); return 1; }
    const ms = tuner.ms(e.group, e.name, e.ms);
    const q = Math.min(1, t / ms);
    let r;
    try { r = this.frame(e, q, t, tuner); } catch (err) { r = { draws: [] }; }
    const playing = q < 1 || e.group === 'status';
    this.drawActor(ctx, this.hero, r.on === 'hero' && playing ? r.tint : null, r.on === 'hero' ? r.ice : 0, r.on === 'hero' && playing ? r.dx || 0 : 0);
    this.drawActor(ctx, this.foe2, null, 0);
    this.drawActor(ctx, this.foe, r.on === 'enemy' && playing ? r.tint : null, r.on === 'enemy' ? r.ice : 0, r.on === 'enemy' && playing ? r.dx || 0 : 0, r.gone && q > 0 && q < 1);
    for (const [x, y, w, h, c, a] of r.draws) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x) * Z - Z / 2, Math.round(y) * Z, w * Z, h * Z); }
    ctx.globalAlpha = 1;
    if (extra) extra(ctx);
    return q;
  }
}
