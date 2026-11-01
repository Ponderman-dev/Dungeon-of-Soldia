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
