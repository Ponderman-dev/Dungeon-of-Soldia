// Phase G1 (updated built items) and G2 (simple commons). Item defs are the REAL ones from items.json.
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { squadSources, dropWeight } from '../../src/systems/rewards.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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
ok('Siege Cannon is legendary, Feather Boots / Lucky Coin / Dice / Totem / Bulwark have no max stacks', itemDefs.siege_cannon.rarity === 'legendary' && ['feather_boots', 'lucky_coin', 'gamblers_dice', 'shield_totem', 'bulwark_plate'].every((id) => itemDefs[id].maxStacks === undefined));
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
// Sucker Punch Glove (session 18): ANY hit (attack, skill, item) on an enemy above `above`% health gets +percent% per glove
{ const eff = itemDefs.sucker_punch_glove.effects[0], pct = eff.percent, above = eff.above;
  const { s, es, k } = mk(['goblin', 'goblin']); const { s: s0, es: e0, k: k0 } = mk(['goblin']);
  for (const e of [...es, ...e0]) { e.hp = e.maxHp = 1e7; }
  const base = basicHit(s0, k0, e0[0]).amount; give(s, k, 'sucker_punch_glove');
  ok('Sucker Punch: a hit on a (nearly) full-health enemy deals +' + pct + '%', Math.abs(basicHit(s, k, es[0]).amount / base - (1 + pct / 100)) < 0.05);
  const skill = s.strike(k, es[0], [], { multiplier: 2 }).amount, skill0 = s0.strike(k0, e0[0], [], { multiplier: 2 }).amount;
  ok('...skills and item hits count too', Math.abs(skill / skill0 - (1 + pct / 100)) < 0.05, `${skill0} -> ${skill}`);
  es[1].hp = es[1].maxHp * (above - 1) / 100; e0[0].hp = e0[0].maxHp * (above - 1) / 100;
  ok('...not once the enemy is under ' + above + '% health', Math.abs(basicHit(s, k, es[1]).amount / basicHit(s0, k0, e0[0]).amount - 1) < 0.05);
  const { s: s2, es: e2, k: k2 } = mk(['goblin']); e2[0].hp = e2[0].maxHp = 1e7; give(s2, k2, 'sucker_punch_glove', 2);
  ok('...two gloves: +' + 2 * pct + '%', Math.abs(basicHit(s2, k2, e2[0]).amount / base - (1 + (2 * pct) / 100)) < 0.08); }
// Bandage Roll (session 18, cure): every `bandageCureEveryMs` the most hurt hero loses 1 bleed/poison/burn kind per roll
// and heals `bandageCure`% of max health per roll.
{ const eff = itemDefs.bandage_roll.effects, every = eff.find((e) => e.special === 'bandageCureEveryMs').percent, pct = eff.find((e) => e.special === 'bandageCure').percent;
  const cure = (rolls) => { const { s, k, h } = mk(['goblin']); give(s, k, 'bandage_roll', rolls);
    h[0].hp = h[0].maxHp * 0.9; h[1].hp = h[1].maxHp * 0.3; h[2].hp = h[2].maxHp * 0.6;
    for (const kind of ['poison', 'poison', 'burn']) s.applyStatus(h[1], { status: kind, durationMs: 60000, damageMultiplier: 0.001, damageType: kind === 'burn' ? 'fire' : 'dark' }, s.enemies[0], 'x', []);
    const before = h.map((x) => x.hp); const ev = []; s.tickBandages(k, every - 10, ev); const early = ev.length; s.tickBandages(k, 20, ev);
    return { gained: h.map((x, i) => x.hp - before[i]), early, max: h[1].maxHp, left: [...new Set(h[1].statuses.map((x) => x.type))] }; };
  const one = cure(1), two = cure(2);
  ok('Bandage Roll: nothing before its timer, then the MOST hurt hero is bandaged', one.early === 0 && one.gained[1] > 0 && one.gained[0] === 0 && one.gained[2] === 0, one.gained.join());
  ok('...heals ' + pct + '% of max health', Math.abs(one.gained[1] - (one.max * pct) / 100) < 1, `${one.gained[1]}`);
  ok('...and removes 1 kind (the one with most stacks: poison)', one.left.join() === 'burn', one.left.join());
  ok('...2 rolls: removes 2 kinds and heals twice as much', two.left.length === 0 && Math.abs(two.gained[1] - (two.max * 2 * pct) / 100) < 1, `${two.left} ${two.gained[1]}`); }
{ const { s, k } = mk(['goblin']); give(s, k, 'bandage_roll'); s.heroes.forEach((x) => (x.hp = x.maxHp)); const ev = []; s.tickBandages(k, 8000, ev);
  ok('...nobody hurt or poisoned: no bandage', !ev.length); }
