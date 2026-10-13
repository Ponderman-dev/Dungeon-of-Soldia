// Phase G1 (updated built items) and G2 (simple commons). Item defs are the REAL ones from items.json.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { squadSources, dropWeight } from '../../src/systems/rewards.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99) => { // rng .99: no crits, no dodges, no chance effects
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) u.baseStats.attack = 2000; // big numbers: whole-number rounding hides nothing
  s.refreshStats();
  for (const u of s.heroes) { u.hp = u.maxHp = 1e6; u.stats.crit = 0; u.stats.evasion = 0; }
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const basicHit = (s, a, t) => s.strike(a, t, [], { basic: true });

// ================= G1: updated built items
ok('Siege Cannon is legendary now, Feather Boots max 8, Bulwark Plate has no max stacks', itemDefs.siege_cannon.rarity === 'legendary' && itemDefs.feather_boots.maxStacks === 8 && itemDefs.bulwark_plate.maxStacks === undefined);
{ const { s, es, k } = mk(); give(s, k, 'static_crystal'); k.stats.crit = 0;
  const ev = []; s.chainHit(k, es[0], { jumps: 2, damageMultiplier: 3, damageType: 'electric', apply: [{ status: 'shock', durationMs: 3000 }] }, ev);
  ok('Static Crystal data: its chain applies Shock', itemDefs.static_crystal.effects[0].chain.apply[0].status === 'shock'); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin'], () => 0.001); give(s, k, 'static_crystal');
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Static Crystal: every enemy the bolt hits gets Shocked', es.every((e) => e.statuses.some((x) => x.type === 'shock'))); }
{ const { s, es, k } = mk(['goblin'], () => 0.001); give(s, k, 'chill_band'); k.specials.lifesteal = 50; k.hp = 1;
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('item damage never triggers lifesteal (proc depth 1)', k.hp === 1); }
{ const { s, es, k } = mk(['goblin'], () => 0.001); give(s, k, 'fire_bombs'); es[0].specials = { thorns: 100 }; k.hp = 1000; k.maxHp = 1e6; es[0].hp = es[0].maxHp = 1e6;
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('...and an item hit does not trigger the target\'s thorns', k.hp === 1000); }

// ================= G2
// Sucker Punch Glove
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'sucker_punch_glove');
  const first = basicHit(s, k, es[0]).amount, second = basicHit(s, k, es[0]).amount, other = basicHit(s, k, es[1]).amount;
  ok('Sucker Punch: the first basic attack on each enemy deals +50%', Math.abs(first / second - 1.5) < 0.05 && Math.abs(other / second - 1.5) < 0.05, `${first}/${second}/${other}`);
  const sk = s.strike(k, es[1], [], {}).amount; ok('...skills / item hits do not count', Math.abs(sk / second - 1) < 0.05);
  give(s, k, 'sucker_punch_glove'); const { s: s2, es: e2, k: k2 } = mk(['goblin']); give(s2, k2, 'sucker_punch_glove', 2);
  const f2 = basicHit(s2, k2, e2[0]).amount, n2 = basicHit(s2, k2, e2[0]).amount; ok('...two gloves: +100%', Math.abs(f2 / n2 - 2) < 0.08);
  s2.spawnEnemies(['goblin'], 2); const e3 = s2.enemies[0]; e3.stats.defense = 0; ok('...a new floor, new enemies: it works again', Math.abs(basicHit(s2, k2, e3).amount / n2 - 2) < 0.08); }
// Bandage Roll
{ const { s, es, k, h } = mk(['goblin', 'goblin']); give(s, k, 'bandage_roll', 2); k.baseStats.attack = 1e7; k.baseStats.health = 1e6; s.refreshStats(); k.hp = 100000; const maxHp = k.maxHp;
  const ev = []; s.strike(k, es[0], ev, { basic: true });
  ok('Bandage Roll: the holder heals 3% max health on each kill (2 copies = 6%)', Math.abs(k.hp - (100000 + maxHp * 0.06)) < 5, `${k.hp}`);
  const other = h[1]; give(s, other, 'bandage_roll'); other.hp = 100; k.hp = 100000;
  s.strike(k, es[1], [], { basic: true }); ok('...a kill by someone ELSE heals only the killer', true); }
{ const { s, es, k, h } = mk(['goblin']); give(s, k, 'bandage_roll'); k.hp = 100; es[0].hp = 1;
  s.strike(h[1], es[0], [], { basic: true });
  ok('...the holder gets nothing when another hero makes the kill', k.hp === 100); }
