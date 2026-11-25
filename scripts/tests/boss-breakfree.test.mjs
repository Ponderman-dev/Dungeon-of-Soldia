// Boss BREAK-FREE (user, session 59): after a stun / freeze a boss cannot be stunned or frozen again for a while.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks, frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), BF = rules.bossBreakFree;
const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(frozenItems()), statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
const [b, g] = s.spawnEnemies(['brood_mother', 'goblin'], 40);
const k = s.heroes[0];
for (const u of [b, g]) { u.hp = u.maxHp = 1e9; u.abilities = []; }
const has = (u, t) => u.statuses.some((x) => x.type === t);
const stun = (u, ms = 2000) => { const ev = []; s.applyStatus(u, { status: 'stun', durationMs: ms }, k, 'test' + Math.random(), ev); return ev; };
const step = (ms) => { for (let t = 0; t < ms; t += 50) s.update(50); };
stun(b); ok('a boss can be stunned', has(b, 'stun'));
const scaled = 2000 * (b.def.statusDurationScale ?? 1);
step(scaled + 100); ok('...the stun ends (halved on a boss)', !has(b, 'stun'));
let ev = stun(b); ok('right after: RESIST, no new stun', !has(b, 'stun') && ev.some((e) => e.type === 'immuneStatus' && e.resist));
ev = s.applyStatus(b, { status: 'freeze', durationMs: 2000 }, k, 'fz', []) || []; ok('...freeze is resisted too', !has(b, 'freeze'));
ev = stun(b); ok('"Resist" pops only once per window', !ev.some((e) => e.type === 'immuneStatus'));
step(BF.ms); stun(b); ok('after ' + BF.ms / 1000 + ' s it can be stunned again', has(b, 'stun'));
stun(g); step(1100); stun(g); ok('normal enemies are not protected', has(g, 'stun'));
const ev2 = []; s.applyStatus(b, { status: 'stun', durationMs: 500 }, b, 'grounded', ev2); ok("the boss's own stun on itself still works", has(b, 'stun'));
