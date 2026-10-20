// Crowds (BattleState.move): a big crowd (3 heroes, 7 skeletons, 4 enemies) does not slide into the
// side walls, and fighters that stand still and swing are not shoved around much (combat.json
// movement.settledPushShare, settledPairPush, wallSoftPx). Compared with the old way (all off).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const base = r('combat.json');
const all = r('heroes.json');

function crowd(movement, seed) {
  let x = seed;
  const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const rules = { ...base, movement: { ...base.movement, ...movement }, minions: { ...base.minions, itemWeakCap: 9 } };
  const s = new BattleState({ heroDefs: ['knight', 'necromancer', 'berserker'].map((id) => all.find((h) => h.id === id)), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), minionDefs: r('minions.json'), rng });
  const es = s.spawnEnemies(['goblin', 'goblin', 'orcBrute', 'goblin'], 1);
  s.placeLines();
  s.startFloor();
  const src = { kind: 'weak', key: 'test', capGroup: 'item', spec: { minion: 'skeleton', cap: 9 } };
  for (let i = 0; i < 7; i++) s.spawnMinion(s.heroes[1], src, []);
  const L = rules.movement.layout;
  let wall = 0, n = 0, shoved = 0;
  const last = new Map();
  for (let t = 0; t < 20000; t += 20) {
    s.update(20);
    for (const u of [...s.heroes, ...es, ...s.minions]) {
      u.hp = u.maxHp = 1e9; // nobody dies: we only watch them move
      if (!u.alive || u.x == null) continue;
      n++;
      if (u.x <= L.marginX + 3 || u.x >= L.width - L.marginX - 3) wall++;
      const p = last.get(u);
      if (p && u.pending) shoved += Math.hypot(u.x - p.x, u.y - p.y);
      last.set(u, { x: u.x, y: u.y });
    }
  }
  return { wall: wall / n, shoved };
}
const avg = (m) => { let w = 0, sh = 0; for (let i = 1; i <= 6; i++) { const c = crowd(m, i * 7919); w += c.wall; sh += c.shoved; } return { wall: w / 6, shoved: sh / 6 }; };
const oldWay = avg({ settledPushShare: 1, settledPairPush: 1, wallSoftPx: 0 });
const now = avg({});
// Since minions make way (2026-10-20) even the old way hardly touches the walls: 'almost never' (<0.5%) is enough.
ok('a big crowd spends much less time squashed against the side walls', now.wall <= Math.max(oldWay.wall * 0.4, 0.005), `${(now.wall * 100).toFixed(1)}% vs old ${(oldWay.wall * 100).toFixed(1)}%`);
ok('fighters that are swinging get shoved less', now.shoved < oldWay.shoved * 0.7, `${now.shoved.toFixed(0)}px vs old ${oldWay.shoved.toFixed(0)}px`);