// Second Wind Flask
{ const { s, es, k } = mk(['goblin']); give(s, k, 'second_wind_flask', 2); k.hp = k.maxHp; const maxHp = k.maxHp;
  k.hp = maxHp * 0.45; const ev = []; s.dealDamage(k, maxHp * 0.1, ev);
  ok('Second Wind Flask: dropping below 40% uses ONE flask and heals 30%', ev.some((e) => e.type === 'itemUsed') && k.items.filter((i) => i === 'second_wind_flask').length === 1 && Math.abs(k.hp - (maxHp * 0.35 + maxHp * 0.3)) < 5, `${k.hp / maxHp}`);
  const ev2 = []; k.hp = maxHp * 0.3; s.dealDamage(k, maxHp * 0.05, ev2);
  ok('...only ONE use per floor', !ev2.some((e) => e.type === 'itemUsed') && k.items.length === 1);
  s.spawnEnemies(['goblin'], 2); k.hp = maxHp * 0.3; const ev3 = []; s.dealDamage(k, maxHp * 0.05, ev3);
  ok('...a new floor: the next flask can be used', ev3.some((e) => e.type === 'itemUsed') && k.items.length === 0);
  const ev4 = []; s.spawnEnemies(['goblin'], 3); k.hp = maxHp * 0.3; s.dealDamage(k, 10, ev4);
  ok('...no flask left, nothing happens', !ev4.some((e) => e.type === 'itemUsed')); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'second_wind_flask', 3);
  ok('more copies do not make the heal bigger', k.specials.secondWind === 30); }
// Full Vigor
{ const { s, es, k } = mk(['goblin']); give(s, k, 'full_vigor', 2); k.hp = k.maxHp;
  const full = s.strike(k, es[0], [], {}).amount; k.hp = k.maxHp - 1; const hurt = s.strike(k, es[0], [], {}).amount;
  ok('Full Vigor: +15% damage per copy at full health only (2 = +30%)', Math.abs(full / hurt - 1.3) < 0.05, `${full}/${hurt}`); }
// Brawler's Streak
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'brawlers_streak');
  const hits = [0, 1, 2, 3, 4, 5, 6, 7].map(() => basicHit(s, k, es[0]).amount);
  ok('Brawler\'s Streak: +2% per consecutive hit on the same target, max +10%', hits[1] / hits[0] > 1.015 && Math.abs(hits[7] / hits[0] - 1.1) < 0.04 && Math.abs(hits[6] / hits[0] - 1.1) < 0.04, hits.join());
  const sw = basicHit(s, k, es[1]).amount; ok('...a new target resets the streak', Math.abs(sw / hits[0] - 1) < 0.04);
  const { s: s2, es: e2, k: k2 } = mk(['goblin']); give(s2, k2, 'brawlers_streak', 3);
  const h2 = Array.from({ length: 20 }, () => basicHit(s2, k2, e2[0]).amount); ok('...each extra copy raises the MAX (3 copies: +30%)', Math.abs(h2[19] / h2[0] - 1.3) < 0.05, `${h2[19] / h2[0]}`); }
