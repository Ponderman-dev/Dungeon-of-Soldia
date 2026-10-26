// Session 31/32 item decisions (docs/item-decisions.md, the '[planned]' sections built in session 33).
// These use the REAL items.json and read every number from it (the frozen fixture keeps the older shapes).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks, plainRules } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const eff = (id, key) => itemDefs[id].effects.find((x) => x.special === key || x.damageBonus === key);
const proc = (id) => itemDefs[id].effects.find((x) => x.proc);
const mk = (enemyIds = ['goblin'], rng = () => 0.99, heroIds = ['knight', 'rogue', 'archer']) => {
  const defs = noPerks(r('heroes.json'));
  const s = new BattleState({ heroDefs: heroIds.map((id) => defs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: plainRules(r('combat.json')), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; u.baseStats.evasion = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const near = (v, t, tol = 0.02) => Math.abs(v / t - 1) < tol;

// ---- batch 1: numbers and small rules ----
// Brawler's Streak: +brawlerStep% per hit in a row, up to brawlerMax.
{ const step = eff('brawlers_streak', 'brawlerStep').percent, max = eff('brawlers_streak', 'brawlerMax').percent;
  const { s, e, k } = mk(); give(s, k, 'brawlers_streak'); const got = [];
  for (let i = 0; i < 8; i++) got.push(s.itemDamageBonus(k, e, { basic: true }));
  ok("Brawler's Streak: +" + step + '% per hit, max +' + max + '%', got[1] === step && got[7] === max, got.join()); }
// Giantslayer's Brand (BIG GAME): bosses AND elites.
{ const b = eff('giantslayers_brand', 'bigGame'); const { s, e, k } = mk(); give(s, k, 'giantslayers_brand', 2);
  const v = () => s.itemDamageBonus(k, e, {});
  const plain = v(); e.elite = { unhit: 0 }; const el = v(); e.elite = null; e.def = { ...e.def, boss: true }; const bo = v();
  ok("Giantslayer's Brand: 0 vs normal, +" + (b.percent + b.perExtra) + '% vs elites and bosses (2 brands)', plain === 0 && el === b.percent + b.perExtra && bo === el, `${plain} ${el} ${bo}`);
  ok('...the boss wind-up part is gone', !k.specials.bossWindup); }
// Heart of the Beast: first copy +10% health and 2% regen, extra copies only flat health + 0.5% regen; x2 when low.
{ const { s, k } = mk(); const base = k.maxHp; give(s, k, 'heart_of_the_beast'); const one = k.maxHp, r1 = k.specials.regen; give(s, k, 'heart_of_the_beast'); const two = k.maxHp, r2 = k.specials.regen;
  const flat = itemDefs.heart_of_the_beast.effects.find((x) => x.stat === 'health' && x.flat).flat;
  ok('Heart of the Beast: 1 copy +' + flat + ' and +10% health, 2% regen', Math.abs(one - (base + flat + base * 0.1)) <= 1 && r1 === 2, `${base} -> ${one}, ${r1}`);
  ok('...2nd copy: only +' + flat + ' health and +0.5% regen', Math.abs(two - one - flat) <= 1 && r2 === 2.5, `${two - one}, ${r2}`);
  const tick = (frac) => { k.hp = Math.round(k.maxHp * frac); const h0 = k.hp; s.update(1000); return (k.hp - h0) / k.maxHp; };
  ok('...DESPERATE: regen x2 below 30% health', near(tick(0.2) / tick(0.6), 2, 0.05), `${tick(0.2)} ${tick(0.6)}`); }
// Heart Charm: +winHeal% on the floor-win heal per charm.
{ const w = eff('heart_charm', 'winHeal').percent; const { s, k } = mk(); give(s, k, 'heart_charm', 2); k.hp = 1;
  s.winHeal(25); ok('Heart Charm: +' + w + '% floor-win heal per charm (25 -> ' + (25 + 2 * w) + '%)', Math.abs(k.hp - 1 - Math.round((k.maxHp * (25 + 2 * w)) / 100)) <= 1, `${k.hp}`);
  ok('...regen ' + eff('heart_charm', 'regen').percent + '%/s per charm', k.specials.regen === 2 * eff('heart_charm', 'regen').percent); }
// Second Wind Flask heals its (new) %.
{ const pct = eff('second_wind_flask', 'secondWind').percent; const { s, k } = mk(); give(s, k, 'second_wind_flask'); k.hp = Math.round(k.maxHp * 0.25);
  s.dealDamage(k, Math.round(k.maxHp * 0.1), []); ok('Second Wind Flask heals ' + pct + '%', near(k.hp / k.maxHp, 0.15 + pct / 100, 0.05), `${(k.hp / k.maxHp).toFixed(2)}`); }
// Catalyst Vial: +dotDamage% to the holder's burns/poison/bleed.
{ const d = eff('catalyst_vial', 'dotDamage').percent; const dot = (n) => { const { s, e, k } = mk(); if (n) give(s, k, 'catalyst_vial', n); s.applyStatus(e, { status: 'bleed', durationMs: 4000, damageMultiplier: 1 }, k, 't', []); return e.statuses.find((x) => x.type === 'bleed').damage; };
  ok('Catalyst Vial: bleed +' + d + '% per vial', near(dot(1), dot(0) * (1 + d / 100)) && near(dot(2), dot(0) * (1 + (2 * d) / 100)), `${dot(0)} ${dot(1)} ${dot(2)}`); }
// Serrated Edge: extra copy = more chance AND more bleed damage.
{ const p = proc('serrated_edge'); const { s, e, k } = mk([ 'goblin' ], () => 0); give(s, k, 'serrated_edge', 3);
  const pr = k.procs.find((x) => x.itemId === 'serrated_edge'); s.rollProcs(k, 'onAttack', [], { target: e, hit: true });
  const b = e.statuses.find((x) => x.type === 'bleed'); const { s: s1, e: e1, k: k1 } = mk(['goblin'], () => 0); give(s1, k1, 'serrated_edge'); s1.rollProcs(k1, 'onAttack', [], { target: e1, hit: true });
  const b1 = e1.statuses.find((x) => x.type === 'bleed');
  ok('Serrated Edge: 3 copies = ' + (p.chance + 2 * p.chancePerExtra) + '% chance, bleed +' + 2 * p.apply[0].damagePerExtraPercent + '%', pr.chance === p.chance + 2 * p.chancePerExtra && near(b.damage, b1.damage * (1 + (2 * p.apply[0].damagePerExtraPercent) / 100), 0.05), `${pr.chance} ${b1.damage} -> ${b.damage}`); }
// Thunderstruck: each extra copy +damagePerExtra to the bolt; it can drop more than once now.
{ const t = proc('thunderstruck').thunderstruck; const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'thunderstruck', 2);
  s.rollProcs(k, 'onAttack', [], { target: e, hit: true }); const th = (s.thunders || [])[0];
  ok('Thunderstruck: 2 copies = ' + Math.round((t.damageMultiplier + t.damagePerExtra) * 100) + '% bolt', th && Math.abs(th.spec.damageMultiplier - (t.damageMultiplier + t.damagePerExtra)) < 1e-9, th && th.spec.damageMultiplier);
  ok('...no longer once per run', !itemDefs.thunderstruck.oncePerRun); }
// Metronome: every Nth basic attack +X%, +perExtra per extra copy.
{ const m = eff('metronome', 'metronome'), every = eff('metronome', 'metronomeEvery').percent; const { s, e, k } = mk(); give(s, k, 'metronome', 2); const got = [];
  for (let i = 0; i < every * 2; i++) got.push(s.metronomeBeat(k, e, []));
  ok('Metronome: every ' + every + 'rd attack, 2 copies +' + (m.percent + m.perExtra) + '%', got[every - 1] === m.percent + m.perExtra && got[every * 2 - 1] === got[every - 1] && got.filter((x) => x).length === 2, got.join()); }
// Soul Lantern: health, attack, attack speed % and FLAT defense.
{ const every = r('combat.json').soulLantern.every; const { s, k } = mk(); give(s, k, 'soul_lantern'); const a0 = k.stats.attackEfficiency, d0 = k.stats.defense;
  for (let i = 0; i < every * 3; i++) s.soulLanternKill(); ok('Soul Lantern: ' + every * 3 + ' kills = +3% attack speed and +3 flat defense', k.lanternGain === 3 && near(k.stats.attackEfficiency, a0 + k.baseStats.attackEfficiency * 0.03, 0.01) && Math.abs(k.stats.defense - d0 - 3) < 1e-6, `${a0}->${k.stats.attackEfficiency} ${d0}->${k.stats.defense}`); }
// Minion upkeep: no defense part any more.
ok('Minion upkeep: the defense part is 0', r('combat.json').minions.upkeepDefensePercent === 0);
// Bombs: Fire Bombs burn; Poison Bombs are NO element (plain damage, plain poison, never in the mix penalty).
{ const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'fire_bombs'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e, hit: true });
  ok('Fire Bombs: the bomb also Burns', e.statuses.some((x) => x.type === 'burn')); }
{ const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'poison_bombs'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e, hit: true });
  const hit = ev.find((x) => x.type === 'attack' && x.target === e); const p = e.statuses.find((x) => x.type === 'poison');
  ok('Poison Bombs: plain (physical) damage and a plain poison', hit && r('damageTypes.json')[hit.damageType].category === 'physical' && p && r('damageTypes.json')[p.damageType].category === 'physical', `${hit && hit.damageType} ${p && p.damageType}`);
  ok('...never counts as an element', !(itemDefs.poison_bombs.provides || []).includes('dark')); }
