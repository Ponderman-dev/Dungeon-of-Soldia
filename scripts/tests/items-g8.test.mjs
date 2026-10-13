// Phase G8: Excalibur (tornado) and Jolly Banner.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = r('combat.json');
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
