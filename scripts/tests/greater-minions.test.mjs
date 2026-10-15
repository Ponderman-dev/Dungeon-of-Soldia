// D4b greater minions + upkeep. Items: `greaterMinion` (one minion, extra copies only make it stronger,
// it stays between floors, nothing heals it after a win, a dead one returns after 2 cleared floors) and
// `minionSpawner` (weak, each copy its own source). While a minion ITEM has a live minion the holder
// pays upkeep (attack speed and defense per minion item). A hero's own spawner costs nothing.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const bonus = () => r('minions.json').gargoyle.copyStatBonus;
const itemDefs = loadItems({
  idol: { name: 'Gargoyle Idol', rarity: 'rare', type: 'special', scope: 'self', effects: [{ greaterMinion: 'gargoyle' }] },
  banner: { name: 'Banner', rarity: 'rare', type: 'special', scope: 'self', effects: [{ greaterMinion: 'gargoyle' }] },
  cage: { name: 'Rat Cage', rarity: 'common', type: 'special', scope: 'self', effects: [{ minionSpawner: { minion: 'skeleton', minMs: 1000, maxMs: 1000, cap: 2, atFloorStart: 1 } }] },
});
const mk = (spawner) => {
  const defs = noPerks(r('heroes.json')).slice(0, 3).map((d, i) => ({ ...d, spawner: i === 2 ? spawner : undefined }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(['goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.timer = -1e12; }
  s.placeLines();
  return { s, es, h: s.heroes, k: s.heroes[0] };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };
const greaters = (s) => s.minions.filter((m) => m.greater);

{ const { s, k } = mk(); s.giveItem(k.uid, 'idol');
  const ev = s.startFloor();
  ok('a greater-minion item summons its minion at the start of the fight', greaters(s).length === 1 && ev.some((e) => e.type === 'minionSpawn' && e.unit.greater && e.holder === k));
  const g = greaters(s)[0];
  ok('it uses its minions.json stats and belongs to the holder', g.maxHp === 140 && g.stats.attack === 7 && g.holderUid === k.uid && g.def.kind === 'greater'); }

{ const { s, k } = mk(); s.giveItem(k.uid, 'idol'); s.giveItem(k.uid, 'idol'); s.giveItem(k.uid, 'idol'); s.startFloor();
  ok('extra copies of the item make NO second minion', greaters(s).length === 1);
  const g = greaters(s)[0]; const b = r('minions.json').gargoyle.copyStatBonus;
  ok('...they only make it stronger (health and attack)', g.maxHp === Math.round(140 * (1 + b * 2)) && g.stats.attack === Math.round(7 * (1 + b * 2)), `${g.maxHp}`);
  const hp = g.hp; s.giveItem(k.uid, 'idol');
  ok('a copy picked up later grows the minion that is already there', g.maxHp === Math.round(140 * (1 + b * 3)) && g.hp > hp); }

{ const { s, k, es } = mk(); s.giveItem(k.uid, 'idol'); s.giveItem(k.uid, 'banner'); s.startFloor();
  ok('two DIFFERENT greater items = two greater minions', greaters(s).length === 2); }

{ const { s, k, es } = mk(); s.giveItem(k.uid, 'idol'); s.startFloor(); const g = greaters(s)[0];
  g.hp = 60; es[0].hp = 0; const evs = []; s.killUnit(es[0], evs);
  s.endFloor(); s.winHeal(rules.winHealPercent);
  ok('a greater minion survives the floor and is NOT healed by the win heal', greaters(s)[0] === g && g.hp === 60);
  s.spawnEnemies(['goblin'], 2); s.startFloor();
  ok('...it is still the same minion on the next floor (no new one, same health)', greaters(s).length === 1 && greaters(s)[0] === g && g.hp === 60);
  g.stats.defense = 0; const bf = g.hp; s.applyStatus(g, { status: 'shield', amount: 10 }, g, 'x', []); ok('buffs and shields work on it', s.shieldAmount(g) === 10); }

{ const { s, k } = mk(); s.giveItem(k.uid, 'idol'); s.startFloor(); const g = greaters(s)[0];
  const ev = []; g.hp = 0; s.killUnit(g, ev);
  ok('a dead greater minion is gone', greaters(s).length === 0 && ev.some((e) => e.type === 'death' && e.unit === g));
  s.endFloor(); s.spawnEnemies(['goblin'], 2); s.startFloor();
  ok('it does NOT come back at the next floor (1 floor cleared so far)', greaters(s).length === 0);
  s.endFloor(); s.spawnEnemies(['goblin'], 3); s.startFloor();
  ok('...it is back at the start of the floor after 2 cleared floors', greaters(s).length === 1 && greaters(s)[0].hp === greaters(s)[0].maxHp);
  s.endFloor(); s.startFloor();
  ok('...and stays one minion', greaters(s).length === 1); }

{ const { s, k } = mk(); s.giveItem(k.uid, 'idol'); s.startFloor(); run(s, 10);
  const ev = []; k.hp = 0; s.killUnit(k, ev);
  ok('a greater minion vanishes when its holder dies', greaters(s).length === 0 && ev.some((e) => e.type === 'minionVanish' && e.reason === 'holderDied')); }

// ---- upkeep
{ const { s, k } = mk(); const a0 = k.stats.attackEfficiency, d0 = k.stats.defense;
  s.giveItem(k.uid, 'idol'); const a1 = k.stats.attackEfficiency;
  ok('an item with no live minion costs nothing yet', a1 === a0 && k.stats.defense === d0);
  s.startFloor();
  ok('upkeep: -12 attack speed while the minion lives', Math.abs(k.stats.attackEfficiency - (a0 + rules.minions.upkeepAttackSpeedPercent)) < 0.001, `${a0} -> ${k.stats.attackEfficiency}`);
  ok('...and -12% defense', Math.abs(k.stats.defense - d0 * (1 + rules.minions.upkeepDefensePercent / 100)) < 0.001);
  const g = greaters(s)[0]; const ev = []; g.hp = 0; s.killUnit(g, ev);
  ok('upkeep stops when the minion dies', k.stats.attackEfficiency === a0 && k.stats.defense === d0); }

{ const { s, k } = mk(); const a0 = k.stats.attackEfficiency;
  s.giveItem(k.uid, 'idol'); s.giveItem(k.uid, 'cage'); s.startFloor();
  ok('two minion items with live minions: greater costs full upkeep, a weak spawner item half', Math.abs(k.stats.attackEfficiency - (a0 + 1.5 * rules.minions.upkeepAttackSpeedPercent)) < 0.001, `${k.stats.attackEfficiency}`);
  s.endFloor();
  ok('after the floor only the greater minion is left: upkeep once', Math.abs(k.stats.attackEfficiency - (a0 + rules.minions.upkeepAttackSpeedPercent)) < 0.001); }

{ const { s, k } = mk(); const a0 = k.stats.attackEfficiency;
  s.giveItem(k.uid, 'cage'); s.giveItem(k.uid, 'cage'); s.startFloor();
  ok('two copies of a weak spawner item: ONE source that spawns 2 minions at a time (2 at the start)', k.minionSources.filter((x) => x.kind === 'weak').length === 1 && s.minions.filter((m) => !m.greater).length === 2);
  run(s, 1050);
  ok('...one shared timer and a shared cap of 4: after the next spawn 4', s.minions.length === 4);
  run(s, 1050);
  ok('...the cap holds (still 4, the oldest are pushed out)', s.minions.length === 4);
  ok('...a weak spawner item pays half an upkeep ONCE, however many copies', Math.abs(k.stats.attackEfficiency - (a0 + 0.5 * rules.minions.upkeepAttackSpeedPercent)) < 0.001, `${k.stats.attackEfficiency}`); }

{ const { s, h } = mk({ minion: 'skeleton', minMs: 1000, maxMs: 1000, cap: 4, atFloorStart: 1 }); const a0 = h[2].stats.attackEfficiency;
  s.startFloor();
  ok('the Necromancer-style hero spawner costs NO upkeep', s.minions.length === 1 && h[2].stats.attackEfficiency === a0); }

{ const { s, h, k } = mk(); s.giveItem(h[1].uid, 'idol'); s.startFloor();
  ok('items give minions only to their holder (the upkeep is the holder\'s)', greaters(s)[0].holderUid === h[1].uid && k.stats.attackEfficiency === s.heroes[0].stats.attackEfficiency && h[1].stats.attackEfficiency < h[1].baseStats.attackEfficiency + 1); }
