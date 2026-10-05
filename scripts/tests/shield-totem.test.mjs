import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const k = s.heroes[0]; s.heroes.slice(1).forEach((h) => (h.alive = false)); s.giveItem(k.uid, 'shield_totem');
ok('block 10 and cooldown 2500 stored', k.specials.block === 10 && k.specials.blockCooldownMs === 2500);
const [g] = s.spawnEnemies(['goblin'], 1); g.hp = g.maxHp = 1e12; g.statuses = []; g.stats.attackEfficiency = 400; k.stats.evasion = 0; k.hp = k.maxHp = 1e12;
let hits = 0, blocked = 0, now = 0, lastBlock = -1e9, tooSoon = 0, minGap = 1e9; let cdChipSeen = false;
for (let t = 0; t < 4000000; t += 50) { now = t; for (const ev of s.update(50)) {
    if (ev.type === 'attack' && ev.attacker === g) { hits++; if (ev.result.blocked) { blocked++; if (now - lastBlock < 2500) tooSoon++; minGap = Math.min(minGap, now - lastBlock); lastBlock = now; } }
    if (ev.type === 'status' && ev.status.type === 'blockCooldown' && ev.change === 'apply') cdChipSeen = true; }
  k.hp = k.maxHp; if (hits > 30000) break; }
ok('never two blocks inside 2.5s', tooSoon === 0, `min gap ${minGap}ms`);
ok('cooldown status shown (chip event)', cdChipSeen);
ok('blocks happen but fewer than 10%', blocked > 0 && blocked / hits < 0.1, `${(100 * blocked / hits).toFixed(1)}% of ${hits} hits (attack speed x4 for a dense test)`);
// slow attacker (1 hit/s): blocks should come close to 10% because the cooldown rarely matters... only 1 hit per 2.5s window
const s2 = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const k2 = s2.heroes[0]; s2.heroes.slice(1).forEach((h) => (h.alive = false)); s2.giveItem(k2.uid, 'shield_totem'); const [g2] = s2.spawnEnemies(['goblin'], 1); g2.hp = g2.maxHp = 1e12; k2.stats.evasion = 0; k2.hp = k2.maxHp = 1e12;
let h2 = 0, b2 = 0; for (let t = 0; t < 4000000; t += 50) { for (const ev of s2.update(50)) if (ev.type === 'attack' && ev.attacker === g2) { h2++; if (ev.result.blocked) b2++; } k2.hp = k2.maxHp; if (h2 > 20000) break; }
console.log(`normal speed: ${(100 * b2 / h2).toFixed(1)}% of ${h2} hits blocked (was 10.5% without cooldown)`);
