// C1 skill wind-up: a tapped skill goes on cooldown at once, winds up (castStart) for castMs, then
// goes off ('cast'). Stunned / frozen / silenced during the wind-up: the skill is lost and STAYS on
// cooldown (user's choice). No basic attacks and no walking while winding up.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), skills = r('skills.json');
const mk = () => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: skills, rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const [g] = s.spawnEnemies(['goblin'], 1);
  for (const u of [...s.heroes, g]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; u.timer = -1e12; }
  return { s, g, knight: s.heroes[0] };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };
const castMs = (id) => skills[id].castMs ?? rules.skillWindUp.defaultCastMs;

ok('a wind-up is longer than a normal swing', rules.skillWindUp.defaultCastMs > rules.attackTiming.hero.swingMs);

{ const { s, g, knight } = mk(); const id = knight.skills[0].id;
  const ev = s.castSkill(knight.uid, 0);
  ok('tapping starts a wind-up (castStart), no damage yet', ev.some((e) => e.type === 'castStart' && e.castMs === castMs(id)) && !ev.some((e) => e.type === 'attack'));
  ok('the skill is on cooldown at once', knight.skills[0].cooldownLeft === skills[id].cooldownMs);
  ok('cannot tap another skill while winding up', s.castSkill(knight.uid, 1).length === 0);
  const early = run(s, castMs(id) - 60);
  ok('nothing goes off before the wind-up ends', !early.some((e) => e.type === 'cast'));
  const late = run(s, 100);
  ok('then the skill goes off', late.some((e) => e.type === 'cast' && e.unit === knight) && late.some((e) => e.type === 'attack' && e.attacker === knight && e.skill)); }

for (const status of ['stun', 'freeze', 'silence']) {
  const { s, g, knight } = mk(); const id = knight.skills[0].id;
  s.castSkill(knight.uid, 0); run(s, 100);
  s.applyStatus(knight, { status, durationMs: 300 }, g, 'x', []);
  const ev = run(s, castMs(id) + 400);
  ok(`${status} during the wind-up: the skill is lost`, ev.some((e) => e.type === 'castCancel' && e.unit === knight) && !ev.some((e) => e.type === 'cast'));
  ok(`...and stays on cooldown`, knight.skills[0].cooldownLeft > 0 && !s.canCast(knight, 0));
}

{ const { s, g, knight } = mk(); knight.timer = 0;
  s.castSkill(knight.uid, 0); knight.timer = s.interval(knight) * 5;
  const ev = run(s, castMs(knight.skills[0].id) - 60);
  ok('no basic attacks while winding up', !ev.some((e) => e.type === 'attackStart' && e.attacker === knight)); }

{ const { s, g, knight } = mk(); s.placeLines(); const x = knight.x, y = knight.y;
  s.castSkill(knight.uid, 0); run(s, castMs(knight.skills[0].id) - 60);
  ok('no walking while winding up', knight.x === x && knight.y === y); }

{ const { s, g, knight } = mk();
  s.castSkill(knight.uid, 0); const ev = []; s.killUnit(g, ev);
  const after = run(s, castMs(knight.skills[0].id) + 100);
  ok('enemy gone before it goes off: cancelled quietly', after.some((e) => e.type === 'castCancel' && e.reason === 'noTarget') && !after.some((e) => e.type === 'cast')); }
