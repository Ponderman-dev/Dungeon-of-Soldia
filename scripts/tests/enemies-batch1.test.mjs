// The 10 new enemies, batch 1: Kobold Sapper (bomb on death), Goblin Shaman (heals), Shieldbearer (shields an ally),
// Stone Golem (enrage under 50%), Lava Hound (howl at 30%). Also: buffs on enemies really change their stats.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { rosterFor } from '../../src/systems/dungeon.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const defs = r('enemies.json');
const A = r('dungeons.json').A;
const mk = (ids, floor = 30) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: defs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.99 });
  const es = s.spawnEnemies(ids, floor);
  for (const h of s.heroes) { h.hp = h.maxHp = 1e6; }
  s.placeLines();
  return { s, es, h: s.heroes };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 50) ev.push(...s.update(50)); return ev; };
const freeze = (s) => { for (const u of [...s.heroes, ...s.enemies]) u.timer = -1e9; }; // nobody attacks (pure ability tests)

ok('all five are in the roster on their floors', ['sapper', 'shaman', 'shieldbearer', 'golem', 'hound'].every((id) => defs[id] && A.roster.some((e) => e.id === id)));
ok('Sapper 5-35, Shaman 12-50 (they leave deeper down)', rosterFor(A, 5).some((e) => e.id === 'sapper') && !rosterFor(A, 36).some((e) => e.id === 'sapper') && !rosterFor(A, 51).some((e) => e.id === 'shaman'));
ok('the Golem is strong and at most one per fight', defs.golem.tier === 'strong' && A.roster.find((e) => e.id === 'golem').max === 1);

