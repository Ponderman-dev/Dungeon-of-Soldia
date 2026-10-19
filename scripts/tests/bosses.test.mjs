// Bosses (every 20 floors, systems/bosses.js + enemies.json): each boss's gimmick.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const enemies = r('enemies.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const itemDefs = loadItems(r('items.json'));
const mk = (enemyIds, floor = 20) => {
  const s = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => ({ ...heroes.find((h) => h.id === id), perk: undefined })), enemyDefs: enemies, minionDefs: r('minions.json'), itemDefs, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: Math.random });
  const es = s.spawnEnemies(enemyIds, floor);
  for (const u of s.heroes) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; u.stats.attack = 0; }
  for (const u of es) { u.stats.evasion = 0; }
  s.startFloor();
  return { s, es, h: s.heroes };
};
const run = (s, ms, step = 50) => { const ev = []; for (let t = 0; t < ms; t += step) ev.push(...s.update(step)); return ev; };
const A = r('dungeons.json').A;

ok('8 boss floors (20, 40 ... 160), every id exists', Object.keys(A.bosses).length === 8 && Object.values(A.bosses).flat().every((id) => enemies[id]));
ok('a boss floor always brings its own line-up', JSON.stringify(enemiesForFloor(A, 40, Math.random)) === JSON.stringify(['brood_mother']));

// ---- Grukk + War Drum
{ const { s, es } = mk(['grukk', 'war_drum']); const [g, drum] = es;
  const fast = s.interval(g); drum.alive = false; const slow = s.interval(g); drum.alive = true;
  ok('War Drum: Grukk attacks faster while the drum stands', fast < slow, `${fast} < ${slow}`);
  const ev = run(s, 3200);
  ok('...the drum beats up a goblin', ev.some((e) => e.type === 'enemySpawn' && e.unit.def.id === 'goblin')); }
{ const { s, es } = mk(['grukk']); const g = es[0]; g.hp = g.maxHp = 1e6;
  const ev = run(s, 5100);
  ok('Grukk winds up Cleaver Charge (a boss cast with a red bar)', ev.some((e) => e.type === 'castStart' && e.boss) && g.bossCast);
  s.applyStatus(g, { status: 'stun', durationMs: 2000 }, s.heroes[0], 'test', []);
  const ev2 = run(s, 200);
  ok('...a stun INTERRUPTS it', ev2.some((e) => e.type === 'castCancel' && e.unit === g && e.reason === 'interrupted') && !g.bossCast); }

// ---- Brood Mother
{ const { s, es } = mk(['brood_mother']); const b = es[0]; b.hp = b.maxHp = 1e6;
  const ev = run(s, 4700);
  const sacs = s.enemies.filter((e) => e.def.id === 'egg_sac');
  ok('Brood Mother lays egg sacs', sacs.length === 2, sacs.length);
  const ev2 = run(s, 6200);
  ok('...an egg sac left alone hatches into 3 spiderlings', ev2.some((e) => e.type === 'hatch') && s.enemies.filter((e) => e.alive && e.def.id === 'spiderling').length >= 3); }

// ---- Frost Warden
{ const { s, es, h } = mk(['frost_warden']); const w = es[0]; w.hp = w.maxHp = 1e6;
  const ev = []; s.applyStatus(w, { status: 'chill', durationMs: 3000, stacks: 1 }, h[0], 'test', ev);
  ok('Frost Warden cannot be chilled', !w.statuses.some((x) => x.type === 'chill') && ev.some((e) => e.type === 'immuneStatus'));
  h[0].stats.attack = 50; const hp0 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'melee' }); const plated = hp0 - w.hp;
  w.plates = 0; const hp1 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'melee' }); const bare = hp1 - w.hp;
  ok('...her armor plates cut the damage a lot', plated < bare * 0.5, `${plated} vs ${bare}`);
  w.plates = 3; w.plateHp = 10; const ev3 = []; s.strike(h[0], w, ev3, { multiplier: 1, damageType: 'fire' });
  ok('...fire breaks a plate', w.plates === 2 && ev3.some((e) => e.type === 'plateBreak')); }

// ---- Rask & Vesh
{ const { s, es, h } = mk(['rask', 'vesh']); const [rask, vesh] = es;
  const ev = []; rask.hp = 0; s.killUnit(rask, ev, h[0]);
  ok('Twins: when Rask falls Vesh ENRAGES', ev.some((e) => e.type === 'enrage' && e.unit === vesh) && vesh.statuses.some((x) => x.type === 'buff'));
  vesh.hp = vesh.maxHp = 1e6;
  const ev2 = run(s, 8200);
  ok('...and raises him again after 8s at 30% health', rask.alive && ev2.some((e) => e.type === 'revive') && Math.abs(rask.hp / rask.maxHp - 0.3) < 0.05); }

