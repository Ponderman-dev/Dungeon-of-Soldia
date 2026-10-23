// New items batch 1 (session 27): Hunter's Badge (elites), Elite's Badge (bosses), Swarm Swatter (fodder),
// Better Odds (per enemy alive), Opening Horn (first seconds of a floor), Quick Fingers (kills cut cooldowns).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin']) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.99 });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const bonus = (s, k, e) => s.itemDamageBonus(k, e, {});

// Hunter's Badge: elites only, the same again per copy.
{ const p = val('hunters_badge', 'eliteDamage').percent;
  const { s, e, k } = mk(); give(s, k, 'hunters_badge', 2);
  ok("Hunter's Badge: nothing vs a normal enemy", bonus(s, k, e) === 0);
  e.elite = { unhit: 0 };
  ok('...2 badges: +' + 2 * p + '% vs an elite', bonus(s, k, e) === 2 * p, `${bonus(s, k, e)}`);
  const { s: s2, e: e2, k: k2 } = mk(); e2.elite = { unhit: 0 };
  const plain = s2.strike(k2, e2, [], { basic: true }).amount; give(s2, k2, 'hunters_badge');
  const more = s2.strike(k2, e2, [], { basic: true }).amount;
  ok('...a real hit on an elite is ' + p + '% bigger', Math.abs(more / plain - (1 + p / 100)) < 0.03, `${plain} -> ${more}`); }
// Elite's Badge: bosses only (same special as Giantslayer's Brand, so they add up).
{ const p = val('elites_badge', 'bossDamage').percent;
  const { s, e, k } = mk(); give(s, k, 'elites_badge', 3);
  ok("Elite's Badge: nothing vs a normal enemy", bonus(s, k, e) === 0);
  e.def = { ...e.def, boss: true };
  ok('...3 badges: +' + 3 * p + '% vs a boss', bonus(s, k, e) === 3 * p, `${bonus(s, k, e)}`);
  give(s, k, 'giantslayers_brand');
  ok("...adds up with Giantslayer's Brand", bonus(s, k, e) === 3 * p + val('giantslayers_brand', 'bossDamage').percent, `${bonus(s, k, e)}`); }
// Swarm Swatter: fodder only, first copy then perExtra.
{ const sw = val('swarm_swatter', 'fodderDamage');
  const { s, es, k } = mk(['slime', 'goblin']); give(s, k, 'swarm_swatter', 2);
  const slime = es.find((x) => x.def.tier === 'fodder'), gob = es.find((x) => x.def.tier !== 'fodder');
  ok('Swarm Swatter: 2 copies +' + (sw.percent + sw.perExtra) + '% vs fodder', bonus(s, k, slime) === sw.percent + sw.perExtra, `${bonus(s, k, slime)}`);
  ok('...nothing vs a normal enemy', bonus(s, k, gob) === 0); }
// Better Odds: per enemy ALIVE right now, per copy.
{ const p = val('better_odds', 'betterOdds').percent;
  const { s, es, e, k } = mk(['goblin', 'goblin', 'goblin', 'goblin']); give(s, k, 'better_odds', 2);
  ok('Better Odds: 4 alive, 2 copies = +' + 4 * 2 * p + '%', Math.abs(bonus(s, k, e) - 4 * 2 * p) < 1e-9, `${bonus(s, k, e)}`);
  es[3].alive = false;
  ok('...shrinks when one dies (3 alive)', Math.abs(bonus(s, k, e) - 3 * 2 * p) < 1e-9, `${bonus(s, k, e)}`); }
// Opening Horn: faster only in the first seconds of the floor.
{ const h = val('opening_horn', 'openingHorn');
  const { s, k } = mk(); const slow = s.interval(k); give(s, k, 'opening_horn', 2);
  s.floorMs = 0; const fast = s.interval(k);
  ok('Opening Horn: 2 horns +' + (h.percent + h.perExtra) + '% attack speed at the start', Math.abs(slow / fast - (1 + (h.percent + h.perExtra) / 100)) < 0.01, `${slow} -> ${fast}`);
  s.floorMs = h.durationMs + 1;
  ok('...gone after ' + h.durationMs / 1000 + 's', s.interval(k) === slow); }
// Quick Fingers: the holder's own kills cut the holder's cooldowns (not other heroes' kills).
{ const q = val('quick_fingers', 'killCooldownMs');
  const { s, e, k } = mk(); give(s, k, 'quick_fingers', 2);
  for (const slot of k.skills) slot.cooldownLeft = 5000;
  s.onKill(s.heroes[1], e, [], []);
  ok("Quick Fingers: another hero's kill does nothing", k.skills.every((sl) => sl.cooldownLeft === 5000));
  s.onKill(k, e, [], []);
  ok('...own kill, 2 copies: cooldowns -' + (q.percent + q.perExtra) + 'ms', k.skills.every((sl) => sl.cooldownLeft === 5000 - q.percent - q.perExtra), `${k.skills.map((sl) => sl.cooldownLeft)}`);
  for (const slot of k.skills) slot.cooldownLeft = 100; s.onKill(k, e, [], []);
  ok('...never below 0', k.skills.every((sl) => sl.cooldownLeft === 0)); }
