// Shield Totem (phase H): 6% block per totem, more totems creep towards 90%, NO recharge (blocks can come back to back).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const mk = (n) => { const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const k = s.heroes[0]; s.heroes.slice(1).forEach((h) => (h.alive = false)); for (let i = 0; i < n; i++) s.giveItem(k.uid, 'shield_totem'); return { s, k }; };
{ const { k } = mk(1); ok('block 6 stored, no recharge', k.specials.block === 6 && !k.specials.blockCooldownMs); }
{ const bl = (n) => mk(n).k.specials.block; ok('more totems creep towards 90% (10 = 45%, 40 = 84%)', Math.abs(bl(10) - 45.3) < 0.5 && Math.abs(bl(40) - 84) < 1, `${bl(10)} ${bl(40)}`); }
{ const { s, k } = mk(1); const [g] = s.spawnEnemies(['goblin'], 1); g.hp = g.maxHp = 1e12; g.stats.attackEfficiency = 400; k.stats.evasion = 0; k.hp = k.maxHp = 1e12;
  let hits = 0, blocked = 0, last = -1, backToBack = 0, cd = false;
  for (let t = 0; t < 4000000 && hits < 30000; t += 50) { for (const ev of s.update(50)) {
      if (ev.type === 'attack' && ev.attacker === g) { hits++; if (ev.result.blocked) { blocked++; if (last === hits - 1) backToBack++; last = hits; } }
      if (ev.type === 'status' && ev.status.type === 'blockCooldown') cd = true; }
    k.hp = k.maxHp; }
  ok('about 6% of hits blocked', Math.abs(blocked / hits - 0.06) < 0.008, `${(100 * blocked / hits).toFixed(1)}% of ${hits}`);
  ok('blocks can come back to back (no recharge status)', backToBack > 0 && !cd); }
