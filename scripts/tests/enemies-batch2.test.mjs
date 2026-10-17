// The 10 new enemies, batch 2: Cave Worm (burrow + pop up stun), Bone Acolyte (raises the first enemy dying near it),
// Blink Imp (teleports to the weakest hero), Banshee (Wail wind-up = silence), Crystal Sentinel (adaptive resist).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const defs = r('enemies.json');
const A = r('dungeons.json').A;
const mk = (ids, floor = 80) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: defs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.99 });
  const es = s.spawnEnemies(ids, floor);
  for (const h of s.heroes) { h.baseStats.health = 1e6; }
  s.refreshStats(); for (const h of s.heroes) h.hp = h.maxHp;
  s.placeLines();
  return { s, es, h: s.heroes };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 50) ev.push(...s.update(50)); return ev; };
const freeze = (s) => { for (const u of [...s.heroes, ...s.enemies, ...s.minions]) u.timer = -1e9; };
const ids = ['worm', 'acolyte', 'blinkimp', 'banshee', 'sentinel'];
ok('all five are in the roster on their floors (38, 42, 52, 65, 75)', ids.every((id, i) => defs[id] && A.roster.find((e) => e.id === id).from === [38, 42, 52, 65, 75][i]));
ok('the Banshee flies', defs.banshee.flying === true);

{
  const { s, es, h } = mk(['worm', 'goblin']);
  freeze(s);
  const w = es[0];
  const ev = run(s, 4100);
  ok('Worm: after 4s it burrows and cannot be hit', w.burrowed && s.untargetable(w) && ev.some((e) => e.type === 'burrow'));
  const miss = s.strike(h[2], w, [], { basic: true });
  ok('...a hit on it is wasted', miss.dodged);
  const ev2 = run(s, 1600);
  const t = ev2.find((e) => e.type === 'surface');
  ok('...1.5s later it pops up next to a hero, hits it and stuns it', t && t.target && !w.burrowed && Math.hypot(w.x - t.target.x, w.y - t.target.y) < 60 && t.target.statuses.some((x) => x.type === 'stun') && ev2.some((e) => e.type === 'attack' && e.target === t.target));
}
{
  const { s, es } = mk(['acolyte', 'goblin', 'bandit']);
  for (const e of es) e.x = es[0].x - 60; // standing close together
  const ev = []; s.killUnit(es[1], ev);
  ok('Acolyte: the first enemy dying near it comes back as a skeleton', ev.some((e) => e.type === 'raiseDead') && s.enemies.some((e) => e.def.id === 'risen_skeleton' && e.alive));
  const ev2 = []; s.killUnit(es[2], ev2);
  ok('...only once per acolyte', !ev2.some((e) => e.type === 'raiseDead'));
  const t = mk(['acolyte', 'goblin']);
  t.es[1].x = t.es[0].x + 400; // far away
  const ev3 = []; t.s.killUnit(t.es[1], ev3);
  ok('...not when the enemy dies far away', !ev3.some((e) => e.type === 'raiseDead'));
  const u = mk(['acolyte', 'acolyte']);
  u.es[1].x = u.es[0].x - 60;
  const ev4 = []; u.s.killUnit(u.es[1], ev4);
  ok('...acolytes never raise acolytes', !ev4.some((e) => e.type === 'raiseDead'));
}
{
  const { s, es, h } = mk(['blinkimp']);
  freeze(s);
  h[1].hp = h[1].maxHp * 0.3; // the weakest
  const ev = run(s, 2600);
  const b = ev.find((e) => e.type === 'blink');
  ok('Blink Imp: teleports next to the hero with the lowest health and stabs it', b && b.target === h[1] && Math.hypot(es[0].x - h[1].x, es[0].y - h[1].y) < 60 && ev.some((e) => e.type === 'attack' && e.target === h[1] && e.attacker === es[0]));
  ok('...and keeps fighting that hero', es[0].foe === h[1].uid);
}
{
  const { s, es, h } = mk(['banshee']);
  freeze(s);
  const ev = run(s, 5100);
  ok('Banshee: winds up its Wail (a red bar = a cast)', es[0].bossCast && ev.some((e) => e.type === 'castStart'));
  run(s, 1600);
  ok('...then every hero is silenced', h.every((x) => x.statuses.some((st) => st.type === 'silence')));
  const t = mk(['banshee']);
  freeze(t.s);
  run(t.s, 5100);
  t.s.applyStatus(t.es[0], { status: 'stun', durationMs: 1000 }, t.h[0], 'x', []);
  run(t.s, 1600);
  ok('...a stun during the wind-up stops it', t.h.every((x) => !x.statuses.some((st) => st.type === 'silence')));
}
{
  const { s, es, h } = mk(['sentinel']);
  const sen = es[0];
  const c = { ...h[0], damageType: 'fire', stats: { ...h[0].stats, crit: 0 } };
  const first = s.strike(c, sen, [], { damageType: 'fire' });
  const second = s.strike(c, sen, [], { damageType: 'fire' });
  const ice = s.strike(c, sen, [], { damageType: 'ice' });
  ok('Sentinel: plain at first, then resists the element that hit it', first.mult === 1 && second.mult < 1, `${first.mult} ${second.mult}`);
  ok('...and is weak to a different one (which it then resists)', ice.mult > 1 && sen.resists.includes('ice'));
  freeze(s);
  run(s, 4100);
  ok('...it wears off after 4s', !sen.adapt && sen.resists.length === 0 && sen.weak.length === 0);
}
{
  let err = null;
  for (const line of [['worm', 'worm', 'acolyte', 'goblin'], ['blinkimp', 'banshee', 'sentinel'], ['acolyte', 'worm', 'banshee', 'blinkimp', 'sentinel']]) {
    const { s } = mk(line, 90);
    for (const u of s.heroes) { u.baseStats.health = 6000; } s.refreshStats(); for (const u of s.heroes) u.hp = u.maxHp;
    try { run(s, 60000); } catch (e) { err = e; }
  }
  ok('long fights with all of them run without errors', !err, err ? err.stack : '');
}
