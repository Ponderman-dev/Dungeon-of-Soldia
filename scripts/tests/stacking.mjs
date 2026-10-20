// Item stacking bench (phase H): one hero holds 0, 1, 5, 10 and 20 copies of an item; a level-12 squad fights
// endless waves of floor-24 enemies (no healing between waves, max 240s). Score = enemies defeated (offense
// and survival together). Prints the score per copy count and how much each step adds.
// Usage: node scripts/tests/stacking.mjs [trials=10] [itemIds comma list | all] [copies=1,5,10,20]
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json');
const T = Number(process.argv[2] || 10);
const ids = !process.argv[3] || process.argv[3] === 'all' ? Object.keys(itemDefs).filter((id) => itemDefs[id].kind !== 'potion' && itemDefs[id].type !== 'book') : process.argv[3].split(',');
const COPIES = (process.argv[4] || '1,5,10,20').split(',').map(Number);
const FLOOR = 18, LEVEL = 12, LIMIT = 240000;
// Who holds the item: a hero who can actually use it.
const HOLDER = {
  archer: ['eagle_eye'],
  mage: ['kindling', 'frost_charm', 'storm_charm', 'frozen_thunderbolt', 'magma_core', 'echo_rune', 'hourglass', 'siege_cannon', 'metronome'],
  necromancer: ['shadow_charm', 'plague_flask', 'bone_charm', 'overseers_whistle', 'grave_dust', 'necro_crown'],
  bard: ['conductors_baton'],
  knight: ['provokers_horn', 'spite_mail', 'martyrs_shield', 'bulwark_plate', 'padded_vest', 'spiked_aegis', 'warding_charm', 'shield_totem', 'tough_skin', 'heart_charm', 'gag_rune', 'mage_cloak', 'fire_heart'],
  cleric: ['lost_clerics_grimoire', 'overheal_ring'],
};
const holderOf = (id) => Object.keys(HOLDER).find((h) => HOLDER[h].includes(id)) || 'berserker';
const squadFor = (h) => [h, ...['berserker', 'cleric', 'knight'].filter((x) => x !== h)].slice(0, 3);
function run(itemId, copies) {
  const holder = holderOf(itemId);
  const s = new BattleState({ heroDefs: squadFor(holder).map((id) => all.find((x) => x.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling });
  for (const h of s.heroes) h.level = LEVEL;
  s.refreshStats();
  let given = 0;
  for (let i = 0; i < copies && canReceive(s.heroes[0], itemDefs[itemId]); i++) { s.giveItem(s.heroes[0].uid, itemId); given++; }
  run.given = given;
  for (const h of s.heroes) h.hp = h.maxHp;
  let t = 0, kills = 0;
  while (t < LIMIT && !s.allHeroesDead()) {
    s.spawnEnemies(enemiesForFloor(dungeon, FLOOR), FLOOR); s.placeLines(); s.startFloor();
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < LIMIT) {
      s.update(50); t += 50;
      for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
    }
    kills += s.enemies.filter((e) => !e.alive && !e.def.object).length;
    if (s.allEnemiesDead()) { s.endFloor(); s.winHeal(0); s.clearStatuses(); } // winHeal(0): only item heals (Aid Kit)
  }
  return kills;
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// The score with no item, once per holder squad.
const bases = {};
const baseOf = (id) => { const h = holderOf(id); if (bases[h] === undefined) { const k = []; for (let i = 0; i < T * 3; i++) k.push(run(id, 0)); bases[h] = avg(k); console.log(`no item (${h} squad): ${bases[h].toFixed(1)} enemies`); } return bases[h]; };
for (const id of ids) {
  const B = baseOf(id);
  const got = [];
  const scores = COPIES.map((c) => { const k = []; for (let i = 0; i < T; i++) k.push(run(id, c)); got.push(run.given); return avg(k); });
  const pct = scores.map((v) => Math.round((100 * (v - B)) / B));
  console.log(JSON.stringify({ id, holder: holderOf(id), rarity: itemDefs[id].rarity, scores: scores.map((v) => +v.toFixed(1)), gainPct: pct, copiesGiven: got }));
}
