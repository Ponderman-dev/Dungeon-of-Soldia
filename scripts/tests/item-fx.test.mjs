// Item effects (systems/itemFx.js + data/itemFx.json): each item its own effect, and the icon pops.
import fs from 'fs';
import * as fx from '../../src/systems/itemFx.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const items = r('items.json'), data = r('itemFx.json');
const listed = Object.keys(data).filter((k) => !k.startsWith('_') && k !== 'iconPop');
ok('itemFx.json only names real items', listed.every((id) => items[id]), listed.filter((id) => !items[id]).join());
ok('every named effect exists', listed.every((id) => fx.ITEM_MS[data[id].effect] > 0), listed.filter((id) => !fx.ITEM_MS[data[id].effect]).join());
ok('every item has an icon to pop', Object.keys(items).filter((k) => !k.startsWith('_')).every((id) => r('itemIcons.json')[id]));
const clean = (d) => Array.isArray(d) && d.every((p) => p.length === 6 && p.every((v) => typeof v === 'number' && !Number.isNaN(v)));
const a = { x: 20, y: 40 }, b = { x: 70, y: 38 }, u = { x: 70, y: 50, top: 28, mid: 39, bot: 50, hw: 6 };
const calls = {
  bomb: (q, t) => fx.bombFx(q, a, b, t), lightning: (q, t) => fx.lightningFx(q, a, b, t, 3), greenfire: (q) => fx.greenfireFx(q, a, b),
  battleCry: (q, t) => [...fx.battleCryFx(q, u), ...fx.speedLinesFx(q, u, t)], shatter: (q) => fx.shatterFx(q, u), knifeBurst: (q) => fx.knifeBurstFx(q, u.x, u.mid),
  plague: (q) => fx.plagueFx(q, a, b), suckerPunch: (q) => fx.suckerPunchFx(q, u, -1), executioner: (q) => fx.executionerFx(q, u), dice: (q, t) => fx.diceFx(q, u, t), mimic: (q, t) => fx.mimicFx(q, 60, 50, t), thunderbolt: (q) => fx.thunderboltFx(q, u), aegisBlast: (q) => fx.aegisBlastFx(q, u), thorns: (q) => fx.thornsFx(q, u), lifesteal: (q) => fx.lifestealFx(q, a, b),
};
ok('every effect has a recipe here', fx.ITEM_FX.every((k) => calls[k]), fx.ITEM_FX.filter((k) => !calls[k]).join());
const bad = [];
for (const [k, fn] of Object.entries(calls)) for (const q of [0, 0.1, 0.3, 0.5, 0.7, 0.95, 1]) for (const t of [0, 61, 500]) { try { if (!clean(fn(q, t))) bad.push(k); } catch (e) { bad.push(k + ': ' + e.message); } }
ok('every effect draws clean pixels at any moment', bad.length === 0, [...new Set(bad)].join('; '));
ok('every effect shows something while it plays', Object.entries(calls).every(([, fn]) => [0.2, 0.4, 0.65].some((q) => [0, 61].some((t) => fn(q, t).length > 0))), Object.entries(calls).filter(([, fn]) => ![0.2, 0.4, 0.65].some((q) => [0, 61].some((t) => fn(q, t).length > 0))).map(([k]) => k).join());
const nearB = (d) => d.filter((p) => Math.hypot(p[0] - b.x, p[1] - b.y) < 8).length;
ok('the bomb flies first, then explodes on the target', nearB(fx.bombFx(0.3, a, b, 0)) === 0 && nearB(fx.bombFx(0.75, a, b, 0)) > 10);
ok('effects are over when they end', Object.entries(calls).filter(([k]) => k !== 'lightning').every(([, fn]) => fn(1, 0).length === 0));
ok('the tornado draws a funnel', fx.tornadoFx(50, 50, 100).length === 32 && clean(fx.tornadoFx(50, 50, 100)));
