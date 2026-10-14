// AREA skills (skills.json `area`, BattleState.areaHit/inZone): a skill that used to hit ALL enemies now
// only hits the ones standing inside its area (circle around the target, cone from the caster, band).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0, ...(v.rotation ? { rotation: v.rotation.map((x) => ({ ...x, castMs: 0 })) } : {}) }]));
const mk = (id, enemyIds = ['goblin', 'goblin', 'goblin']) => {
  const s = new BattleState({ heroDefs: [heroes.find((h) => h.id === id)], enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; }
  s.placeLines();
  return { s, h: s.heroes[0], es };
};
const hitSet = (ev) => new Set(ev.filter((e) => e.type === 'attack').map((e) => e.target));
const at = (u, x, y) => { u.x = u.homeX = x; u.y = u.homeY = y; };

// Ground Pound: around his target. Two enemies close together, one far away.
{ const { s, h, es } = mk('knight'); at(es[0], 100, 340); at(es[1], 160, 340); at(es[2], 360, 340); s.focusUid = es[0].uid;
  const ev = s.castSkill(h.uid, h.skills.findIndex((x) => x.kind === 'attack')); const hit = hitSet(ev);
  ok('Ground Pound hits its target and the enemy next to it', hit.has(es[0]) && hit.has(es[1]));
  ok('...but NOT the enemy far away', !hit.has(es[2]));
  const cast = ev.find((e) => e.type === 'cast');
  ok('...the cast tells the scene where the area is', cast.zone && cast.zone.shape === 'circle' && cast.zone.x === 100); }

// Frost Nova (a rotation spell): same, around the target.
{ const { s, h, es } = mk('mage'); at(es[0], 60, 340); at(es[1], 120, 360); at(es[2], 330, 340); s.focusUid = es[1].uid; h.skills[0].rotation = 1;
  const hit = hitSet(s.castSkill(h.uid, 0));
  ok('Frost Nova: the enemies near its target, not the far one', hit.has(es[0]) && hit.has(es[1]) && !hit.has(es[2])); }

// Fan of Knives: a cone from the Rogue towards his target.
{ const { s, h, es } = mk('rogue'); at(h, 195, 700); at(es[0], 195, 340); at(es[1], 240, 330); at(es[2], 380, 690); s.focusUid = es[0].uid;
  const hit = hitSet(s.castSkill(h.uid, h.skills.findIndex((x) => x.kind === 'attack')));
  ok('Fan of Knives: enemies inside the fan are hit', hit.has(es[0]) && hit.has(es[1]));
  ok('...an enemy off to the side is not', !hit.has(es[2])); }

// Wind Cutter: a band at the target's height.
{ const { s, h, es } = mk('samurai'); at(es[0], 60, 340); at(es[1], 330, 350); at(es[2], 200, 520); s.focusUid = es[0].uid;
  const hit = hitSet(s.castSkill(h.uid, h.skills.findIndex((x) => x.kind === 'attack')));
  ok('Wind Cutter: the whole row at the target\'s height, even far sideways', hit.has(es[0]) && hit.has(es[1]));
  ok('...but not an enemy much lower down', !hit.has(es[2])); }

// Rain of Arrows: a channel; its zone follows the main target while it walks.
{ const { s, h, es } = mk('archer'); at(es[0], 100, 340); at(es[1], 150, 340); at(es[2], 360, 340); s.focusUid = es[0].uid;
  for (const e of es) s.applyStatus(e, { status: 'stun', durationMs: 5000 }, h, 'test', []); // they stand still for this test
  s.castSkill(h.uid, h.skills.findIndex((x) => x.kind === 'attack'));
  const ev = []; for (let t = 0; t < 2400; t += 20) ev.push(...s.update(20));
  const hits = ev.filter((e) => e.type === 'attack' && e.skill); // the rain only, not his basic arrows
  ok('Rain of Arrows: every wave hits the target', hits.filter((e) => e.target === es[0]).length === 5, hits.filter((e) => e.target === es[0]).length);
  ok('...the far enemy is never hit', !hits.some((e) => e.target === es[2])); }

// Without positions (old rule tests) an area skill still hits everyone.
{ const s = new BattleState({ heroDefs: [heroes.find((h) => h.id === 'knight')], enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(['goblin', 'goblin', 'goblin'], 1); const h = s.heroes[0];
  const hit = hitSet(s.castSkill(h.uid, h.skills.findIndex((x) => x.kind === 'attack')));
  ok('without positions: every enemy is hit (as before)', es.every((e) => hit.has(e))); }
