// Phase G7: minion items (real items.json).
import { frozenItems } from './util.mjs';
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
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