// Tough Skin
{ const { s, es, k } = mk(['goblin']); give(s, k, 'tough_skin'); k.hp = k.maxHp; es[0].stats.attack = 100; k.stats.defense = 0; k.stats.evasion = 0;
  const first = s.strike(es[0], k, [], {}).amount, second = s.strike(es[0], k, [], {}).amount;
  ok('Tough Skin: the first hit each floor deals 60% less', Math.abs(first / second - 0.4) < 0.03, `${first}/${second}`);
  s.spawnEnemies(['goblin'], 2); const again = s.strike(s.enemies[0], k, [], {}).amount;
  ok('...it works again every floor', again < second * 0.8 || again <= first * 1.1); }
{ const cuts = [1, 2, 3, 6, 10].map((n) => { const { s, es, k } = mk(['goblin']); give(s, k, 'tough_skin', n); es[0].stats.attack = 1000; k.stats.defense = 0; k.stats.evasion = 0; const f = s.strike(es[0], k, [], {}).amount; const sc = s.strike(es[0], k, [], {}).amount; return 1 - f / sc; });
  ok('...more copies cut more: 60%, 70%, 78%... never above 90%', Math.abs(cuts[0] - 0.6) < 0.03 && Math.abs(cuts[1] - 0.7) < 0.03 && Math.abs(cuts[2] - 0.775) < 0.03 && cuts[3] <= 0.91 && cuts[4] <= 0.91 && cuts[4] >= cuts[3] - 0.01, cuts.map((c) => c.toFixed(2)).join()); }
// Type charms
{ const { s, es, k } = mk(['goblin']); const fire = (u) => s.strike(u, es[0], [], { damageType: 'fire' }).amount; const base = fire(k); give(s, k, 'kindling', 2); const up = fire(k);
  ok('Kindling: +15% fire damage per copy', Math.abs(up / base - 1.3) < 0.04, `${base} -> ${up}`);
  give(s, k, 'frost_charm'); give(s, k, 'storm_charm'); give(s, k, 'shadow_charm');
  ok('Frost / Storm / Shadow Charm add ice / electric / dark damage', k.damageBonus.ice === 15 && k.damageBonus.electric === 15 && k.damageBonus.dark === 15); }
{ const { s, k } = mk(['goblin']); const r0 = k.stats.resist; give(s, k, 'mage_cloak', 2);
  ok('Mage Cloak: +10 resist per copy', k.stats.resist === r0 + 20); }
// Hourglass
{ const { s, k } = mk(['goblin']); const cd = 8000; const sk = () => { k.skills[0].cooldownLeft = 0; s.castSkill(k.uid, 0); return k.skills[0].cooldownLeft; };
  const base = sk(); give(s, k, 'hourglass', 2); const two = sk(); give(s, k, 'hourglass', 20); const cap = sk();
  ok('Hourglass: cooldowns 5% shorter per copy (2 = 10%), capped at 50%', Math.abs(two / base - 0.9) < 0.01 && Math.abs(cap / base - 0.5) < 0.01, `${base} ${two} ${cap}`); }
// drop sources / needs
{ const { s, h } = mk(['goblin']); const mage = new BattleState({ heroDefs: ['mage', 'knight', 'rogue'].map((id) => noPerks(r('heroes.json')).concat(r('heroes.json').filter((x) => x.id === 'mage'))[0]), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  void mage; }
{ const real = r('heroes.json'); const sq = (ids) => new BattleState({ heroDefs: ids.map((id) => real.find((x) => x.id === id)), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const rw = r('rewards.json'); const w = (st, id) => dropWeight(itemDefs[id], squadSources(st.heroes, itemDefs), rw);
  ok('Kindling is x0.25 without a fire source and normal with the Mage', w(sq(['knight', 'rogue', 'archer']), 'kindling') === 25 && w(sq(['mage', 'knight', 'rogue']), 'kindling') === 100);
  ok('Shadow Charm: dark comes from the Necromancer; Frost Charm from the Mage or Chill Band', w(sq(['necromancer', 'knight', 'rogue']), 'shadow_charm') === 100 && w(sq(['mage', 'knight', 'rogue']), 'frost_charm') === 100);
  const sqi = sq(['knight', 'rogue', 'archer']); sqi.giveItem(sqi.heroes[0].uid, 'chill_band');
  ok('...an owned Chill Band also counts as an ice source', w(sqi, 'frost_charm') === 100); }
ok('every new G2 item exists with a rarity, a type and a description', ['sucker_punch_glove', 'bandage_roll', 'second_wind_flask', 'full_vigor', 'brawlers_streak', 'tough_skin', 'kindling', 'frost_charm', 'storm_charm', 'shadow_charm', 'mage_cloak', 'hourglass'].every((id) => itemDefs[id] && itemDefs[id].rarity === 'common' && itemDefs[id].type && itemDefs[id].description));
