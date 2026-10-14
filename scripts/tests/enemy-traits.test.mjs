// Enemy traits: `onHit` (a chance to put a status on the hero it hits, e.g. the Spider poisons) and
// `onDeath` (a burst when it dies, e.g. the Puffshroom's poison cloud on the heroes close by).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const base = r('enemies.json').goblin;
const enemyDefs = {
  ...r('enemies.json'),
  poisoner: { ...base, name: 'Poisoner', onHit: [{ status: 'poison', chance: 100, durationMs: 3000, damageMultiplier: 0.1 }] },
  never: { ...base, name: 'Never', onHit: [{ status: 'poison', chance: 0, durationMs: 3000, damageMultiplier: 0.1 }] },
  shroom: { ...base, name: 'Shroom', onDeath: { radius: 100, apply: [{ status: 'poison', durationMs: 3000, damageMultiplier: 0.1 }] } },
};
const mk = (ids, place = false) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(ids, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; }
  if (place) s.placeLines();
  return { s, es, h: s.heroes };
};
const has = (u, st) => u.statuses.some((x) => x.type === st);

{ const { s, es, h } = mk(['poisoner']);
  s.landAttack(es[0], h[0], []);
  ok('onHit 100%: the hero it hits is poisoned', has(h[0], 'poison'));
  ok('...only the hero it hit', !has(h[1], 'poison') && !has(h[2], 'poison')); }

{ const { s, es, h } = mk(['never']);
  s.landAttack(es[0], h[0], []);
  ok('onHit 0%: never applies', !has(h[0], 'poison')); }

{ const { s, es, h } = mk(['poisoner']);
  h[0].stats.evasion = 100; s.rules = { ...s.rules, caps: { ...s.rules.caps, evasion: 100 } };
  s.landAttack(es[0], h[0], []);
  ok('a dodged hit applies nothing', !has(h[0], 'poison')); }

{ const { s, es, h } = mk(['shroom'], true);
  const e = es[0];
  h[0].x = e.x; h[0].y = e.y + 50; // close
  h[1].x = e.x + 400; h[1].y = e.y + 400; // far
  const ev = [];
  s.killUnit(e, ev, h[2]);
  ok('onDeath: a deathBurst event', ev.some((x) => x.type === 'deathBurst' && x.unit === e));
  ok('...heroes inside the radius get the status', has(h[0], 'poison'));
  ok('...heroes outside it do not', !has(h[1], 'poison')); }

{ const { s, es, h } = mk(['shroom']);
  s.killUnit(es[0], [], h[0]);
  ok('onDeath without positions: every living hero', h.every((x) => has(x, 'poison'))); }