// Kindling: a chance to Burn.
{ const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'kindling'); s.rollProcs(k, 'onAttack', [], { target: e, hit: true, folded: true });
  ok('Kindling: ' + proc('kindling') && 'Kindling: can Burn on attack', e.statuses.some((x) => x.type === 'burn')); }

// ---- batch 2: elements ----
const lost = (e) => 1e7 - e.hp;
const flush = (s, ev = []) => { for (let i = 0; i < 20; i++) s.tickDelays(100, ev); return ev; };
const per = r('combat.json').elementMix.penaltyPerExtraPercent;
// Fused pairs: Ghastly Fire (fire + dark) and Frozen Thunderbolt (electric + ice) count as one element.
{ const cut = (ids) => { const { s, k } = mk(); for (const id of ids) give(s, k, id); return k.elementCut; };
  ok('Fused pairs: Kindling + Ghastly Fire = 1 element (no cut)', cut(['kindling', 'ghastly_fire']) === 0);
  ok('...+ Frost Charm = 2 elements (-' + per + '%)', cut(['kindling', 'ghastly_fire', 'frost_charm']) === per);
  ok('...Storm Charm + Frozen Thunderbolt = 1 element', cut(['storm_charm', 'frozen_thunderbolt']) === 0);
  ok('...minion items never count', cut(['kindling', 'wisp_lantern']) === 0 && cut(['kindling', 'fire_imp_brazier', 'frost_charm']) === per); }
