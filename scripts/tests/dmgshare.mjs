// Where each hero's damage comes from, by floor depth (smart player runs): basic attacks, skills, other hits
// (items, passives, counters) and minions. DoT ticks carry no source, so they are left out.
// Usage: node scripts/tests/dmgshare.mjs [runsPerSquad=2]
import BattleState from '../../src/systems/BattleState.js';
import { playRun } from './smartbot.mjs';
const N = Number(process.argv[2] || 2);
const HEROES = ['knight', 'berserker', 'rogue', 'archer', 'samurai', 'mage', 'cleric', 'necromancer', 'bard', 'alchemist'];
const BRACKETS = [[1, 10], [11, 25], [26, 45], [46, 400]];
const tally = {}; // hero -> bracket -> {basic, skill, other, minion}
let floorNow = 1;
const spawn = BattleState.prototype.spawnEnemies;
BattleState.prototype.spawnEnemies = function (ids, floor, ...rest) { floorNow = floor; return spawn.call(this, ids, floor, ...rest); };
const update = BattleState.prototype.update;
BattleState.prototype.update = function (dt) {
  const ev = update.call(this, dt);
  const b = BRACKETS.findIndex(([a, z]) => floorNow >= a && floorNow <= z);
  for (const e of ev) {
    if (e.type !== 'attack' || !e.result || !e.result.amount || !e.attacker || e.attacker.side !== 'hero') continue;
    let a = e.attacker, kind = e.skill ? 'skill' : e.basic ? 'basic' : 'other';
    if (a.holderUid !== undefined && !this.heroes.includes(a)) { a = this.heroes.find((h) => h.uid === a.holderUid); kind = 'minion'; }
    if (!a || !a.def) continue;
    const t = ((tally[a.def.id] ||= BRACKETS.map(() => ({ basic: 0, skill: 0, other: 0, minion: 0 })))[b]);
    t[kind] += e.result.amount;
  }
  return ev;
};
const squads = [];
for (let i = 0; i < HEROES.length; i++) for (let j = i + 1; j < HEROES.length; j++) for (let k = j + 1; k < HEROES.length; k++) squads.push([HEROES[i], HEROES[j], HEROES[k]]);
for (const sq of squads) for (let r = 0; r < N; r++) playRun(sq, { maxFloor: 80 });
const pct = (v, t) => (t ? Math.round((100 * v) / t) : 0);
console.log('hero          ' + BRACKETS.map(([a, z]) => `f${a}-${z > 100 ? '+' : z}`.padEnd(26)).join(''));
console.log('              ' + BRACKETS.map(() => 'basic skill other minion  '.padEnd(26)).join(''));
for (const h of HEROES) {
  const row = (tally[h] || []).map((t) => { const tot = t.basic + t.skill + t.other + t.minion; return [t.basic, t.skill, t.other, t.minion].map((v) => String(pct(v, tot)).padStart(5)).join(' ').padEnd(26); });
  console.log(h.padEnd(14) + row.join(''));
}
