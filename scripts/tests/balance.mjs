// Phase H bot: plays whole runs with ANY squad, skills, minions and random rewards (like the real game).
// Usage: node scripts/tests/balance.mjs [runs=30] [squad ids comma list | all]   e.g. knight,rogue,archer
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json');
const N = Number(process.argv[2] || 30), MAX = 150;
export function playRun(ids) {
  const heroDefs = ids.map((id) => all.find((h) => h.id === id));
  const s = new BattleState({ heroDefs, enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling });
  const given = {};
  let floor = 1;
  for (; floor <= MAX; floor++) {
    s.spawnEnemies(enemiesForFloor(dungeon, floor), floor);
    s.placeLines();
    s.startFloor();
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 600000) {
      s.update(50); t += 50;
      // Like a player: tap the boss's objects (War Drum, egg sacs, the phylactery) to break them first.
      const obj = !s.focusUnit && s.enemies.find((e) => e.alive && e.def.object && !s.untargetable(e));
      if (obj) s.setFocus(obj.uid);
      for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
    }
    if (s.allHeroesDead()) break;
    s.endFloor();
    s.winHeal(rules.winHealPercent); s.clearStatuses();
    const choices = rollChoices({ itemDefs, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance });
    if (choices.length) {
      const item = choices[Math.floor(Math.random() * choices.length)];
      if (item.kind === 'potion') s.healHeroes(item.healPercent);
      else { const tg = s.heroes.filter((h) => h.alive && canReceive(h, item)); if (tg.length) { s.giveItem(tg[Math.floor(Math.random() * tg.length)].uid, item.id); given[item.id] = (given[item.id] || 0) + 1; } }
    }
  }
  return { floor, given };
}
if (process.argv[1].endsWith('balance.mjs')) {
  const arg = process.argv[3] || 'knight,rogue,archer';
  const squads = arg === 'all' ? [['knight', 'rogue', 'archer'], ['berserker', 'samurai', 'mage'], ['cleric', 'necromancer', 'bard'], ['alchemist', 'knight', 'mage'], ['knight', 'cleric', 'archer'], ['samurai', 'bard', 'necromancer']] : [arg.split(',')];
  for (const ids of squads) {
    const f = []; const t0 = Date.now();
    for (let i = 0; i < N; i++) f.push(playRun(ids).floor);
    f.sort((a, b) => a - b);
    console.log(ids.join('/').padEnd(28), 'mean', (f.reduce((a, b) => a + b) / N).toFixed(1), 'median', f[N >> 1], 'range', f[0] + '-' + f[N - 1], `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