// Euclid of Elements: +X% per element past the first (negative cut), +perExtra per element per extra copy.
{ const eu = eff('euclid_of_elements', 'euclid'); const c = (n) => { const { s, k } = mk(); for (const id of ['kindling', 'frost_charm', 'storm_charm', 'shadow_charm']) give(s, k, id); give(s, k, 'euclid_of_elements', n); return -k.elementCut; };
  ok('Euclid: 4 elements, 1 copy = +' + 3 * eu.percent + '%, 2 copies = +' + 3 * (eu.percent + eu.perExtra) + '%', c(1) === 3 * eu.percent && c(2) === 3 * (eu.percent + eu.perExtra), `${c(1)} ${c(2)}`); }
{ const fill = eff('euclid_of_elements', 'prismFill').percent, pr = eff('euclid_of_elements', 'prism');
  const { s, es, k } = mk(['goblin', 'goblin'], () => 0.5); give(s, k, 'kindling'); give(s, k, 'frost_charm'); give(s, k, 'euclid_of_elements');
  const ev = []; let n = 0; while (!ev.some((x) => x.label === 'Prism burst!') && n++ < 200) s.landAttack(k, es[0], ev);
  const before = lost(es[1]); const ev2 = flush(s);
  const types = new Set(ev2.filter((x) => x.type === 'attack' && x.target === es[1]).map((x) => x.damageType));
  ok('Euclid PRISM BURST: 2-element hits fill the prism (' + fill + '% of attack), then fire+ice+electric+dark hit EVERY enemy', n < 200 && lost(es[1]) > before && ['fire', 'ice', 'electric', 'dark'].every((t) => types.has(t)), `${n} ${[...types]}`);
  const { s: s2, e: e2, k: k2 } = mk(); give(s2, k2, 'kindling'); give(s2, k2, 'euclid_of_elements'); for (let i = 0; i < 50; i++) s2.landAttack(k2, e2, []);
  ok('...one element never fills it', !k2.prismStore); }
