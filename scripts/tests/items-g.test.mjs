// Phase G item batches G1-G8: the old per-batch test files in one file. Each block below is one old file, with its own helpers.
import fs from 'fs';
import { noPerks, frozenItems, kitsV1 } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { squadSources, dropWeight } from '../../src/systems/rewards.js';

// ================= was items-g.test.mjs =================
{
// Phase G1 (updated built items) and G2 (simple commons). Item defs are the REAL ones from items.json.
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
// Bandage Roll (phase H round 2): every `bandageCureEveryMs` the most hurt hero loses 1 debuff kind (any kind) per roll
// and gets +`bandageArmor` defense per roll for `bandageArmorMs`.
{ const eff = itemDefs.bandage_roll.effects, every = eff.find((e) => e.special === 'bandageCureEveryMs').percent, armor = eff.find((e) => e.special === 'bandageArmor').percent;
  const cure = (rolls) => { const { s, k, h } = mk(['goblin']); give(s, k, 'bandage_roll', rolls);
    h[0].hp = h[0].maxHp * 0.9; h[1].hp = h[1].maxHp * 0.3; h[2].hp = h[2].maxHp * 0.6;
    for (const kind of ['poison', 'poison', 'weaken']) s.applyStatus(h[1], { status: kind, durationMs: 60000, damageMultiplier: 0.001, damageType: 'dark' }, s.enemies[0], 'x', []);
    const def0 = h.map((x) => x.stats.defense); const ev = []; s.tickBandages(k, every - 10, ev); const early = ev.length; s.tickBandages(k, 20, ev);
    return { gained: h.map((x, i) => x.stats.defense - def0[i]), early, left: [...new Set(h[1].statuses.filter((x) => x.type !== 'buff').map((x) => x.type))] }; };
  const one = cure(1), two = cure(2);
  ok('Bandage Roll: nothing before its timer, then the MOST hurt hero is bandaged', one.early === 0 && one.gained[1] > 0 && one.gained[0] === 0 && one.gained[2] === 0, one.gained.join());
  ok('...+' + armor + ' defense', Math.abs(one.gained[1] - armor) < 0.01, `${one.gained[1]}`);
  ok('...and removes 1 debuff kind (the one with most stacks: poison)', one.left.join() === 'weaken', one.left.join());
  ok('...2 rolls: removes 2 kinds (any debuff) and twice the defense', two.left.length === 0 && Math.abs(two.gained[1] - 2 * armor) < 0.01, `${two.left} ${two.gained[1]}`); }
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
  const rw = { ...r('rewards.json'), needsMissingFactor: 0.25 }; const w = (st, id) => dropWeight(itemDefs[id], squadSources(st.heroes, itemDefs), rw);
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
}

// ================= was items-g.test.mjs =================
{
// Phase G3: debuff appliers (real items.json).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99, heroIds = null) => {
  const real = kitsV1(r('heroes.json'));
  const defs = heroIds ? heroIds.map((id) => ({ ...real.find((x) => x.id === id), perk: undefined })) : noPerks(real).slice(0, 3);
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; }
  s.refreshStats();
  for (const u of s.heroes) { u.hp = u.maxHp = 1e6; u.stats.crit = 0; u.stats.evasion = 0; }
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const rate = (id, copies, status, N = 6000, heroIdx = 0, heroIds = null) => {
  const { s, es, h } = mk(['goblin'], Math.random, heroIds); give(s, h[heroIdx], id, copies); s.rng = Math.random; let n = 0;
  for (let i = 0; i < N; i++) { es[0].statuses = []; s.rollProcs(h[heroIdx], 'onAttack', [], { target: es[0], hit: true }); if (es[0].statuses.some((x) => x.type === status)) n++; }
  return n / N;
};
const within = (v, t, tol) => Math.abs(v - t) <= tol;

{ const need = ['ember_charm', 'venom_fang', 'rusty_nails', 'serrated_edge', 'hex_doll', 'dread_bell', 'gag_rune'];
  ok('all 7 G3 items (Fire Arrows removed) exist with a description', need.every((id) => itemDefs[id] && itemDefs[id].description));
  ok('rarities: commons Ember/Venom/Rusty, rares the rest', ['ember_charm', 'venom_fang', 'rusty_nails'].every((i) => itemDefs[i].rarity === 'common') && ['serrated_edge', 'hex_doll', 'dread_bell'].every((i) => itemDefs[i].rarity === 'rare') && itemDefs.gag_rune.rarity === 'epic'); }

// ---- the chance appliers
ok('Ember Charm: 6% Burn per attack', within(rate('ember_charm', 1, 'burn'), 0.06, 0.012));
ok('...2 copies = 12% (each rolls separately)', within(rate('ember_charm', 2, 'burn'), 0.12 - 0.0036, 0.015));
ok('Venom Fang: 8% Poison', within(rate('venom_fang', 1, 'poison'), 0.08, 0.014));
ok('Rusty Nails: 8% Armor Break', within(rate('rusty_nails', 1, 'armorBreak'), 0.08, 0.014));
ok('Hex Doll: 8% Curse', within(rate('hex_doll', 1, 'curse'), 0.08, 0.014));
ok('Dread Bell: 5% Fear', within(rate('dread_bell', 1, 'fear'), 0.05, 0.012));
ok('Serrated Edge: 10% Bleed', within(rate('serrated_edge', 1, 'bleed'), 0.10, 0.015));
ok('...2 copies: ONE roll of 15%', within(rate('serrated_edge', 2, 'bleed', 10000), 0.15, 0.015), `${rate('serrated_edge', 2, 'bleed', 10000)}`);
{ const { s, k } = mk(); give(s, k, 'serrated_edge', 10); const p = k.procs.filter((x) => x.itemId === 'serrated_edge'); ok('...10 copies: one roll of 55%', p.length === 1 && p[0].chance === 55); }
{ const ch = (id, n) => { const { s, k } = mk(); give(s, k, id, n); return k.procs.filter((x) => x.itemId === id).map((x) => x.chance).join(); };
  ok('Hex Doll / Rusty Nails: one roll, 8% +4% per extra (3 = 16%)', ch('hex_doll', 3) === '16' && ch('rusty_nails', 3) === '16');
  ok('Dread Bell: one roll, 5% +3% per extra (3 = 11%)', ch('dread_bell', 3) === '11'); }

// stacking rules
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'venom_fang', 3);
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('3 Venom Fangs = ONE roll per attack: one Poison stack, one popup (user: copies stack into one)', s.stacks(es[0], 'poison') === 1); }
for (const id of ['ember_charm', 'venom_fang', 'thousand_cuts']) {
  const e = itemDefs[id].effects[0]; const { s, k } = mk(['goblin']); give(s, k, id, 3); const p = k.procs.filter((x) => x.itemId === id && x.apply);
  ok(`${itemDefs[id].name}: 3 copies = one proc whose chance grows per copy`, p.length === 1 && p[0].chance === e.chance + 2 * e.chancePerExtra, `${p.map((x) => x.chance)}`); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'rusty_nails', 2); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Armor Break STACKS with every proc hit (2 procs = 2 stacks = -30 defense)', es[0].statuses.filter((x) => x.type === 'armorBreak').length === 2);
  s.tickStatuses(2600, []); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); s.tickStatuses(2600, []);
  ok('...each stack has its own timer (5s): the first two ran out, the newest is still there', es[0].statuses.filter((x) => x.type === 'armorBreak').length === 1); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'hex_doll'); for (let i = 0; i < 4; i++) s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Curse stacks too (4 procs = 4 stacks)', es[0].statuses.filter((x) => x.type === 'curse').length === 4); }
{ const dur = (n) => { const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'dread_bell', n); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); return es[0].statuses.find((x) => x.type === 'fear').total; };
  ok('Dread Bell: fear 1s, +0.2s per extra bell', dur(1) === 1000 && dur(3) === 1400, `${dur(1)} ${dur(3)}`); }
