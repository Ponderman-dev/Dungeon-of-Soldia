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
// Elite's Badge (BOUNTY, session 31): an elite dying heals the squad and gives more XP.
{ const heal = val('elites_badge', 'bounty'), xp = val('elites_badge', 'bountyXp');
  const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'elites_badge', 2);
  for (const h of s.heroes) h.hp = Math.round(h.maxHp * 0.5);
  const a = s.heroes[1], a0 = a.hp; es[0].elite = { element: 'burning', trait: 'vampiric', hits: 0, unhit: 0 }; es[0].hp = 1; const ev = []; s.strike(k, es[0], ev, {});
  const want = (a.maxHp * (heal.percent + heal.perExtra)) / 100;
  ok("Elite's Badge: an elite dies = the whole squad heals " + (heal.percent + heal.perExtra) + '% (2 badges)', ev.some((e) => e.label === 'Bounty!') && Math.abs(a.hp - a0 - want) < 1.5, `${a.hp - a0} vs ${want}`);
  const a1 = a.hp; es[1].hp = 1; s.strike(k, es[1], [], {}); ok('...nothing for a normal enemy', a.hp === a1);
  const gain = (badges, elite) => { const t = mk(['goblin']); if (badges) give(t.s, t.k, 'elites_badge', badges); if (elite) t.e.elite = { unhit: 0 }; t.e.xpScale = 1; t.e.def = { ...t.e.def, xp: 3 }; for (const h of t.s.heroes) h.xp = 0; t.s.awardXp(t.e, []); return t.s.heroes[1].xp; };
  ok('...+' + xp.percent + '% XP from an elite (+' + xp.perExtra + '% per extra badge)', Math.abs(gain(1, true) / gain(0, true) - (1 + xp.percent / 100)) < 1e-6 && Math.abs(gain(2, true) / gain(0, true) - (1 + (xp.percent + xp.perExtra) / 100)) < 1e-6 && gain(1, false) === gain(0, false)); }
// Swarm Swatter (session 31): NORMAL enemies (not elites, not bosses), first copy then perExtra.
{ const sw = val('swarm_swatter', 'normalDamage');
  const { s, es, k } = mk(['slime', 'goblin']); give(s, k, 'swarm_swatter', 2);
  ok('Swarm Swatter: 2 copies +' + (sw.percent + sw.perExtra) + '% vs normal enemies', bonus(s, k, es[0]) === sw.percent + sw.perExtra && bonus(s, k, es[1]) === sw.percent + sw.perExtra, `${bonus(s, k, es[1])}`);
  es[1].elite = { unhit: 0 }; ok('...nothing vs an elite', bonus(s, k, es[1]) === 0);
  es[0].def = { ...es[0].def, boss: true }; ok('...nothing vs a boss', bonus(s, k, es[0]) === 0); }
// Better Odds: per enemy ALIVE right now, first copy then perExtra.
{ const b = val('better_odds', 'betterOdds'); const p = b.percent + (b.perExtra ?? b.percent);
  const { s, es, e, k } = mk(['goblin', 'goblin', 'goblin', 'goblin']); give(s, k, 'better_odds', 2);
  ok('Better Odds: 4 alive, 2 copies = +' + 4 * p + '%', Math.abs(bonus(s, k, e) - 4 * p) < 1e-9, `${bonus(s, k, e)}`);
  es[3].alive = false;
  ok('...shrinks when one dies (3 alive)', Math.abs(bonus(s, k, e) - 3 * p) < 1e-9, `${bonus(s, k, e)}`); }
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
