// Phase H item stacking rework (decided item by item with the user, docs/item-decisions.md).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const mk = (enemyIds = ['goblin'], rng = () => 0.5) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const near = (v, t, tol = 0.03) => Math.abs(v / t - 1) < tol;

// Feather Boots / Shield Totem: slowly closer to their limit, no max stacks
{ const ev = (n) => { const { s, k } = mk(); const e0 = k.stats.evasion; give(s, k, 'feather_boots', n); return k.stats.evasion - e0; };
  ok('Feather Boots: +8, then a bit less per pair, closer to 70', ev(1) === 8 && ev(5) < 40 && ev(5) > 30 && ev(30) < 70 && ev(30) > 60, `${ev(5).toFixed(1)} ${ev(30).toFixed(1)}`); }
{ const bl = (n) => { const { s, k } = mk(); give(s, k, 'shield_totem', n); return k.specials.block; };
  ok('Shield Totem: 6%, 6 = 31%, 20 = 67% (towards 90%)', bl(1) === 6 && Math.abs(bl(6) - 30.5) < 0.2 && Math.abs(bl(20) - 67.4) < 0.2, `${bl(6)} ${bl(20)}`); }
// Gambler's Dice: no max, +50% crit damage per die
{ const { s, k } = mk(); give(s, k, 'gamblers_dice', 5); ok('Gambler\'s Dice: 5 dice = +100 crit and +350% crit damage', k.specials.critDamage === 350); }
// Overheal Ring: shield cap +25% per ring
{ const cap = (n) => { const { s, k } = mk(); give(s, k, 'overheal_ring', n); k.hp = k.maxHp; s.healUnit(k, k.maxHp * 10, [], { aura: false }); return s.shieldAmount(k) / k.maxHp; };
  ok('Overheal Ring: shield cap 25% max health per ring (1 = 25%, 4 = 100%)', near(cap(1), 0.25) && near(cap(4), 1), `${cap(1)} ${cap(4)}`); }
// Necro Crown
{ const { s, k } = mk(); give(s, k, 'necro_crown', 2);
  ok('Necro Crown: +20% minion stats per crown (boneCharm), weak minions 50% faster, no cap bonus', s.minionBoost().bone === 40 && s.minionBoost().spawnSpeed === 50 && s.minionBoost().weakCap === 0);
  const { s: s2, k: k2 } = mk(); give(s2, k2, 'necro_crown', 5); ok('...the 50% speed does not grow with crowns', s2.minionBoost().spawnSpeed === 50);
  ok('...rat delay 12s -> 8s', Math.abs(s.spawnDelay({ minMs: 12000 }) - 8000) < 1); }
// Excalibur: 8% per copy (no shrink), +20% tornado damage per extra
{ const { s, k } = mk(); give(s, k, 'excalibur', 3); const p = k.procs.filter((x) => x.itemId === 'excalibur');
  ok('Excalibur: every copy rolls its own 8%', p.length === 3 && p.every((x) => x.chance === 8));
  const ev = []; s.rollProcs(k, 'onAttack', ev, { target: s.enemies[0], hit: true, force: true });
  ok('...3 copies: tornadoes hit +40% harder', s.tornados.length && near(s.tornados[0].spec.damageMultiplier, 0.85 * 1.4), `${s.tornados[0] && s.tornados[0].spec.damageMultiplier}`); }
// Jolly Banner: one roll, 5% +3% per extra
{ const { s, k } = mk(); give(s, k, 'jolly_banner', 3); const p = k.procs.filter((x) => x.itemId === 'jolly_banner'); ok('Jolly Banner: 3 banners = one 11% roll', p.length === 1 && p[0].chance === 11); }
// Mimic Chest: 10% +3% per extra
{ const { s, k } = mk(); give(s, k, 'mimic_chest', 3); ok('Mimic Chest: 3 chests = 16%', k.specials.mimic === 16); }
// Blood Chalice: +20%, then +10% per extra
{ const { s, k } = mk(); give(s, k, 'blood_chalice', 3); ok('Blood Chalice: 3 chalices = +56% vs bleeding', k.specials.bloodChalice === 56); }
// Conductor's Baton: +25%, then +8% per extra
{ const { s, k } = mk(); give(s, k, 'conductors_baton', 3); ok('Conductor\'s Baton: 3 batons = +41%', k.specials.baton === 41); }
// Shatter Hammer: +10% vs chilled (not frozen)
{ const { s, es, k } = mk(); const base = s.strike(k, es[0], [], {}).amount; give(s, k, 'shatter_hammer', 2);
  s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'c', []); const chilled = s.strike(k, es[0], [], {}).amount;
  ok('Shatter Hammer: +14% per hammer vs chilled enemies (2 = +28%)', near(chilled / base, 1.28), `${base} ${chilled}`); }
// Quick Gloves: double hit 8% once
{ const { s, k } = mk(); give(s, k, 'quick_gloves', 4); const p = k.procs.filter((x) => x.itemId === 'quick_gloves'); ok('Quick Gloves: 4 pairs = still one 8% double-hit roll', p.length === 1 && p[0].chance === 8); }
// Static Crystal: 5% per crystal, 2 jumps +1 per extra
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin', 'goblin', 'goblin']); give(s, k, 'static_crystal', 3);
  ok('Static Crystal: 5% per crystal', k.procs.filter((x) => x.itemId === 'static_crystal').every((x) => x.chance === 5));
  const ev = []; s.rollProcs({ ...k, procs: [k.procs.find((x) => x.itemId === 'static_crystal')] }, 'onAttack', ev, { target: es[0], hit: true, force: true });
  const hit = new Set(ev.filter((e) => e.type === 'attack' && e.damageType === 'electric').map((e) => e.target)); ok('...3 crystals: 4 jumps (5 enemies hit)', hit.size === 5, `${hit.size}`); }
// Fire Heart: the shield breaks into a fire nova
{ const { s, es, k } = mk(); give(s, k, 'fire_heart', 2); s.startFloor(); const st = k.statuses.find((x) => x.key === 'shield:fireheart');
  ok('Fire Heart: the shield explodes when broken (70% fire per heart)', st && st.onBreak && near(st.onBreak.damageMultiplier, 1.4) && st.onBreak.damageType === 'fire'); }
// Siege Cannon / Gag Rune / Heart Charm data
ok('Gag Rune is epic now', itemDefs.gag_rune.rarity === 'epic');
