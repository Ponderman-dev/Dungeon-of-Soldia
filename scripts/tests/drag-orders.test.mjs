// Drag orders (user's sketch): drag a hero onto an enemy = only that hero attacks it; tap focus stays for the others.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const mk = () => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin', 'bandit', 'slime'], 5);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; }
  s.placeLines();
  return { s, es, h: s.heroes };
};
{
  const { s, es, h } = mk();
  ok('an order needs a living hero and a living enemy', s.setOrder(h[0].uid, es[2].uid) && !s.setOrder(h[0].uid, 9999));
  s.setFocus(es[0].uid);
  ok('the ordered hero goes for ITS enemy, the others for the tapped one', s.pickTarget(h[0]) === es[2] && s.pickTarget(h[1]) === es[0] && s.pickTarget(h[2]) === es[0]);
  const ev = [];
  for (let t = 0; t < 8000; t += 50) ev.push(...s.update(50));
  const hitBy0 = new Set(ev.filter((e) => e.type === 'attack' && e.attacker === h[0]).map((e) => e.target));
  ok('in a fight that hero only hits its enemy', hitBy0.size === 1 && hitBy0.has(es[2]));
  ok('a melee hero walks over to it', h[0].damageType !== 'melee' || s.inReach(h[0], es[2]));
}
{
  const { s, es, h } = mk();
  s.setOrder(h[1].uid, es[1].uid);
  s.killUnit(es[1], []);
  ok('the order ends when its enemy dies', h[1].order === null && s.pickTarget(h[1]) !== es[1]);
  s.setOrder(h[1].uid, es[0].uid);
  s.spawnEnemies(['goblin'], 6);
  ok('...and when the floor ends', h[1].order === null);
}
{
  const { s, es, h } = mk();
  s.setOrder(h[2].uid, es[1].uid);
  es[1].burrowed = { remaining: 1000, spec: {} }; // can't be hit right now (Cave Worm)
  ok('an enemy that cannot be hit right now: the hero fights on normally, the order waits', s.pickTarget(h[2]) !== es[1] && h[2].order === es[1].uid);
  es[1].burrowed = null;
  ok('...and comes back to it', s.pickTarget(h[2]) === es[1]);
  ok('minions cannot get orders', !s.setOrder(12345, es[0].uid));
}
