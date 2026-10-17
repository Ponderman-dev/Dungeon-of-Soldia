// The Monster House (dungeon.js monsterHouse, dungeons.json director.monsterHouse): from floor 61, 5% of fight floors,
// 11-15 enemies at once, never on a boss floor or the floor before one, its own epic/legendary prize.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { noPerks } from './util.mjs';
import { enemiesForFloor, monsterHouse } from '../../src/systems/dungeon.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const A = r('dungeons.json').A;
const M = A.director.monsterHouse;
const defs = r('enemies.json');
const seeded = (seed) => { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

const rate = (n, k = 4000) => { const rng = seeded(n); let h = 0; for (let i = 0; i < k; i++) if (enemiesForFloor(A, n, rng, {}, defs).monsterHouse) h++; return h / k; };
ok('never before floor 61', rate(60) === 0 && rate(30) === 0);
const r70 = rate(70);
ok('about 1 fight floor in 20 after floor 60', r70 > 0.035 && r70 < 0.065, String(r70));
const bossFloors = Object.keys(A.bosses).map(Number).filter((f) => f > 60);
ok('never on a boss floor or the floor before a boss', bossFloors.every((f) => rate(f, 500) === 0 && rate(f - 1, 500) === 0));

const rng = seeded(5);
let sizes = [], bad = 0, fodderOnly = 0, elites = 0;
for (let i = 0; i < 300; i++) {
  const ids = monsterHouse({ ...A, director: { ...A.director, monsterHouse: { ...M, chance: 100 } } }, 90, rng, defs);
  sizes.push(ids.length);
  if (ids.filter((id) => id === 'orcBrute').length > 1) bad++;
  if (ids.every((id) => defs[id].tier === 'fodder')) fodderOnly++;
  if (ids.elites.length) elites++;
}
ok('11 to 15 enemies, all at once', Math.min(...sizes) === 11 && Math.max(...sizes) === 15);
ok('the roster max still holds (one Orc Brute)', bad === 0);
ok('a real mix, not only fodder', fodderOnly === 0);
ok('elites can be in it', elites > 100, String(elites));

{
  const ids = monsterHouse({ ...A, director: { ...A.director, monsterHouse: { ...M, chance: 100 } } }, 90, seeded(9), defs);
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: defs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  s.spawnEnemies(ids, 90);
  ok('BattleState knows it is a Monster House', s.monsterHouse === true && s.enemies.length === ids.length);
  s.spawnEnemies(enemiesForFloor(A, 3), 3);
  ok('...and forgets it on the next floor', s.monsterHouse === false);
  s.spawnEnemies(ids, 90); s.placeLines();
  for (const h of s.heroes) h.hp = h.maxHp = 1e7;
  let err = null;
  try { for (let t = 0; t < 120000 && !s.allEnemiesDead(); t += 50) s.update(50); } catch (e) { err = e; }
  ok('a full Monster House fight runs without errors', !err, err ? err.message : '');
}
{
  const itemDefs = loadItems(r('items.json'));
  const heroes = new BattleState({ heroDefs: r('heroes.json').slice(0, 3), enemyDefs: defs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') }).heroes;
  const rr = seeded(3); let ep = 0, leg = 0, other = 0;
  for (let i = 0; i < 300; i++) for (const c of rollChoices({ itemDefs, rules: r('rewards.json'), count: 3, heroes, rng: rr, odds: M.rewardOdds })) c.rarity === 'epic' ? ep++ : c.rarity === 'legendary' ? leg++ : other++;
  ok('the prize: epic cards with a small legendary chance', other === 0 && leg > 0 && leg / (ep + leg) < 0.2, `${ep} epic ${leg} legendary`);
}
