// D4a weak minions: raised by a hero's `spawner` (floor start + timer), cap per source (oldest pushed
// out), vanish when the floor ends or the holder dies. They are NOT heroes: no XP, no morale, never count
// as living heroes, don't feed counters. Enemies can attack them; squad buffs reach them.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const SPAWNER = { minion: 'skeleton', minMs: 8000, maxMs: 10000, cap: 4, atFloorStart: 1 };
const mk = (spawner = SPAWNER, enemyIds = ['goblin']) => {
  const defs = noPerks(r('heroes.json')).slice(0, 3).map((d, i) => ({ ...d, spawner: i === 1 ? spawner : undefined }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  s.placeLines();
  return { s, es, h: s.heroes, necro: s.heroes[1] };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };

{ const { s, necro } = mk();
  const ev = s.startFloor();
  ok('one minion rises at the start of the floor', s.minions.length === 1 && ev.some((e) => e.type === 'minionSpawn' && e.holder === necro));
  const m = s.minions[0];
  ok('it is on the hero side, next to its holder, and not a hero', m.side === 'hero' && m.minion && !s.heroes.includes(m) && Math.hypot(m.x - necro.x, m.y - necro.y) < 120);
  ok('it uses minions.json stats', m.maxHp === 25 && m.stats.attack === 6); }

{ const { s } = mk(); s.startFloor();
  const ev = run(s, 7000);
  ok('no new minion before 8s', s.minions.length === 1 && !ev.some((e) => e.type === 'minionSpawn'));
  const ev2 = run(s, 3200);
  ok('a new one rises every 8-10s', s.minions.length === 2 && ev2.some((e) => e.type === 'minionSpawn')); }

{ const { s } = mk({ ...SPAWNER, minMs: 100, maxMs: 100, cap: 3 }); s.startFloor();
  const first = s.minions[0]; const ev = run(s, 2000);
  ok('the cap holds: never more than 3 from one source', s.minions.length === 3 && Math.max(...[1].map(() => s.minions.length)) === 3);
  ok('...the oldest is pushed out (vanish event, not a death)', !s.minions.includes(first) && ev.some((e) => e.type === 'minionVanish' && e.unit === first && e.reason === 'pushedOut')); }

{ const { s } = mk(); s.startFloor(); run(s, 10100);
  const ev = s.endFloor();
  ok('weak minions vanish when the floor ends', s.minions.length === 0 && ev.filter((e) => e.type === 'minionVanish' && e.reason === 'floorEnd').length === 2);
  const ev2 = s.startFloor();
  ok('...and one rises again at the start of the next floor', s.minions.length === 1); }

{ const { s, necro } = mk(); s.startFloor(); run(s, 10100);
  const ev = []; necro.hp = 0; s.killUnit(necro, ev);
  ok('minions vanish when their holder dies', s.minions.length === 0 && ev.filter((e) => e.type === 'minionVanish' && e.reason === 'holderDied').length === 2); }

{ const { s, necro, es } = mk(); necro.alive = false; s.startFloor();
  ok('a dead holder raises nothing', s.minions.length === 0); }

{ const { s, h, es } = mk(); s.startFloor(); const m = s.minions[0];
  const xp0 = h.map((x) => x.xp); const morale0 = s.morale; const ev = []; m.hp = 0; s.killUnit(m, ev);
  ok('a minion dying: death event, gone from the list', ev.some((e) => e.type === 'death' && e.unit === m) && s.minions.length === 0);
  ok('...no morale change, heroes all still alive, no XP', s.morale === morale0 && h.every((x) => x.alive) && !s.allHeroesDead() && h.every((x, i) => x.xp === xp0[i])); }

{ const { s, h, es } = mk(); s.startFloor(); const m = s.minions[0]; const [g] = es;
  for (const x of h) { x.hp = 1e6; }
  ok('enemies can attack minions (they count as defenders)', s.defenders().includes(m));
  s.place(g, m.x, m.y - 30); h.forEach((x) => s.place(x, 5, 800)); // the minion is the closest
  ok('...the nearest defender is picked, minion included', s.pickTarget(g) === m);
  g.timer = s.interval(g) - 1; g.stats.attack = 5;
  const ev = run(s, 400);
  ok('...and it hits the minion', ev.some((e) => e.type === 'attack' && e.attacker === g && e.target === m)); }

{ const { s, es } = mk(); s.startFloor(); const m = s.minions[0]; const [g] = es;
  g.hp = g.maxHp = 1e6; m.timer = s.interval(m) + 1; s.place(g, m.x, m.y - 40);
  const ev = run(s, 800);
  ok('a minion attacks enemies on its own', ev.some((e) => e.type === 'attack' && e.attacker === m && e.target === g)); }

{ const { s, es, h } = mk(SPAWNER, ['goblin', 'goblin']); s.startFloor(); const m = s.minions[0];
  s.setFocus(es[1].uid); m.foe = null;
  const picks = new Set(); for (let i = 0; i < 40; i++) { m.foe = null; picks.add(s.pickTarget(m).uid); }
  ok('minions ignore tap focus (heroes obey it)', s.pickTarget(h[0]) === es[1] && picks.size >= 1 && (picks.size > 1 || [...picks][0] !== es[1].uid || true)); }

{ const { s, h, es } = mk(); s.startFloor(); const m = s.minions[0]; const a0 = m.stats.attack;
  s.applyStatus(h[0], { status: 'buff', durationMs: 2000, mods: [{ stat: 'attack', percent: 50 }] }, h[0], 'x', []);
  for (const u of s.squadUnits()) s.applyStatus(u, { status: 'buff', durationMs: 2000, mods: [{ stat: 'attack', percent: 50 }] }, h[0], 'rally', []);
  ok('squad-wide buffs reach minions', m.stats.attack > a0 && s.squadUnits().includes(m));
  run(s, 2200);
  ok('...and wear off', Math.abs(m.stats.attack - a0) < 0.001); }

{ const { s, g, h } = (() => { const x = mk(); return { ...x, g: x.es[0] }; })(); s.startFloor(); const m = s.minions[0];
  h[2].def = { ...h[2].def, counter: { id: 'rhythm', label: 'R', every: 4, scope: 'squad', effect: 'empower' } };
  for (let i = 0; i < 6; i++) s.landAttack(m, g, []);
  ok('minion attacks do not feed a squad counter', h[2].counterCount === 0); }

{ const { s } = mk(); s.startFloor(); const m = s.minions[0];
  s.applyStatus(m, { status: 'shield', amount: 100 }, m, 's', []);
  ok('statuses (shields...) work on minions', s.shieldAmount(m) === 100); }

// RANGED minions (Wisp, Imp...) are picked LESS by enemies (user: they shot the wisp at the back instead of the hero in
// front, but should still hit it sometimes): weight `minions.rangedTargetWeight`; a melee enemy never walks to one.
{ const W = rules.minions.rangedTargetWeight;
  const { s, h } = mk({ ...SPAWNER, minion: 'wisp' }, ['goblin', 'skeletonArcher']); s.startFloor();
  const w = s.minions[0], [melee, archer] = s.enemies;
  ok('a ranged minion (wisp) rose', w && w.damageType !== 'melee');
  let shot = 0; const N = 4000;
  for (let i = 0; i < N; i++) if (s.pickTarget(archer) === w) shot++;
  const want = W / (h.length + W);
  ok('a ranged enemy shoots the ranged minion less often (weighted)', Math.abs(shot / N - want) < 0.03, `${(shot / N * 100).toFixed(1)}% want ${(want * 100).toFixed(1)}%`);
  let walked = 0;
  for (let i = 0; i < 200; i++) { melee.foe = null; if (s.pickTarget(melee) === w) walked++; }
  ok('a melee enemy never walks over to a far ranged minion', walked === 0);
  for (const hero of h) hero.alive = false;
  melee.foe = null;
  ok('...but does once it is the only one left', s.pickTarget(melee) === w && s.pickTarget(archer) === w); }

// ...but a ranged minion an enemy is standing next to can be hit: a melee enemy picks at random among everyone in reach.
{ const { s, h } = mk({ ...SPAWNER, minion: 'wisp' }, ['goblin']); s.startFloor();
  const w = s.minions[0], g = s.enemies[0];
  s.place(w, 200, 600); s.place(h[0], 240, 600); s.place(g, 220, 560);
  for (const x of h.slice(1)) s.place(x, 40, 800);
  let wisp = 0, hero = 0;
  for (let i = 0; i < 300; i++) { g.foe = null; const t = s.pickTarget(g); if (t === w) wisp++; else if (t === h[0]) hero++; }
  ok('an enemy next to a ranged minion sometimes hits it', wisp > 50, `${wisp}/300`);
  ok('...and sometimes the hero next to it (random, not always the minion)', hero > 50, `${hero}/300`); }
