// The Warden (hero id 'bard', reworked from the Bard): Shackles, Chain Hook, Lockdown, Iron Grip.
// Real heroes.json / skills.json; numbers are read from the data.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const W = heroes.find((h) => h.id === 'bard');
const itemDefs = loadItems(frozenItems());
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], { perk = false } = {}) => {
  const defs = ids.map((id) => heroes.find((h) => h.id === id)).map((h) => (perk ? h : { ...h, perk: undefined }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const st = (u, type) => u.statuses.find((x) => x.type === type);

ok('the Warden is a melee tank named Warden', W.name === 'Warden' && W.role === 'Tank' && W.damageType === 'melee');

// ---- Shackles: every Nth basic hit roots + weakens
{ const C = W.passive.counter; const { s, es, a } = mk(['bard']); const g = es[0];
  for (let i = 0; i < C.every - 1; i++) s.landAttack(a, g, []);
  ok(`Shackles: nothing on hits 1-${C.every - 1}`, !st(g, 'rooted') && !st(g, 'weaken'));
  s.landAttack(a, g, []);
  const root = st(g, 'rooted'), weak = st(g, 'weaken');
  const rootSpec = C.apply.find((x) => x.status === 'rooted'), weakSpec = C.apply.find((x) => x.status === 'weaken');
  ok(`...hit ${C.every} ROOTS it for ${rootSpec.durationMs}ms`, root && root.total === rootSpec.durationMs, root && root.total);
  ok(`...and it deals ${-weakSpec.attackPercent}% less damage for ${weakSpec.durationMs}ms`, weak && weak.attackPercent === weakSpec.attackPercent && weak.total === weakSpec.durationMs); }

// ---- Rooted: can't walk, can still attack in reach
{ const { s, es, a } = mk(['bard'], ['goblin']); const g = es[0];
  s.applyStatus(g, { status: 'rooted', durationMs: 2000 }, a, 't', []);
  s.applyStatus(a, { status: 'rooted', durationMs: 9000 }, g, 't', []); // the Warden stays put too, so the goblin must come to him
  const x0 = g.x, y0 = g.y; s.update(500);
  ok('Rooted: a melee enemy far away does not walk', g.x === x0 && g.y === y0);
  s.update(2000);
  ok('...and walks again when it ends', g.x !== x0 || g.y !== y0); }
{ const { s, es, a } = mk(['bard'], ['goblin']); const g = es[0];
  g.x = a.x; g.y = a.y - 50; s.applyStatus(g, { status: 'rooted', durationMs: 5000 }, a, 't', []);
  let swings = 0; for (let t = 0; t < 4000; t += 20) swings += s.update(20).filter((e) => e.type === 'attack' && e.attacker === g).length;
  ok('...but still attacks a hero in reach', swings > 0, swings); }

// ---- Chain Hook: farthest enemy, pulled in front of him, stunned
{ const sk = skills[W.skills.attack]; const { s, es, a } = mk(['bard']);
  es.forEach((e, i) => { e.x = a.x; e.y = a.y - 150 - i * 120; });
  const far = es[2]; const d0 = Math.hypot(far.x - a.x, far.y - a.y);
  const ev = cast(s, a, 'attack');
  ok('Chain Hook hits the FARTHEST enemy', ev.some((e) => e.type === 'attack' && e.target === far) && !ev.some((e) => e.type === 'attack' && e.target !== far && e.target && e.target.side === 'enemy'));
  ok(`...and STUNS it ${sk.apply[0].durationMs}ms`, st(far, 'stun') && st(far, 'stun').total === sk.apply[0].durationMs);
  ok('...a pull event', ev.some((e) => e.type === 'pull' && e.target === far));
  { const x0 = far.x, y0 = far.y; for (let t = 0; t < (sk.pull.delayMs || 0) - 20; t += 20) s.update(20); ok(`...it waits ${sk.pull.delayMs}ms (the hook flying) before sliding`, far.x === x0 && far.y === y0); }
  for (let t = 0; t < sk.pull.ms + 60; t += 20) s.update(20);
  const d1 = Math.hypot(far.x - a.x, far.y - a.y);
  ok(`...it is dragged to about ${sk.pull.gapPx}px in front of him`, Math.abs(d1 - sk.pull.gapPx) < 25, `${Math.round(d0)} -> ${Math.round(d1)}`); }
{ const { s, es, a } = mk(['bard']); es.forEach((e, i) => { e.x = a.x; e.y = a.y - 150 - i * 120; });
  s.focusUid = es[0].uid; const ev = cast(s, a, 'attack');
  ok('...a tapped enemy is hooked instead of the farthest', ev.some((e) => e.type === 'pull' && e.target === es[0])); }
{ const { s, es, a } = mk(['bard'], ['grukk']); const b = es[0]; const y0 = b.y;
  const ev = cast(s, a, 'attack'); for (let t = 0; t < 400; t += 20) s.update(20);
  ok('...a BOSS is not dragged (still hit)', !ev.some((e) => e.type === 'pull') && ev.some((e) => e.type === 'attack' && e.target === b) && Math.abs(b.y - y0) < 30); }

// ---- Lockdown: area around him, weaken + chill
{ const sk = skills[W.skills.support]; const { s, es, a } = mk(['bard']);
  es[0].x = a.x; es[0].y = a.y - 60; es[1].x = a.x + 40; es[1].y = a.y - 90; es[2].x = a.x; es[2].y = a.y - sk.area.radius - 120;
  cast(s, a, 'support');
  const wk = sk.apply.find((x) => x.status === 'weaken'), ch = sk.apply.find((x) => x.status === 'chill');
  ok(`Lockdown: enemies within ${sk.area.radius}px are WEAKENED (${wk.attackPercent}%)`, [es[0], es[1]].every((e) => st(e, 'weaken') && st(e, 'weaken').attackPercent === wk.attackPercent));
  ok(`...and get ${ch.stacks} CHILL`, [es[0], es[1]].every((e) => e.statuses.filter((x) => x.type === 'chill').length === ch.stacks));
  ok('...the far one is untouched', !st(es[2], 'weaken') && !st(es[2], 'chill')); }

// ---- Iron Grip (perk): squad control on enemies lasts longer
{ const mod = W.perk.mods.find((m) => m.special === 'controlDuration');
  const on = mk(['bard', 'knight'], ['goblin'], { perk: true }), off = mk(['bard', 'knight'], ['goblin']);
  for (const x of [on, off]) x.s.applyStatus(x.es[0], { status: 'stun', durationMs: 1000 }, x.h[1], 't', []);
  const a = st(off.es[0], 'stun').total, b = st(on.es[0], 'stun').total;
  ok(`Iron Grip: a squad-mate's stun lasts +${mod.percent}%`, Math.abs(b / a - (1 + mod.percent / 100)) < 1e-6, `${a} -> ${b}`);
  for (const x of [on, off]) x.s.applyStatus(x.es[0], { status: 'poison', durationMs: 1000 }, x.h[1], 't', []);
  ok('...not damage over time', st(on.es[0], 'poison').total === st(off.es[0], 'poison').total);
  for (const x of [on, off]) x.s.applyStatus(x.h[1], { status: 'stun', durationMs: 1000 }, x.es[0], 't', []);
  ok('...not control put on heroes', st(on.h[1], 'stun').total === st(off.h[1], 'stun').total); }
