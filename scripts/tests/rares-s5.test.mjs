// Rare item buffs of session 5 (user approved): Warding Charm pulse shield, Overseer's Whistle health, Grave Dust 400% + poison.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks, frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const heroes = r('heroes.json');
const mk = (ids = ['knight', 'rogue', 'archer'], enemyIds = ['goblin'], rng = () => 0.5) => {
  const defs = ids.includes('necromancer') ? heroes : noPerks(heroes); // the Necromancer keeps his passive (skeletons)
  const s = new BattleState({ heroDefs: ids.map((id) => defs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  for (const h of s.heroes) { h.stats.evasion = 0; h.baseStats.evasion = 0; }
  s.placeLines();
  return { s, es, h: s.heroes, k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const near = (v, t, tol = 0.03) => Math.abs(v / t - 1) < tol;

// Warding Charm: a shield of 8% max health (x1.2 from its own bonus) at the start of a fight and every 10s
{ const { s, k } = mk(); give(s, k, 'warding_charm'); s.startFloor();
  const want = Math.round(k.maxHp * 0.08 * 1.2);
  ok('Warding Charm: shield 8% max health (x1.2) at the fight start', s.shieldAmount(k) === want, `${s.shieldAmount(k)} ${want}`);
  k.statuses = k.statuses.filter((x) => x.type !== 'shield');
  for (let t = 0; t < 9900; t += 50) s.update(50);
  const before = s.shieldAmount(k); s.update(150);
  ok('...and again every 10s', before === 0 && s.shieldAmount(k) === want, `${before} ${s.shieldAmount(k)}`); }
{ const { s, k } = mk(); give(s, k, 'warding_charm', 3); s.startFloor();
  ok('...3 charms: the pulse stays 8% but shields are 60% bigger', s.shieldAmount(k) === Math.round(k.maxHp * 0.08 * 1.6), `${s.shieldAmount(k)}`); }
// Overseer's Whistle: weak minions +25% health per whistle
{ const hp = (n) => { const { s, h } = mk(['necromancer', 'knight', 'rogue'], ['goblin']); if (n) give(s, h[1], 'overseers_whistle', n); s.startFloor(); return s.minions[0].maxHp; };
  ok('Overseer\'s Whistle: weak minions +25% health (2 whistles +50%)', near(hp(1) / hp(0), 1.25, 0.05) && near(hp(2) / hp(0), 1.5, 0.05), `${hp(0)} ${hp(1)} ${hp(2)}`); }
// Grave Dust: a dying weak minion explodes for 400% of its attack per copy and poisons
{ const { s, es, h } = mk(['necromancer', 'knight', 'rogue'], ['goblin']); give(s, h[1], 'grave_dust'); s.startFloor();
  const m = s.minions[0]; m.x = es[0].x; m.y = es[0].y; const ev = []; s.explodeMinion(m, ev);
  const hit = ev.find((e) => e.type === 'attack' && e.target === es[0]);
  ok('Grave Dust: 400% of the minion\'s attack', hit && Math.abs(hit.result.amount - m.stats.attack * 4) <= 1, `${hit && hit.result.amount} ${m.stats.attack}`);
  ok('...and the enemy is Poisoned', es[0].statuses.some((x) => x.type === 'poison')); }
