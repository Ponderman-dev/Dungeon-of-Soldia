// Per-floor difficulty report: how many runs die on each floor and how hurt the squad is after it.
// Usage: node scripts/tests/difficulty.mjs [enemySpeedMultiplier] [hpPerStep] [attackPerStep]   (bot casts skills, random rewards)
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const heroDefs = r('heroes.json'), enemyDefs = r('enemies.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rarities = r('rarities.json'), rw = r('rewards.json');
const rules = JSON.parse(JSON.stringify(r('combat.json')));
if (process.argv[2]) rules.enemyAttackSpeedMultiplier = Number(process.argv[2]);
if (process.argv[3]) rules.floorScaling.hpPerStep = Number(process.argv[3]);
if (process.argv[4]) rules.floorScaling.attackPerStep = Number(process.argv[4]);
const N = 150, MAX = 60;
const reached = Array(MAX + 2).fill(0), died = Array(MAX + 2).fill(0), lost = Array(MAX + 2).fill(0), secs = Array(MAX + 2).fill(0), cleared = Array(MAX + 2).fill(0);
let sum = 0;
for (let run = 0; run < N; run++) {
  const s = new BattleState({ heroDefs, enemyDefs, itemDefs, skillDefs, rules, damageTypes, leveling });
  let floor = 1;
  while (floor <= MAX) {
    const entry = [...dungeon.floors].reverse().find((f) => f.floor <= floor);
    s.spawnEnemies(entry.enemies, floor);
    reached[floor]++;
    const before = s.heroes.filter((h) => h.alive).reduce((a, h) => a + h.hp / h.maxHp, 0) / Math.max(1, s.heroes.filter((h) => h.alive).length);
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 900000) {
      s.update(50); t += 50;
      for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
    }
    if (s.allHeroesDead()) { died[floor]++; break; }
    const living = s.heroes.filter((h) => h.alive);
    lost[floor] += before - living.reduce((a, h) => a + h.hp / h.maxHp, 0) / living.length; // average health lost on this floor (before the win heal)
    secs[floor] += t / 1000; cleared[floor]++;
    s.winHeal(rules.winHealPercent); s.restoreMana(rules.winManaPercent); s.clearStatuses();
    const choices = rollChoices({ itemDefs, rarities, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance });
    if (choices.length) { const item = choices[Math.floor(Math.random() * choices.length)]; if (item.kind === 'potion') s.healHeroes(item.healPercent); else { const tg = s.heroes.filter((h) => canReceive(h, item)); s.giveItem(tg[Math.floor(Math.random() * tg.length)].uid, item.id); } }
    floor++;
  }
  sum += floor;
}
console.log(`enemy speed x${rules.enemyAttackSpeedMultiplier ?? 1}, hp +${rules.floorScaling.hpPerStep}/${rules.floorScaling.hpStepFloors}fl, atk +${rules.floorScaling.attackPerStep}/${rules.floorScaling.attackStepFloors}fl  -> mean death floor ${(sum / N).toFixed(1)}`);
console.log('floor | reached | died% | avg hp lost | fight s');
for (let f = 1; f <= MAX; f++) if (reached[f] >= 5) console.log(`${String(f).padStart(5)} | ${String(reached[f]).padStart(7)} | ${(100 * died[f] / reached[f]).toFixed(0).padStart(4)}% | ${(100 * lost[f] / Math.max(1, cleared[f])).toFixed(0).padStart(6)}%     | ${(secs[f] / Math.max(1, cleared[f])).toFixed(1)}`);
