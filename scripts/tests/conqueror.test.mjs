// Conqueror's Flag 'KILLS = POWER' (user, session 59): every holder kill heals the others AND gives the squad +attack
// until the floor ends (grows per kill, capped).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const E = Object.fromEntries(itemDefs.conquerors_flag.effects.map((e) => [e.special, e.percent]));
const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
const [k, h2] = s.heroes; s.giveItem(k.uid, 'conquerors_flag');
let pool = s.spawnEnemies(Array(60).fill('goblin'), 1);
const kill = (by) => { const g = pool.find((e) => e.alive); g.hp = 0; s.killUnit(g, [], by); };
const buff = (h) => { const st = h.statuses.find((x) => x.key === 'buff:conqueror'); return st ? st.mods[0].percent : 0; };
kill(k); ok('one kill: every hero gets +' + E.conquerAttack + '% attack', s.heroes.every((h) => buff(h) === E.conquerAttack));
kill(k); ok('...it grows with every kill', buff(h2) === 2 * E.conquerAttack);
for (let i = 0; i < 40; i++) kill(k); ok('...up to +' + E.conquerAttackCap + '%', buff(h2) === E.conquerAttackCap, buff(h2));
s.startFloor([]); pool = s.spawnEnemies(Array(5).fill('goblin'), 2); ok('gone when the next fight starts', buff(h2) === 0);
kill(h2); ok("another hero's kill does not count", buff(h2) === 0);
{ const t = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const [a, b] = t.heroes; t.giveItem(a.uid, 'conquerors_flag'); t.spawnEnemies(['goblin'], 1); const before = b.stats.attack;
  t.applyStatus(b, { status: 'buff', durationMs: 1e9, untilFightEnd: true, mods: [{ stat: 'attack', percent: 20 }] }, a, 'conqueror', []);
  ok('the buff really raises attack', b.stats.attack > before, `${before} -> ${b.stats.attack}`); }
