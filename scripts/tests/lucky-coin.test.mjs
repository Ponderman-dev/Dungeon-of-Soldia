import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const s = new BattleState({ heroDefs: r('heroes.json'), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const rogue = s.heroes[2]; const base = rogue.stats.crit; const rows = [];
let prev = base;
for (let n = 1; n <= 10; n++) { s.giveItem(rogue.uid, 'lucky_coin'); rows.push(`${n}: +${(rogue.stats.crit - prev).toFixed(1)} -> ${(rogue.stats.crit - base).toFixed(1)}`); prev = rogue.stats.crit; }
console.log(rows.join('\n'));
console.log('base crit', base, 'final crit', rogue.stats.crit.toFixed(1), 'can take 11th:', canReceive(rogue, itemDefs.lucky_coin));
const ok = Math.abs(rogue.stats.crit - base - 75) < 0.01 && !canReceive(rogue, itemDefs.lucky_coin);
console.log(ok ? 'PASS: 10 coins = +75, stack limit 10' : 'FAIL');
// preview shows the real (diminished) increment
const k = s.heroes[0]; for (let i = 0; i < 5; i++) s.giveItem(k.uid, 'lucky_coin'); const before = k.stats.crit; const after = s.previewStats(k.uid, 'lucky_coin').stats.crit;
console.log('preview 6th coin on Knight:', (after - before).toFixed(2), '(expect', (10 * Math.pow(0.934099, 5)).toFixed(2) + ')');
