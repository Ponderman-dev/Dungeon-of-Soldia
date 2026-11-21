// Timed boss enrage (combat.json bossEnrage, systems/bosses.js tickTimeEnrage): a boss fight that drags on makes the
// boss stronger step by step, so no boss fight lasts for ever. Numbers are read from the data.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), E = rules.bossEnrage, heroes = r('heroes.json');
const mk = (ids) => {
  const s = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => heroes.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(r('items.json')), skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: Math.random });
  const es = s.spawnEnemies(ids, 20); s.startFloor();
  for (const u of s.heroes) { u.hp = u.maxHp = 1e9; u.stats.attack = 0; }
  return { s, boss: es.find((e) => e.def.boss), es };
};
const run = (s, ms, keep) => { const ev = []; for (let t = 0; t < ms; t += 50) { ev.push(...s.update(50)); keep && keep(); } return ev; };
ok('the enrage numbers exist and make sense', E && E.afterMs > 60000 && E.everyMs > 0 && E.maxSteps > 0 && E.mods.length > 0);
{ const { s, boss } = mk(['grukk']);
  const keep = () => { for (const h of s.heroes) { h.hp = h.maxHp; h.alive = true; } boss.hp = boss.maxHp; };
  const base = boss.stats.attack;
  const before = run(s, E.afterMs - 1000, keep);
  ok('no enrage before afterMs', !before.some((e) => e.type === 'enrage') && boss.stats.attack === base);
  const at = run(s, 2000, keep);
  ok('one ENRAGED step right after afterMs (the enrage event shows the pop)', at.filter((e) => e.type === 'enrage' && e.unit === boss).length === 1 && boss.enrageSteps === 1);
  const atk = E.mods.find((m) => m.stat === 'attack');
  ok('...and the boss hits harder by the step\'s percent', !atk || Math.abs(boss.stats.attack - base * (1 + atk.percent / 100)) < 0.01, `${base} -> ${boss.stats.attack}`);
  run(s, E.everyMs * (E.maxSteps + 3), keep);
  ok('one more step every everyMs, never more than maxSteps', boss.enrageSteps === E.maxSteps, String(boss.enrageSteps));
  ok('...the steps add up', !atk || Math.abs(boss.stats.attack - base * (1 + (atk.percent * E.maxSteps) / 100)) < 0.01); }
{ const { s, es } = mk(['grukk']);
  const add = es.filter((e) => !e.def.boss);
  run(s, E.afterMs + 5000, () => { for (const h of s.heroes) { h.hp = h.maxHp; h.alive = true; } for (const e of s.enemies) e.hp = e.maxHp; });
  ok('only bosses enrage, not their helpers', s.enemies.filter((e) => !e.def.boss).every((e) => !e.enrageSteps), String(add.length)); }
