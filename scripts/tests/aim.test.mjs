// TAP-TO-AIM rules (BattleState.aimable / castSkill(uid, index, aimUid)): one-enemy attack skills hit the tapped enemy.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const itemDefs = loadItems(frozenItems());
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], skillDefs = skills) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroes.find((h) => h.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, skillDefs, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; }
  s.placeLines();
  return { s, es, h: s.heroes[0] };
};
const atk = (h) => h.skills.findIndex((x) => x.kind === 'attack');
const hitOn = (ev, h) => ev.filter((e) => e.type === 'attack' && e.attacker === h && e.target && e.target.side === 'enemy').map((e) => e.target);

// which skills can be aimed: the one-enemy attack skills
const aimIds = heroes.filter((d) => { const { s, h } = mk([d.id]); return s.aimable(h, atk(h)); }).map((d) => d.id).sort();
ok('aimable = the one-enemy attack skills (Knight, Berserker, Rogue, Necromancer, Warden)', JSON.stringify(aimIds) === JSON.stringify(['bard', 'berserker', 'knight', 'necromancer', 'rogue']), aimIds.join());
{ const { s, h } = mk(['knight']); ok('...support skills are never aimed', !s.aimable(h, h.skills.findIndex((x) => x.kind === 'support'))); }

// Knight's Defense Bash hits the tapped enemy, not the tap-focused one
{ const { s, es, h } = mk(['knight']); s.focusUid = es[0].uid;
  const ev = s.castSkill(h.uid, atk(h), es[2].uid);
  ok('Defense Bash hits the TAPPED enemy (not the focused one)', hitOn(ev, h).includes(es[2]) && !hitOn(ev, h).includes(es[0]));
  ok('...and stuns it', es[2].statuses.some((x) => x.type === 'stun')); }
// Warden's Chain Hook: the tapped one instead of the farthest
{ const { s, es, h } = mk(['bard']); es.forEach((e, i) => { e.x = h.x; e.y = h.y - 120 - i * 100; });
  const ev = s.castSkill(h.uid, atk(h), es[0].uid);
  ok('Chain Hook pulls the tapped enemy (not the farthest)', ev.some((e) => e.type === 'pull' && e.target === es[0])); }
// with a wind-up the aim is kept until the skill goes off
{ const slow = { ...skills, defense_bash: { ...skills.defense_bash, castMs: 400 } };
  const { s, es, h } = mk(['knight'], undefined, slow); s.focusUid = es[0].uid;
  const ev = s.castSkill(h.uid, atk(h), es[1].uid); for (let t = 0; t < 600; t += 20) ev.push(...s.update(20));
  ok('...after a wind-up it still hits the tapped enemy', hitOn(ev, h).includes(es[1]) && !hitOn(ev, h).filter((x) => x === es[0]).length);
  ok('...the aim is used up (the next cast picks as usual)', !h.aimUid); }
// the tapped enemy died meanwhile: the skill picks as usual
{ const slow = { ...skills, defense_bash: { ...skills.defense_bash, castMs: 400 } };
  const { s, es, h } = mk(['knight'], undefined, slow);
  const ev = s.castSkill(h.uid, atk(h), es[1].uid); es[1].alive = false; es[1].hp = 0;
  for (let t = 0; t < 600; t += 20) ev.push(...s.update(20));
  ok('...tapped enemy died during the wind-up: it hits another one', hitOn(ev, h).length > 0 && !hitOn(ev, h).includes(es[1])); }
// an aim on a skill that is not aimable is ignored
{ const { s, es, h } = mk(['archer']); const ev = s.castSkill(h.uid, atk(h), es[2].uid);
  ok('an aim on a non-aimable skill (Arrow Rain) is ignored', !h.aimUid && ev.length > 0); }
