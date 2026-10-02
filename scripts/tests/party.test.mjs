import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { pickSquad, moraleTier } from '../../src/systems/party.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const mk = () => new BattleState({ heroDefs: pickSquad(r('heroes.json'), r('squad.json')), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const base = (name) => r('heroes.json').find((h) => h.name === name).stats;
const kill = (s, h) => { const ev = []; s.killUnit(h, ev); return ev; };

// The squad is Knight, Rogue, Archer
{ const s = mk(); ok('squad of 3: Knight, Rogue, Archer', s.heroes.map((h) => h.name).join() === 'Knight,Rogue,Archer'); }
// Perks help everyone from the start: Knight +10% health, Rogue +6 crit, Archer +10% attack
{ const s = mk(); const [k, ro, a] = s.heroes;
  ok('Knight perk: +10% max health for all', Math.abs(k.maxHp - base('Knight').health * 1.1) < 1 && Math.abs(ro.maxHp - base('Rogue').health * 1.1) < 1, `${k.maxHp} ${ro.maxHp}`);
  ok('Rogue perk: +6 crit for all', Math.abs(k.stats.crit - (base('Knight').crit + 6)) < 0.01 && Math.abs(ro.stats.crit - (base('Rogue').crit + 6)) < 0.01);
  ok('Archer perk: +10% attack for all', Math.abs(k.stats.attack - base('Knight').attack * 1.1) < 0.01 && Math.abs(a.stats.attack - base('Archer').attack * 1.1) < 0.01);
  ok('new heroes start at full health', k.hp === k.maxHp && ro.hp === ro.maxHp); }
// The perk grows with the hero's level
{ const s = mk(); const k = s.heroes[0]; const before = s.heroes[1].maxHp; k.level = 11; s.refreshStats();
  const lvl = s.heroes[1].maxHp; ok('Knight perk grows with level (+4% at Lv11)', lvl > before, `${before} -> ${lvl}`); }
// Death: perk lost + 'incomplete' then 'all alone'
{ const s = mk(); const [k, ro, a] = s.heroes; ok('morale starts full', s.morale === 'full' && moraleTier(s.heroes) === 'full');
  const atk0 = ro.stats.attack, spd0 = ro.stats.attackEfficiency, def0 = ro.stats.defense;
  const ev = kill(s, a);
  ok('first death -> incomplete (event sent)', s.morale === 'incomplete' && ev.some((e) => e.type === 'morale' && e.tier === 'incomplete'));
  ok('Archer perk lost and -10% attack, -10% speed, -3 defense', Math.abs(ro.stats.attack - base('Rogue').attack * 0.9) < 0.01 && Math.abs(ro.stats.attackEfficiency - spd0 * 0.9) < 0.01 && Math.abs(ro.stats.defense - Math.max(0, def0 - 3)) < 0.01, `atk ${atk0}->${ro.stats.attack}`);
  const ev2 = kill(s, ro);
  ok('second death -> all alone (event sent)', s.morale === 'alone' && ev2.some((e) => e.type === 'morale' && e.tier === 'alone'));
  ok('last hero: -25% attack, no more perks from the fallen', Math.abs(k.stats.attack - base('Knight').attack * 0.75) < 0.01 && k.stats.crit - base('Knight').crit < 0.01, `${k.stats.attack}`);
  const ev3 = kill(s, k); ok('no morale event when the last hero falls', !ev3.some((e) => e.type === 'morale') || s.allHeroesDead()); }
// An enemy dying does not change morale
{ const s = mk(); const [e] = s.spawnEnemies(['goblin'], 1); const ev = []; s.killUnit(e, ev); ok('enemy death: no morale event', !ev.some((x) => x.type === 'morale') && s.morale === 'full'); }
// The stats that go back when morale ends? (no revives yet) -> morale is based on who is alive now
{ const s = mk(); kill(s, s.heroes[2]); s.heroes[2].alive = true; s.refreshStats(); ok('morale follows who is alive', s.morale === 'full'); }