// Ember Charm (BURNING SKIN): + resist, melee attackers burn.
{ const { s, e, k } = mk(); const r0 = k.stats.resist; give(s, k, 'ember_charm'); e.damageType = 'melee'; s.strike(e, k, [], {});
  ok('Ember Charm: +' + itemDefs.ember_charm.effects[0].flat + ' resist, a melee attacker is Burned', k.stats.resist - r0 === itemDefs.ember_charm.effects[0].flat && e.statuses.some((x) => x.type === 'burn'));
  ok('...it is rare now', itemDefs.ember_charm.rarity === 'rare'); }
// Magma Core (ERUPTION): no fire hit; when a Burn ends the enemy explodes.
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'magma_core'); for (const e of es) { e.x = 100; e.y = 100; }
  ok('Magma Core: no fire rider any more', !s.riders(k).length);
  s.applyStatus(es[0], { status: 'burn', durationMs: 1000, damageMultiplier: 0.01, damageType: 'fire' }, k, 't', []);
  const ev = []; for (let t = 0; t < 1200; t += 50) ev.push(...s.update(50));
  ok('...when the Burn ends the enemy ERUPTS and hits its neighbour', ev.some((x) => x.label === 'Eruption!') && lost(es[1]) > 0, `${lost(es[1])}`); }
// Frost Mantle (FROST SKIN): + defense, EVERY melee attacker gets 1 Chill.
{ const { s, e, k } = mk(['goblin'], () => 0.99); const d0 = k.stats.defense; give(s, k, 'frost_mantle'); e.damageType = 'melee';
  for (let i = 0; i < 3; i++) s.strike(e, k, [], {});
  ok('Frost Mantle: +15 defense, every melee hit chills (no roll)', k.stats.defense - d0 === 15 && s.stacks(e, 'chill') === 3, `${s.stacks(e, 'chill')}`); }
// Frozen Demon Head: fire/electric/dark ITEM hits turn to ice at half damage.
{ const pct = eff('frozen_demon_head', 'demonHeadItem').percent;
  const hit = (dh) => { const { s, e, k } = mk(); if (dh) give(s, k, 'frozen_demon_head'); k.damageBonus = {}; e.resists = []; const ev = []; s.strike(k, e, ev, { damageType: 'fire', multiplier: 1, item: true }); return { lost: lost(e), type: (ev.find((x) => x.type === 'attack') || {}).damageType }; };
  const a = hit(false), b = hit(true);
  ok('Frozen Demon Head: a fire ITEM hit lands as ice at ' + pct + '%', b.type === 'ice' && b.lost > 0 && b.lost < a.lost, `${a.lost} -> ${b.lost} ${b.type}`); }