for (const [id, st] of [['ember_charm', 'burn'], ['venom_fang', 'poison'], ['thousand_cuts', 'bleed']]) {
  const stacksOf = (n) => { const { s, es, k } = mk(['goblin'], () => 0); give(s, k, id, n); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); return es[0].statuses.filter((x) => x.type === st).map((x) => x.damage); };
  const pct = itemDefs[id].effects[0].apply[0].damagePerExtraPercent; const one = stacksOf(1), three = stacksOf(3);
  ok(`${itemDefs[id].name}: 3 copies = still ONE ${st} per proc, ${pct}% stronger per extra copy`, three.length === one.length && Math.abs(three[0] / one[0] - (1 + 2 * pct / 100)) < 0.03, `${one} vs ${three}`); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'ember_charm'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: false });
  ok('a missed attack applies nothing', es[0].statuses.length === 0); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'dread_bell'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  es[0].timer = s.interval(es[0]) - 1; const ev = s.update(20);
  ok('Fear makes the enemy skip its attack', s.has(es[0], 'fear') && !ev.some((e) => e.type === 'attackStart' && e.attacker === es[0])); }

// Rogue / Samurai bonus applies to item debuffs
{ const real = kitsV1(r('heroes.json')); const sq = ['rogue', 'knight', 'archer'];
  const rg = rate('venom_fang', 1, 'poison', 12000, 0, sq), kn = rate('venom_fang', 1, 'poison', 12000, 1, sq);
  ok('Rogue: item debuffs 25% likelier (8% -> 10%), others stay 8%', within(rg, 0.10, 0.012) && within(kn, 0.08, 0.012), `${rg} / ${kn}`); }

// Gag Rune
{ const { s, es, k } = mk(['goblin']); give(s, k, 'gag_rune');
  s.applyStatus(es[0], { status: 'stun', durationMs: 1000 }, k, 'x', []);
  const sil = es[0].statuses.find((x) => x.type === 'silence');
  ok('Gag Rune: a stun the holder causes also Silences for 2s', sil && sil.remaining === 2000);
  es[0].statuses = []; s.applyStatus(es[0], { status: 'freeze', durationMs: 1000 }, k, 'x', []); ok('...a freeze too', es[0].statuses.some((x) => x.type === 'silence'));
  es[0].statuses = []; s.applyStatus(es[0], { status: 'poison', durationMs: 1000, damageMultiplier: 1, damageType: 'dark' }, k, 'x', []); ok('...but no silence for other debuffs', !es[0].statuses.some((x) => x.type === 'silence'));
  es[0].statuses = []; s.applyStatus(es[0], { status: 'stun', durationMs: 1000 }, s.heroes[1], 'x', []); ok('...and none when ANOTHER hero stuns', !es[0].statuses.some((x) => x.type === 'silence'));
  give(s, k, 'gag_rune', 2); es[0].statuses = []; s.applyStatus(es[0], { status: 'stun', durationMs: 1000 }, k, 'x', []);
  ok('...3 runes: 4s (+1s per extra copy)', es[0].statuses.find((x) => x.type === 'silence').remaining === 4000); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'chill_band'); give(s, k, 'gag_rune');
  for (let i = 0; i < 5; i++) s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'c', []);
  ok('a freeze from 5 Chill stacks also gags (Chill sources count)', es[0].statuses.some((x) => x.type === 'freeze') && es[0].statuses.some((x) => x.type === 'silence')); }
}

// ================= was items-g.test.mjs =================
{
// Phase G4: debuff payoffs (real items.json).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.health = 1e6; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const dmg = (s, a, t, opts = {}) => s.strike(a, t, [], opts).amount;
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const burn = (s, t, src) => s.applyStatus(t, { status: 'burn', durationMs: 9000, damageMultiplier: 0.001, damageType: 'fire' }, src, 'b', []);
const bleed = (s, t, src) => s.applyStatus(t, { status: 'bleed', durationMs: 9000, damageMultiplier: 0.001 }, src, 'bl', []);
const poison = (s, t, src) => s.applyStatus(t, { status: 'poison', durationMs: 9000, damageMultiplier: 0.001, damageType: 'dark' }, src, 'p', []);

ok('all 9 G4 items exist', ['executioners_axe', 'magma_core', 'shatter_hammer', 'blood_chalice', 'plague_flask', 'exploiters_lens', 'hunters_sigil', 'thousand_cuts', 'frozen_thunderbolt'].every((id) => itemDefs[id] && itemDefs[id].description));

// Executioner's Axe
{ const { s, es, k } = mk(); give(s, k, 'executioners_axe'); const full = dmg(s, k, es[0]); es[0].hp = es[0].maxHp * 0.2; const low = dmg(s, k, es[0]);
  ok('Executioner\'s Axe: +30% damage under 25% health', near(low / full, 1.3), `${full} -> ${low}`);
  es[0].hp = es[0].maxHp * 0.3; ok('...not at 30%', near(dmg(s, k, es[0]) / full, 1)); }
{ const { s, es, k } = mk(); give(s, k, 'executioners_axe', 3); es[0].hp = 1; const x = dmg(s, k, es[0]); const { s: s0, es: e0, k: k0 } = mk(); e0[0].hp = 1; const base = dmg(s0, k0, e0[0]);
  ok('...extra copies add a little less each (30 + 28.5 + 27 = +85.5%)', near(x / base, 1.855, 0.04), `${x / base}`); }
// Magma Core (v2): a sure fire hit on every attack + harder burns
{ const core = itemDefs.magma_core.effects, hit = core.find((e) => e.strike).strike.damageMultiplier, burnPct = core.find((e) => e.special === 'magmaBurn').percent;
  const { s, es, k } = mk(); give(s, k, 'magma_core'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true });
  const fire = ev.filter((e) => e.type === 'attack' && e.attacker === k && e.damageType === 'fire');
  ok('Magma Core: every attack adds ONE fire hit', fire.length === 1, `${fire.length}`);
  const { s: s0, es: e0, k: k0 } = mk(); const plain = dmg(s0, k0, e0[0], { multiplier: hit, damageType: 'fire', item: true });
  ok('...worth the data\'s share of attack', fire[0] && near(fire[0].result.amount, plain, 0.06), `${fire[0] && fire[0].result.amount} vs ${plain}`);
  const burnDmg = (n) => { const { s, es, k } = mk(); give(s, k, 'magma_core', n); s.applyStatus(es[0], { status: 'burn', durationMs: 3000, damageMultiplier: 1, damageType: 'fire' }, k, 'b', []); return es[0].statuses.find((x) => x.type === 'burn').damage; };
  const b0 = burnDmg(0); ok('...burns deal +' + burnPct + '% per core', near(burnDmg(1) / b0, 1 + burnPct / 100, 0.03) && near(burnDmg(2) / b0, 1 + (2 * burnPct) / 100, 0.03), `${b0} ${burnDmg(1)} ${burnDmg(2)}`);
  const { s: s2, es: e2, k: k2 } = mk(); give(s2, k2, 'magma_core'); give(s2, k2, 'kindling'); const ev2 = []; s2.rollProcs(k2, 'onAttack', ev2, { target: e2[0], hit: true });
  ok('...its fire hit MERGES with Kindling\'s (one number)', ev2.filter((e) => e.type === 'attack' && e.attacker === k2 && e.damageType === 'fire').length === 1); }
