// Shield Totem v2 (user, session 59): it falls after a number of HITS (4, more with copies, max 10), damage over time and
// healing do nothing to it, it keeps the hits it took between floors, and a dead totem stands up again after 30 s of fighting.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const T = r('minions.json').shield_totem;
const mk = (copies = 1) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const k = s.heroes[0];
  for (let i = 0; i < copies; i++) s.giveItem(k.uid, 'shield_totem');
  const [e] = s.spawnEnemies(['goblin'], 1);
  e.hp = e.maxHp = 1e9; e.stats.attack = 0; e.stats.attackEfficiency = 1; // an enemy that keeps the fight going
  s.placeLines();
  s.startFloor([]);
  return { s, k, e };
};
const totem = (s) => s.minions.find((m) => m.alive && m.sourceKey === 'shield_totem');
const hitOnce = (s, m) => { const ev = []; s.dealDamage(m, 99999, ev); if (m.hp <= 0) s.killUnit(m, ev); };
const run = (s, ms) => { for (let t = 0; t < ms; t += 100) s.update(100); };

{ const { s } = mk(1); const m = totem(s);
  ok('1 totem: ' + T.hitsToKill + ' hits', m && m.maxHp === T.hitsToKill && m.hp === T.hitsToKill, m && `${m.hp}/${m.maxHp}`);
  hitOnce(s, m); ok('a huge hit takes only one', m.hp === T.hitsToKill - 1);
  for (let i = 1; i < T.hitsToKill; i++) hitOnce(s, m);
  ok('...and it falls on hit ' + T.hitsToKill, !totem(s)); }
{ const hits = (n) => totem(mk(n).s).maxHp;
  ok('copies add ' + T.hitsPerCopy + ' hits, at most ' + T.hitsMax, hits(2) === Math.min(T.hitsMax, T.hitsToKill + T.hitsPerCopy) && hits(20) === T.hitsMax, `${hits(2)} ${hits(20)}`); }
{ const { s } = mk(1); const m = totem(s); hitOnce(s, m);
  s.applyStatus(m, { status: 'burn', durationMs: 5000, damage: 50, damageType: 'fire' }, s.enemies[0], 'test', []);
  run(s, 3000);
  ok('burns do nothing to it', totem(s) && totem(s).hp === T.hitsToKill - 1, totem(s) && totem(s).hp);
  ok('healing does not give hits back', s.healUnit(m, 100, []) === 0 && m.hp === T.hitsToKill - 1); }
{ const { s } = mk(1); for (let i = 0; i < T.hitsToKill; i++) hitOnce(s, totem(s));
  run(s, T.respawnMs - 1000); ok('dead: not back before ' + T.respawnMs / 1000 + ' s', !totem(s));
  run(s, 1500); ok('...back after ' + T.respawnMs / 1000 + ' s, whole', totem(s) && totem(s).hp === T.hitsToKill); }
{ const { s } = mk(1); hitOnce(s, totem(s)); s.endFloor([]); s.startFloor([]);
  ok('next floor: the same totem (hits taken are kept)', totem(s) && totem(s).hp === T.hitsToKill - 1, totem(s) && totem(s).hp); }
{ const { s } = mk(1); for (let i = 0; i < T.hitsToKill; i++) hitOnce(s, totem(s));
  run(s, T.respawnMs - 10000); s.endFloor([]); s.startFloor([]);
  ok('dead at floor end: no free totem at the next floor start', !totem(s));
  run(s, 10500); ok('...it comes back when its timer runs out', !!totem(s)); }
