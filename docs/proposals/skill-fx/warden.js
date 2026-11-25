// WARDEN REVIEW (proposal page, not game code): the Warden's new skill looks, played with the GAME'S OWN effect code
// (heroLooks.js wardenCharge / wardenHook / wardenLockdown via skillFx castFx, statusFx rooted / stun / chill loops)
// on a slice of the fight screen at game size (390 x 288, characters x3). combat.json gives the hit timings.
// SCENES lists what the page shows; drawScene(ctx, id, t) draws one frame; sceneMs(id) = one loop.
import heroes from '../../../src/data/heroes.json';
import enemies from '../../../src/data/enemies.json';
import combat from '../../../src/data/combat.json';
import skills from '../../../src/data/skills.json';
import { artPixels, partArt } from '../../../src/systems/pixelArt.js';
import { bodyBox, statusLook } from '../../../src/systems/statusFx.js';
import { castFx, CAST_MS } from '../../../src/systems/skillFx.js';

export const Z = 3, W = 130, H = 96;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const mix = (a, b, k) => { const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (p) => 1 - (1 - clamp(p)) * (1 - clamp(p));
const WARDEN = heroes.find((h) => h.id === 'bard');
const READY = WARDEN.passive.counter.readyLook;
const LOOK = combat.skillFx.look;
const CHARGE = skills.chain_hook.castMs || 500;
const PULL = skills.chain_hook.pull;

function actor(def, fx, fy, faceLeft) {
  const parts = Object.entries(def.parts).map(([name, p]) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { name, px, left: p.x - w / 2, top: p.y - h / 2, w, h };
  });
  return { def, fx, fy, faceLeft, parts, box: bodyBox(def.parts, def.height) };
}
function drawActor(ctx, a, tint, liftWeapon = 0, outWeapon = 0) {
  for (const p of a.parts) {
    const dy = p.name === 'weapon' ? -liftWeapon : 0, dx = p.name === 'weapon' ? outWeapon : 0;
    p.px.forEach((row, y) => row.forEach((c, x) => {
      if (c === null) return;
      const relX = p.left + x + dx;
      const gx = Math.round(a.faceLeft ? a.fx - relX - 1 : a.fx + relX), gy = Math.round(a.fy + p.top + y + dy);
      ctx.fillStyle = hex(tint ? mix(c, tint[0], tint[1]) : c); ctx.fillRect(gx * Z, gy * Z, Z, Z);
    }));
  }
}
// The body the game's effects get: feet x/y, top/mid/bot, half width, and the weapon (wx, wtop) for the hook tip.
function body(a, lift = 0) {
  const s = a.faceLeft ? -1 : 1, x = a.fx + s * a.box.cx, y = a.fy;
  const b = { x, y, top: y + a.box.top, mid: y + a.box.mid, bot: y + a.box.bot, hw: a.box.hw, side: s };
  const w = a.parts.find((p) => p.name === 'weapon');
  if (w) { b.wx = a.fx + s * (w.left + w.w / 2); b.wy = a.fy + w.top + w.h / 2 - lift; b.wtop = a.fy + w.top - lift; b.wbot = a.fy + w.top + w.h - lift; }
  return b;
}
function room(ctx) {
  ctx.fillStyle = '#1b1624'; ctx.fillRect(0, 0, W * Z, H * Z);
  ctx.fillStyle = '#231d2e';
  for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) ctx.fillRect(x * Z, y * Z, 11 * Z, 7 * Z);
}
function paint(ctx, draws, ox = 0, oy = 0) {
  for (const [x, y, w, h, c, a] of draws) { ctx.globalAlpha = a ?? 1; ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x + ox) * Z, Math.round(y + oy) * Z, w * Z, h * Z); }
  ctx.globalAlpha = 1;
}
// Status loops on a fighter (kinds = { rooted: {...}, stun: {...} }), the game's own statusLook.
function statusOn(ctx, a, kinds, t) {
  const b = body(a); const rel = { hw: a.box.hw, top: a.box.top, mid: a.box.mid, bot: a.box.bot };
  const out = statusLook(kinds, rel, t);
  paint(ctx, out.draws, b.x, b.y);
  return out.tint;
}
const tintFor = (tints, list, j) => { for (const [l, i, v] of tints || []) if (l === list && i === j && v) return v; return null; };
function label(ctx, text, x, y, color = '#ffffff') { ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#000'; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = color; ctx.fillText(text, x, y); }

export const SCENES = [
  { id: 'hook', name: 'Chain Hook', ms: 4200, what: 'Wind-up: a loop of chain whirls over his raised hook. Then the hook flies out on its chain, bites the enemy at the back (flash + sparks), drags it to him, and the chain reels back. The enemy is stunned 2s.' },
  { id: 'lockdown', name: 'Lockdown', ms: 3800, round: 2, note: 'The shackle should be in the middle of their body, and make the shackle simpler.', did: 'The shackle is now one plain iron band round the middle of each enemy (light on top, dark below) that snaps shut, and the chain runs from his body to theirs.', what: 'Same wind-up, then he slams his chain down: a ring of chain spreads over the floor around him, a chain runs to every enemy inside and an iron band snaps shut round its middle. They go grey (weakened) and chilled. The one outside the ring is not hit.' },
  { id: 'ready', name: 'Shackles: hook ready, then the 4th hit', ms: 3600, what: 'After his 3rd hit the hook rises high and bobs (ready). The 4th hit lands and the enemy is ROOTED: cuffs on its feet, chained to a stake in the floor.' },
  { id: 'rooted', name: 'Rooted (close up)', ms: 2400, what: 'What a rooted enemy wears while it cannot walk (1.5s): a cuff on each foot, chained to a stake, rattling.' },
];
export const sceneMs = (id) => SCENES.find((s) => s.id === id).ms;

const cache = {};
function cast(id) {
  if (cache[id]) return cache[id];
  const gob = (x, y) => actor(enemies.goblin, x, y, true);
  if (id === 'hook') return (cache[id] = { w: actor(WARDEN, 26, 88, false), far: actor(enemies.goblinArcher || enemies.goblin, 108, 34, true), near: gob(62, 40) });
  if (id === 'lockdown') return (cache[id] = { w: actor(WARDEN, 60, 80, false), foes: [gob(38, 64), gob(84, 66), gob(64, 56)], out: gob(118, 30) });
  if (id === 'ready') return (cache[id] = { w: actor(WARDEN, 50, 84, false), g: gob(70, 60) });
  return (cache[id] = { g: actor(enemies.goblin, 65, 72, false) });
}

export function drawScene(ctx, id, t) {
  ctx.imageSmoothingEnabled = false;
  room(ctx);
  const k = t % sceneMs(id), C = cast(id);
  if (id === 'hook') {
    const L = LOOK.chain_hook, castAt = CHARGE, hitAt = castAt + L.hitMs, slideAt = castAt + (PULL.delayMs || 0);
    const f = C.far, f0 = { fx: 108, fy: 34 };
    // the enemy is dragged to gapPx in front of him after delayMs (the rules), over pull.ms
    const wb = body(C.w), gap = PULL.gapPx / Z;
    const dx = f0.fx - wb.x, dy = f0.fy - wb.y, d = Math.hypot(dx, dy), end = { fx: wb.x + (dx / d) * gap, fy: wb.y + (dy / d) * gap };
    const p = ease((k - slideAt) / PULL.ms);
    f.fx = f0.fx + (end.fx - f0.fx) * p; f.fy = f0.fy + (end.fy - f0.fy) * p;
    let wt = null, ft = null; const draws = [];
    if (k < castAt) { const o = castFx('wardenCharge', k / castAt, { caster: body(C.w), targets: [], squad: [], enemies: [] }, t); draws.push(...o.draws); wt = tintFor(o.tints, 'caster', 0); }
    else if (k < castAt + CAST_MS.wardenHook) { const o = castFx('wardenHook', (k - castAt) / CAST_MS.wardenHook, { caster: body(C.w), targets: [body(f)], squad: [], enemies: [body(f), body(C.near)], hitMs: L.hitMs }, t); draws.push(...o.draws); ft = tintFor(o.tints, 'targets', 0); }
    drawActor(ctx, C.near); drawActor(ctx, C.w, wt);
    const stunned = k >= hitAt && k < hitAt + skills.chain_hook.apply[0].durationMs;
    const st = stunned ? statusOn(ctx, f, { stun: { stacks: 1, age: k - hitAt } }, t) : null;
    drawActor(ctx, f, ft || st);
    paint(ctx, draws);
    if (k >= castAt && k < castAt + 900) label(ctx, 'CHAIN HOOK', 4 * Z, 10 * Z, combat.skillFx.name.heroColors.bard);
  } else if (id === 'lockdown') {
    const L = LOOK.lockdown, castAt = CHARGE, hitAt = castAt + L.hitMs, R = skills.lockdown.area.radius / Z;
    let wt = null, tints = []; const draws = [];
    const foes = C.foes.map((a) => body(a));
    if (k < castAt) { const o = castFx('wardenCharge', k / castAt, { caster: body(C.w), targets: [], squad: [], enemies: [] }, t); draws.push(...o.draws); wt = tintFor(o.tints, 'caster', 0); }
    else if (k < castAt + CAST_MS.wardenLockdown) { const o = castFx('wardenLockdown', (k - castAt) / CAST_MS.wardenLockdown, { caster: body(C.w), targets: foes, squad: [], enemies: [...foes, body(C.out)], hitMs: L.hitMs, staggerMs: L.staggerMs, radius: R, allHit: true }, t); draws.push(...o.draws); tints = o.tints; }
    drawActor(ctx, C.out); drawActor(ctx, C.w, wt);
    C.foes.forEach((a, j) => {
      const hit = hitAt + j * L.staggerMs, on = k >= hit && k < hit + 2600;
      const st = on ? statusOn(ctx, a, { weaken: { stacks: 1, age: k - hit }, chill: { stacks: 2, age: k - hit } }, t) : null;
      drawActor(ctx, a, tintFor(tints, 'targets', j) || st);
    });
    paint(ctx, draws);
    if (k >= castAt && k < castAt + 900) label(ctx, 'LOCKDOWN', 4 * Z, 10 * Z, combat.skillFx.name.heroColors.bard);
  } else if (id === 'ready') {
    // 0-700 idle, 700-950 the hook rises (readyLook), it bobs until 2100, then the 4th hit: flash + rooted 1.5s
    const up = ease((k - 700) / READY.easeMs) * (k < 2100 ? 1 : 1 - ease((k - 2100) / 150));
    const bob = Math.sin((t / READY.bobMs) * Math.PI * 2) * READY.bobPx;
    const lift = (READY.liftPx + bob) * up, out = READY.outPx * up;
    const hit = k >= 2150, age = k - 2150;
    let gt = hit && age < 80 ? [0xffffff, 0.85] : null;
    if (hit && age < 1500) { const st = statusOn(ctx, C.g, { rooted: { stacks: 1, age }, weaken: { stacks: 1, age } }, t); gt = gt || st; }
    drawActor(ctx, C.w, null, lift, out); drawActor(ctx, C.g, gt);
    if (hit && age < 700) label(ctx, 'ROOTED!', 62 * Z, 30 * Z, '#c8d0dc');
    label(ctx, k < 700 ? 'HIT 3' : k < 2150 ? 'READY' : 'HIT 4', 4 * Z, 10 * Z, k >= 700 && k < 2150 ? '#f2c544' : '#ffffff');
  } else {
    const st = statusOn(ctx, C.g, { rooted: { stacks: 1, age: k } }, t);
    // it tries to walk: leans left and right but its feet stay put
    drawActor(ctx, C.g, st);
  }
}
