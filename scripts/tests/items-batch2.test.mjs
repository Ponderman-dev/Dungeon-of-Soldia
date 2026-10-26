// New items batch 2 (session 27): Life Crystal (orb on any kill heals heroes near it), Emergency Buckler (kill
// shield that fades), Rally Flag (squad shield when a hero drops low), Frost Mantle (melee attackers get chilled),
// Reaper's Bell (the holder's kills explode, and can chain).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; u.baseStats.evasion = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const shield = (u, key) => u.statuses.find((st) => st.type === 'shield' && (!key || st.key === key));

// Life Crystal: any enemy death (not only the holder's kills), heals heroes near the dead enemy.
{ const lc = val('life_crystal', 'lifeCrystal'), heal = val('life_crystal', 'lifeCrystalHeal').percent;
  const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'life_crystal', 2);
  ok('Life Crystal: 2 copies = ' + (lc.percent + lc.perExtra) + '% chance', k.specials.lifeCrystal === lc.percent + lc.perExtra);
  const far = s.heroes[2];
  for (const h of s.heroes) h.hp = h.maxHp / 2;
  const near = s.heroes[1]; near.x = e.x; near.y = e.y; far.x = e.x + lc.radius * 3; far.y = e.y;
  const ev = []; s.onKill(near, e, ev, []);
  ok("...another hero's kill drops an orb", ev.some((x) => x.type === 'lifeOrb'));
  ok('...heals a hero next to it ' + heal + '% max health', Math.abs(near.hp - near.maxHp / 2 - (near.maxHp * heal) / 100) <= 1, `${near.hp - near.maxHp / 2}`);
  ok('...not a hero far away', far.hp === far.maxHp / 2);
  const { s: s2, e: e2, k: k2 } = mk(['goblin'], () => 0.99); give(s2, k2, 'life_crystal');
  const ev2 = []; s2.onKill(k2, e2, ev2, []);
  ok('...no orb when the chance misses', !ev2.some((x) => x.type === 'lifeOrb')); }
// Emergency Buckler: the holder's kills shield the holder; the shield fades to nothing.
{ const b = val('emergency_buckler', 'killShield');
  const { s, e, k } = mk(); give(s, k, 'emergency_buckler', 2);
  s.onKill(s.heroes[1], e, [], []);
  ok("Emergency Buckler: another hero's kill gives nothing", !shield(k));
  s.onKill(k, e, [], []);
  const sh = shield(k);
  ok('...own kill, 2 copies: ' + (b.percent + b.perExtra) + '% max health shield', sh && Math.abs(sh.amount - (k.maxHp * (b.percent + b.perExtra)) / 100) <= 1, `${sh && sh.amount} of ${k.maxHp}`);
  const full = sh.amount; s.tickStatuses(b.durationMs / 2, []);
  ok('...half way: about half left', Math.abs(sh.amount - full / 2) <= 1, `${full} -> ${sh.amount}`);
  s.tickStatuses(b.durationMs / 2 + 1, []);
  ok('...gone after ' + b.durationMs / 1000 + 's', !shield(k)); }
// Rally Flag: one rally per flag per floor; shields replace each other.
{ const rf = val('rally_flag', 'rallyFlag');
  const { s, k } = mk(); give(s, k, 'rally_flag');
  const [a, b2, c] = s.heroes;
  b2.hp = b2.maxHp * 0.5; s.afterDamage(b2, []);
  ok('Rally Flag: nothing above ' + rf.below + '%', !shield(a));
  b2.hp = b2.maxHp * 0.2; const ev = []; s.afterDamage(b2, ev);
  ok('...a hero below ' + rf.below + '%: every hero gets a ' + rf.percent + '% shield', s.heroes.every((h) => shield(h) && Math.abs(shield(h).amount - (h.maxHp * rf.percent) / 100) <= 1));
  shield(a).amount = 1; c.hp = c.maxHp * 0.2; s.afterDamage(c, []);
  ok('...once per floor per flag', shield(a).amount === 1);
  const { s: t, k: k1 } = mk(); give(t, k1, 'rally_flag'); give(t, t.heroes[1], 'rally_flag', 2);
  const [x, y, z] = t.heroes;
  y.hp = y.maxHp * 0.2; t.afterDamage(y, []);
  y.hp = y.maxHp * 0.1; t.afterDamage(y, []);
  ok('...the same hero sets off only one rally', t.heroes.filter((h) => h.alive && h.specials.rallyFlag && h.floor.rallyUsed).length === 1);
  z.hp = z.maxHp * 0.2; t.afterDamage(z, []);
  ok('...a 2nd flag holder rallies for a 2nd hero', x.floor.rallyUsed && y.floor.rallyUsed);
  ok("...shields don't stack: one rally shield per hero", t.heroes.every((h) => h.statuses.filter((st) => st.type === 'shield').length === 1)); }
// Frost Mantle: melee attackers get chilled (not ranged).
{ const fm = val('frost_mantle', 'frostMantle');
  const { s, e, k } = mk(['goblin', 'skeletonArcher'], () => 0); give(s, k, 'frost_mantle', 2);
  ok('Frost Mantle: 2 copies = ' + (fm.percent + fm.perExtra) + '%', k.specials.frostMantle === fm.percent + fm.perExtra);
  const archer = s.enemies.find((x) => x.damageType !== 'melee');
  e.damageType = 'melee'; s.strike(e, k, [], {});
  ok('...a melee attacker is chilled', s.stacks(e, 'chill') === 1);
  s.strike(archer, k, [], {});
  ok('...a ranged attacker is not', s.stacks(archer, 'chill') === 0);
  const { s: s2, e: e2, k: k3 } = mk(['goblin'], () => 0.99); give(s2, k3, 'frost_mantle'); e2.damageType = 'melee'; s2.strike(e2, k3, [], {});
  ok('...nothing when the chance misses', s2.stacks(e2, 'chill') === 0); }
// Reaper's Bell: reworked in session 31 (haunting spirits), tested in items-s31.test.mjs.