// Shatter Hammer
{ const { s, es, k } = mk(); give(s, k, 'shatter_hammer'); const clean = dmg(s, k, es[0]);
  s.applyStatus(es[0], { status: 'freeze', durationMs: 5000 }, k, 'f', []); const ev = []; const hit = s.strike(k, es[0], ev, {});
  ok('Shatter Hammer: +85% damage on a frozen enemy', near(hit.amount / clean, 1.85), `${clean} -> ${hit.amount}`);
  ok('...and the hit breaks the freeze', !es[0].statuses.some((x) => x.type === 'freeze') && ev.some((e) => e.type === 'proc' && e.label === 'Shatter!'));
  const again = dmg(s, k, es[0]); ok('...so the next hit is normal damage', near(again / clean, 1)); }
{ const { s, es, k } = mk(); give(s, k, 'shatter_hammer'); give(s, k, 'chill_band'); for (let i = 0; i < 5; i++) s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'c', []);
  ok('(Chill reaching 5 stacks freezes, so Chill sources feed it)', es[0].statuses.some((x) => x.type === 'freeze')); }
// Blood Chalice
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'blood_chalice'); const clean = dmg(s, k, es[0]); bleed(s, es[0], k);
  ok('Blood Chalice: bleeding enemies take +28% damage', near(dmg(s, k, es[0]) / clean, 1.28));
  k.hp = 1000; es[0].hp = 1; s.strike(k, es[0], [], {}); ok('...killing a BLEEDING enemy heals the holder 3%', Math.abs(k.hp - (1000 + k.maxHp * 0.03)) < 5, `${k.hp}`);
  k.hp = 1000; es[1].hp = 1; s.strike(k, es[1], [], {}); ok('...killing a non-bleeding one does not', k.hp === 1000); }
// Plague Flask
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'plague_flask');
  for (let i = 0; i < 5; i++) poison(s, es[0], k); const ev = []; es[0].hp = 1; s.strike(k, es[0], ev, {});
  const got = es.slice(1).map((e) => s.stacks(e, 'poison'));
  ok('Plague Flask: 15% of the poison stacks (5 -> 1, at least 1) spread to ONE other enemy', got.filter((n) => n === 1).length === 1 && got.filter((n) => n === 0).length === 1, got.join()); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask', 4); for (let i = 0; i < 10; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...+15% per extra flask (4 flasks = 60%: 10 stacks -> 6)', s.stacks(es[1], 'poison') === 6, `${s.stacks(es[1], 'poison')}`); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask', 10); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...can pass 100% (10 flasks = 150%: 4 stacks -> 6)', s.stacks(es[1], 'poison') === 6, `${s.stacks(es[1], 'poison')}`); }
{ const pd = itemDefs.plague_flask.effects.find((e) => e.special === 'plaguePoison').percent;
  const dmg = (n) => { const { s, es, k } = mk(['goblin']); give(s, k, 'plague_flask', n); s.applyStatus(es[0], { status: 'poison', durationMs: 9000, damageMultiplier: 20, damageType: 'dark' }, k, 'p', []); return es[0].statuses.find((x) => x.type === 'poison').damage; };
  ok('...its holder\'s poison deals +' + pd + '% per flask', Math.abs(dmg(1) / dmg(0) - (1 + pd / 100)) < 0.02 && Math.abs(dmg(2) / dmg(0) - (1 + (2 * pd) / 100)) < 0.02, `${dmg(0)} ${dmg(1)} ${dmg(2)}`); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'plague_flask', 2); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...+1 enemy per copy (2 copies: both others get 30% of 4 = 1 stack)', es.slice(1).every((e) => s.stacks(e, 'poison') === 1)); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'plague_flask'); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; const ev = [];
  let threw = false; try { s.strike(k, es[0], ev, {}); } catch { threw = true; } ok('...with no other enemy nothing happens (no crash)', !threw); }
{ const { s, es, k, h } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask'); for (let i = 0; i < 4; i++) poison(s, es[0], h[1]); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...only the HOLDER\'s own poison spreads', s.stacks(es[1], 'poison') === 0); }
// Exploiter's Lens
{ const { s, es, k } = mk(); give(s, k, 'exploiters_lens'); const clean = dmg(s, k, es[0]);
  burn(s, es[0], k); bleed(s, es[0], k); ok('Exploiter\'s Lens: nothing with only 2 different debuffs', near(dmg(s, k, es[0]) / clean, 1));
  poison(s, es[0], k); ok('...+42% with 3 different debuffs', near(dmg(s, k, es[0]) / clean, 1.42));
  poison(s, es[0], k); poison(s, es[0], k); ok('...extra stacks of the same kind do not count', near(dmg(s, k, es[0]) / clean, 1.42)); }
// Hunter's Sigil
{ const { s, es, k, h } = mk(['goblin', 'goblin']); give(s, k, 'hunters_sigil'); const before = dmg(s, h[1], es[0]);
  const first = []; s.strike(k, es[0], first, {});
  ok('Hunter\'s Sigil: the first hit on an enemy Marks it', es[0].statuses.some((x) => x.type === 'mark' && x.damageTakenPercent === 14));
  const after = dmg(s, h[1], es[0]); ok('...the whole squad hits it +14% harder', near(after / before, 1.14), `${before} -> ${after}`);
  ok('...the other enemy is not marked yet', !es[1].statuses.some((x) => x.type === 'mark')); s.strike(k, es[1], [], {}); ok('...but is after the holder hits it', es[1].statuses.some((x) => x.type === 'mark')); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'hunters_sigil', 3); s.strike(k, es[0], [], {}); const m = es[0].statuses.find((x) => x.type === 'mark');
  ok('...3 copies: +42% and the mark lasts longer', m.damageTakenPercent === 42 && m.remaining === 10000, `${m.damageTakenPercent} ${m.remaining}`);
  const marks = es[0].statuses.filter((x) => x.type === 'mark').length; s.strike(k, es[0], [], {}); ok('...only one mark per enemy (it is not marked again)', es[0].statuses.filter((x) => x.type === 'mark').length === marks); }
// Thousand Cuts
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Thousand Cuts: a melee hit can apply Bleed, with 1 EXTRA stack (2 stacks)', s.stacks(es[0], 'bleed') === 2, `${s.stacks(es[0], 'bleed')}`); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.applyStatus(es[0], { status: 'bleed', durationMs: 5000, damageMultiplier: 0.1 }, k, 'any', []);
  ok('...EVERY bleed the holder applies gets the extra stack (also from skills)', s.stacks(es[0], 'bleed') === 2); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.applyStatus(es[0], { status: 'bleed', durationMs: 5000, damageMultiplier: 0.1 }, s.heroes[1], 'any', []);
  ok('...but not bleeds from other heroes', s.stacks(es[0], 'bleed') === 1); }
{ const { s, es } = mk(['goblin'], () => 0, ); const ar = new BattleState({ heroDefs: ['archer', 'knight', 'rogue'].map((id) => ({ ...r('heroes.json').find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0 });
  const e = ar.spawnEnemies(['goblin'], 1)[0]; ar.giveItem(ar.heroes[0].uid, 'thousand_cuts'); ar.rollProcs(ar.heroes[0], 'onAttack', [], { target: e, hit: true });
  ok('...a ranged holder does not apply bleed from hits (melee only)', ar.stacks(e, 'bleed') === 0); void s; void es; }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'thousand_cuts'); const mid = es[1]; bleed(s, mid, k); const hp0 = es.map((e) => e.hp); mid.hp = 1; s.strike(s.heroes[1], mid, [], {});
  ok('a bleeding enemy dying bursts knives into the enemies next to it', es[0].hp < hp0[0] && es[2].hp < hp0[2], `${hp0[0] - es[0].hp}`); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'thousand_cuts'); const mid = es[1]; const hp0 = es.map((e) => e.hp); mid.hp = 1; s.strike(s.heroes[1], mid, [], {});
  ok('...no burst if it was not bleeding', es[0].hp === hp0[0] && es[2].hp === hp0[2]); }
{ const burst = (n) => { const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'thousand_cuts', n); bleed(s, es[1], k); const hp = es[0].hp; es[1].hp = 1; s.strike(s.heroes[1], es[1], [], {}); return hp - es[0].hp; };
  ok('...more copies = bigger burst', burst(2) > burst(1) * 1.8); }
