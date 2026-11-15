// Move orders (user's pick): drag a hero onto the floor = it walks there; tap the floor = the whole squad walks there.
// No attacks while walking, straight back to fighting on arrival.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const MO = rules.moveOrders;
const L = rules.movement.layout;
const mk = () => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).filter((d) => ['knight', 'archer', 'berserker'].includes(d.id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin', 'bandit', 'slime'], 5);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; }
  s.placeLines();
  return { s, es, h: s.heroes };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 50) ev.push(...s.update(50)); return ev; };
const ranged = (h) => h.find((x) => x.damageType !== 'melee');
const melee = (h) => h.find((x) => x.damageType === 'melee');
{
  const { s, h } = mk();
  const hero = ranged(h) || h[0];
  const spot = { x: 80, y: 600 };
  const from = { x: hero.x, y: hero.y };
  ok('a move order needs a living hero', s.setMove(hero.uid, spot.x, spot.y) && !s.setMove(9999, 1, 1));
  const ev = [];
  let walkedAt = null;
  for (let t = 0; t < 4000 && hero.walkTo; t += 50) {
    const e = s.update(50);
    ev.push(...e.filter((x) => x.type === 'attack' && x.attacker === hero));
    walkedAt = t;
  }
  ok('it walks to the spot', Math.hypot(hero.x - spot.x, hero.y - spot.y) <= MO.arrivePx + 1, `${hero.x.toFixed(0)},${hero.y.toFixed(0)}`);
  ok('...at walking speed (no teleport)', walkedAt >= 0.9 * (Math.hypot(from.x - spot.x, from.y - spot.y) / rules.movement.walkSpeedPxPerSec) * 1000 - 100);
  ok('no attacks while walking', ev.length === 0, `${ev.length}`);
  const after = run(s, 3000).filter((x) => x.type === 'attack' && x.attacker === hero);
  ok('back to fighting on arrival (a ranged hero shoots from its new spot)', after.length > 0 && Math.hypot(hero.x - spot.x, hero.y - spot.y) < 30);
}
{
  const { s, h, es } = mk();
  const m = melee(h);
  if (m) {
    s.setOrder(m.uid, es[0].uid);
    s.setMove(m.uid, 200, 700);
    ok('a move order replaces the drag (attack) order', m.order === null);
    run(s, 6000);
    ok('a melee hero walks back to an enemy after arriving', !m.walkTo && es.some((e) => s.inReach(m, e)));
  }
}
{
  const { s, h } = mk();
  const got = s.moveSquad(195, 500);
  ok('tap the floor: every living hero gets the order', got.length === 3 && h.every((x) => x.walkTo));
  const xs = h.map((x) => x.walkTo.x);
  ok('...side by side around the spot', Math.abs(xs[1] - xs[0] - MO.gatherSpacingPx) < 0.01 && Math.abs((xs[0] + xs[2]) / 2 - 195) < 0.01);
  s.setMove(h[0].uid, -500, 99999);
  ok('spots are kept inside the fight floor', h[0].walkTo.x === L.marginX && h[0].walkTo.y === L.heroY);
  s.spawnEnemies(['goblin'], 6);
  ok('move orders end with the floor', h.every((x) => x.walkTo === null));
}
{
  const { s, h } = mk();
  s.update(1); // start the fight
  const hero = h[1];
  hero.pending = { target: s.enemies[0], remaining: 500 };
  const ev = [];
  s.setMove(hero.uid, 100, 650, ev);
  ok('an attack it had started is dropped', hero.pending === null && ev.some((e) => e.type === 'attackCancel' && e.reason === 'move'));
  hero.walkTo.left = 60;
  run(s, 150);
  ok('gives up after maxMs if it cannot get there', hero.walkTo === null);
  s.killUnit(h[2], []);
  ok('dead heroes cannot get orders', !s.setMove(h[2].uid, 100, 600) && s.moveSquad(150, 600).length === 2);
}
{
  // Attack commands end a walk (user: after a mis-tap on the floor the heroes kept walking instead of attacking).
  const { s, es, h } = mk();
  s.moveSquad(60, L.heroY);
  ok('the squad is walking', h.every((x) => x.walkTo));
  s.setFocus(es[0].uid);
  ok('tapping an enemy ends every move order', h.every((x) => !x.walkTo) && s.focusUnit === es[0]);
  s.moveSquad(60, L.heroY);
  s.setOrder(h[0].uid, es[1].uid);
  ok('an attack order ends only that hero\'s move order', !h[0].walkTo && h[1].walkTo && h[2].walkTo);
}
{
  // A hero that cannot get closer stops trying long before maxMs.
  const { s, h } = mk();
  const hero = h[0];
  s.setMove(hero.uid, 60, L.heroY);
  const hold = { x: hero.x, y: hero.y };
  let t = 0;
  for (; t < MO.maxMs && hero.walkTo; t += 50) { s.update(50); hero.x = hold.x; hero.y = hold.y; } // held in place
  ok('stuck (not getting closer) = gives up after stuckMs', !hero.walkTo && t <= MO.stuckMs + 100 && t < MO.maxMs, `${t}ms`);
}
{
  // BLOCKED: three melee heroes told to attack an enemy BEHIND a crowd do not push for ever, they hit what is in the way.
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).filter((d) => ['knight', 'berserker', 'samurai'].includes(d.id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(Array(12).fill('risen_skeleton'), 5);
  s.placeLines();
  const last = {}; let gap = 0, onFocus = 0, far = null;
  for (let t = 0; t < 15000; t += 50) {
    for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e7; }
    if (t === 1000) { const h = s.heroes[0]; far = [...es].sort((a, b) => Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y))[0]; s.setFocus(far.uid); }
    for (const e of s.update(50)) if (e.type === 'attack' && e.attacker.side === 'hero') { if (last[e.attacker.uid] !== undefined && t > 1000) gap = Math.max(gap, t - last[e.attacker.uid]); last[e.attacker.uid] = t; if (far && e.target === far) onFocus++; }
  }
  ok('no melee hero goes long without attacking while blocked', gap <= rules.movement.blockedMs + 3000, `${gap}ms`);
  ok('every hero attacked', s.heroes.every((h) => last[h.uid] !== undefined && 15000 - last[h.uid] < 4000));
}
