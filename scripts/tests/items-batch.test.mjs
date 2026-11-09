// New items batches 1-5 (session 27): the old per-batch test files in one file. Each block below is one old file, with its own helpers.
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';

// ================= was items-batch.test.mjs =================
{
// New items batch 1 (session 27): Hunter's Badge (elites), Elite's Badge (bosses), Swarm Swatter (fodder),
// Better Odds (per enemy alive), Opening Horn (first seconds of a floor), Quick Fingers (kills cut cooldowns).
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
}

// ================= was items-batch.test.mjs =================
{
// New items batch 2 (session 27): Life Crystal (orb on any kill heals heroes near it), Emergency Buckler (kill
// shield that fades), Rally Flag (squad shield when a hero drops low), Frost Mantle (melee attackers get chilled),
// Reaper's Bell (the holder's kills explode, and can chain).
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
  ok('...a hero below ' + rf.below + '%: ONLY that hero gets a ' + rf.percent + '% shield (Cautious Banner, session 32)', shield(b2) && Math.abs(shield(b2).amount - (b2.maxHp * rf.percent) / 100) <= 1 && !shield(a) && !shield(c));
  c.hp = c.maxHp * 0.2; s.afterDamage(c, []);
  ok('...once per floor per flag', !shield(c));
  const { s: t, k: k1 } = mk(); give(t, k1, 'rally_flag'); give(t, t.heroes[1], 'rally_flag', 2);
  const [x, y, z] = t.heroes;
  y.hp = y.maxHp * 0.2; t.afterDamage(y, []);
  y.hp = y.maxHp * 0.1; t.afterDamage(y, []);
  ok('...the same hero sets off only one rally', t.heroes.filter((h) => h.alive && h.specials.rallyFlag && h.floor.rallyUsed).length === 1);
  z.hp = z.maxHp * 0.2; t.afterDamage(z, []);
  ok('...a 2nd flag holder rallies for a 2nd hero', x.floor.rallyUsed && y.floor.rallyUsed);
  ok("...shields don't stack: at most one rally shield per hero", t.heroes.every((h) => h.statuses.filter((st) => st.type === 'shield').length <= 1) && y.statuses.some((st) => st.type === 'shield')); }
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
// Reaper's Bell: reworked in session 31 (haunting spirits), tested in items-s.test.mjs.
}

