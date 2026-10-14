// Status effects on fighters (systems/statusFx.js): every status plays its own loop, all at once.
import fs from 'fs';
import { statusLook, LOOPING, iceBreak, iceColor, bodyBox } from '../../src/systems/statusFx.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const statuses = r('statuses.json');
const u = { cx: 0, hw: 6, top: -22, mid: -11, bot: 0 };
const one = (k, s = { stacks: 1, age: 1000 }, t = 1234) => statusLook({ [k]: s }, u, t);
// Every lasting status that does something visible has a loop, and each loop draws at several moments.
const needLoop = ['stun', 'freeze', 'chill', 'shock', 'fear', 'taunt', 'silence', 'weaken', 'armorBreak', 'curse', 'blind', 'mark', 'bleed', 'burn', 'poison', 'buff', 'regenBoost', 'shield', 'invulnerable', 'parry'];
ok('every visible status has its own effect', needLoop.every((k) => LOOPING.includes(k) && statuses[k]), needLoop.filter((k) => !LOOPING.includes(k)).join());
const broken = [];
for (const k of LOOPING) for (const t of [0, 137, 555, 999, 4321]) { try { const d = one(k, { stacks: 3, age: 2000 }, t).draws; if (!d.every((p) => p.length === 6 && p.every((v) => typeof v === 'number' && !Number.isNaN(v)))) broken.push(k); } catch (e) { broken.push(k + ': ' + e.message); } }
ok('every effect draws clean pixels at any time', broken.length === 0, [...new Set(broken)].join('; '));
ok('every effect draws something', LOOPING.every((k) => [0, 300, 700].some((t) => one(k, { stacks: 2, age: 2000 }, t).draws.length > 0)));
// All at once: every status plays together (not only the most important one).
const all = Object.fromEntries(LOOPING.map((k) => [k, { stacks: 2, age: 2000 }]));
const sum = LOOPING.reduce((n, k) => n + one(k, { stacks: 2, age: 2000 }).draws.length, 0);
ok('all statuses play at the same time', statusLook(all, u, 1234).draws.length === sum);
ok('no statuses = nothing drawn, no tint', statusLook({}, u, 50).draws.length === 0 && statusLook({}, u, 50).tint === null);
// Bleed: more stacks = more drops.
ok('more bleed stacks = more drops', one('bleed', { stacks: 4, age: 0 }).draws.length > one('bleed', { stacks: 1, age: 0 }).draws.length);
// Freeze: the ice climbs up over 0.6s, then the whole sprite is ice; no tint while frozen.
ok('freeze ice climbs up', one('freeze', { stacks: 1, age: 0 }).ice === 0 && one('freeze', { stacks: 1, age: 300 }).ice > 0 && one('freeze', { stacks: 1, age: 300 }).ice < 1 && one('freeze', { stacks: 1, age: 700 }).ice === 1);
ok('frozen = no tint and no shake', statusLook({ freeze: { stacks: 1, age: 900 }, burn: { stacks: 1, age: 0 }, fear: { stacks: 1, age: 0 } }, u, 100).tint === null && statusLook({ freeze: { stacks: 1, age: 900 }, fear: { stacks: 1, age: 0 } }, u, 50).dx === 0);
ok('ice colours: outline becomes a bright rim, light = pale ice', iceColor(0x1a1020) === 0xe8fbff && iceColor(0xffffff) === 0xdff6ff);
ok('ice breaks off in shards', iceBreak(u, 0.5).length === 12 && iceBreak(u, 1).length === 0);
// Tints: one at a time, amounts in steps of 0.05 (cached textures).
const tn = statusLook({ chill: { stacks: 3, age: 0 } }, u, 500).tint;
ok('chill tints paler with stacks', tn && Math.abs(tn[1] - 0.3) < 1e-9);
ok('tint amounts are rounded', LOOPING.every((k) => { const t = one(k).tint; return !t || Math.abs(t[1] * 20 - Math.round(t[1] * 20)) < 1e-9; }));
// Body box: the weapon is left out.
const knight = r('heroes.json').find((h) => h.id === 'knight');
const box = bodyBox(knight.parts, knight.height);
const withWeapon = bodyBox({ ...knight.parts, body2: knight.parts.weapon }, knight.height);
ok('body box ignores the weapon', box.top < 0 && box.bot <= 0.5 && box.hw > 0 && withWeapon.hw >= box.hw);
