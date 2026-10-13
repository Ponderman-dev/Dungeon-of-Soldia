// D2 taunt: a taunted enemy MUST attack the taunter (melee enemies walk to it, ranged ones shoot it),
// the newest living taunter wins, an attack on the way is redirected, bosses take it for less, and a
// proc can taunt the enemy it hit AND give the holder a defense buff (the Knight's Taunt Wall idea).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json');
const mk = (enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  s.placeLines();
  return { s, es, h: s.heroes };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };

{ const { s, es, h } = mk(); const [knight] = h;
  for (const e of es) { s.applyStatus(e, { status: 'taunt', durationMs: 10000 }, knight, 'tw', []); e.timer = 0; } // enemies may attack now
  ok('every taunted enemy goes for the taunter', es.every((e) => s.pickTarget(e) === knight));
  const ev = run(s, 4000);
  ok('...and only attacks the taunter while it lasts', ev.filter((e) => e.type === 'attack' && e.attacker.side === 'enemy').every((e) => e.target === knight) && ev.some((e) => e.type === 'attack' && e.attacker.side === 'enemy'));
  ok('...melee enemies walk over to the taunter', es.every((e) => s.inReach(e, knight) || s.distance(e, knight) < s.distance({ x: e.homeX, y: e.homeY }, knight))); }

{ const { s, es, h } = mk(['goblin']); const [knight, rogue] = h; const [g] = es;
  s.applyStatus(g, { status: 'taunt', durationMs: 5000 }, knight, 'a', []);
  s.applyStatus(g, { status: 'taunt', durationMs: 5000 }, rogue, 'b', []);
  ok('the newest taunter wins', s.pickTarget(g) === rogue);
  rogue.alive = false;
  ok('...an older taunt takes over when the newer taunter dies', s.pickTarget(g) === knight);
  s.applyStatus(g, { status: 'taunt', durationMs: 5000 }, knight, 'a', []);
  ok('the same taunt again just refreshes', g.statuses.filter((x) => x.type === 'taunt' && x.key === 'taunt:a').length === 1); }

{ const { s, es, h } = mk(['goblin']); const [knight, rogue] = h; const [g] = es; g.foe = rogue.uid;
  ok('before the taunt it fights its own opponent', s.pickTarget(g) === rogue);
  s.applyStatus(g, { status: 'taunt', durationMs: 1000 }, knight, 't', []);
  ok('taunt beats the opponent it had', s.pickTarget(g) === knight);
  run(s, 1200);
  ok('when the taunt ends it goes back to its opponent', s.pickTarget(g) === rogue); }

{ const { s, es, h } = mk(['goblin']); const [knight, rogue] = h; const [g] = es;
  g.foe = rogue.uid; s.place(g, rogue.x, rogue.y - 40); g.timer = s.interval(g) - 1; // standing at the rogue
  const st = s.update(5).find((e) => e.type === 'attackStart' && e.attacker === g);
  const ev = []; s.applyStatus(g, { status: 'taunt', durationMs: 3000 }, knight, 't', ev);
  ok('a swing on the way to someone else is dropped when it gets taunted', st && !g.pending && ev.some((e) => e.type === 'attackCancel' && e.reason === 'taunted'));
  ok('...and it is ready again to hit the taunter on arrival', g.timer >= s.interval(g) - 1); }

{ const { s, es, h } = mk(['bat']); const [knight] = h; const [bat] = es; bat.damageType = 'ranged'; // a ranged enemy
  bat.timer = s.interval(bat) - 1;
  const st = s.update(5).find((e) => e.type === 'attackStart' && e.attacker === bat);
  const ev = []; s.applyStatus(bat, { status: 'taunt', durationMs: 3000 }, knight, 't', ev);
  const hit = run(s, 400).find((e) => e.type === 'attack' && e.attacker === bat);
  ok('a ranged enemy\'s arrow in flight bends to the taunter', ev.some((e) => e.type === 'attackRetarget' && e.target === knight) || st.target === knight, '');
  ok('...and lands on the taunter', !hit || hit.target === knight); }

{ const { s, es, h } = mk(['goblin']); const [knight] = h; const [g] = es;
  g.def = { ...g.def, statusDurationScale: 0.5 };
  s.applyStatus(g, { status: 'taunt', durationMs: 4000 }, knight, 't', []);
  ok('bosses are taunted for half as long', g.statuses.find((x) => x.type === 'taunt').remaining === 2000); }

{ const { s, es, h } = mk(['goblin', 'goblin'], () => 0); const [knight] = h; // rng 0 = every chance succeeds
  knight.procs = [{ proc: 'onAttack', chance: 10, label: 'Taunt Wall!', itemId: 'taunt_wall', targets: 'self', apply: [
    { status: 'taunt', durationMs: 3000, to: 'target' },
    { status: 'buff', durationMs: 3000, mods: [{ stat: 'defense', flat: 20 }], to: 'self' } ] }];
  const d0 = knight.stats.defense; const target = es[0];
  s.rollProcs(knight, 'onAttack', [], { target, hit: true });
  ok('the proc taunts the enemy it hit', s.tauntedBy(target) === knight && !s.tauntedBy(es[1]));
  ok('...and gives the Knight himself a defense buff', knight.stats.defense === d0 + 20 && !target.statuses.some((x) => x.type === 'buff'));
  run(s, 3200);
  ok('...both end after 3s', !s.tauntedBy(target) && knight.stats.defense === d0); }

{ const { s, es, h } = mk(['goblin', 'goblin'], () => 0); const [knight] = h;
  knight.procs = [{ proc: 'onAttack', chance: 10, label: 'x', itemId: 'tw', targets: 'self', apply: [{ status: 'taunt', durationMs: 3000, to: 'target' }] }];
  s.rollProcs(knight, 'onAttack', [], { target: es[0], hit: false });
  ok('a missed attack does not taunt', !s.tauntedBy(es[0])); }
