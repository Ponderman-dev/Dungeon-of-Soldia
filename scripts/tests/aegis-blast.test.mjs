// Spiked Aegis SHIELD BREAK BLAST (user, session 59): a breaking shield on the holder bursts: damage around + stun.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const B = itemDefs.spiked_aegis.effects.find((e) => e.special === 'shieldBlast');
const mk = (copies) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const k = s.heroes[0]; for (let i = 0; i < copies; i++) s.giveItem(k.uid, 'spiked_aegis');
  const es = s.spawnEnemies(['goblin', 'goblin'], 1); s.placeLines();
  for (const e of es) { e.hp = e.maxHp = 1e6; e.stats.evasion = 0; }
  es[0].x = k.x; es[0].y = k.y - 40; es[1].x = k.x; es[1].y = k.y - 400; // one close, one far
  return { s, k, es };
};
const brk = (s, k) => { s.applyStatus(k, { status: 'shield', amount: 10, durationMs: 5000 }, k, 'test', []); const ev = []; const d = s.dealDamage(k, 50, ev); s.breakEffects(k, d.broken, ev); return ev; };
{ const { s, k, es } = mk(1); const ev = brk(s, k);
  ok('a breaking shield bursts (Spikes!)', ev.some((e) => e.type === 'proc' && e.itemId === 'spiked_aegis'));
  ok('...hits and stuns the enemy close by', es[0].hp < es[0].maxHp && es[0].statuses.some((x) => x.type === 'stun'));
  ok('...but not one outside ' + B.radius + 'px', es[1].hp === es[1].maxHp && !es[1].statuses.some((x) => x.type === 'stun')); }
{ const lost = (n) => { const { s, k, es } = mk(n); brk(s, k); return es[0].maxHp - es[0].hp; };
  ok('2 copies hit harder (+' + B.perExtra + '%)', lost(2) > lost(1) * 1.3, `${lost(1)} ${lost(2)}`); }
{ const { s, k, es } = mk(0); const ev = brk(s, k); ok('no item: no burst', !ev.some((e) => e.itemId === 'spiked_aegis') && es[0].hp === es[0].maxHp); }