// Chill Band (NUMBING COLD): no ice hit; a chilled enemy deals less.
{ const nc = eff('chill_band', 'numbingCold');
  const { s, e, k } = mk(['goblin'], () => 0.99); give(s, k, 'chill_band', 2);
  ok('Chill Band: no ice rider any more', !s.riders(k).length);
  const dmg = (chill) => { const t = mk(['goblin'], () => 0.99); give(t.s, t.k, 'chill_band', 2); t.e.stats.crit = 0; t.e.stats.attack = 1000; if (chill) t.s.applyStatus(t.e, { status: 'chill', durationMs: 5000 }, t.k, 'x', []); t.k.hp = t.k.maxHp = 1e6; const r1 = t.s.strike(t.e, t.k, [], {}); return r1.amount; };
  ok('...a chilled enemy deals ' + (nc.percent + nc.perExtra) + '% less (2 bands)', near(dmg(true), dmg(false) * (1 - (nc.percent + nc.perExtra) / 100), 0.05), `${dmg(false)} -> ${dmg(true)}`);
  s.landAttack(k, e, []); ok('...every attack still adds 1 Chill', s.stacks(e, 'chill') === 1); }
// Kinetic Coil v2: dodges only, charges kept, at 3 the next attack is a lightning strike.
{ const kc = eff('kinetic_coil', 'kineticCoil'); const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'kinetic_coil', 2);
  k.stats.evasion = 100; s.strike(e, k, [], {}); s.strike(e, k, [], {});
  k.stats.evasion = 0; s.rng = () => 0.99; s.landAttack(k, e, []);
  ok('Kinetic Coil: charges are NOT spent below ' + kc.count, k.floor.coil === 2 && !s.coilReady(k));
  s.rng = () => 0; k.stats.evasion = 100; s.strike(e, k, [], {}); k.stats.evasion = 0;
  ok('...at ' + kc.count + ' charges the weapon is ready', s.coilReady(k));
  s.rng = () => 0.99; const ev = []; const h0 = lost(e); s.landAttack(k, e, ev); const hit = ev.find((x) => x.type === 'attack' && x.attacker === k);
  const rider = hit.result.riders.find((rd) => rd.damageType === 'electric');
  ok('...the next attack is a LIGHTNING strike (+' + (kc.percent + kc.perExtra) + '% electric) and the charges reset', ev.some((x) => x.label === 'Lightning!') && rider && near(rider.amount, k.stats.attack * (kc.percent + kc.perExtra) / 100, 0.05) && k.floor.coil === 0, `${rider && rider.amount}`);
  const { s: b, e: be, k: bk } = mk(['goblin'], () => 0); give(b, bk, 'kinetic_coil'); bk.stats.evasion = 0; bk.specials.block = 100; b.strike(be, bk, [], {});
  ok('...a BLOCK no longer stores a charge', !bk.floor.coil); }
// Reaper's Bell (HAUNTING SPIRITS): no element, a spirit haunts another enemy (weaken, silence, armor break), max 3.
{ const rb = eff('reapers_bell', 'reaperBell'); ok("Reaper's Bell: no element", !(itemDefs.reapers_bell.provides || []).some((t) => ['fire', 'ice', 'electric', 'dark'].includes(t)));
  const { s, es, k } = mk(['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin'], () => 0); give(s, k, 'reapers_bell');
  const ev = []; s.onKill(k, es[0], ev, []);
  const t = es.find((e) => e !== es[0] && e.statuses.some((x) => x.type === 'weaken'));
  ok('...a kill sends a spirit: the haunted enemy is weakened, silenced and armor-broken', t && ['silence', 'armorBreak'].every((x) => t.statuses.some((st) => st.type === x)) && ev.some((x) => x.label === 'Haunt!'));
  for (let i = 0; i < 5; i++) s.onKill(k, es[0], [], []);
  ok('...max ' + eff('reapers_bell', 'hauntMax').percent + ' spirits at once', s.spirits.length === eff('reapers_bell', 'hauntMax').percent && new Set(s.spirits.map((x) => x.target)).size === s.spirits.length);
  const { s: s2, es: es2, k: k2 } = mk(['goblin', 'goblin']); give(s2, k2, 'reapers_bell'); es2[1].def = { ...es2[1].def, boss: true }; s2.rng = () => 0; s2.onKill(k2, es2[0], [], []);
  ok('...a boss is not silenced (the rest still applies)', !es2[1].statuses.some((x) => x.type === 'silence') && es2[1].statuses.some((x) => x.type === 'weaken'));
  const { s: s3, es: es3, k: k3 } = mk(['goblin', 'goblin'], () => 0.99); give(s3, k3, 'reapers_bell'); s3.onKill(k3, es3[0], [], []);
  ok('...' + rb.percent + '% chance (a high roll: nothing)', !s3.spirits.length); }