// ---- Morthul
{ const { s, es, h } = mk(['morthul']); const m = es[0];
  const ev = []; m.hp = 0; s.killUnit(m, ev, h[0]);
  const crystal = s.enemies.find((e) => e.def.id === 'phylactery');
  ok('Morthul falls to DUST (still in the fight, cannot be hit) and his crystal appears', m.alive && m.dust && s.untargetable(m) && crystal && crystal.alive && ev.some((e) => e.type === 'dust'));
  ok('...heroes can only aim at the crystal', s.targetableEnemies().length === 1 && s.targetableEnemies()[0] === crystal);
  const ev2 = []; crystal.hp = 0; s.killUnit(crystal, ev2, h[0]);
  ok('...breaking the crystal ends him for good', !m.alive && s.allEnemiesDead()); }
{ const { s, es, h } = mk(['morthul']); const m = es[0];
  m.hp = 0; s.killUnit(m, [], h[0]);
  const crystal = s.enemies.find((e) => e.def.id === 'phylactery'); crystal.hp = crystal.maxHp = 1e6;
  const ev = run(s, 10200);
  ok('...a crystal left alone: he REFORMS at 50% health', m.alive && !m.dust && ev.some((e) => e.type === 'reform') && Math.abs(m.hp / m.maxHp - 0.5) < 0.1, (m.hp / m.maxHp).toFixed(2)); }
// He comes back only maxReforms times: the crystal after that ends him (a fight could never end before).
{ const { s, es, h } = mk(['morthul']); const m = es[0]; const max = m.def.phylactery.maxReforms;
  let reforms = 0;
  for (let i = 0; i <= max; i++) {
    m.hp = 0; s.killUnit(m, [], h[0]);
    const crystal = s.enemies.find((e) => e.def.id === 'phylactery' && e.alive); crystal.hp = crystal.maxHp = 1e9;
    reforms += run(s, m.def.phylactery.reformMs + 200).filter((e) => e.type === 'reform').length;
  }
  ok(`Morthul comes back ${max} times, then his crystal running out ends him for good`, reforms === max && !m.alive && s.allEnemiesDead(), `${reforms} reforms, alive ${m.alive}`); }

// ---- Ignatius
{ const { s, es, h } = mk(['ignatius']); const ig = es[0]; ig.hp = ig.maxHp = 1e6;
  run(s, 1000);
  ok('Ignatius heats up over time', ig.heat > 3, ig.heat);
  const h0 = ig.heat; s.heatFromHit(ig, 'fire', []); const hot = ig.heat - h0;
  const h1 = ig.heat; s.heatFromHit(ig, 'ice', []); const cold = ig.heat - h1;
  ok('...fire hits heat him, ice cools him', hot > 0 && cold < 0);
  ig.heat = 99.9; const ev = []; s.addHeat(ig, 1, ev);
  ok('...full heat = ERUPTION on the whole squad', ev.some((e) => e.type === 'bossAbility' && e.ability.id === 'eruption') && ig.heat === 0); }

// ---- Sela
{ const { s, es, h } = mk(['sela']); const se = es[0]; se.hp = se.maxHp = 1e6;
  run(s, 100);
  const clones = s.enemies.filter((e) => e.alive && e.def.glass);
  ok('Sela makes a glass clone of every hero at the start', clones.length === 3, clones.length);
  const evS = run(s, 14500);
  ok('...Shatter: the clones burst on the heroes', evS.some((e) => e.type === 'bossAbility' && e.ability.id === 'shatter') && !s.enemies.some((e) => e.alive && e.def.glass)); }
{ const { s, es, h } = mk(['sela']); const se = es[0]; se.hp = se.maxHp = 1e6; const k = h[0]; k.stats.attack = 30;
  s.applyStatus(se, { status: 'reflect', durationMs: 3000 }, se, 'test', []);
  const kHp = k.hp; const ev = []; s.skillHit(k, { damageMultiplier: 2 }, 'x', se, ev);
  ok('...Mirror Ward bounces a skill back on its caster', k.hp < kHp && ev.some((e) => e.type === 'reflect') && !se.statuses.some((x) => x.type === 'reflect')); }

// ---- Vharox
{ const { s, es, h } = mk(['vharox']); const v = es[0]; v.hp = v.maxHp * 0.74;
  const ev = run(s, 100);
  const sprites = s.enemies.filter((e) => e.alive && e.def.id === 'stormSprite');
  ok('Vharox under 75% flies into the sky (cannot be hit) with 3 storm sprites', s.untargetable(v) && sprites.length === 3 && ev.some((e) => e.type === 'skyPhase'));
  const ev1 = run(s, 1100);
  ok('...lightning strikes the squad from above', ev1.some((e) => e.type === 'bossAbility' && e.ability.id === 'lightning'));
  const ev2 = []; for (const sp of sprites) { sp.hp = 0; s.killUnit(sp, ev2, h[0]); }
  run(s, 50).forEach((e) => ev2.push(e));
  ok('...all sprites down: he is GROUNDED, stunned and takes more damage', !s.untargetable(v) && ev2.some((e) => e.type === 'grounded') && s.isStunned(v) && v.statuses.some((x) => x.type === 'mark')); }

// ---- every boss survives a real fight without errors
for (const n of Object.keys(A.bosses)) {
  const { s } = mk(A.bosses[n], Number(n));
  for (const u of s.heroes) { u.stats.attack = 60; }
  let crash = null; try { run(s, 60000, 100); } catch (err) { crash = err; }
  ok(`floor ${n} boss fight runs 60s without errors`, !crash, crash && crash.stack.split('\n').slice(0, 3).join(' | '));
}