// Frozen Thunderbolt: every electric hit adds a small ice hit + 1 Chill; at `thunderShatterAt` Chill (or Frozen) the enemy
// shatters (ice burst on it + its neighbours, the cold is used up)
{ const fx = Object.fromEntries(itemDefs.frozen_thunderbolt.effects.map((e) => [e.special, e.percent]));
  const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); const hp0 = es.map((e) => e.hp);
  const zap = () => { const ev = []; s.strike(k, es[1], ev, { damageType: 'electric', multiplier: 1 }); return ev.filter((e) => e.type === 'attack' && e.damageType === 'ice'); };
  let ice = zap();
  ok(`Frozen Thunderbolt: an electric hit adds a ${fx.thunderIce}% ice hit and 1 Chill`, ice.length === 1 && near(ice[0].result.amount, k.stats.attack * fx.thunderIce / 100, 0.15) && s.stacks(es[1], 'chill') === 1 && es[0].hp === hp0[0]);
  for (let i = 2; i < fx.thunderShatterAt; i++) zap();
  const mid = es.map((e) => e.hp); ice = zap();
  ok(`...at ${fx.thunderShatterAt} Chill it shatters: ice burst on it and both neighbours`, ice.length === 4 && es[0].hp < mid[0] && es[2].hp < mid[2], `${ice.length}`);
  ok(`...each burst is ${fx.frozenThunderbolt}% of attack`, ice.slice(1).every((e) => near(e.result.amount, k.stats.attack * fx.frozenThunderbolt / 100, 0.1)), ice.map((e) => e.result.amount).join());
  ok('...and the chill is used up', s.stacks(es[1], 'chill') === 0);
  s.applyStatus(es[1], { status: 'freeze', durationMs: 2000 }, k, 'test', []); ice = zap();
  ok('...a frozen enemy shatters at once, the freeze ends', ice.length === 4 && !es[1].statuses.some((x) => x.type === 'freeze')); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); const hp0 = es[1].hp; s.strike(k, es[0], [], { damageType: 'fire' });
  ok('...a fire hit does nothing', es[1].hp === hp0 && s.stacks(es[0], 'chill') === 0); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); give(s, k, 'static_crystal');
  s.rng = () => 0.001; const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true });
  ok('Static Crystal bolts set off Frozen Thunderbolt (the one exception to proc depth 1)', es.every((e) => s.stacks(e, 'chill') === 1) && ev.some((e) => e.type === 'attack' && e.damageType === 'ice'));
  const bursts = ev.filter((e) => e.type === 'attack' && e.damageType === 'ice').length; ok('...but a burst never starts another burst (finite)', bursts < 12, `${bursts}`); }
{ const dmg = (n) => { const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'frozen_thunderbolt', n); s.applyStatus(es[0], { status: 'freeze', durationMs: 2000 }, k, 'test', []); const hp0 = es[1].hp; s.strike(k, es[0], [], { damageType: 'electric', multiplier: 1 }); return hp0 - es[1].hp; };
  ok('...burst damage adds up per copy', near(dmg(2) / dmg(1), 2, 0.1)); }
}

// ================= was items-g.test.mjs =================
{
// Phase G5: shield / heal / taunt items (real items.json).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.defense = 0; u.baseStats.health = 10000; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const hitMe = (s, e, u, amount) => { e.stats.attack = amount; const ev = []; s.strike(e, u, ev, {}); return ev; };

ok('all 8 G5 items exist', ['warding_charm', 'overheal_ring', 'spiked_aegis', 'provokers_horn', 'spite_mail', 'martyrs_shield', 'fire_heart', 'lost_clerics_grimoire'].every((id) => itemDefs[id] && itemDefs[id].description));

// Warding Charm
{ const { s, k } = mk(); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'a', []); const base = s.shieldAmount(k);
  give(s, k, 'warding_charm'); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'b', []);
  ok('Warding Charm: shields the holder receives are 20% bigger', s.shieldAmount(k) - base === 120);
  give(s, k, 'warding_charm'); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'c', []); ok('...+20% per copy (2 = +40%)', s.shieldAmount(k) - base - 120 === 140); }

// Vital Band (was Overheal Ring): regen per copy, healing above full health no longer makes a shield
{ const pct = itemDefs.overheal_ring.effects.find((e) => e.special === 'regen').percent;
  const base = (mk().k.specials.regen || 0); const { s, k } = mk(); give(s, k, 'overheal_ring', 2);
  ok('Vital Band: +' + pct + '% regen per copy', Math.abs((k.specials.regen || 0) - base - 2 * pct) < 1e-9, `${k.specials.regen}`);
  k.hp = k.maxHp - 100; s.healUnit(k, 600, [], { aura: false }); ok('...no shield from overhealing', s.shieldAmount(k) === 0); }
{ const { s, k } = mk(); k.hp = k.maxHp - 100; s.healUnit(k, 600, [], { aura: false }); ok('...and none without it either', s.shieldAmount(k) === 0); }

// Spiked Aegis (session 18): while the holder has a shield, MELEE attackers take `shieldThorns`% of their whole hit back
{ const pct = itemDefs.spiked_aegis.effects[0].percent;
  const back = (shield, melee = true, n = 1) => { const { s, es, k } = mk(['goblin']); give(s, k, 'spiked_aegis', n); const e = es[0]; e.hp = e.maxHp = 1e7; e.damageType = melee ? 'melee' : 'ranged';
    if (shield) s.applyStatus(k, { status: 'shield', amount: shield, durationMs: 9000 }, k, 'sh', []); const hp0 = e.hp; hitMe(s, e, k, 1000); return hp0 - e.hp; };
  ok('Spiked Aegis: shielded, a melee attacker takes ' + pct + '% of the hit back (even if the shield soaked it all)', near(back(1e6), 1000 * pct / 100, 0.05), `${back(1e6)}`);
  ok('...also when the hit breaks the shield', near(back(50), 1000 * pct / 100, 0.05));
  ok('...nothing without a shield, nothing for ranged attackers', back(0) === 0 && back(1e6, false) === 0);
  ok('...2 copies reflect twice as much', near(back(1e6, true, 2), 2 * 1000 * pct / 100, 0.05)); }