// ---- batch 3: minions, defense, banners, cleave, fear ----
const M = r('combat.json').minions;
// Overseer's Whistle: +1 weak minion per copy, faster; no health part.
{ const w = eff('overseers_whistle', 'whistleSpeed'); const { s, k } = mk(); give(s, k, 'overseers_whistle', 2); const b = s.minionBoost();
  ok("Overseer's Whistle: 2 copies +2 weak minions, +" + (w.percent + w.perExtra) + '% speed, no health bonus', b.weakCap === 2 && b.weakSpeed === w.percent + w.perExtra && !b.weakHealth, JSON.stringify(b)); }
// Necro Crown: +38% minions, kill skeletons in their own group, max 4 (+2 per extra crown).
{ const c = eff('necro_crown', 'necroCrownSkeletons'); const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'necro_crown');
  ok('Necro Crown: +' + eff('necro_crown', 'boneCharm').percent + '% minion health and attack', s.minionBoost().bone === eff('necro_crown', 'boneCharm').percent);
  for (let i = 0; i < 10; i++) s.onKill(s.heroes[1], es[0], [], []);
  const sk = s.minions.filter((m) => m.capGroup === 'crown');
  ok('...every squad kill raises a skeleton, max ' + c.percent, sk.length === c.percent, `${sk.length}`);
  give(s, k, 'necro_crown'); for (let i = 0; i < 10; i++) s.onKill(s.heroes[1], es[0], [], []);
  ok('...+' + c.perExtra + ' per extra crown', s.minions.filter((m) => m.capGroup === 'crown').length === c.percent + c.perExtra); }
// 6 minions per hero at most (crown skeletons not counted).
{ const { s, k } = mk(); give(s, k, 'rat_cage', 9); give(s, k, 'overseers_whistle', 9); const src = k.minionSources.find((x) => x.key === 'rat_cage');
  for (let i = 0; i < 12; i++) s.spawnMinion(k, src, []);
  ok('At most ' + M.maxPerHero + ' minions per hero', s.minions.filter((m) => m.holderUid === k.uid).length === M.maxPerHero, `${s.minions.length}`); }
// Every minion gets half its holder's matching damage bonus (Rats: +melee).
{ const { s, k } = mk(); give(s, k, 'rat_cage'); give(s, k, 'sharp_edge'); const rat = s.spawnMinion(k, k.minionSources.find((x) => x.key === 'rat_cage'), []);
  ok("Minions get " + M.holderBonusShare * 100 + "% of the holder's +damage for their type (rat: +melee)", near(rat.damageBonus.melee, k.damageBonus.melee * M.holderBonusShare, 0.001), `${rat.damageBonus.melee}`); }
// Element collars: minions hit with that element, the newest collar wins, extra copies +25%.
{ const { s, k } = mk(); give(s, k, 'rat_cage'); give(s, k, 'ember_collar'); const rat = s.spawnMinion(k, k.minionSources.find((x) => x.key === 'rat_cage'), []);
  ok('Ember Collar: the rats hit as fire', rat.hitType === 'fire');
  give(s, k, 'frost_collar'); ok('...a newer Frost Collar wins (ice)', rat.hitType === 'ice');
  give(s, k, 'frost_collar'); ok('...2 Frost Collars: +' + eff('frost_collar', 'collar').percent + '% minion ice damage', near(rat.damageBonus.ice, eff('frost_collar', 'collar').percent, 0.001), `${JSON.stringify(rat.damageBonus)}`);
  ok('...collar text warns it does not stack', /not stack/.test(itemDefs.ember_collar.description)); }