// Second Wind Flask
{ const { s, es, k } = mk(['goblin']); give(s, k, 'second_wind_flask', 2); k.hp = k.maxHp; const maxHp = k.maxHp;
  k.hp = maxHp * 0.25; const ev0 = []; s.dealDamage(k, maxHp * 0.03, ev0);
  ok('Second Wind Flask: nothing at 22% health (it waits for 20%)', !ev0.some((e) => e.type === 'itemUsed'));
  k.hp = maxHp * 0.25; const ev = []; s.dealDamage(k, maxHp * 0.1, ev);
  ok('Second Wind Flask: dropping below 20% uses ONE flask and heals 80%', ev.some((e) => e.type === 'itemUsed') && k.items.filter((i) => i === 'second_wind_flask').length === 1 && Math.abs(k.hp - Math.min(maxHp, maxHp * 0.15 + maxHp * 0.8)) < 5, `${k.hp / maxHp}`);
  const ev2 = []; k.hp = maxHp * 0.15; s.dealDamage(k, maxHp * 0.05, ev2);
  ok('...only ONE use per floor', !ev2.some((e) => e.type === 'itemUsed') && k.items.length === 1);
  s.spawnEnemies(['goblin'], 2); k.hp = maxHp * 0.15; const ev3 = []; s.dealDamage(k, maxHp * 0.05, ev3);
  ok('...a new floor: the next flask can be used', ev3.some((e) => e.type === 'itemUsed') && k.items.length === 0);
  ok('...the LAST flask still heals a real number (it used to turn health into NaN)', Number.isFinite(k.hp) && k.hp > maxHp * 0.5, `${k.hp}`);
  const ev4 = []; s.spawnEnemies(['goblin'], 3); k.hp = maxHp * 0.15; s.dealDamage(k, 10, ev4);
  ok('...no flask left, nothing happens', !ev4.some((e) => e.type === 'itemUsed')); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'second_wind_flask', 3);
  ok('more copies do not make the heal bigger', k.specials.secondWind === 80); }
// Full Vigor
{ const { s, es, k } = mk(['goblin']); give(s, k, 'full_vigor', 2); k.hp = k.maxHp;
  const full = s.strike(k, es[0], [], {}).amount; k.hp = k.maxHp * 0.91; const high = s.strike(k, es[0], [], {}).amount; k.hp = k.maxHp * 0.89; const hurt = s.strike(k, es[0], [], {}).amount;
  ok('Full Vigor: +15% damage per copy above 90% health (2 = +30%)', Math.abs(full / hurt - 1.3) < 0.05 && Math.abs(high / hurt - 1.3) < 0.05, `${full}/${high}/${hurt}`); }
// Brawler's Streak
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'brawlers_streak');
  const hits = [0, 1, 2, 3, 4, 5, 6, 7].map(() => basicHit(s, k, es[0]).amount);
  ok('Brawler\'s Streak: +2% per hit in a row, max +10%', hits[1] / hits[0] > 1.015 && Math.abs(hits[7] / hits[0] - 1.1) < 0.04 && Math.abs(hits[6] / hits[0] - 1.1) < 0.04, hits.join());
  const sw = basicHit(s, k, es[1]).amount; ok('...switching to another enemy KEEPS the combo', Math.abs(sw / hits[0] - 1.1) < 0.04);
  s.applyStatus(k, { status: 'stun', durationMs: 500 }, es[0], 'test', []); const after = basicHit(s, k, es[1]).amount; ok('...being stunned loses the combo', Math.abs(after / hits[0] - 1) < 0.04);
  const { s: s2, es: e2, k: k2 } = mk(['goblin']); give(s2, k2, 'brawlers_streak', 3);
  const h2 = Array.from({ length: 20 }, () => basicHit(s2, k2, e2[0]).amount); ok('...each extra copy raises the MAX (3 copies: +30%)', Math.abs(h2[19] / h2[0] - 1.3) < 0.05, `${h2[19] / h2[0]}`); }
// Tough Skin
{ const { s, es, k } = mk(['goblin']); give(s, k, 'tough_skin'); k.hp = k.maxHp; es[0].stats.attack = 100; k.stats.defense = 0; k.stats.evasion = 0;
  const first = s.strike(es[0], k, [], {}).amount, second = s.strike(es[0], k, [], {}).amount;
  const { s: s0, es: e0, k: k0 } = mk(['goblin']); e0[0].stats.attack = 100; k0.stats.defense = 0; k0.stats.evasion = 0; const plain = s0.strike(e0[0], k0, [], {}).amount;
  ok('Tough Skin: EVERY hit deals 2 less (not only the first)', first === plain - 2 && second === plain - 2, `${plain} ${first} ${second}`); }
{ const hit = (n, atk) => { const { s, es, k } = mk(['goblin']); if (n) give(s, k, 'tough_skin', n); es[0].stats.attack = atk; k.stats.defense = 0; k.stats.evasion = 0; return s.strike(es[0], k, [], {}).amount; };
  const p = hit(0, 100); ok('...2 less PER COPY (5 copies = 10 less)', hit(5, 100) === p - 10);
  ok('...a hit never drops below 1', hit(50, 3) === 1); }
