import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json')), rw = r('rewards.json');
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = () => new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
{ const s = mk(); const k = s.heroes[0]; const atk = k.stats.attack; s.giveItem(k.uid, 'siege_cannon');
  ok('siege cannon +40% attack', Math.abs(k.stats.attack - atk * 1.4) < 0.01, `${atk} -> ${k.stats.attack}`);
  ok('skillDamage special stored', k.specials.skillDamage === 30); }
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'bulwark_plate'); ok('plate +30 def & thorns', k.stats.defense === 40 && k.specials.thorns === 25, `${k.stats.defense}`); }
{ const s = mk(); const [e] = s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; s.giveItem(k.uid, 'bulwark_plate'); e.hp = 1000; e.maxHp = 1000; s.heroes.slice(1).forEach((h) => (h.alive = false)); // the goblin can only hit the Knight
  const hp0 = e.hp; k.stats.evasion = 0; let reflected = 0; for (let i = 0; i < 400; i++) for (const ev of s.update(50)) if (ev.type === 'thorns') reflected += ev.amount;
  ok('thorns reflect melee damage', reflected > 0, `reflected=${reflected}`); }
{ const s = mk(); const [e] = s.spawnEnemies(['goblin'], 1); e.stats.evasion = 0; e.hp = e.maxHp = 99999; const b = s.heroes[1]; s.giveItem(b.uid, 'bloodlust_mask'); b.hp = 10; let heals = 0;
  for (let i = 0; i < 200; i++) for (const ev of s.update(50)) if (ev.type === 'heal') heals += ev.amount;
  ok('lifesteal heals', heals > 0, `healed=${heals}`); }
{ const s = mk(); const g = s.heroes[2]; const c0 = g.stats.crit; s.giveItem(g.uid, 'gamblers_dice'); ok('dice +20 crit, crit dmg +50%', g.stats.crit === c0 + 20 && g.specials.critDamage === 50); }
// potion appears rarely and only when someone is hurt
{ const s = mk(); let n = 0; const T = 4000; s.heroes[0].hp -= 10;
  for (let i = 0; i < T; i++) { const ch = rollChoices({ itemDefs, rules: rw, count: 3, heroes: s.heroes, potionChance: 0.05, rng: Math.random }); if (ch.some((x) => x.kind === 'potion')) n++; }
  ok('potion offered ~5% when hurt', n / T > 0.03 && n / T < 0.07, `${(100 * n / T).toFixed(1)}%`); }
{ const s = mk(); let n = 0; for (let i = 0; i < 2000; i++) if (rollChoices({ itemDefs, rules: rw, count: 3, heroes: s.heroes, potionChance: 1, rng: Math.random }).some((x) => x.kind === 'potion')) n++;
  ok('potion never offered when nobody is hurt', n === 0); }
// rarity frequency
{ const s = mk(); const tally = {}; for (let i = 0; i < 6000; i++) for (const it of rollChoices({ itemDefs, rules: rw, count: 3, heroes: s.heroes })) tally[it.rarity] = (tally[it.rarity] || 0) + 1;
  const tot = Object.values(tally).reduce((a, b) => a + b, 0); console.log('rarity mix:', Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, (100 * v / tot).toFixed(1) + '%']))); }
