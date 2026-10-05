import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { pickSquad } from '../../src/systems/party.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const heroDefs = pickSquad(r('heroes.json'), r('squad.json')), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json');
const mode = process.argv[2] || 'skills';   // 'noskills' | 'skills'
const rewards = process.argv[3] === 'rewards';
const N = 40; let sum = 0, min = 99, max = 0, casts = 0;
for (let run = 0; run < N; run++) {
  const s = new BattleState({ heroDefs, enemyDefs, itemDefs, skillDefs, statusDefs: r('statuses.json'), rules, damageTypes, leveling });
  let floor = 1;
  while (floor < 120) {
    s.spawnEnemies(enemiesForFloor(dungeon, floor), floor);
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 900000) {
      s.update(50); t += 50;
      if (mode === 'skills') for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) if (s.castSkill(h.uid, i).length) casts++;  // a bot taps every ready skill
    }
    if (s.allHeroesDead()) break;
    s.winHeal(rules.winHealPercent);
    if (rewards) {
      const choices = rollChoices({ itemDefs, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance });
      if (choices.length) { const item = choices[Math.floor(Math.random() * choices.length)]; if (item.kind === 'potion') s.healHeroes(item.healPercent); else { const tg = s.heroes.filter((h) => canReceive(h, item)); s.giveItem(tg[Math.floor(Math.random() * tg.length)].uid, item.id); } }
    }
    floor++;
  }
  sum += floor; min = Math.min(min, floor); max = Math.max(max, floor);
}
console.log(`${mode}${rewards ? ' + random rewards' : ''}: mean death floor ${(sum / N).toFixed(1)} (${min}-${max})${mode === 'skills' ? `, casts/run ${(casts / N).toFixed(0)}` : ''}`);
