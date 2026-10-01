import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const heroDefs = r('heroes.json'), enemyDefs = r('enemies.json'), baseRules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
function run(rules) {
  const s = new BattleState({ heroDefs, enemyDefs, rules, damageTypes, leveling });
  let floor = 1;
  while (floor < 80) {
    const entry = [...dungeon.floors].reverse().find((f) => f.floor <= floor);
    s.spawnEnemies(entry.enemies, floor);
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 600000) { s.update(50); t += 50; }
    if (s.allHeroesDead()) break;
    s.winHeal(rules.winHealPercent);
    floor++;
  }
  return floor;
}
const N = 40;
const hpOpts = (process.argv[2] || '0.05,0.1,0.15,0.2').split(',').map(Number);
const atkOpts = (process.argv[3] || '0.06,0.1,0.15,0.2,0.3').split(',').map(Number);
for (const hp of hpOpts) {
  const row = [];
  for (const atk of atkOpts) {
    const rules = { ...baseRules, floorScaling: { ...baseRules.floorScaling, hpPerStep: hp, attackPerStep: atk } };
    let sum = 0, min = 99, max = 0;
    for (let i = 0; i < N; i++) { const f = run(rules); sum += f; min = Math.min(min, f); max = Math.max(max, f); }
    row.push(`atk${atk}: ${(sum / N).toFixed(1)} (${min}-${max})`);
  }
  console.log(`hp${hp} | ${row.join(' | ')}`);
}
