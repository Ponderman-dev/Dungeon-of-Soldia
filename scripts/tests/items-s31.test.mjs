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
