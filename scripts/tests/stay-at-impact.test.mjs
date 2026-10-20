// Dash and leap skills (skills.json `staysAtImpact`: Defense Bash, Multistrike, Savage Leap): the hero really moves to
// where the skill hits and STAYS there afterwards (user 2026-10-20: no going back to its old spot). How far comes from
// the skill's look in combat.json skillFx (dash: distance minus stopPx, between minPx and maxPx; leap: share of the way).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), skills = r('skills.json'), heroes = r('heroes.json'), F = rules.skillFx;

for (const heroId of ['knight', 'rogue', 'berserker']) {
  const def = heroes.find((h) => h.id === heroId), skillId = def.skills.attack, sk = skills[skillId];
  ok(`${sk.name} is a stay-at-impact skill`, sk.staysAtImpact === true);
  const s = new BattleState({ heroDefs: [def], enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: skills, minionDefs: r('minions.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const [enemy] = s.spawnEnemies(['goblin'], 1);
  s.placeLines();
  const [hero] = s.heroes;
  for (const u of [hero, enemy]) { u.hp = u.maxHp = 1e9; u.stats.attackEfficiency = 0; } // nobody dies, nobody swings
  s.place(hero, hero.x, hero.y); s.place(enemy, hero.x, hero.y - 220); // far apart: the skill has to cover the ground
  const before = { x: hero.x, y: hero.y };
  hero.skills[0].cooldownLeft = 0;
  const ev = [];
  s.castSkill(hero.uid, 0);
  for (let t = 0; t < 1500 && !ev.some((e) => e.type === 'cast'); t += 20) ev.push(...s.update(20));
  const cast = ev.find((e) => e.type === 'cast');
  ok(`${sk.name}: the cast says where he came from`, cast && cast.moved && Math.abs(cast.moved.x - before.x) < 1 && Math.abs(cast.moved.y - before.y) < 1);
  const went = Math.hypot(hero.x - before.x, hero.y - before.y);
  const gap = Math.hypot(enemy.x - before.x, enemy.y - before.y); // the goblin walked in during the wind-up: measure at the hit
  const dash = F.dash[skillId], leap = F.look[skillId] && F.look[skillId].leap;
  const M = rules.movement, k = ((hero.size || 1) + (enemy.size || 1)) / 2;
  const edge = M.separateY * (1 + (k - 1) * 0.5); // straight up: the push-apart edge is the oval's height
  const want = Math.min(dash ? Math.min(dash.maxPx, Math.max(dash.minPx, gap - dash.stopPx)) : gap * leap.share, gap - edge - 1);
  ok(`${sk.name}: he moves the skill's distance towards the target`, Math.abs(went - want) < 6 && hero.y < before.y, `${went.toFixed(0)} / ${want.toFixed(0)}px`);
  ok(`${sk.name}: ...but never into the target's body`, Math.hypot(enemy.x - hero.x, enemy.y - hero.y) >= edge - 4, `${Math.hypot(enemy.x - hero.x, enemy.y - hero.y).toFixed(0)} >= ${edge.toFixed(0)}`);
  // The target is gone (nothing to walk to): he must stay where he landed, not walk back to his old spot.
  const landed = { x: hero.x, y: hero.y };
  s.killUnit(enemy, []);
  for (let t = 0; t < 2000; t += 20) s.update(20);
  ok(`${sk.name}: afterwards he stays where he hit`, Math.hypot(hero.x - landed.x, hero.y - landed.y) < 2 && hero.y < before.y - want * 0.8 + 1, `${Math.hypot(hero.x - landed.x, hero.y - landed.y).toFixed(1)}px from the landing`);
}