{ // buffs on enemies work now (they used to do nothing)
  const { s, es } = mk(['goblin']);
  const before = es[0].stats.attackEfficiency;
  s.applyStatus(es[0], { status: 'buff', durationMs: 1000, mods: [{ stat: 'attackEfficiency', percent: 50 }] }, es[0], 'x', []);
  ok('a buff on an enemy raises its stat', Math.abs(es[0].stats.attackEfficiency - before * 1.5) < 0.01);
  run(s, 1100);
  ok('...and it goes back when the buff ends', Math.abs(es[0].stats.attackEfficiency - before) < 0.01);
}
{
  const { s, es } = mk(['golem', 'goblin']);
  freeze(s);
  const g = es[0], speed = g.stats.attackEfficiency;
  run(s, 200);
  ok('Golem: no enrage above 50%', g.stats.attackEfficiency === speed);
  g.hp = g.maxHp * 0.45;
  const ev = run(s, 200);
  ok('Golem: under 50% it ENRAGES (+50% attack speed, a small popup move)', Math.abs(g.stats.attackEfficiency - speed * 1.5) < 0.01 && ev.some((e) => e.type === 'bossAbility' && e.minor));
}
{
  const { s, es } = mk(['hound', 'goblin', 'bandit']);
  freeze(s);
  const [hound, gob, ban] = es, gs = gob.stats.attackEfficiency, hs = hound.stats.attackEfficiency;
  hound.hp = hound.maxHp * 0.25;
  run(s, 200);
  ok('Lava Hound at 30%: the OTHER enemies get +25% attack speed', Math.abs(gob.stats.attackEfficiency - gs * 1.25) < 0.01 && ban.stats.attackEfficiency > ban.baseStats.attackEfficiency && hound.stats.attackEfficiency === hs);
  run(s, 5200);
  ok('...for 5 seconds', Math.abs(gob.stats.attackEfficiency - gs) < 0.01);
}
{
  const { s, es } = mk(['shaman', 'goblin', 'bandit']);
  freeze(s);
  run(s, 4000);
  ok('Shaman: waits while nobody is hurt', es.every((e) => e.hp === e.maxHp));
  es[2].hp = es[2].maxHp * 0.3; es[1].hp = es[1].maxHp * 0.8;
  const hp = es[2].hp;
  const ev = run(s, 100);
  ok('...then heals the MOST hurt enemy 15%', Math.abs(es[2].hp - hp - es[2].maxHp * 0.15) < 1 && ev.some((e) => e.type === 'bossAbility'));
}
{
  const { s, es } = mk(['shieldbearer', 'goblin', 'bandit']);
  freeze(s);
  es[1].hp = es[1].maxHp * 0.5;
  run(s, 2100);
  const sh = es[1].statuses.find((st) => st.type === 'shield');
  const pct = defs.shieldbearer.abilities.find((a) => a.shield).shield.percentOwnHp / 100;
  ok('Shieldbearer: shields the most hurt enemy for a share of ITS OWN health', sh && Math.abs(sh.amount - es[0].maxHp * pct) < 1);
}
{
  const { s, es } = mk(['shieldbearer', 'goblin']);
  freeze(s);
  es[0].hp = es[0].maxHp * 0.2; es[1].hp = es[1].maxHp * 0.6; // it is the most hurt, but never shields itself
  run(s, 2100);
  ok('...never itself: the most hurt OTHER enemy gets it', !es[0].statuses.some((st) => st.type === 'shield') && es[1].statuses.some((st) => st.type === 'shield'));
  const { s: s2, es: e2 } = mk(['shieldbearer']);
  freeze(s2); e2[0].hp = e2[0].maxHp * 0.5; run(s2, 2100);
  ok('...alone: no shield at all', !e2[0].statuses.some((st) => st.type === 'shield'));
}
{
  const { s, es, h } = mk(['sapper', 'goblin']);
  const sap = es[0];
  sap.x = h[0].x; sap.y = h[0].y - 30; // it dies right next to the Knight
  const ev = []; s.killUnit(sap, ev);
  ok('Sapper: dies and leaves a lit bomb (no blast yet)', s.bombs.length === 1 && ev.some((e) => e.type === 'bombDrop') && !ev.some((e) => e.type === 'deathBurst'));
  const hp0 = h[0].hp;
  const ev2 = run(s, 1400);
  ok('...the heroes walk out of the blast', Math.hypot(h[0].x - s.bombs[0].x, h[0].y - s.bombs[0].y) > 75 && !ev2.some((e) => e.type === 'deathBurst'));
  const ev3 = run(s, 200);
  ok('...and it goes off after 1.5s', s.bombs.length === 0 && ev3.some((e) => e.type === 'deathBurst' && e.explosive));
  // A hero who stays in it gets hurt (no positions: the blast hits everyone).
  const t = mk(['sapper']);
  for (const u of [...t.s.heroes, ...t.s.enemies]) u.x = u.y = undefined;
  const e4 = []; t.s.killUnit(t.es[0], e4);
  const before = t.h.map((x) => x.hp);
  const e5 = run(t.s, 1600);
  ok('...and burns whoever is still inside (fire)', e5.some((e) => e.type === 'attack' && e.damageType === 'fire') && t.h.some((x, i) => x.hp < before[i]));
  void hp0;
  // The last enemy is a Sapper: its bomb must not stay on the floor after the win (user bug).
  const w = mk(['sapper']);
  const ew = []; w.s.killUnit(w.es[0], ew);
  const end = w.s.endFloor([]);
  ok('...a bomb still lit when the floor is won goes out with the floor', w.s.bombs.length === 0 && end.some((e) => e.type === 'bombFizzle'));
}
{
  let err = null;
  for (const ids of [['sapper', 'sapper', 'shaman'], ['shieldbearer', 'golem', 'hound'], ['shaman', 'shieldbearer', 'hound', 'sapper']]) {
    const { s } = mk(ids, 60);
    for (const u of s.heroes) u.hp = u.maxHp = 4000;
    try { run(s, 60000); } catch (e) { err = e; }
  }
  ok('long fights with all of them run without errors', !err, err ? err.stack : '');
}