ok('Fire Imp Brazier is rare now', itemDefs.fire_imp_brazier.rarity === 'rare');
// Mimic Chest: only below 50% health.
{ const { s, e, k } = mk(['goblin'], () => 0); give(s, k, 'mimic_chest'); s.onHeroHit(k, []);
  ok('Mimic Chest: nothing above ' + eff('mimic_chest', 'mimic').below + '% health', !s.minions.length);
  k.hp = k.maxHp * 0.3; s.onHeroHit(k, []); ok('...a Mimic below it', s.minions.length === 1); }
// Phoenix: revives once per floor at 50%.
{ const { s, k } = mk(); give(s, k, 'phoenix_hatchling'); const src = k.minionSources.find((x) => x.key === 'phoenix_hatchling'); const ph = s.spawnMinion(k, src, []);
  ph.hp = 0; s.killUnit(ph, []); ok('Phoenix: comes back once per floor at ' + r('minions.json').phoenix.reviveOncePerFloor + '%', ph.alive && near(ph.hp, ph.maxHp * 0.5, 0.05));
  ph.hp = 0; s.killUnit(ph, []); ok('...the second death is for real', !ph.alive); }
// Minion upkeep: per summon item, no defense part; the Shield Totem is free.
{ const { s, k } = mk(); const d0 = k.stats.defense, a0 = k.stats.attackEfficiency; give(s, k, 'gargoyle_idol'); s.spawnMinion(k, k.minionSources.find((x) => x.key === 'gargoyle_idol'), []);
  ok('Upkeep: attack speed only (no defense part)', k.stats.defense === d0 && k.stats.attackEfficiency < a0, `${d0}->${k.stats.defense} ${a0}->${k.stats.attackEfficiency}`); }
// Shield Totem: a greater minion that never attacks, front centre; every hero blocks while it stands; no upkeep.
{ const tb = eff('shield_totem', 'totemBlock'); const { s, es, k, h } = mk(); const a0 = k.stats.attackEfficiency; give(s, k, 'shield_totem', 2);
  const t = s.spawnMinion(k, k.minionSources.find((x) => x.key === 'shield_totem'), []);
  const L = r('combat.json').movement.layout;
  ok('Shield Totem: a totem stands in the front centre', t && t.def.object && Math.abs(t.x - L.width / 2) < 1 && t.y < L.heroY);
  ok('...EVERY hero blocks ' + 2 * tb.percent + '% (2 copies)', h.every((x) => x.specials.block === 2 * tb.percent), h.map((x) => x.specials.block).join());
  ok('...no upkeep', k.stats.attackEfficiency === a0);
  const ev = []; for (let i = 0; i < 40; i++) ev.push(...s.update(50)); ok('...it never attacks', !ev.some((x) => x.type === 'attackStart' && x.attacker === t));
  t.hp = 0; s.killUnit(t, []); ok('...when it falls the block is gone', h.every((x) => !x.specials.block)); }
// Buckler: holder-only block 5% per copy.
{ const b = eff('emergency_buckler', 'block'); const { s, k, h } = mk(); give(s, k, 'emergency_buckler', 3);
  ok('Buckler: ' + 3 * b.percent + '% block with 3 (holder only), no kill shield', k.specials.block === 3 * b.percent && !h[1].specials.block && !k.specials.killShield && itemDefs.emergency_buckler.name === 'Buckler'); }
// Spite Mail: no reflect; while taunting +defense +resist and heals per hit taken.
{ const { s, es, k } = mk(); give(s, k, 'spite_mail'); const r0 = k.stats.resist; s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, k, 't', []); s.tickTaunting(k);
  ok('Spite Mail: taunting = +' + eff('spite_mail', 'spiteResist').percent + ' resist too', k.taunting && k.stats.resist - r0 === eff('spite_mail', 'spiteResist').percent);
  k.hp = Math.round(k.maxHp / 2); es[0].stats.attack = 1; const ev = []; s.strike(es[0], k, ev, {});
  ok('...a hit taken heals ' + eff('spite_mail', 'spiteHeal').percent + '% max health', ev.some((x) => x.type === 'heal' && x.unit === k), ev.map((x) => x.type).join());
  ok('...no reflect', !k.specials.spiteReflect); }
