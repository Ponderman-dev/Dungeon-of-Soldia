// A skill whose target is gone (every enemy left can't be hit: Morthul as dust, Vharox in the sky) is cancelled
// cleanly ('noTarget') instead of crashing the fight. Found by the smart player (curve.mjs).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const heroes = r('heroes.json');
const mk = (ids) => new BattleState({ heroDefs: ids.map((id) => heroes.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(r('items.json')), skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
for (const id of ['knight', 'archer', 'mage', 'rogue', 'samurai', 'necromancer', 'cleric', 'bard', 'alchemist', 'berserker']) {
  const s = mk([id]);
  s.spawnEnemies(['goblin'], 1); s.placeLines(); s.startFloor();
  const g = s.enemies[0];
  g.statuses.push({ key: 'airborne:test', type: 'airborne', remaining: 1e9, total: 1e9 }); // up in the sky: can't be hit
  let crashed = null;
  try {
    for (let i = 0; i < 2; i++) { s.heroes[0].skills[i].cooldownLeft = 0; s.castSkill(s.heroes[0].uid, i); }
    for (let t = 0; t < 3000; t += 50) s.update(50);
  } catch (err) { crashed = err.message; }
  ok(`${id}: skills with no target to hit don't crash`, !crashed, crashed || '');
}
