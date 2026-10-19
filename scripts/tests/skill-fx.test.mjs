// Hero skill effects (systems/skillFx.js + data/skillFx.json): every skill its own effect.
import fs from 'fs';
import { castFx, shotFx, CAST_MS, SHOT_MS, CAST_FX, SHOT_FX } from '../../src/systems/skillFx.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const skills = r('skills.json'), heroes = r('heroes.json'), data = r('skillFx.json');
const keys = Object.keys(data).filter((k) => !k.startsWith('_'));
ok('skillFx.json names real skills (and rotation spells)', keys.every((k) => { const [id, sh] = k.split(':'); return skills[id] && (!sh || (skills[id].rotation || []).some((x) => x.short === sh)); }));
ok('every named recipe exists', keys.every((k) => CAST_MS[data[k]] > 0), keys.filter((k) => !CAST_MS[data[k]]).join());
// Every hero skill has its own look: a cast recipe, a projectile recipe, a channel/flask, or lightning.
const looks = (id, sk, short) => !!(data[short ? `${id}:${short}` : id] || SHOT_MS[sk.projectile] || sk.projectile === 'crescent' || sk.random || sk.chain);
const missing = [];
for (const h of heroes) for (const id of [h.skills.attack, h.skills.support]) {
  const sk = skills[id];
  if (sk.rotation) for (const sp of sk.rotation) { if (!looks(id, { ...sk, ...sp }, sp.short)) missing.push(`${id}:${sp.short}`); }
  else if (!looks(id, sk)) missing.push(id);
}
ok('every hero skill has its own effect', missing.length === 0, missing.join());
const body = (x) => ({ x, y: 50, top: 28, mid: 39, bot: 50, hw: 6 });
const c = { caster: body(20), targets: [body(70), body(90)], squad: [body(20), body(35)], enemies: [body(70), body(90), body(105)] };
const clean = (d) => Array.isArray(d) && d.every((p) => p.length === 6 && p.every((v) => typeof v === 'number' && !Number.isNaN(v)));
const bad = [];
for (const k of CAST_FX) for (const q of [0, 0.1, 0.3, 0.5, 0.8, 1]) for (const t of [0, 77, 400]) {
  try { const o = castFx(k, q, c, t); if (!clean(o.draws) || !o.tints.every(([l, i, tint]) => typeof l === 'string' && i >= 0 && (tint === null || tint[1] >= 0))) bad.push(k); } catch (e) { bad.push(k + ': ' + e.message); }
}
for (const k of SHOT_FX) for (const q of [0, 0.2, 0.5, 0.8, 1]) { try { if (!clean(shotFx(k, q, { x: 10, y: 40 }, { x: 80, y: 40 }, 33, 2, 0x6de07a))) bad.push('shot ' + k); } catch (e) { bad.push('shot ' + k + ': ' + e.message); } }
ok('every effect draws clean pixels', bad.length === 0, [...new Set(bad)].join('; '));
ok('every cast effect shows something', CAST_FX.every((k) => [0.2, 0.4, 0.6].some((q) => castFx(k, q, c, 0).draws.length > 0)), CAST_FX.filter((k) => ![0.2, 0.4, 0.6].some((q) => castFx(k, q, c, 0).draws.length > 0)).join());
ok('every shot shows something', SHOT_FX.every((k) => [0.2, 0.4, 0.7].some((q) => shotFx(k, q, { x: 10, y: 40 }, { x: 80, y: 40 }, 0, 1).length > 0)));
ok('a skill with no targets draws nothing broken', CAST_FX.every((k) => clean(castFx(k, 0.4, { caster: body(20), targets: [], squad: [], enemies: [] }, 0).draws)));
const charge = r('combat.json').skillFx.charge;
const realSkill = (k) => { const [id, sh] = k.split(':'); return skills[id] && (!sh || (skills[id].rotation || []).some((x) => x.short === sh)); };
ok('charge looks name real skills (or rotation spells) and real recipes', Object.keys(charge).filter((k) => !k.startsWith('_')).every((k) => realSkill(k) && CAST_MS[charge[k].recipe || charge[k]] > 0), Object.keys(charge).filter((k) => !k.startsWith('_') && !(realSkill(k) && CAST_MS[charge[k].recipe || charge[k]] > 0)).join());
const waveLooks = r('combat.json').skillFx.wave;
// A wave look: a channel skill's per-wave recipe, or `none` for a skill whose cast look draws its one wave (Holy Nova).
ok('per-wave looks name real wave skills and real recipes', Object.keys(waveLooks).filter((k) => !k.startsWith('_')).every((k) => skills[k] && (waveLooks[k].none ? skills[k].holyNova : skills[k].channel && CAST_MS[waveLooks[k].recipe] > 0)));
// HERO LOOKS v2 (heroLooks.js + combat.json skillFx.look / flask / counter).
const FXR = r('combat.json').skillFx;
const lookKeys = Object.keys(FXR.look).filter((k) => !k.startsWith('_'));
ok('v2 looks name real skills and each has a cast recipe', lookKeys.every((k) => realSkill(k) && CAST_MS[data[k]] > 0), lookKeys.filter((k) => !(realSkill(k) && CAST_MS[data[k]] > 0)).join());
ok('every hero skill now has a charge look', heroes.every((h) => [h.skills.attack, h.skills.support].every((id) => charge[id] || (skills[id].rotation || []).every((sp) => charge[`${id}:${sp.short}`]))), heroes.flatMap((h) => [h.skills.attack, h.skills.support]).filter((id) => !charge[id] && !(skills[id].rotation && skills[id].rotation.every((sp) => charge[`${id}:${sp.short}`]))).join());
ok('a look hits inside its own run time', lookKeys.every((k) => (FXR.look[k].hitMs || 0) + (FXR.look[k].staggerMs || 0) * 4 < CAST_MS[data[k]]));
ok('the flask and counter looks are real recipes that land in time', CAST_MS[FXR.flask.recipe] > FXR.flask.hitMs && CAST_MS[FXR.counter.recipe] > FXR.counter.hitMs);
// The looks follow the weapon part when the body has one (a redesigned hero moves its staff / bow / flask).
const withW = (b, wx) => ({ ...b, wx, wy: b.mid, wtop: b.top + 2, wbot: b.bot - 2 });
const moved = (name) => { const a = castFx(name, 0.6, { ...c, caster: withW(body(20), 14) }, 50).draws, b = castFx(name, 0.6, { ...c, caster: withW(body(20), 30) }, 50).draws; return JSON.stringify(a) !== JSON.stringify(b); };
ok('the staff orb, bow, lute and flask follow the weapon part', ['mageChargeFire', 'archerChargeUp', 'bardCharge', 'alchCharge'].every(moved));
const flaskC = (name) => ({ ...c, targets: [body(70)], flask: { name, color: '0x6bd16a' }, hitMs: 380 });
ok('a flask flies before its hit and shatters after it', castFx('flaskThrow', 0.1, flaskC('Poison Flask'), 0).draws.length > 0 && ['Poison Flask', 'Healing Flask', 'Speed Flask', 'Shield Flask'].every((n) => castFx('flaskThrow', 0.3, flaskC(n), 0).draws.length > 0));
ok('an arrow rain wave draws arrows on its targets and the floor', castFx('arrowRainWave', 0.3, { ...c, wave: 2, waves: 6, center: { x: 80, y: 50 }, radius: 36, hitMs: 150 }, 0).draws.length > 20);
ok('a wave recipe draws for every wave', ['rogueSlash'].every((k) => [0, 2, 4].every((w) => castFx(k, 0.3, { ...c, wave: w, waves: 5 }, 0).draws.length > 0)));
ok('unknown recipes are harmless', castFx('nope', 0.5, c, 0).draws.length === 0 && shotFx('nope', 0.5, { x: 0, y: 0 }, { x: 1, y: 1 }, 0).length === 0);
ok('war cry colours the squad red and the enemies grey', castFx('warCry', 0.7, c, 0).tints.some(([l, , t]) => l === 'squad' && t) && castFx('warCry', 0.7, c, 0).tints.some(([l, , t]) => l === 'enemies' && t));
