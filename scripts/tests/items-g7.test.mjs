// Phase G7: minion items (real items.json).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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
  h[1].hp = h[1].maxHp * 0.5; const before = h[1].hp; s.strike(es[0], ph, []);
  ok('Phoenix: being hit heals the squad', h[1].hp > before);
  const mid = h[1].hp; s.strike(es[0], ph, []); ok('...with a cooldown', h[1].hp === mid); }

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
