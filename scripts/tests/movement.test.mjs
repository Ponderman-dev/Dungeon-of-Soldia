// Real movement (BattleState.move, combat.json `movement`): melee fighters walk to their target at a
// steady speed and only attack once in reach; both sides walk towards each other and meet; ranged
// fighters stay put; fighters push apart instead of standing on top of each other; nobody teleports.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), M = rules.movement;
const all = noPerks(r('heroes.json'));
const mk = (heroIds = ['knight', 'rogue', 'archer'], enemyIds = ['goblin', 'goblin', 'goblin']) => {
  const s = new BattleState({ heroDefs: heroIds.map((id) => all.find((h) => h.id === id)), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; }
  s.placeLines();
  return { s, es, h: s.heroes };
};
const run = (s, ms, each) => { const ev = []; for (let t = 0; t < ms; t += 20) { ev.push(...s.update(20)); if (each) each(); } return ev; };
const starts = (ev, u) => ev.filter((e) => e.type === 'attackStart' && e.attacker === u);

{ const { s, es, h } = mk(['knight'], ['goblin']); const [knight] = h, [g] = es;
  const gap = s.distance(knight, g);
  const ev = run(s, 200);
  ok('a melee hero far away does not hit at once', starts(ev, knight).length === 0);
  ok('...it walks towards the enemy', s.distance(knight, g) < gap);
  const ev2 = run(s, 4000);
  const first = starts(ev2, knight)[0];
  ok('it attacks once it gets there', first && first.hitInMs === rules.attackTiming.hero.swingMs);
  ok('...standing next to the enemy, not on it', s.inReach(knight, g) && s.distance(knight, g) > M.separateX * 0.8, s.distance(knight, g).toFixed(0));
  ok('hero ends below the enemy (face to face)', knight.y > g.y); }

{ const { s, es, h } = mk(['knight'], ['goblin']); const [knight] = h, [g] = es;
  const k0 = { x: knight.x, y: knight.y }, g0 = { x: g.x, y: g.y };
  run(s, 4000);
  const kMoved = Math.hypot(knight.x - k0.x, knight.y - k0.y), gMoved = Math.hypot(g.x - g0.x, g.y - g0.y);
  ok('both melee fighters walk and meet in the middle', kMoved > 60 && gMoved > 60 && Math.abs(kMoved - gMoved) < 60, `${kMoved.toFixed(0)} / ${gMoved.toFixed(0)}`); }

{ const { s, es, h } = mk(['knight'], ['goblin']); const [knight] = h;
  const y0 = knight.y; run(s, 500);
  const speed = ((y0 - knight.y) / 500) * 1000;
  ok('walk speed is walkSpeedPxPerSec', Math.abs(speed - M.walkSpeedPxPerSec) < 5, speed.toFixed(0)); }

{ const { s, h } = mk(); const archer = h[2]; const x0 = archer.x, y0 = archer.y;
  run(s, 3000);
  ok('a ranged hero stays in its spot', Math.hypot(archer.x - x0, archer.y - y0) < 1); }

// No teleporting: nobody ever moves faster than walking + pushing apart, also when targets die.
{ const { s, es, h } = mk(); let worst = 0; const last = new Map();
  const limit = ((M.walkSpeedPxPerSec + M.separatePushPerSec) * 20) / 1000 + 0.5;
  run(s, 6000, () => {
    for (const u of [...h, ...es]) { const p = last.get(u); if (p && u.alive && !u.knock) worst = Math.max(worst, Math.hypot(u.x - p.x, u.y - p.y)); last.set(u, { x: u.x, y: u.y }); }
    if (es[0].alive && s.heroes[0].foe === es[0].uid && Math.random() < 0.05) { const ev = []; s.killUnit(es[0], ev); }
  });
  ok('nobody moves faster than it can walk (no teleport)', worst <= limit, `${worst.toFixed(2)} <= ${limit.toFixed(2)}`); }

// A crowd spreads out: after a while nobody stands on top of anyone.
{ const { s, es, h } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin', 'goblin']);
  run(s, 5000);
  const units = [...h, ...es]; let closest = Infinity;
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) closest = Math.min(closest, Math.hypot((units[i].x - units[j].x) / M.separateX, (units[i].y - units[j].y) / M.separateY));
  ok('fighters do not stand on top of each other', closest > 0.8, closest.toFixed(2)); }

// When its enemy dies a melee hero walks to the next one (it does not hit from afar).
{ const { s, es, h } = mk(['knight'], ['goblin', 'goblin']); const [knight] = h;
  run(s, 4000); const foe = es.find((e) => e.uid === knight.foe); const other = es.find((e) => e !== foe);
  const ev = []; s.killUnit(foe, ev);
  let hitFromAfar = false;
  run(s, 3000, () => {}); // walks over
  const ev2 = run(s, 2000);
  for (const e of ev2) if (e.type === 'attackStart' && e.attacker === knight && !s.inReach(knight, e.target)) hitFromAfar = true;
  ok('after its enemy dies it walks to the next and hits it there', !hitFromAfar && starts(ev2, knight).some((e) => e.target === other) && s.inReach(knight, other)); }

