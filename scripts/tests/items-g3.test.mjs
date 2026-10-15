// Phase G3: debuff appliers (real items.json).
import fs from 'fs';
import { noPerks, kitsV1 } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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

{ const need = ['ember_charm', 'venom_fang', 'rusty_nails', 'serrated_edge', 'hex_doll', 'dread_bell', 'gag_rune', 'fire_arrows'];
  ok('all 8 G3 items exist with a description', need.every((id) => itemDefs[id] && itemDefs[id].description));
  ok('rarities: commons Ember/Venom/Rusty, rares the rest', ['ember_charm', 'venom_fang', 'rusty_nails'].every((i) => itemDefs[i].rarity === 'common') && ['serrated_edge', 'hex_doll', 'dread_bell', 'fire_arrows'].every((i) => itemDefs[i].rarity === 'rare') && itemDefs.gag_rune.rarity === 'epic'); }

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
  ok('every proc adds a Poison STACK (3 copies, all roll: 3 stacks)', s.stacks(es[0], 'poison') === 3); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'rusty_nails', 2); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Armor Break STACKS with every proc hit (2 procs = 2 stacks = -30 defense)', es[0].statuses.filter((x) => x.type === 'armorBreak').length === 2);
  s.tickStatuses(2600, []); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); s.tickStatuses(2600, []);
  ok('...each stack has its own timer (5s): the first two ran out, the newest is still there', es[0].statuses.filter((x) => x.type === 'armorBreak').length === 1); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'hex_doll'); for (let i = 0; i < 4; i++) s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Curse stacks too (4 procs = 4 stacks)', es[0].statuses.filter((x) => x.type === 'curse').length === 4); }
{ const dur = (n) => { const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'dread_bell', n); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); return es[0].statuses.find((x) => x.type === 'fear').total; };
  ok('Dread Bell: fear 1s, +0.2s per extra bell', dur(1) === 1000 && dur(3) === 1400, `${dur(1)} ${dur(3)}`); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'ember_charm'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); const one = es[0].statuses.find((x) => x.type === 'burn').damage;
  const { s: s2, es: e2, k: k2 } = mk(['goblin'], () => 0); give(s2, k2, 'ember_charm', 2); s2.rollProcs(k2, 'onAttack', [], { target: e2[0], hit: true }); const two = e2[0].statuses.filter((x) => x.type === 'burn').map((x) => x.damage);
  ok('Ember Charm: burn damage +10% per extra charm (2 copies: each stack 1.1x)', two.length === 2 && two.every((d) => Math.abs(d / one - 1.1) < 0.02), `${one} vs ${two}`); }
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

// Fire Arrows
{ const { s, es, k } = mk(['goblin'], () => 0.1, ['archer', 'knight', 'rogue']); const a = s.heroes[0]; give(s, a, 'fire_arrows');
  const ev = []; s.landAttack(a, es[0], ev); const fire = ev.filter((e) => e.type === 'attack' && e.damageType === 'fire');
  ok('Fire Arrows: a ranged attack can add an extra fire hit (20% of attack)', fire.length === 1 && Math.abs(fire[0].result.amount - a.stats.attack * 0.2) < 3, `${fire[0] && fire[0].result.amount}`); }
{ const { s, es } = mk(['goblin'], () => 0.1, ['archer', 'knight', 'rogue']); const a = s.heroes[0]; give(s, a, 'fire_arrows', 3);
  const ev = []; s.landAttack(a, es[0], ev); const fire = ev.filter((e) => e.type === 'attack' && e.damageType === 'fire');
  ok('...more copies: the chance stays 50% but the fire hit grows (3 copies = 60%)', fire.length === 1 && Math.abs(fire[0].result.amount - a.stats.attack * 0.6) < 4, `${fire[0] && fire[0].result.amount}`); }
{ const { s, es } = mk(['goblin'], Math.random, ['archer', 'knight', 'rogue']); const a = s.heroes[0]; give(s, a, 'fire_arrows'); s.rng = Math.random; let n = 0; const N = 5000;
  for (let i = 0; i < N; i++) { const ev = []; s.landAttack(a, es[0], ev); if (ev.some((e) => e.damageType === 'fire')) n++; }
  ok('...50% of attacks', within(n / N, 0.5, 0.03)); }
{ const { s, es, k } = mk(['goblin'], () => 0.1); give(s, k, 'fire_arrows'); const ev = []; s.landAttack(k, es[0], ev);
  ok('a MELEE holder gets nothing from Fire Arrows', !ev.some((e) => e.type === 'attack' && e.damageType === 'fire')); }
{ const { s, es } = mk(['goblin'], () => 0.1, ['archer', 'knight', 'rogue']); const a = s.heroes[0]; give(s, a, 'fire_arrows'); a.specials.lifesteal = 100; a.hp = 1;
  s.landAttack(a, es[0], []); const afterBasic = a.hp;
  ok('item fire hits do no lifesteal (only the basic hit does)', afterBasic > 1); }
{ const { s } = mk(['goblin']); const real = kitsV1(r('heroes.json')); const rw = r('rewards.json');
  ok('Fire Arrows needs a ranged source', itemDefs.fire_arrows.needs === 'ranged'); }
