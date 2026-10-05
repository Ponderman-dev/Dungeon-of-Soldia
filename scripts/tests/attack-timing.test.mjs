// B1: a basic attack STARTS (attackStart event) and LANDS later (attack event).
// Melee / ranged delays come from combat.json attackTiming (0 = instant, as before).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const base = r('combat.json');
const mk = (timing) => {
  const rules = { ...base, attackTiming: { hero: timing, enemy: timing } };
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(['goblin', 'goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; u.timer = -1e12; } // nobody attacks unless we say so
  return { s, es, knight: s.heroes[0], archer: s.heroes[3] };
};
const step = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 50) ev.push(...s.update(50)); return ev; };
const ready = (s, u) => (u.timer = s.interval(u) - 1); // this unit starts an attack on the next update

ok('heroes have real timings, enemies are still instant', base.attackTiming.hero.meleeHitMs > 0 && base.attackTiming.hero.rangedHitMs > 0 && !base.attackTiming.enemy.meleeHitMs);

{ const { s, knight } = mk({ meleeHitMs: 400, rangedHitMs: 250 });
  ready(s, knight); const ev = s.update(50);
  const start = ev.find((e) => e.type === 'attackStart' && e.attacker === knight);
  ok('melee: attackStart says when it will land', start && start.hitInMs === 400);
  ok('no damage yet', !ev.some((e) => e.type === 'attack' && e.attacker === knight));
  const before = step(s, 300).filter((e) => e.type === 'attack' && e.attacker === knight).length;
  const after = step(s, 150).filter((e) => e.type === 'attack' && e.attacker === knight).length;
  ok('melee hit lands after 400 ms, not before', before === 0 && after === 1, `${before}/${after}`); }

{ const { s, archer } = mk({ meleeHitMs: 400, rangedHitMs: 250 });
  ready(s, archer); const [st] = s.update(50).filter((e) => e.type === 'attackStart');
  ok('ranged uses rangedHitMs', st && st.attacker === archer && st.hitInMs === 250);
  ok('ranged hit lands after 250 ms', step(s, 300).filter((e) => e.type === 'attack' && e.attacker === archer).length === 1); }

{ const { s, es, knight } = mk({ meleeHitMs: 400, rangedHitMs: 250 });
  ready(s, knight); const [st] = s.update(50).filter((e) => e.type === 'attackStart');
  const first = st.target, other = es.find((e) => e !== first);
  first.alive = false; // its target dies before the hit lands
  const hit = step(s, 450).find((e) => e.type === 'attack' && e.attacker === knight);
  ok('target died mid-attack: the hit goes to another enemy', hit && hit.target === other); }

{ const { s, es, knight } = mk({ meleeHitMs: 400, rangedHitMs: 250 });
  ready(s, knight); s.update(50);
  s.applyStatus(knight, { status: 'stun', durationMs: 1000 }, es[0], 'x', []);
  const ev = step(s, 500);
  ok('stunned mid-attack: the attack is cancelled', ev.some((e) => e.type === 'attackCancel' && e.unit === knight) && !ev.some((e) => e.type === 'attack' && e.attacker === knight)); }

{ const { s, knight } = mk({ meleeHitMs: 400, rangedHitMs: 250 });
  ready(s, knight); s.update(50); knight.alive = false; knight.pending = null;
  ok('a dead attacker never lands its hit', !step(s, 500).some((e) => e.type === 'attack' && e.attacker === knight)); }

// Over a long fight the number of attacks stays the same: the delay doesn't slow attack speed.
{ const count = (timing) => { const { s, knight } = mk(timing); knight.timer = 0; return step(s, 10000).filter((e) => e.type === 'attack' && e.attacker === knight).length; };
  const a = count({ meleeHitMs: 0, rangedHitMs: 0 }), b = count({ meleeHitMs: 400, rangedHitMs: 250 });
  ok('same attacks per 10s with or without the delay', Math.abs(a - b) <= 1, `${a} vs ${b}`); }