// Fear: back to its own spot. Knockback: pushed towards its own side.
{ const { s, es } = mk(['knight'], ['goblin']); const [g] = es;
  run(s, 1500); const y = g.y;
  s.applyStatus(g, { status: 'fear', durationMs: 3000 }, s.heroes[0], 'x', []);
  run(s, 400);
  ok('a feared enemy walks back towards its spot', g.y < y); }
{ const { s, es } = mk(['knight'], ['goblin']); const [g] = es;
  run(s, 1500); const y = g.y;
  s.applyStatus(g, { status: 'knockback', durationMs: 0 }, s.heroes[0], 'x', []);
  s.update(M.knockbackMs);
  ok('a knocked-back enemy is pushed up (towards its side)', g.y < y - M.knockbackPx * 0.5, `${(y - g.y).toFixed(0)}`); }

// Targets: enemies go for the NEAREST hero (melee or ranged), melee keep their opponent.
{ const { s, es, h } = mk();
  ok('left enemy takes the left hero, middle the middle, right the right', s.pickTarget(es[0]) === h[0] && s.pickTarget(es[1]) === h[1] && s.pickTarget(es[2]) === h[2]); }
{ const { s, es, h } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin']);
  ok('with 2 enemies they take the nearest heroes: left and right', s.pickTarget(es[0]) === h[0] && s.pickTarget(es[1]) === h[2]); }
{ const { s, es } = mk(); const t = s.pickTarget(es[0]);
  let same = true; for (let i = 0; i < 50; i++) if (s.pickTarget(es[0]) !== t) same = false;
  ok('an enemy keeps its opponent', same); }
{ const { s, es, h } = mk(); h[0].alive = false; h[1].alive = false;
  ok('no melee heroes left: enemies go for the back line', s.pickTarget(es[0]) === h[2]); }
{ const { s, es, h } = mk(); s.setFocus(es[2].uid);
  ok('tap focus: the melee hero goes for the tapped enemy', s.pickTarget(h[0]) === es[2]); }

// Once standing at its enemy, attack speed alone sets how often it hits.
{ const { s, es, h } = mk(['knight'], ['goblin']); const [knight] = h, [g] = es;
  g.stats.attack = 0; run(s, 4000);
  const n = run(s, 10000).filter((e) => e.type === 'attack' && e.attacker === knight).length;
  const expected = 10000 / s.interval(knight);
  ok('attack speed sets how often a melee hero hits once there', Math.abs(n - expected) <= 1, `${n} vs ${expected.toFixed(1)}`); }

// `speed` = its OWN walking pace (the scene hops only then): a fighter that is only shoved has speed 0
// (bug: Grukk, jostled by his goblins, hung mid-hop and looked like he floated).
{ const { s, es, h } = mk(['knight'], ['goblin']); const [knight] = h, [g] = es;
  run(s, 200);
  ok('a walking fighter has its walking speed', Math.abs(knight.speed - M.walkSpeedPxPerSec) < 1, String(knight.speed));
  g.stats.attack = 0; run(s, 4000);
  knight.x = g.x + 1; knight.y = g.y; knight.pending = { target: g }; // busy swinging, standing on the goblin: only pushed
  s.move(20);
  ok('a fighter that is only shoved has speed 0', knight.moving && knight.speed === 0, `${knight.moving} ${knight.speed}`); }

// A BIG attacker swings from its own edge (reach grows with both sizes): a boss walking at a hero stops outside
// the push-apart oval instead of walking into him and being shoved out again (overlapping, jittering).
for (const bossId of ['grukk', 'frost_warden', 'ignatius']) {
  const { s, es, h } = mk(['knight'], [bossId]); const [knight] = h, [boss] = es;
  knight.stats.attack = 0; boss.stats.attack = 0; knight.x = 60; // the knight stands near the left wall
  let moves = 0;
  const pin = () => { knight.x = 60; knight.y = M.layout.heroY; knight.knock = null; }; // he stays put (Cleaver Charge knocks him back)
  run(s, 6000, pin); run(s, 2000, () => { pin(); if (boss.speed > 0) moves++; }); // its own steps
  const k = ((boss.size || 1) + 1) / 2;
  const d = Math.hypot((boss.x - knight.x) / (M.separateX * k), (boss.y - knight.y) / (M.separateY * (1 + (k - 1) * 0.5)));
  ok(`${bossId} stops at the hero's edge, not inside him`, s.inReach(boss, knight) && d >= 0.95, d.toFixed(2));
  ok(`...and stands still there (no walk-in / push-out jitter)`, moves < 5, String(moves)); }