// War Banner: steady squad attack speed aura.
{ const w = itemDefs.war_banner.effects[0].percent; const { s, k, h } = mk(); const a = h.map((x) => x.stats.attackEfficiency); give(s, k, 'war_banner', 2);
  ok('War Banner: the whole squad +' + 2 * w + '% attack speed (2 copies)', h.every((x, i) => near(x.stats.attackEfficiency, a[i] + x.baseStats.attackEfficiency * 0.02 * w * (s.squadItemMult ? s.squadItemMult() : 1), 0.02)), h.map((x, i) => `${a[i]}->${x.stats.attackEfficiency}`).join()); }
// Conqueror's Flag: the holder's kills heal the OTHER heroes.
{ const c = eff('conquerors_flag', 'conqueror'); const { s, es, k, h } = mk(); give(s, k, 'conquerors_flag'); for (const x of h) x.hp = Math.round(x.maxHp / 2);
  const k0 = k.hp, o0 = h[1].hp; s.onKill(k, es[0], [], []);
  ok("Conqueror's Flag: a kill heals the others " + c.percent + '%, not the holder', k.hp === k0 && Math.abs(h[1].hp - o0 - (h[1].maxHp * c.percent) / 100) <= 1, `${h[1].hp - o0}`);
  const o1 = h[1].hp; s.onKill(h[2], es[0], [], []); ok("...another hero's kill: nothing", h[1].hp === o1); }
// Sweeping Strap (CLEAVE): every 3rd melee attack hits all enemies in front.
{ const sw = eff('sweeping_strap', 'sweep'), every = eff('sweeping_strap', 'sweepEvery').percent;
  const { s, es, k } = mk(['goblin', 'goblin', 'goblin'], () => 0.99); give(s, k, 'sweeping_strap', 2); k.damageType = 'melee';
  for (const e of es) { e.x = k.x; e.y = k.y - 40; }
  const hits = []; for (let i = 0; i < every; i++) { const ev = []; s.landAttack(k, es[0], ev); hits.push(ev.some((x) => x.type === 'sweep')); }
  ok('Cleave: only every ' + every + 'rd melee attack', hits.join() === [...Array(every - 1).fill(false), true].join(), hits.join());
  ok('...it hits every enemy in front for ' + (sw.percent + sw.perExtra) + '%', lost(es[1]) > 0 && lost(es[2]) > 0 && near(lost(es[1]), lost(es[0]) / every * (sw.percent + sw.perExtra) / 100, 0.1), `${lost(es[0])} ${lost(es[1])}`);
  es[2].y = k.y + 80; s.landAttack(k, es[0], []); s.landAttack(k, es[0], []); const b2 = lost(es[2]); s.landAttack(k, es[0], []);
  ok('...not one behind the hero', lost(es[2]) === b2); }
// Dread Bell (FEAR RING): target + neighbours feared, 3s cooldown, bosses immune.
{ const fr = eff('dread_bell', 'fearRing'); const { s, es, k } = mk(['goblin', 'goblin', 'goblin'], () => 0); give(s, k, 'dread_bell', 2);
  es[0].x = es[1].x = 100; es[0].y = es[1].y = 100; es[2].x = 300; es[2].y = 100; s.floorMs = 0;
  s.landAttack(k, es[0], []); const f = (e) => e.statuses.find((x) => x.type === 'fear');
  ok('Fear Ring: the target and its neighbour are Feared, a far one is not', f(es[0]) && f(es[1]) && !f(es[2]));
  ok('...2 copies: ' + (fr.spec.durationMs + fr.spec.durationPerCopyMs) + 'ms', f(es[0]).total === fr.spec.durationMs + fr.spec.durationPerCopyMs);
  for (const e of es) e.statuses = []; s.landAttack(k, es[0], []); ok('...then a ' + fr.cooldownMs / 1000 + 's cooldown', !f(es[0]));
  s.floorMs = fr.cooldownMs + 1; s.landAttack(k, es[0], []); ok('...ready again after it', !!f(es[0]));
  const bosses = Object.values(r('enemies.json')).filter((e) => e.boss); ok('...every boss is immune to fear', bosses.length && bosses.every((b) => (b.statusImmune || []).includes('fear'))); }
