// A6a: damage over time (bleed, burn, poison) stacks with no limit, each stack has its own timer,
// all stacks of one kind tick together. Bleed ignores defense. Bosses don't shorten DoTs.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const statusDefs = r('statuses.json');
const mk = () => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs, rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  // Nobody attacks during these tests: only status ticks change health.
  const [g] = s.spawnEnemies(['goblin'], 1);
  Object.assign(g, { hp: 1e9, maxHp: 1e9, weak: [], resists: [] });
  g.stats.defense = 0; g.stats.resist = 0;
  for (const u of [...s.heroes, g]) u.timer = -1e12;
  return { s, g, src: s.heroes[0] };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 50) ev.push(...s.update(50)); return ev; };
const spec = (status, durationMs, damageMultiplier = 0.5) => ({ status, durationMs, damageMultiplier });

{ const { s, g, src } = mk();
  for (let i = 0; i < 5; i++) s.applyStatus(g, spec('poison', 6000), src, 'same_skill', []);
  ok('the same skill 5 times = 5 poison stacks (no limit, no refresh)', s.stacks(g, 'poison') === 5);
  const ev = run(s, 1000).filter((e) => e.type === 'dot');
  ok('all stacks tick together as ONE number', ev.length === 1 && ev[0].stacks === 5, `${ev.length} events`);
  ok('one tick = 5 x the single damage', ev[0].amount === 5 * Math.round(src.stats.attack * 0.5), `${ev[0].amount}`); }

{ const { s, g, src } = mk();
  s.applyStatus(g, spec('burn', 1000), src, 'a', []);
  run(s, 500);
  s.applyStatus(g, spec('burn', 3000), src, 'a', []);
  ok('2 burn stacks', s.stacks(g, 'burn') === 2);
  run(s, 600);
  ok('each stack has its own timer: the first ran out, the second is still there', s.stacks(g, 'burn') === 1);
  run(s, 3000);
  ok('all stacks gone in the end', s.stacks(g, 'burn') === 0 && !('burn' in g.dotClocks)); }

{ const { s, g, src } = mk();
  s.applyStatus(g, spec('burn', 2000), src, 'a', []);
  const ticks = run(s, 2000).filter((e) => e.type === 'dot').length;
  ok('burn ticks every 0.5s (4 ticks in 2s)', ticks === 4, `${ticks}`); }

{ const { s, g, src } = mk(); g.stats.defense = 50;
  s.applyStatus(g, spec('bleed', 1000), src, 'a', []);
  const [tick] = run(s, 1000).filter((e) => e.type === 'dot');
  ok('bleed ignores 50 defense', tick.amount === Math.round(src.stats.attack * 0.5), `${tick.amount}`);
  ok('bleed is physical (melee)', tick.damageType === 'melee'); }

{ const { s, g, src } = mk(); g.stats.resist = 50;
  s.applyStatus(g, spec('poison', 1000), src, 'a', []);
  const [tick] = run(s, 1000).filter((e) => e.type === 'dot');
  ok('poison is still cut by resist', tick.amount === Math.round(Math.round(src.stats.attack * 0.5) * 0.5), `${tick.amount}`); }

{ const { s, g, src } = mk(); g.def = { ...g.def, statusDurationScale: 0.5 };
  s.applyStatus(g, spec('poison', 4000), src, 'a', []);
  s.applyStatus(g, { status: 'stun', durationMs: 1000 }, src, 'b', []);
  ok('boss: poison keeps its full length', g.statuses.find((x) => x.type === 'poison').remaining === 4000);
  ok('boss: stun (control) is halved', g.statuses.find((x) => x.type === 'stun').remaining === 500); }

{ const { s, g, src } = mk();
  s.applyStatus(g, spec('poison', 3000), src, 'a', []);
  s.applyStatus(g, spec('bleed', 3000), src, 'a', []);
  const kinds = new Set(run(s, 1000).filter((e) => e.type === 'dot').map((e) => e.status));
  ok('different kinds tick separately', kinds.has('poison') && kinds.has('bleed')); }

{ const { s, g, src } = mk(); g.hp = 3;
  s.applyStatus(g, spec('poison', 5000), src, 'a', []);
  const ev = run(s, 1000);
  ok('damage over time can kill', !g.alive && ev.some((e) => e.type === 'death')); }

ok('all DoT kinds have a tick time in statuses.json', ['bleed', 'burn', 'poison'].every((k) => statusDefs[k].dot && statusDefs[k].tickMs > 0));