// Provoker's Horn
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'provokers_horn'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Provoker\'s Horn: any holder gets a 10% taunt chance (the target must attack him)', s.tauntedBy(es[0]) === k); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'provokers_horn'); const clean = s.strike(k, es[0], [], {}).amount; s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, s.heroes[1], 't', []);
  ok('...taunted enemies take +15% damage from the holder', near(s.strike(k, es[0], [], {}).amount / clean, 1.15), ''); }
{ const { s, es, k } = mk(['goblin'], Math.random); give(s, k, 'provokers_horn'); s.rng = Math.random; let n = 0; const N = 8000;
  for (let i = 0; i < N; i++) { es[0].statuses = []; s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); if (es[0].statuses.some((x) => x.type === 'taunt')) n++; }
  ok('...18% chance', Math.abs(n / N - 0.18) < 0.015, `${n / N}`); }
{ const { s, k } = mk(['goblin']); give(s, k, 'provokers_horn', 3); const p = k.procs.filter((x) => x.itemId === 'provokers_horn');
  ok('...more horns: still ONE 18% roll, taunt +0.3s per extra horn, +15% damage per horn', p.length === 1 && p[0].chance === 18 && k.specials.hornDamage === 45); }
{ const real = kitsV1(r('heroes.json')); const s2 = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => ({ ...real.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0 });
  const e = s2.spawnEnemies(['goblin'], 1)[0]; s2.giveItem(s2.heroes[0].uid, 'provokers_horn');
  ok('the Knight adds the Horn to his own Taunt Wall (two taunt rolls)', s2.heroes[0].procs.filter((p) => p.apply && p.apply.some((a) => a.status === 'taunt')).length === 2); void e; }

// Spite Mail
{ const { s, es, k } = mk(['goblin']); give(s, k, 'spite_mail'); const d0 = k.stats.defense;
  ok('Spite Mail: nothing while the holder taunts nobody', k.stats.defense === d0);
  s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, k, 't', []); s.update(20);
  ok('...while he taunts an enemy: +30 defense', k.stats.defense === d0 + 30 && k.taunting);
  ok('...and he reflects melee damage (25%)', (() => { const e = es[0]; e.hp = e.maxHp = 1e9; e.damageType = 'melee'; const hp0 = e.hp; e.stats.attack = 1000; s.strike(e, k, [], {}); return hp0 - e.hp > 0; })());
  es[0].statuses = []; s.update(20); ok('...it ends when the taunt ends', k.stats.defense === d0 && !k.taunting); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'spite_mail', 2); s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, k, 't', []); s.update(20);
  ok('...2 copies: +60 defense', k.stats.defense === 60); }
{ const { s, es, k, h } = mk(['goblin']); give(s, k, 'spite_mail'); s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, h[1], 't', []); s.update(20);
  ok('...a taunt by someone else does not count', !k.taunting); }

// Martyr's Shield (session 18, Bodyguard): an ally under `bodyguardBelow`% health -> the holder takes ALL enemy hits
// on them for `bodyguardMs` (+1s per extra shield), then a `bodyguardCdMs` cooldown.
{ const eff = itemDefs.martyrs_shield.effects, ms = eff.find((e) => e.special === 'bodyguardMs').percent, below = eff.find((e) => e.special === 'bodyguardBelow').percent;
  const { s, es, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield'); const ally = h[2];
  ally.hp = ally.maxHp; const m0 = h[1].hp; hitMe(s, es[0], ally, 10);
  ok('Martyr\'s Shield: no guard while the ally is healthy', ally.hp < ally.maxHp && h[1].hp === m0);
  ally.hp = (ally.maxHp * (below - 5)) / 100; const ev = []; s.afterDamage(ally, ev);
  ok('...ally under ' + below + '%: the holder starts guarding (GUARD icon)', ev.some((e) => e.label === 'Bodyguard!') && ally.statuses.some((x) => x.type === 'guarded'));
  const a1 = ally.hp, m1 = h[1].hp; hitMe(s, es[0], ally, 100); hitMe(s, es[0], ally, 100);
  ok('...EVERY hit on the ally goes to the holder', ally.hp === a1 && h[1].hp < m1);
  for (let t = 0; t < ms + 100; t += 50) s.update(50); const a2 = ally.hp; hitMe(s, es[0], ally, 100);
  ok('...the guard ends after its time', ally.hp < a2);
  const ev2 = []; s.afterDamage(ally, ev2); ok('...and has a cooldown', !ev2.some((e) => e.label === 'Bodyguard!'));
  ok('...+' + eff.find((e) => e.stat === 'defense').flat + ' defense', eff.some((e) => e.stat === 'defense')); }
{ const { s, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield', 3);
  ok('...3 shields guard 2s longer', h[1].specials.bodyguardMs === itemDefs.martyrs_shield.effects.find((e) => e.special === 'bodyguardMs').percent + 2 * itemDefs.martyrs_shield.effects.find((e) => e.special === 'bodyguardMs').perExtra); }

// Fire Heart
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor();
  ok('Fire Heart: a fire shield (20% max health) at the start of the floor', Math.abs(s.shieldAmount(k) - k.maxHp * 0.2) < 2, `${s.shieldAmount(k)}`);
  give(s, k, 'fire_heart'); s.startFloor(); ok('...bigger with more copies (2 = 40%)', Math.abs(s.shieldAmount(k) - k.maxHp * 0.4) < 2); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor(); const full = s.shieldAmount(k); hitMe(s, es[0], k, 1000); const low = s.shieldAmount(k);
  ok('...it blocks damage', k.hp === k.maxHp && low < full);
  ok('...and burns whoever hits it', s.stacks(es[0], 'burn') >= 1);
  for (let t = 0; t < 3000; t += 50) s.update(50); ok('...it slowly regenerates', s.shieldAmount(k) > low); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor(); hitMe(s, es[0], k, 4000); const after = s.shieldAmount(k);
  for (let t = 0; t < 3000; t += 50) s.update(50); ok('...once BROKEN it stays gone (until the next floor)', after === 0 && s.shieldAmount(k) === 0);
  s.spawnEnemies(['goblin'], 2); s.startFloor(); ok('...and comes back on the next floor', s.shieldAmount(k) > 0); }

// Lost Cleric's Grimoire
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire', 2); k.hp = 1000; const hp0 = es[0].hp; const ev = [];
  const got = s.healUnit(k, 500, ev, { aura: false });
  ok('Grimoire: healing is stored as Soul Energy (100% per copy); at 10% max health it fires a green fireball of 350% of the energy', got >= k.maxHp * 0.05 && ev.some((e) => e.type === 'projectile' && e.kind === 'greenfire') && near(hp0 - es[0].hp, got * 2 * 3.5, 0.05) && k.soul === 0, `${hp0 - es[0].hp} vs ${got * 7}`);
  k.hp = k.maxHp; const hp1 = es[0].hp; s.healUnit(k, 500, [], { aura: false }); ok('...a heal at full health does not count', es[0].hp === hp1); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); k.specials.lifesteal = 100; k.hp = 1000; const hp = k.hp;
  s.healUnit(k, 10, [], { aura: false }); ok('...the fireball does no lifesteal (item damage)', k.hp === hp + 10); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); k.hp = 1; const hp0 = es[0].hp; const small = Math.floor(k.maxHp * 0.04);
  const ev = []; s.healUnit(k, small, ev, { aura: false }); s.healUnit(k, small, ev, { aura: false });
  ok('...small heals are stored until the energy reaches 10% (2 x 4%: no fireball yet)', es[0].hp === hp0 && Math.abs(k.soul - small * 2) < 1);
  s.healUnit(k, small, ev, { aura: false }); ok('...the 3rd heal passes 10% and it fires', es[0].hp < hp0 && k.soul === 0);
  s.healUnit(k, Math.floor(k.maxHp * 0.2), ev, { aura: false }); ok('...at most one fireball per 0.1s (the energy waits)', k.soul > 0 && ev.filter((e) => e.kind === 'greenfire').length === 1);
  s.update(120); s.healUnit(k, 1, ev, { aura: false }); ok('...after 0.1s the stored energy fires', ev.filter((e) => e.kind === 'greenfire').length === 2); }
{ const { s, es, k, h } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); h[1].hp = 1; const hp0 = es[0].hp; s.healUnit(h[1], 100, [], { aura: false });
  ok('...a heal on ANOTHER hero does not count for the holder', es[0].hp === hp0); }
}