// ================= was items-batch.test.mjs =================
{
// New items batch 3 (session 27): the bomb family (Ice / Electric / Dark / Poison Bombs, like Fire Bombs + a debuff)
// and Bombardier's Barrel (+bomb damage, sometimes throws 2-4 more bombs of the kinds the holder has).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const mk = (ids = ['goblin', 'goblin', 'goblin'], rng = () => 0) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const bombProc = (k, id) => k.procs.find((p) => p.itemId === id);
const shots = (ev) => ev.filter((x) => x.type === 'projectile');

// Every bomb: same chance / damage as Fire Bombs, its own element, its own debuff on the enemy it hits.
const fire = itemDefs.fire_bombs.effects[0];
for (const [id, status] of [['ice_bomb', 'chill'], ['electric_bomb', 'stun'], ['dark_bomb', 'weaken'], ['poison_bombs', 'poison']]) {
  const def = itemDefs[id].effects[0];
  ok(itemDefs[id].name + ': ' + def.chance + '% chance, ' + def.strike.damageMultiplier * 100 + '% like Fire Bombs', def.chance === fire.chance && def.strike.damageMultiplier === fire.strike.damageMultiplier && def.bomb);
  const { s, e, k } = mk(); give(s, k, id, 2);
  ok('...one roll per copy (2 copies = 2 procs)', k.procs.filter((p) => p.itemId === id).length === 2);
  const ev = []; s.throwBomb(k, e, bombProc(k, id), ev);
  const want = def.strike.apply[0];
  const count = e.statuses.filter((st) => st.type === status).length;
  ok('...hits for ' + def.strike.damageMultiplier * 100 + '% ' + def.strike.damageType + ' and puts ' + (want.stacks || 1) + ' ' + status + ' on it', e.hp === 1e7 - 300 && count === (want.stacks || 1), `${1e7 - e.hp} ${count}`);
  ok('...with its own bomb look', shots(ev).some((x) => x.kind === def.strike.projectile));
}
{ const { s, e, k } = mk(); give(s, k, 'dark_bomb'); s.throwBomb(k, e, bombProc(k, 'dark_bomb'), []);
  const w = e.statuses.find((st) => st.type === 'weaken');
  ok('Dark Bomb: the enemy deals ' + -w.attackPercent + '% less damage', w.attackPercent === itemDefs.dark_bomb.effects[0].strike.apply[0].attackPercent); }
// Bombardier's Barrel.
{ const bd = itemDefs.bombardiers_barrel.effects.find((x) => x.special === 'bombDamage'), bb = itemDefs.bombardiers_barrel.effects.find((x) => x.special === 'bombBarrel');
  const { s, e, k } = mk(['goblin'], () => 0.99); give(s, k, 'fire_bombs'); give(s, k, 'bombardiers_barrel', 2);
  s.throwBomb(k, e, bombProc(k, 'fire_bombs'), []);
  const pct = bd.percent + bd.perExtra; // the first barrel gives percent, every extra one perExtra (session 29: no snowball)
  ok("Bombardier's Barrel: 2 barrels = +" + pct + '% bomb damage', e.hp === 1e7 - Math.round(300 * (1 + pct / 100)), `${1e7 - e.hp}`);
  ok('...barrel chance ' + bb.percent + '% +' + bb.perExtra + '% per extra', k.specials.bombBarrel === bb.percent + bb.perExtra);
  const ev = []; const { s: t, e: e2, k: k2 } = mk(['goblin'], () => 0.99); give(t, k2, 'ice_bomb'); give(t, k2, 'bombardiers_barrel'); t.throwBomb(k2, e2, bombProc(k2, 'ice_bomb'), ev);
  ok('...no extra bombs when the chance misses', shots(ev).length === 1);
  // rng 0: the barrel always goes off and throws the lowest count, one bomb every staggerMs; barrel bombs can set it
  // off again, but only after its cooldown.
  const { s: u, k: k3 } = mk(); give(u, k3, 'ice_bomb'); give(u, k3, 'poison_bombs'); give(u, k3, 'bombardiers_barrel');
  const ev3 = []; u.throwBomb(k3, u.enemies[0], bombProc(k3, 'ice_bomb'), ev3);
  const pops = (ev) => ev.filter((x) => x.type === 'proc' && x.itemId === 'bombardiers_barrel').length;
  ok('...goes off: the first bomb now, the ' + bb.count[0] + ' extra bombs come one after another', shots(ev3).length === 1 && pops(ev3) === 1);
  const step = (ms) => { k3.barrelCd -= ms; u.tickDelays(ms, ev3); };
  step(bb.staggerMs);
  ok('...an extra bomb after ' + bb.staggerMs / 1000 + 's, inside the cooldown: no new barrel', shots(ev3).length === 2 && pops(ev3) === 1, `${shots(ev3).length} ${pops(ev3)}`);
  step(bb.cooldownMs - bb.staggerMs);
  ok('...the next one after the ' + bb.cooldownMs / 1000 + 's cooldown can set it off again', shots(ev3).length === 1 + bb.count[0] && pops(ev3) === 2, `${shots(ev3).length} ${pops(ev3)}`);
  const kinds = new Set(shots(ev3).slice(1).map((x) => x.kind));
  ok('...extra bombs are bombs the hero holds', [...kinds].every((kd) => ['iceBomb', 'poisonBomb'].includes(kd)), [...kinds].join());
  let seed = 7; const lcg = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { s: w, k: k4 } = mk(['goblin', 'goblin', 'goblin'], lcg); give(w, k4, 'ice_bomb'); give(w, k4, 'poison_bombs'); give(w, k4, 'bombardiers_barrel');
  const ev4 = []; for (let i = 0; i < 60; i++) { k4.barrelCd = 0; w.throwBomb(k4, w.enemies[0], bombProc(k4, 'ice_bomb'), ev4); k4.barrelCd = 1e9; w.tickDelays(1000, ev4); }
  const extras = ev4.filter((x) => x.type === 'projectile' && x.kind === 'poisonBomb').length;
  ok('...picked at random among them (both kinds can come)', extras > 0 && ev4.filter((x) => x.type === 'projectile' && x.kind === 'iceBomb').length > 60, `${extras} poison bombs`); }
// A real attack: a bomb proc goes through throwBomb (debuff + barrel), Fire Bombs counts as a bomb.
{ const { s, e, k } = mk(); give(s, k, 'electric_bomb'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  ok('An attack proc throws the bomb with its debuff', e.statuses.some((st) => st.type === 'stun') && shots(ev).some((x) => x.kind === 'electricBomb')); }
}

// ================= was items-batch.test.mjs =================
{
// New items batch 4 (session 27): Sweeping Strap (melee swings also hit neighbours), Kinetic Coil (dodges store
// electric charges for the next attack), Sharpest Blade (plain physical attacks may strike the heart: big hit + stun).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin', 'goblin', 'goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const melee = (s) => s.heroes.find((h) => h.damageType === 'melee');
const lost = (e) => 1e7 - e.hp;

// Sweeping Strap: reworked in session 32 (CLEAVE), tested in items-s.test.mjs.
// Kinetic Coil: reworked in session 31 (v2), tested in items-s.test.mjs.
// Sharpest Blade (reworked session 29, user): PURE STEEL only (no element); pure attacks +pureSteel%, every Nth is a
// Heart Strike (multiplier + a share of the enemy's max health, less on a boss, stun); a Heart Strike kill = the next too.
{ const hs = val('sharpest_blade', 'heartStrike'), hm = val('sharpest_blade', 'heartStrikeMult'), hp = val('sharpest_blade', 'heartStrikeMaxHp');
  const hb = val('sharpest_blade', 'heartStrikeBossMaxHp'), ps = val('sharpest_blade', 'pureSteel'), N = hs.percent;
  const plain = (() => { const { s, e } = mk(['goblin']); s.landAttack(melee(s), e, []); return lost(e); })();
  const blade = (extra = []) => { const { s, e, es } = mk(['goblin', 'goblin']); const k = melee(s); give(s, k, 'sharpest_blade'); for (const id of extra) give(s, k, id); return { s, e, es, k }; };
  const hearts = (ev) => ev.filter((x) => x.type === 'proc' && x.itemId === 'sharpest_blade').length;
  { const { s, e, k } = blade(); s.landAttack(k, e, []);
    ok('Sharpest Blade: a pure attack deals +' + ps.percent + '%', Math.abs(lost(e) - plain * (1 + ps.percent / 100)) <= 1, `${plain} -> ${lost(e)}`); }
  { const { s, e, k } = blade(); const ev = [];
    for (let i = 0; i < N - 1; i++) s.landAttack(k, e, ev);
    ok('...no Heart Strike in the first ' + (N - 1) + ' attacks, then the glint says the next one is', hearts(ev) === 0 && s.heartStrikeIn(k) === 0);
    const before = lost(e); s.landAttack(k, e, ev); const dealt = lost(e) - before;
    const want = plain * (1 + ps.percent / 100) * (hm.percent / 100) + (e.maxHp * hp.percent) / 100;
    ok('...attack ' + N + ' is a Heart Strike: ' + hm.percent + '% + ' + hp.percent + '% of max health, and a stun', hearts(ev) === 1 && Math.abs(dealt - want) / want < 0.01 && e.statuses.some((st) => st.type === 'stun'), `${dealt} vs ${want}`);
    ok('...then the count starts again', s.heartStrikeIn(k) === N - 1);
    const hb2 = val('sharpest_blade', 'heartStrikeBreak'), br = e.statuses.find((st) => st.type === 'armorBreak');
    ok('...and it breaks the armor: -' + hb2.percent + '% defense for ' + hb2.spec.durationMs / 1000 + 's', br && br.defensePercent === -hb2.percent && Math.abs(br.remaining - hb2.spec.durationMs) < 1, JSON.stringify(br)); }
  { // The broken armor helps the whole squad: a plain hit from ANOTHER hero on an armored enemy does more.
    const hitOn = (broken) => { const { s, e } = mk(['goblin']); e.stats.defense = 200; const other = s.heroes.find((h) => h.damageType === 'melee');
      if (broken) s.applyStatus(e, { status: 'armorBreak', durationMs: 5000, defenseFlat: 0, defensePercent: -50 }, other, 'test', []);
      s.strike(other, e, [], { basic: true }); return lost(e); };
    ok('...a squad mate hits the broken enemy harder', hitOn(true) > hitOn(false) * 1.1, `${hitOn(false)} -> ${hitOn(true)}`); }
  { const { s, e, k } = blade(); e.def = { ...e.def, boss: true }; for (let i = 0; i < N - 1; i++) s.landAttack(k, e, []);
    const before = lost(e); s.landAttack(k, e, []); const dealt = lost(e) - before;
    const want = plain * (1 + ps.percent / 100) * (hm.percent / 100) + (e.maxHp * hb.percent) / 100;
    ok('...on a boss only ' + hb.percent + '% of max health', Math.abs(dealt - want) / want < 0.01, `${dealt} vs ${want}`); }
  { const { s, es, k } = blade(); for (let i = 0; i < N - 1; i++) s.landAttack(k, es[1], []);
    es[0].hp = 1; const ev = []; s.landAttack(k, es[0], ev);
    ok('...a Heart Strike that kills makes the NEXT attack a Heart Strike too', !es[0].alive && s.heartStrikeIn(k) === 0);
    s.landAttack(k, es[1], ev); ok('...(it is)', hearts(ev) === 2); }
  for (const [why, setup] of [['a charm', (k, s) => give(s, k, 'frost_charm')], ['an elemental attack (like the Mage)', (k) => { k.hitType = 'fire'; }]]) {
    const { s, e, k } = blade(); setup(k, s); const ev = []; for (let i = 0; i < N * 2; i++) s.landAttack(k, e, ev);
    ok('...' + why + ' turns it all off (no Heart Strike, no pure bonus)', hearts(ev) === 0 && s.heartStrikeIn(k) === -1); }
  { const { s, k } = mk(); const h = melee(s); give(s, h, 'sharpest_blade', 2);
    ok('...2 copies: +' + (ps.percent + ps.perExtra) + '% pure, ' + (hm.percent + hm.perExtra) + '%, ' + (hp.percent + hp.perExtra) + '% max health, still every ' + N, h.specials.pureSteel === ps.percent + ps.perExtra && h.specials.heartStrikeMult === hm.percent + hm.perExtra && h.specials.heartStrikeMaxHp === hp.percent + hp.perExtra && h.specials.heartStrike === N); } }
}

// ================= was items-batch.test.mjs =================
{
// New items batch 5 (session 27): Euclid of Elements (2+ element hits may cast 3 more times) and Frozen Demon Head
// (+ice damage, ice damage fills Ice Spikes on the strongest enemy, the holder deals no fire / electric / dark).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin', 'goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const lost = (e) => 1e7 - e.hp;
const flush = (s, ev = []) => { for (let i = 0; i < 20; i++) s.tickDelays(100, ev); return ev; };

// Euclid of Elements: reworked in session 31 (prism burst), tested in items-s.test.mjs.
// Frozen Demon Head
{ const dh = val('frozen_demon_head', 'demonHead'), fill = val('frozen_demon_head', 'demonHeadFill').percent;
  const ice = itemDefs.frozen_demon_head.effects.find((x) => x.damageBonus === 'ice');
  const { s, k } = mk(); give(s, k, 'frozen_demon_head', 2);
  ok('Frozen Demon Head: 2 copies +' + (ice.percent + ice.perExtra) + '% ice damage', Math.abs(k.damageBonus.ice - ice.percent - ice.perExtra) < 1e-9, `${k.damageBonus.ice}`);
  const hit = (type, item = false) => { const { s: t, e, k: h } = mk(); give(t, h, 'frozen_demon_head'); const ev = []; const res = t.strike(h, e, ev, { damageType: type, multiplier: 1, item }); return { res, lost: lost(e), ev }; };
  for (const type of ['fire', 'electric', 'dark']) {
    const own = hit(type); // its own attack / skill (session 29): turned to ice
    ok('...its own ' + type + ' hit lands as ice', own.lost > 0 && own.ev.some((x) => x.type === 'attack' && x.damageType === 'ice'), JSON.stringify(own.ev.filter((x) => x.type === 'attack').map((x) => x.damageType)));
  }
  ok('...melee and ice hits still land', hit('melee').lost > 0 && hit('ice').lost > 0);
  { const { s: t, e, k: h } = mk(); give(t, h, 'frozen_demon_head'); give(t, h, 'kindling'); give(t, h, 'frost_charm'); const res = t.strike(h, e, [], { basic: true, riders: true });
    ok('...charm riders: fire is dropped, ice stays', (res.riders || []).every((rd) => rd.damageType !== 'fire') && (res.riders || []).some((rd) => rd.damageType === 'ice')); }
  // Fill: ice damage of 8x the attack sets off the spikes on the strongest enemy, with a freeze.
  const { s: t, es, k: h } = mk(['goblin', 'goblin']); give(t, h, 'frozen_demon_head', 2);
  es[1].maxHp = 2e7; es[1].hp = 1e7; // the strongest (most max health)
  const ev = [];
  let n = 0; while (!ev.some((x) => x.type === 'iceSpikes') && n++ < 50) t.strike(h, es[0], ev, { damageType: 'ice', multiplier: 1 });
  const spikes = ev.find((x) => x.type === 'iceSpikes');
  ok('...ice damage fills the Head (about ' + fill / 100 + 'x attack): Ice Spikes', !!spikes, `${n} ice hits`);
  ok('...on the strongest enemy, and it is frozen', spikes && spikes.target === es[1] && es[1].statuses.some((st) => st.type === 'freeze'));
  const spikeHit = ev.find((x) => x.type === 'attack' && x.target === es[1]);
  const plainIce = ev.find((x) => x.type === 'attack' && x.target === es[0]).result.amount;
  ok('...2 copies: ' + (dh.percent + dh.perExtra) + '% of attack', spikeHit && Math.abs(spikeHit.result.amount / plainIce - (dh.percent + dh.perExtra) / 100) < 0.05, `${plainIce} -> ${spikeHit && spikeHit.result.amount}`);
  ok('...and the store starts again', (h.iceStore || 0) === 0); }
}
