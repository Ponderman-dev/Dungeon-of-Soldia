// PROJECTILE REVIEW (proposal page, not game code; session 40): every basic-attack shot and item shot of the game,
// played on a slice of the fight screen at game size (390 x 288, characters x3), with the GAME'S OWN drawing code
// (hitFx.js projectileFx + impactFx, skillFx.js flask, itemFx.js bombs / lightning / ghost fire / moon / spirit),
// at the game's timings. Heroes stand at the bottom, enemies at the top, like in a fight.
// SHOTS lists what the page shows; drawShot(ctx, id, t) draws one frame; shotLoopMs(id) = one loop.
import heroes from '../../../src/data/heroes.json';
import enemies from '../../../src/data/enemies.json';
import combat from '../../../src/data/combat.json';
import effectsData from '../../../src/data/effects.json';
import { artPixels, partArt } from '../../../src/systems/pixelArt.js';
import { bodyBox } from '../../../src/systems/statusFx.js';
import { projectileFx, impactFx, IMPACT_MS } from '../../../src/systems/hitFx.js';
import { shotFx, SHOT_MS } from '../../../src/systems/skillFx.js';
import * as itemFx from '../../../src/systems/itemFx.js';
import { makeTuner } from '../../../src/systems/fxTune.js';

export const Z = 3, W = 130, H = 96; // scene in character pixels (390 x 288 on screen)
const TUNE = makeTuner(effectsData); // the Studio's effect tweaks, as the game applies them
const FLY = combat.attackTiming.hero.rangedHitMs; // a basic shot's flight time
const PAUSE = 600; // still frame between loops
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const hero = (id) => heroes.find((h) => h.id === id);

// ---- fighters (pixel parts, no animation) ---------------------------------------------------------
function actor(def, fx, fy, faceLeft) {
  const box = bodyBox(def.parts, def.height);
  const parts = Object.values(def.parts).map((p) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { px, left: p.x - w / 2, top: p.y - h / 2 };
  });
  return { def, fx, fy, faceLeft, parts, box };
}
function drawActor(ctx, a, tint) {
  for (const p of a.parts) p.px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    const relX = p.left + x;
    const gx = Math.round(a.faceLeft ? a.fx - relX - 1 : a.fx + relX), gy = Math.round(a.fy + p.top + y);
    ctx.fillStyle = hex(tint ? mix(c, tint[0], tint[1]) : c); ctx.fillRect(gx * Z, gy * Z, Z, Z);
  }));
}
const mix = (a, b, k) => { const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
// The body box used by the game's effects: { x, y (feet), top, mid, bot, hw, side }.
function body(a, side = 1) {
  const x = a.fx + (a.faceLeft ? -a.box.cx : a.box.cx), y = a.fy;
  return { x, y, top: y + a.box.top, mid: y + a.box.mid, bot: y + a.box.bot, hw: a.box.hw, side };
}
const centre = (a) => { const b = body(a); return { x: b.x, y: b.mid }; };

// ---- the floor -------------------------------------------------------------------------------------
function room(ctx) {
  ctx.fillStyle = '#1b1624'; ctx.fillRect(0, 0, W * Z, H * Z);
  ctx.fillStyle = '#231d2e'; // flagstones, faint
  for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) ctx.fillRect(x * Z, y * Z, 11 * Z, 7 * Z);
}
function paint(ctx, draws) {
  for (const [x, y, w, h, c, a] of draws) { ctx.globalAlpha = a ?? 1; ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x) * Z - Math.floor(Z / 2), Math.round(y) * Z, w * Z, h * Z); }
  ctx.globalAlpha = 1;
}

