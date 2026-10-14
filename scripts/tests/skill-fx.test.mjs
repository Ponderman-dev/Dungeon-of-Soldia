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
ok('unknown recipes are harmless', castFx('nope', 0.5, c, 0).draws.length === 0 && shotFx('nope', 0.5, { x: 0, y: 0 }, { x: 1, y: 1 }, 0).length === 0);
ok('war cry colours the squad red and the enemies grey', castFx('warCry', 0.7, c, 0).tints.some(([l, , t]) => l === 'squad' && t) && castFx('warCry', 0.7, c, 0).tints.some(([l, , t]) => l === 'enemies' && t));