// ================= was items-g.test.mjs =================
{
// Phase G6: skill items (real items.json): Conductor's Baton, Echo Rune, Metronome.
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroDefs = kitsV1(r('heroes.json')), skills = r('skills.json');
const noCast = Object.fromEntries(Object.entries(skills).map(([id, d]) => [id, { ...d, castMs: 0, ...(d.rotation ? { rotation: d.rotation.map((x) => ({ ...x, castMs: 0 })) } : {}) }]));
const mk = (ids, enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroDefs.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: noCast, rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.health = 10000; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const buff = (u) => u.statuses.find((x) => x.type === 'buff');

ok('all 3 G6 items exist', ['conductors_baton', 'echo_rune', 'metronome'].every((id) => itemDefs[id] && itemDefs[id].description));

// Conductor's Baton
{ const { s, a, h } = mk(['knight', 'rogue', 'archer']); cast(s, a, 'support'); const base = buff(a); const bd = base.remaining, bm = base.mods[0].flat;
  const { s: s2, a: a2 } = mk(['knight', 'rogue', 'archer']); give(s2, a2, 'conductors_baton'); cast(s2, a2, 'support'); const b2 = buff(a2);
  ok('Conductor\'s Baton: support skills 25% stronger (Rally Cry +15 -> +18.75 defense)', near(b2.mods[0].flat / bm, 1.25), `${bm} -> ${b2.mods[0].flat}`);
  ok('...and 25% longer (6s -> 7.5s)', near(b2.remaining / bd, 1.25), `${bd} -> ${b2.remaining}`); }
{ const val = (n) => { const { s, a } = mk(['knight', 'rogue', 'archer']); give(s, a, 'conductors_baton', n); cast(s, a, 'support'); return buff(a).mods[0].flat; };
  const one = val(1) / val(0), two = val(2) / val(0);
  ok('...a second copy adds +15% (+25%, then +40%)', near(one, 1.25) && near(two, 1.4), `${one} ${two}`); }
{ const { s, a, h } = mk(['mage', 'knight', 'rogue']); give(s, a, 'conductors_baton'); cast(s, a, 'support');
  ok('...Arcane Ward: the shield is 25% bigger (and it lasts longer)', near(s.shieldAmount(a), a.stats.attack * 2.5 * 1.25, 0.03), `${s.shieldAmount(a)}`); }
{ const { s, a, h } = mk(['bard', 'knight', 'rogue']); give(s, a, 'conductors_baton'); h.forEach((x) => (x.hp = x.maxHp / 2)); cast(s, a, 'support');
  const st = h[1].statuses.find((x) => x.type === 'regenBoost'); ok('...Ballad of Rest: 25% stronger and longer', near(st.percentMaxHpPerSec, 6.25) && near(st.remaining, 5000)); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer']); give(s, a, 'conductors_baton'); cast(s, a, 'support');
  ok('...also what a support skill puts on ENEMIES (Smoke Bomb\'s blind lasts longer)', near(es[0].statuses.find((x) => x.type === 'blind').remaining, 5000)); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer']); give(s, a, 'conductors_baton'); const hp0 = es[0].hp; cast(s, a, 'attack');
  const dmg = hp0 - es[0].hp; const { s: s2, a: a2, es: e2 } = mk(['rogue', 'knight', 'archer']); const hp1 = e2[0].hp; cast(s2, a2, 'attack');
  ok('...ATTACK skills are not changed', near(dmg / (hp1 - e2[0].hp), 1)); }

// Echo Rune
{ const { s, a, es } = mk(['rogue', 'knight', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const hp0 = es[0].hp;
  const ev = cast(s, a, 'attack'); const hits = ev.filter((e) => e.type === 'attack');
  ok('Echo Rune: a skill can cast twice (the echo hits again)', hits.length === 2 && ev.some((e) => e.type === 'proc' && e.label === 'Echo!'));
  ok('...the echo deals 60% of the original', near(hits[1].result.amount / hits[0].result.amount, 0.6, 0.05), `${hits[0].result.amount} / ${hits[1].result.amount}`);
  ok('...an echo cannot echo again', ev.filter((e) => e.type === 'proc' && e.label === 'Echo!').length === 1); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer'], ['goblin']); give(s, a, 'echo_rune'); s.rng = Math.random; let n = 0; const N = 6000;
  for (let i = 0; i < N; i++) { a.skills[0].cooldownLeft = 0; if (cast(s, a, 'attack').some((e) => e.label === 'Echo!')) n++; }
  ok('...15% chance', Math.abs(n / N - 0.15) < 0.02, `${n / N}`); }
{ const ch = (n) => { const { s, a } = mk(['rogue', 'knight', 'archer']); give(s, a, 'echo_rune', n); return a.specials.echo; };
  ok('...more copies: closer and closer to 90%, no hard stop (1: 15%, 3: about 38%, 20: about 87%)', ch(1) === 15 && Math.abs(ch(3) - 37.9) < 0.5 && ch(20) > 85 && ch(20) < 90, `${ch(3)} ${ch(20)}`); }
{ const power = (n) => { const { s, a } = mk(['rogue', 'knight', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune', n); const h = cast(s, a, 'attack').filter((e) => e.type === 'attack'); return h[1].result.amount / h[0].result.amount; };
  ok('...more copies make the echo stronger, +10% each with no limit (1: 60%, 3: 80%, 8: 130%)', near(power(1), 0.6, 0.05) && near(power(3), 0.8, 0.05) && near(power(8), 1.3, 0.05), `${power(1)} ${power(3)} ${power(8)}`); }
{ const { s, a } = mk(['mage', 'knight', 'rogue'], ['goblin', 'goblin'], () => 0); give(s, a, 'echo_rune');
  const before = s.currentSpell(a, 0).name; const ev = cast(s, a, 'attack'); const after = s.currentSpell(a, 0).name;
  ok('the Mage\'s rotation moves forward only ONCE per cast, and the echo repeats the SAME spell', before === 'Fireball' && after === 'Frost Nova' && ev.filter((e) => e.type === 'cast').every((e) => e.skill.name === 'Fireball') && ev.filter((e) => e.type === 'cast').length === 2); }
{ const { s, a, h, es } = mk(['knight', 'rogue', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const d0 = a.stats.defense; cast(s, a, 'support');
  ok('support skills can echo too (Rally Cry twice, the buff refreshes)', buff(a) && a.stats.defense === d0 + 15); }
{ const { s, a } = mk(['archer', 'knight', 'rogue'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const ev = cast(s, a, 'attack');
  ok('channels (Rain of Arrows) do not echo', !ev.some((e) => e.label === 'Echo!')); }

// Metronome (reworked): its OWN counter, every 4th basic attack of the holder deals +50% per copy.
{ const basics = (n) => { const { s, a, es } = mk(['knight', 'rogue', 'archer']); give(s, a, 'metronome', n); const out = [];
    for (let i = 0; i < 8; i++) { const ev = []; s.landAttack(a, es[0], ev); out.push({ hit: ev.find((e) => e.type === 'attack' && e.basic), pop: ev.some((e) => e.type === 'proc' && e.itemId === 'metronome') }); }
    return out; };
  const one = basics(1), three = basics(3);
  ok('Metronome: attacks 1-3 are normal, the 4th hits +50% and pops the icon', near(one[3].hit.result.amount / one[0].hit.result.amount, 1.5, 0.05) && one[3].pop && !one[0].pop && !one[2].pop, `${one[0].hit.result.amount} -> ${one[3].hit.result.amount}`);
  ok('...and again on the 8th', one[7].pop && near(one[7].hit.result.amount / one[4].hit.result.amount, 1.5, 0.05));
  ok('...+50% per copy (3 copies = +150%)', near(three[3].hit.result.amount / three[0].hit.result.amount, 2.5, 0.05));
  const { s, a, es } = mk(['knight', 'rogue', 'archer']); const ev = []; for (let i = 0; i < 4; i++) s.landAttack(a, es[0], ev);
  ok('...without it nothing happens', !ev.some((e) => e.itemId === 'metronome')); }
}

// ================= was items-g.test.mjs =================
{
// Phase G7: minion items (real items.json).
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroDefs = r('heroes.json');
const mk = (ids = ['knight', 'rogue', 'archer'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroDefs.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(['goblin'], 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.weak = []; e.resists = []; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.health = 10000; u.baseStats.evasion = 0; u.baseStats.defense = 0; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const near = (v, t, tol) => Math.abs(v - t) <= tol;
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const ids = ['rat_cage', 'wisp_lantern', 'fire_imp_brazier', 'mimic_chest', 'gargoyle_idol', 'spirit_knight_banner', 'phoenix_hatchling', 'bone_charm', 'overseers_whistle', 'grave_dust', 'necro_crown'];
ok('all 11 G7 items exist', ids.every((id) => itemDefs[id] && itemDefs[id].description));

// Mimic Chest
{ const { s, es, a } = mk(['knight', 'rogue', 'archer'], () => 0); give(s, a, 'mimic_chest'); s.startFloor([]);
  s.strike(es[0], a, []); ok('Mimic Chest: a hit on the holder can pop out a Mimic', s.minions.some((m) => m.def.id === 'mimic')); }
{ const { s, es, a } = mk(['knight', 'rogue', 'archer'], () => 0.99); give(s, a, 'mimic_chest'); s.strike(es[0], a, []);
  ok('...but not on a bad roll', s.minions.length === 0); }
{ const { s, es, a } = mk(['knight', 'rogue', 'archer'], () => 0); give(s, a, 'mimic_chest'); s.strike(es[0], a, []);
  const m = s.minions[0]; es[0].x = m.x; es[0].y = m.y; const ev = []; const hp = es[0].hp; m.hp = 0; s.killUnit(m, ev, es[0]);
  ok('...and when it dies it explodes', ev.some((e) => e.type === 'minionExplode') && es[0].hp < hp); }

// Phoenix
{ const { s, es, a, h } = mk(); give(s, a, 'phoenix_hatchling'); s.startFloor([]);
  const ph = s.minions.find((m) => m.def.id === 'phoenix'); ok('Phoenix is summoned at fight start', !!ph);
  ph.hp = ph.maxHp / 2; const hp = ph.hp; s.update(1000);
  ok('Phoenix heals itself (regenPercent of max health per second)', near(ph.hp - hp, ph.maxHp * ph.def.regenPercent / 100, 1), `${hp} -> ${ph.hp}`);
  s.landAttack(ph, es[0], []); ok('...its hits Burn', es[0].statuses.some((x) => x.type === 'burn')); }
// Element minions get holderElementShare of their hero's +% for their element; melee minions get none
{ const { s, a } = mk(); give(s, a, 'fire_imp_brazier'); give(s, a, 'kindling', 2); give(s, a, 'spirit_knight_banner'); s.startFloor([]); s.tickSpawner(a, 1e6, []);
  const imp = s.minions.find((m) => m.def.id === 'imp'), kn = s.minions.find((m) => m.def.id === 'spirit_knight');
  ok('Imp: half of its hero\'s +fire damage', near(imp.damageBonus.fire, a.damageBonus.fire * imp.def.holderElementShare, 0.01), JSON.stringify(imp.damageBonus));
  const ev = []; s.landAttack(kn, s.enemies[0], ev);
  ok('Ice Spirit Knight walks in as melee but its hits are ice, no fire bonus', kn.damageType === 'melee' && ev.some((e) => e.type === 'attack' && e.attacker === kn && e.damageType === 'ice') && !kn.damageBonus.fire); }

// Mimic: a bait, never attacks; on its attack turns it taunts the enemies around it
{ const { s, es, a } = mk(); give(s, a, 'mimic_chest'); s.spawnMinion(a, { key: 'mimic_chest', kind: 'weak', capGroup: 'items', spec: { minion: 'mimic' } }, []);
  const mi = s.minions.find((m) => m.def.id === 'mimic'); es[0].x = mi.x + 20; es[0].y = mi.y; const hp = es[0].hp; mi.timer = 1e6;
  s.update(16);
  ok('Mimic deals no damage and taunts the enemy next to it', es[0].hp === hp && es[0].statuses.some((x) => x.type === 'taunt' && x.sourceUid === mi.uid), JSON.stringify(es[0].statuses.map((x) => x.type))); }

// Imp / Gargoyle on-hit statuses
{ const { s, es, a } = mk(); give(s, a, 'fire_imp_brazier'); s.startFloor([]); s.tickSpawner(a, 1e6, []);
  const imp = s.minions.find((m) => m.def.id === 'imp'); s.landAttack(imp, es[0], []);
  ok('Imp hit burns the enemy', es[0].statuses.some((x) => x.type === 'dot' || x.type === 'burn' || x.key?.includes('burn') || x.kind === 'burn') || es[0].statuses.length > 0); }
{ const { s, es, a } = mk(); give(s, a, 'gargoyle_idol'); s.startFloor([]);
  const g = s.minions.find((m) => m.def.id === 'gargoyle'); s.landAttack(g, es[0], []);
  ok('Gargoyle hit taunts the enemy', es[0].statuses.some((x) => x.type === 'taunt')); }

// Necro Crown
{ const { s, es, a } = mk(); give(s, a, 'necro_crown'); const ev = []; es[0].hp = 1; s.strike(a, es[0], ev);
  ok('Necro Crown: a kill raises a skeleton', s.minions.some((m) => m.def.id === 'skeleton')); }
{ const { s, a } = mk(); give(s, a, 'bone_charm'); give(s, a, 'overseers_whistle'); give(s, a, 'rat_cage');
  const b = s.minionBoost(); ok('Boosters register', b.bone > 0 && b.weakCap > 0 && b.weakSpeed > 0); }

// Weak minions are there from the START of the fight (then more on the timer).
{ const { s, a } = mk(); give(s, a, 'rat_cage'); const ev = s.startFloor([]);
  ok('Rat Cage: a Rat is there as soon as the fight starts', s.minions.filter((m) => m.def.id === 'rat').length === 1 && ev.some((e) => e.type === 'minionSpawn'));
  let spawned = 0;
  for (let t = 0; t < 11000; t += 50) spawned += s.update(50).filter((e) => e.type === 'minionSpawn').length;
  ok('...the next one comes after the normal 12s wait', spawned === 0, spawned);
  for (let t = 0; t < 1500; t += 50) spawned += s.update(50).filter((e) => e.type === 'minionSpawn').length;
  ok('...and then it does', spawned === 1, spawned); }

// Stacking rework (phase H, user's picks): Rat Cage / Wisp Lantern / Fire Imp Brazier.
{
  const R = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
  const all = R('heroes.json');
  const mk2 = (id, n) => {
    const s = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((x) => all.find((d) => d.id === x)), enemyDefs: R('enemies.json'), itemDefs: loadItems(R('items.json')), skillDefs: R('skills.json'), minionDefs: R('minions.json'), statusDefs: R('statuses.json'), rules: R('combat.json'), damageTypes: R('damageTypes.json'), leveling: R('leveling.json'), rng: () => 0.5 });
    for (let i = 0; i < n; i++) s.giveItem(s.heroes[0].uid, id);
    s.spawnEnemies(['goblin', 'goblin', 'goblin'], 1); s.placeLines(); s.startFloor();
    return { s, h: s.heroes[0] };
  };
  const r1 = mk2('rat_cage', 1), r6 = mk2('rat_cage', 6);
  ok('Rat Cage: no upkeep at all', r1.s.upkeepCount(r1.h) === 0 && r6.s.upkeepCount(r6.h) === 0);
  ok('...6 cages = 6 rats at the start (cap 4 +1 per extra cage)', r6.s.minions.length === 6, `${r6.s.minions.length}`);
  ok('...copies do NOT make rats stronger', r6.s.minions[0].maxHp === r1.s.minions[0].maxHp);
  const src = (x) => x.h.minionSources.find((q) => q.key === 'rat_cage');
  ok('...each extra cage: rats come 10% sooner (6 cages = 12s / 1.5)', Math.abs(r6.s.spawnDelay(src(r6).spec, 6) - 8000) < 1 && Math.abs(r1.s.spawnDelay(src(r1).spec, 1) - 12000) < 1);
  const w1 = mk2('wisp_lantern', 1), w3 = mk2('wisp_lantern', 3);
  ok('Wisp Lantern: upkeep once (3 lanterns = still half an upkeep)', w3.s.upkeepCount(w3.h) === 0.5);
  ok('...+20% wisp stats per extra lantern', Math.abs(w3.s.minions[0].maxHp / w1.s.minions[0].maxHp - 1.4) < 0.1);
  ok('...1 lantern: no chain; 3 lanterns: 2 jumps at 50%', !w1.s.minions[0].chain && w3.s.minions[0].chain.jumps === 2 && w3.s.minions[0].chain.damageMultiplier === 0.5);
  { const w = w3.s.minions[0]; const es = w3.s.enemies; const ev = []; w3.s.landAttack(w, es[1], ev);
    const hits = ev.filter((e) => e.type === 'attack' && e.result && !e.result.dodged);
    ok('...a wisp bolt hits its target, then jumps to the 2 others', new Set(hits.map((e) => e.target)).size === 3, `${hits.length}`); }
  const i1 = mk2('fire_imp_brazier', 1), i3 = mk2('fire_imp_brazier', 3);
  ok('Fire Imp Brazier: upkeep once, +15% stats per extra brazier', i3.s.upkeepCount(i3.h) === 0.5 && Math.abs(i3.s.minions[0].maxHp / i1.s.minions[0].maxHp - 1.3) < 0.1);
}
}

// ================= was items-g.test.mjs =================
{
// Phase G8: Excalibur (tornado) and Jolly Banner.
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = r('combat.json');
const heroDefs = r('heroes.json');
const mk = (rng = () => 0, enemyIds = ['goblin', 'goblin']) => {
  const s = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => ({ ...heroDefs.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.weak = []; e.resists = []; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.evasion = 0; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
ok('Excalibur and Jolly Banner exist', itemDefs.excalibur && itemDefs.jolly_banner);
{ const { s, a, es } = mk(); s.giveItem(a.uid, 'excalibur'); const ev = [];
  s.landAttack(a, es[0], ev);
  ok('Excalibur: melee attack spawns a tornado', s.tornados.length === 1 && ev.some((e) => e.type === 'tornadoSpawn'));
  const hp = es[0].hp; s.tickTornados(600, []); ok('...it damages its enemy', es[0].hp < hp);
  for (let i = 0; i < 5; i++) s.landAttack(a, es[0], []);
  ok('...max 3 at once', s.tornados.length === 3);
  const e2 = []; s.tickTornados(6000, e2); ok('...they end after 5s', s.tornados.length === 0 && e2.some((e) => e.type === 'tornadoEnd')); }
{ const { s, h, a, es } = mk(); s.giveItem(h[2].uid, 'excalibur'); s.landAttack(h[2], es[0], []);
  ok('...ranged heroes cannot (melee only)', s.tornados.length === 0); }
{ const { s, h, a, es } = mk(); s.giveItem(a.uid, 'jolly_banner'); s.landAttack(a, es[0], []);
  const hasBuff = (u) => u.statuses.some((x) => x.type === 'buff') && u.statuses.some((x) => x.type === 'regenBoost');
  const n = h.filter(hasBuff).length;
  ok('Jolly Banner: holder + one ally get the buff', hasBuff(a) && n === 2, `${n}`);
  ok('...sure crits (crit 100) and faster attacks', a.stats.crit >= 100 && a.stats.attackEfficiency > 100); }
{ const { s, a, es } = mk(); s.giveItem(a.uid, 'jolly_banner'); s.giveItem(a.uid, 'jolly_banner'); s.landAttack(a, es[0], []);
  ok('...a second copy: 2.5s and the chance does not grow', a.statuses.find((x) => x.type === 'buff').remaining > 2400 && a.procs.filter((p) => p.itemId === 'jolly_banner').length === 1); }

// A won floor ends every tornado (they used to keep spinning into the next floor).
{
  const fs2 = await import('fs');
  const rd = (f) => JSON.parse(fs2.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
  const { default: BS } = await import('../../src/systems/BattleState.js');
  const { loadItems: li } = await import('../../src/systems/items.js');
  const s = new BS({ heroDefs: [rd('heroes.json').find((h) => h.id === 'knight')], enemyDefs: rd('enemies.json'), minionDefs: rd('minions.json'), itemDefs: li(rd('items.json')), skillDefs: rd('skills.json'), statusDefs: rd('statuses.json'), rules: rd('combat.json'), damageTypes: rd('damageTypes.json'), leveling: rd('leveling.json') });
  const es = s.spawnEnemies(['goblin'], 1);
  s.spawnTornado(s.heroes[0], li(rd('items.json')).excalibur.effects.find((e) => e.proc && e.tornado).tornado, es[0], []);
  const had = s.tornados.length;
  const ev = s.endFloor();
  console.log(had === 1 && s.tornados.length === 0 && ev.some((e) => e.type === 'tornadoEnd') ? 'PASS' : 'FAIL', 'a won floor ends Excalibur tornadoes (tornadoEnd events)', `${had} -> ${s.tornados.length}`);
}
// A proc on a killing blow or a miss used to pop its icon and do nothing.
{ const { s, a, es } = mk(); s.giveItem(a.uid, 'excalibur'); es[0].hp = 1; const ev = [];
  s.landAttack(a, es[0], ev);
  ok('Excalibur on a KILLING blow still makes a tornado (on the next enemy)', !es[0].alive && s.tornados.length === 1 && s.tornados[0].target === es[1]); }
{ const { s, a, es } = mk(); s.giveItem(a.uid, 'excalibur'); const ev = [];
  s.rollProcs(a, 'onAttack', ev, { target: es[0], hit: false });
  ok('...and on a miss', s.tornados.length === 1); }
{ const { s, a, es } = mk(); s.giveItem(a.uid, 'venom_fang'); const ev = [];
  s.rollProcs(a, 'onAttack', ev, { target: es[0], hit: false });
  ok('a debuff item does not pop its icon when the attack missed', !ev.some((e) => e.type === 'proc'));
  es[0].alive = false; const ev2 = []; s.rollProcs(a, 'onAttack', ev2, { target: es[0], hit: true });
  ok('...or when the enemy is already dead', !ev2.some((e) => e.type === 'proc')); }
}