// ---- the shots -------------------------------------------------------------------------------------
// who: 'hero' = a hero (bottom) shoots the goblin (top); 'enemy' = an enemy (top) shoots the Knight (bottom);
// 'ally' = the Cleric's Grace mote to the Knight.
// kind 'basic': projectileFx(type) for FLY ms, then impactFx(type). 'flask': skillFx flask. 'item': itemFx recipe.
export const SHOTS = [
  { id: 'arrow', group: 'basic', name: 'Arrow', users: 'Archer, Bard, Skeleton / Goblin Archer, Quiver of Plenty', shooter: 'archer', kind: 'basic', type: 'ranged' },
  { id: 'fire', group: 'basic', name: 'Fire bolt', users: 'Mage, Fire Imp, fire elites', shooter: 'mage', kind: 'basic', type: 'fire' },
  { id: 'holy', group: 'basic', name: 'Holy light', users: 'Cleric', shooter: 'cleric', kind: 'basic', type: 'holy' },
  { id: 'dark', group: 'basic', name: 'Dark orb', users: 'Necromancer, Cultist, Shaman, Banshee, dark elites', shooter: 'necromancer', kind: 'basic', type: 'dark' },
  { id: 'ice', group: 'basic', name: 'Ice shard', users: 'Frost Wisp, ice elites', shooter: 'frostWisp', who: 'enemy', kind: 'basic', type: 'ice' },
  { id: 'electric', group: 'basic', name: 'Electric spark', users: 'Storm Sprite, electric elites', shooter: 'stormSprite', who: 'enemy', kind: 'basic', type: 'electric' },
  { id: 'flask', group: 'basic', name: 'Poison flask', users: 'Alchemist (his normal attack is a lobbed flask)', shooter: 'alchemist', kind: 'flask', color: Number(hero('alchemist').passive.lobbed.color), ms: Math.max(200, FLY * 2), type: 'ranged' },
  { id: 'grace', group: 'basic', name: 'Grace mote', users: 'Cleric passive: every 7s a gold mote heals the most hurt hero', shooter: 'cleric', who: 'ally', kind: 'flask', color: 0xfff2a0, ms: SHOT_MS.flask },
  { id: 'bombs', group: 'item', name: 'Bombs (5 elements)', users: 'Fire Bombs, Ice Bomb, Electric Bomb, Dark Bomb, Poison Bombs (one after the other)', shooter: 'knight', kind: 'bombs' },
  { id: 'lightning', group: 'item', name: 'Lightning bolt', users: 'Static Crystal, Mage Chain Lightning', shooter: 'mage', kind: 'item', fn: 'lightningFx', ms: itemFx.ITEM_MS.lightning, type: 'electric' },
  { id: 'greenfire', group: 'item', name: 'Green ghost fire', users: "Lost Cleric's Grimoire", shooter: 'cleric', kind: 'item', fn: 'greenfireFx', ms: itemFx.ITEM_MS.greenfire, type: 'fire' },
  { id: 'moon', group: 'item', name: 'Moon crescent', users: 'Moonlight Twinblade', shooter: 'samurai', kind: 'item', fn: 'moonFx', ms: itemFx.ITEM_MS.moon },
  { id: 'spiritfire', group: 'item', name: 'Dark spirit', users: "Dark Spirit, Reaper's Bell, Eclipse Idol", shooter: 'necromancer', kind: 'item', fn: 'spiritFireFx', ms: itemFx.ITEM_MS.spiritfire, type: 'dark' },
];
const BOMBS = ['fire', 'ice', 'electric', 'dark', 'poison'];
const flightMs = (s) => (s.kind === 'basic' ? FLY : s.ms || itemFx.ITEM_MS.bomb);
const oneMs = (s) => flightMs(s) + (s.kind === 'basic' || (s.kind === 'flask' && s.type) ? IMPACT_MS[s.type] : 0) + PAUSE;
export const shotLoopMs = (id) => { const s = SHOTS.find((x) => x.id === id); return s.kind === 'bombs' ? BOMBS.length * (itemFx.ITEM_MS.bomb + PAUSE) : oneMs(s); };

// The cast of one scene, made once per shot.
const cache = {};
function cast(s) {
  if (cache[s.id]) return cache[s.id];
  const top = (def) => actor(def, 96, 40, true), bottom = (def) => actor(def, 34, 86, false);
  let from, to, extra = [];
  if (s.who === 'enemy') { from = top(enemies[s.shooter]); to = bottom(hero('knight')); }
  else if (s.who === 'ally') { from = actor(hero('cleric'), 34, 86, false); to = actor(hero('knight'), 92, 84, true); extra = [top(enemies.goblin)]; }
  else { from = bottom(hero(s.shooter)); to = top(enemies.goblin); }
  return (cache[s.id] = { from, to, extra });
}

// Draws shot `id` at time t (ms, looping).
export function drawShot(ctx, id, t) {
  const s = SHOTS.find((x) => x.id === id);
  const { from, to, extra } = cast(s);
  ctx.imageSmoothingEnabled = false;
  room(ctx);
  let loop = shotLoopMs(id), k = t % loop, bomb = null;
  if (s.kind === 'bombs') { const one = itemFx.ITEM_MS.bomb + PAUSE; bomb = BOMBS[Math.floor(k / one)]; k %= one; }
  const a = centre(from), b = centre(to), fly = bomb ? itemFx.ITEM_MS.bomb : flightMs(s);
  const draws = [];
  let tint = null;
  if (s.kind === 'basic' && k < fly) {
    const p = k / fly;
    const head = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    draws.push(...TUNE.paint('shot', s.type, projectileFx(s.type, a, head, t * TUNE.speed('shot', s.type), 1)));
  } else if (s.kind === 'flask' && k < fly) draws.push(...TUNE.paint('shot', 'flask', shotFx('flask', k / fly, a, b, t, 1, s.color)));
  else if (s.kind === 'item' && k < fly) draws.push(...TUNE.paint('item', s.id, itemFx[s.fn](k / fly, a, b, t, 1)));
  else if (bomb && k < fly) draws.push(...TUNE.paint('item', 'bomb', itemFx.bombFx(k / fly, a, b, t, 1, bomb)));
  // the hit where it lands (basic shots and the Alchemist's flask: the game's per-damage-type impact)
  if ((s.kind === 'basic' || (s.kind === 'flask' && s.type)) && k >= fly && k < fly + IMPACT_MS[s.type]) {
    const side = from.fx < to.fx ? -1 : 1;
    const out = impactFx(s.type, (k - fly) / IMPACT_MS[s.type], body(to, side), t, 1, s.type === 'electric' ? a : null);
    draws.push(...TUNE.paint('hit', s.type, out.draws));
    if (out.tint) tint = out.tint;
  }
  for (const e of extra) drawActor(ctx, e);
  drawActor(ctx, from);
  drawActor(ctx, to, tint);
  paint(ctx, draws);
  // a small caption: which bomb is flying
  if (bomb) { ctx.fillStyle = '#ffffff'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText(bomb.toUpperCase() + ' BOMB', 8, 16); }
}