// Type charms
{ const { s, es, k } = mk(['goblin']); const fire = (u) => s.strike(u, es[0], [], { damageType: 'fire' }).amount; const base = fire(k); give(s, k, 'kindling', 2); const up = fire(k);
  ok('Kindling: +15% fire damage per copy', Math.abs(up / base - 1.3) < 0.04, `${base} -> ${up}`);
  give(s, k, 'frost_charm'); give(s, k, 'storm_charm'); give(s, k, 'shadow_charm');
  ok('Frost / Storm / Shadow Charm add ice / electric / dark damage', k.damageBonus.ice === 15 && k.damageBonus.electric === 15 && k.damageBonus.dark === 15); }
{ const { s, k } = mk(['goblin']); const r0 = k.stats.resist; give(s, k, 'mage_cloak', 2);
  ok('Mage Cloak: +12 resist per copy', k.stats.resist === r0 + 24); }
// Hourglass
{ const { s, k } = mk(['goblin']); const cd = 8000; const sk = () => { k.skills[0].cooldownLeft = 0; s.castSkill(k.uid, 0); return k.skills[0].cooldownLeft; };
  const base = sk(); give(s, k, 'hourglass', 2); const two = sk(); give(s, k, 'hourglass', 20); const cap = sk();
  ok('Hourglass: each copy cuts 5% of what is left (2 = 9.75%, 22 = 67.6%, no hard stop)', Math.abs(two / base - 0.9025) < 0.01 && Math.abs(cap / base - Math.pow(0.95, 22)) < 0.01, `${base} ${two} ${cap}`); }
// drop sources / needs
{ const { s, h } = mk(['goblin']); const mage = new BattleState({ heroDefs: ['mage', 'knight', 'rogue'].map((id) => noPerks(r('heroes.json')).concat(r('heroes.json').filter((x) => x.id === 'mage'))[0]), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  void mage; }
{ const real = r('heroes.json'); const sq = (ids) => new BattleState({ heroDefs: ids.map((id) => real.find((x) => x.id === id)), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const rw = r('rewards.json'); const w = (st, id) => dropWeight(itemDefs[id], squadSources(st.heroes, itemDefs), rw);
  ok('Element charms work for anyone: normal drop weight without a source', ['kindling', 'frost_charm', 'storm_charm', 'shadow_charm'].every((id) => w(sq(['knight', 'rogue', 'archer']), id) === w(sq(['mage', 'knight', 'rogue']), id)));
  ok('Ghastly Fire (needs fire) is x0.25 without a fire source and normal with the Mage', w(sq(['knight', 'rogue', 'archer']), 'ghastly_fire') * 4 === w(sq(['mage', 'knight', 'rogue']), 'ghastly_fire'));
  const sqi = sq(['knight', 'rogue', 'archer']); sqi.giveItem(sqi.heroes[0].uid, 'kindling');
  ok('...an owned Kindling counts as a fire source', w(sqi, 'ghastly_fire') === w(sq(['mage', 'knight', 'rogue']), 'ghastly_fire')); }
// Element charms: every attack adds a small hit of the charm's element (copies merge into one bigger hit), silent
for (const id of ['kindling', 'frost_charm', 'storm_charm', 'shadow_charm']) {
  const type = itemDefs[id].effects.find((e) => e.strike).strike.damageType;
  const one = (n) => { const { s, es, k } = mk(['goblin']); give(s, k, id, n); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true }); return { ev, hits: ev.filter((x) => x.type === 'attack' && x.attacker === k && x.damageType === type) }; };
  const a = one(1), b = one(3);
  ok(`${itemDefs[id].name}: 3 copies = ONE bigger ${type} hit on a basic attack (one number), no popup`, a.hits.length === 1 && b.hits.length === 1 && b.hits[0].result.amount > a.hits[0].result.amount * 2.5 && !b.ev.some((x) => x.type === 'proc'), `${a.hits.map((h) => h.result.amount)} -> ${b.hits.map((h) => h.result.amount)}`);
}
// Different items' sure hits of the SAME element merge too (Frost Charm + Chill Band = one ice hit, bigger than either)
{ const ice = (ids) => { const { s, es, k } = mk(['goblin']); for (const id of ids) give(s, k, id); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true }); return ev.filter((x) => x.type === 'attack' && x.attacker === k && x.damageType === 'ice'); };
  const both = ice(['frost_charm', 'chill_band']), c = ice(['frost_charm']), b = ice(['chill_band']);
  ok('Frost Charm + Chill Band: ONE ice hit worth both', both.length === 1 && both[0].result.amount > c[0].result.amount && both[0].result.amount > b[0].result.amount, `${c[0].result.amount} + ${b[0].result.amount} -> ${both.map((h) => h.result.amount)}`); }
ok('every new G2 item exists with a rarity, a type and a description', ['sucker_punch_glove', 'bandage_roll', 'second_wind_flask', 'full_vigor', 'brawlers_streak', 'tough_skin', 'kindling', 'frost_charm', 'storm_charm', 'shadow_charm', 'mage_cloak', 'hourglass'].every((id) => itemDefs[id] && itemDefs[id].rarity === 'common' && itemDefs[id].type && itemDefs[id].description));
