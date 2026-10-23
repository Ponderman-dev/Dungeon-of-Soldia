// Hero toughness (combat.json): heroDefense raises every hero's defense and resist by a percent, and the death save
// (once per run per hero) cuts the first killing hit to deathSave.damagePercent; if that still kills, the hero dies.
import fs from 'fs';
import { noPerks, plainRules } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json');
const mk = (rl = rules) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: rl, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  s.spawnEnemies(['goblin'], 1);
  return { s, h: s.heroes[0] };
};
const pct = rules.deathSave.damagePercent / 100;
// Defense bonus
{ const { h } = mk(), { h: p } = mk(plainRules(rules)); const f = 1 + rules.heroDefense.percent / 100;
  ok('heroDefense: defense and resist are raised by the percent', Math.abs(h.stats.defense - p.stats.defense * f) < 0.01 && Math.abs(h.stats.resist - p.stats.resist * f) < 0.01, `${h.stats.defense} ${p.stats.defense}`); }
{ const { h } = mk(), { h: p } = mk(plainRules(rules)); const f = 1 + rules.heroAttack.percent / 100;
  ok('heroAttack: attack is raised by the percent', rules.heroAttack.percent > 0 && Math.abs(h.stats.attack - p.stats.attack * f) < 0.01, `${h.stats.attack} ${p.stats.attack}`); }
// Save: the cut hit leaves the hero alive
{ const { s, h } = mk(); h.hp = 100; const hit = Math.round(100 / pct) - 20; const ev = []; s.dealDamage(h, hit, ev);
  ok('deathSave: the first killing hit is cut, the hero lives', h.alive && h.hp === 100 - Math.round(hit * pct), `${h.hp}`);
  ok('...a deathSave event says it survived', ev.some((e) => e.type === 'deathSave' && e.unit === h && e.survived));
  h.hp = 10; const ev2 = []; s.dealDamage(h, 50, ev2); if (h.hp <= 0) s.killUnit(h, ev2);
  ok('...only once per run: the next killing hit kills', !h.alive && !ev2.some((e) => e.type === 'deathSave')); }
// Save: the cut hit is still enough
{ const { s, h } = mk(); h.hp = 10; const ev = []; s.dealDamage(h, Math.round(10 / pct) + 40, ev);
  ok('deathSave: a hit that still kills after the cut kills (save used up)', h.hp === 0 && h.deathSaveUsed && ev.some((e) => e.type === 'deathSave' && !e.survived)); }
// Not lethal: no save used
{ const { s, h } = mk(); h.hp = 100; s.dealDamage(h, 30, []);
  ok('deathSave: a hit that does not kill leaves the save unused', h.hp === 70 && !h.deathSaveUsed); }
// Enemies don't get it
{ const { s } = mk(); const e = s.enemies[0]; e.hp = 10; s.dealDamage(e, 15, []);
  ok('deathSave: enemies never get it', e.hp === 0); }
