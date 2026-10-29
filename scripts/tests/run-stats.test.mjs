// Run stats for the game-over summary (src/systems/runStats.js): counted from BattleState's events.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { newRunStats, countEvents, finishRun, clockText } from '../../src/systems/runStats.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const heroes = r('heroes.json'), byId = (id) => heroes.find((h) => h.id === id);
const mk = (ids, enemies, floor = 1) => {
  const s = new BattleState({ heroDefs: ids.map(byId), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: r('items.json'), statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })() });
  s.spawnEnemies(enemies, floor);
  return s;
};
// A real fight: the counts follow what happened.
{ const s = mk(['knight', 'cleric', 'mage'], ['goblin', 'goblin', 'goblin'], 3);
  const rs = newRunStats(s.heroes);
  let all = [];
  for (let t = 0; t < 60000 && !s.allEnemiesDead() && !s.allHeroesDead(); t += 50) { const ev = s.update(50); all = all.concat(ev); countEvents(rs, ev, { floor: 3, floorMs: s.floorMs }); }
  const H = Object.values(rs.heroes);
  const hpLost = all.filter((e) => e.type === 'attack' && e.target.side === 'hero' && !e.target.minion && e.result && !e.result.dodged && e.result.amount > 0).reduce((n, e) => n + e.result.amount - (e.result.absorbed || 0), 0);
  ok('the fight was won', s.allEnemiesDead());
  ok('kills by heroes add up to the enemies they finished', H.reduce((n, h) => n + h.kills, 0) === all.filter((e) => e.type === 'death' && e.unit.side === 'enemy' && e.killer && e.killer.side === 'hero').length, H.map((h) => h.kills).join());
  ok('every hero who fought dealt damage', H.filter((h) => h.id !== 'cleric').every((h) => h.damage > 0), H.map((h) => `${h.id} ${Math.round(h.damage)}`).join(', '));
  ok('damage taken = health lost to hits (no dots/thorns here)', Math.abs(H.reduce((n, h) => n + h.taken, 0) - hpLost - all.filter((e) => (e.type === 'dot' || e.type === 'thorns') && e.unit.side === 'hero').reduce((n, e) => n + e.amount, 0)) < 1e-6);
  const healed = all.filter((e) => e.type === 'heal' && e.unit.side === 'hero').reduce((n, e) => n + e.amount, 0);
  ok('all healing on heroes is counted to someone', Math.abs(H.reduce((n, h) => n + h.healing, 0) - healed) < 1e-6, `${healed}`); }
// Hand-made events: who gets what.
{ const s = mk(['knight', 'cleric', 'necromancer'], ['goblin']);
  const [k, c, n] = s.heroes, g = s.enemies[0], skel = { side: 'hero', minion: true, holderUid: n.uid, def: { id: 'skeleton' } };
  const boss = { side: 'enemy', def: { id: 'grukk', name: 'Grukk', boss: true } };
  const rs = newRunStats(s.heroes);
  countEvents(rs, [
    { type: 'attack', attacker: skel, target: g, result: { amount: 30 } },
    { type: 'attack', attacker: k, target: g, result: { amount: 10, dodged: true } },
    { type: 'dot', unit: g, amount: 20, shares: { [k.uid]: 0.25, [c.uid]: 0.75 } },
    { type: 'thorns', unit: g, amount: 4, holder: k },
    { type: 'heal', unit: k, amount: 50, by: c },
    { type: 'heal', unit: k, amount: 5, by: null },
    { type: 'heal', unit: g, amount: 99, by: null },
    { type: 'attack', attacker: g, target: k, result: { amount: 40, absorbed: 15 } },
    { type: 'death', unit: g, killer: skel },
    { type: 'death', unit: boss, killer: c },
    { type: 'death', unit: k, killer: null },
  ], { floor: 20, floorMs: 161000 });
  const R = rs.heroes;
  ok('a minion\'s damage and kill go to its holder', R[n.uid].damage === 30 && R[n.uid].kills === 1);
  ok('a dodged hit counts nothing', R[k.uid].damage === 5 + 4);
  ok('a damage-over-time tick is split by who put the stacks on', R[c.uid].damage === 15);
  ok('heals go to the healer, else to the hero healed; enemy heals never count', R[c.uid].healing === 50 && R[k.uid].healing === 5);
  ok('damage taken = health lost (shield part not counted)', R[k.uid].taken === 25);
  ok('a boss death is kept with its floor and time', rs.bosses.length === 1 && rs.bosses[0].floor === 20 && rs.bosses[0].ms === 161000);
  ok('a hero who fell keeps the floor and the last enemy that hit them', R[k.uid].fellFloor === 20 && R[k.uid].killer && R[k.uid].killer.id === 'goblin');
  k.items = ['heart_charm', 'heart_charm', 'war_banner']; c.items = ['heart_charm'];
  const sum = finishRun(rs, s.heroes, { floor: 47, kills: 312, ms: 1453000, bestBefore: 41, bossFloors: ['20', '40', '60', '80'] });
  ok('summary: NEW BEST over the old best, next boss after the floor', sum.newBest && sum.oldBest === 41 && sum.nextBoss === 60);
  ok('summary: one item entry per kind with every holder', sum.items.length === 2 && sum.items[0].heldBy.join() === 'Knight,Cleric', JSON.stringify(sum.items));
  ok('summary: a hero still standing "fell" on the last floor', sum.heroes[2].fellFloor === 47); }
ok('clock: 24:13 and 1:02:09', clockText(1453000) === '24:13' && clockText(3729000) === '1:02:09');
