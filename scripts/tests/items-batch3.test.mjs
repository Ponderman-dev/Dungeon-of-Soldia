// New items batch 3 (session 27): the bomb family (Ice / Electric / Dark / Poison Bombs, like Fire Bombs + a debuff)
// and Bombardier's Barrel (+bomb damage, sometimes throws 2-4 more bombs of the kinds the holder has).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const mk = (ids = ['goblin', 'goblin', 'goblin'], rng = () => 0) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const bombProc = (k, id) => k.procs.find((p) => p.itemId === id);
const shots = (ev) => ev.filter((x) => x.type === 'projectile');

// Every bomb: same chance / damage as Fire Bombs, its own element, its own debuff on the enemy it hits.
const fire = itemDefs.fire_bombs.effects[0];
for (const [id, status] of [['ice_bomb', 'chill'], ['electric_bomb', 'stun'], ['dark_bomb', 'weaken'], ['poison_bombs', 'poison']]) {
  const def = itemDefs[id].effects[0];
  ok(itemDefs[id].name + ': ' + def.chance + '% chance, ' + def.strike.damageMultiplier * 100 + '% like Fire Bombs', def.chance === fire.chance && def.strike.damageMultiplier === fire.strike.damageMultiplier && def.bomb);
  const { s, e, k } = mk(); give(s, k, id, 2);
  ok('...one roll per copy (2 copies = 2 procs)', k.procs.filter((p) => p.itemId === id).length === 2);
  const ev = []; s.throwBomb(k, e, bombProc(k, id), ev);
  const want = def.strike.apply[0];
  const count = e.statuses.filter((st) => st.type === status).length;
  ok('...hits for ' + def.strike.damageMultiplier * 100 + '% ' + def.strike.damageType + ' and puts ' + (want.stacks || 1) + ' ' + status + ' on it', e.hp === 1e7 - 300 && count === (want.stacks || 1), `${1e7 - e.hp} ${count}`);
  ok('...with its own bomb look', shots(ev).some((x) => x.kind === def.strike.projectile));
}
{ const { s, e, k } = mk(); give(s, k, 'dark_bomb'); s.throwBomb(k, e, bombProc(k, 'dark_bomb'), []);
  const w = e.statuses.find((st) => st.type === 'weaken');
  ok('Dark Bomb: the enemy deals ' + -w.attackPercent + '% less damage', w.attackPercent === itemDefs.dark_bomb.effects[0].strike.apply[0].attackPercent); }
// Bombardier's Barrel.
{ const bd = itemDefs.bombardiers_barrel.effects.find((x) => x.special === 'bombDamage'), bb = itemDefs.bombardiers_barrel.effects.find((x) => x.special === 'bombBarrel');
  const { s, e, k } = mk(['goblin'], () => 0.99); give(s, k, 'fire_bombs'); give(s, k, 'bombardiers_barrel', 2);
  s.throwBomb(k, e, bombProc(k, 'fire_bombs'), [], true);
  ok("Bombardier's Barrel: 2 barrels = +" + 2 * bd.percent + '% bomb damage', e.hp === 1e7 - Math.round(300 * (1 + (2 * bd.percent) / 100)), `${1e7 - e.hp}`);
  ok('...barrel chance ' + bb.percent + '% +' + bb.perExtra + '% per extra', k.specials.bombBarrel === bb.percent + bb.perExtra);
  const ev = []; const { s: t, e: e2, k: k2 } = mk(['goblin'], () => 0.99); give(t, k2, 'ice_bomb'); give(t, k2, 'bombardiers_barrel'); t.throwBomb(k2, e2, bombProc(k2, 'ice_bomb'), ev, true);
  ok('...no extra bombs when the chance misses', shots(ev).length === 1);
  // rng 0: the barrel always goes off, throws the lowest count; the extra bombs never set it off again.
  const { s: u, k: k3 } = mk(); give(u, k3, 'ice_bomb'); give(u, k3, 'poison_bombs'); give(u, k3, 'bombardiers_barrel');
  const ev3 = []; u.throwBomb(k3, u.enemies[0], bombProc(k3, 'ice_bomb'), ev3, true);
  ok('...goes off: ' + bb.count[0] + '-' + bb.count[1] + ' more bombs (no endless chain)', shots(ev3).length === 1 + bb.count[0], `${shots(ev3).length}`);
  const kinds = new Set(shots(ev3).slice(1).map((x) => x.kind));
  ok('...extra bombs are bombs the hero holds', [...kinds].every((kd) => ['iceBomb', 'poisonBomb'].includes(kd)), [...kinds].join());
  let seed = 7; const lcg = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { s: w, k: k4 } = mk(['goblin', 'goblin', 'goblin'], lcg); give(w, k4, 'ice_bomb'); give(w, k4, 'poison_bombs'); give(w, k4, 'bombardiers_barrel');
  const ev4 = []; for (let i = 0; i < 60; i++) w.throwBomb(k4, w.enemies[0], bombProc(k4, 'ice_bomb'), ev4, true);
  const extras = ev4.filter((x) => x.type === 'projectile' && x.kind === 'poisonBomb').length;
  ok('...picked at random among them (both kinds can come)', extras > 0 && ev4.filter((x) => x.type === 'projectile' && x.kind === 'iceBomb').length > 60, `${extras} poison bombs`); }
// A real attack: a bomb proc goes through throwBomb (debuff + barrel), Fire Bombs counts as a bomb.
{ const { s, e, k } = mk(); give(s, k, 'electric_bomb'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  ok('An attack proc throws the bomb with its debuff', e.statuses.some((st) => st.type === 'stun') && shots(ev).some((x) => x.kind === 'electricBomb')); }
