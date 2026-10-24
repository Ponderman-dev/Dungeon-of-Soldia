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
  ok('...the drum beats up a goblin AND a goblin archer', ['goblin', 'goblinArcher'].every((id) => ev.some((e) => e.type === 'enemySpawn' && e.unit.def.id === id)));
  const archer = s.enemies.find((e) => e.def.id === 'goblinArcher');
  ok('...archers attack faster near the drum too', s.auraSpeed(archer) > 0);
  const pct = enemies.war_drum.abilities[0].summon[0].hpPercent, normal = s.makeUnit(enemies.goblin, 'enemy', 20, 1);
  const drumGob = s.enemies.find((e) => e.def.id === 'goblin');
  ok('...its goblins are weaker than normal goblins (hpPercent)', Math.abs(drumGob.maxHp - (normal.maxHp * pct) / 100) <= 1, `${drumGob.maxHp} vs ${normal.maxHp}`);
  run(s, 8000 * 3);
  const max = enemies.war_drum.abilities[0].summon.map((sm) => sm.max);
  ok('...at most the cap of each kind at once', ['goblin', 'goblinArcher'].every((id, i) => s.enemies.filter((e) => e.alive && e.def.id === id).length <= max[i])); }
ok('Goblin Archer: its hits always poison', enemies.goblinArcher.onHit.some((o) => o.status === 'poison' && o.chance === 100));
{ const { s, es, h } = mk(['grukk']); const g = es[0]; g.hp = g.maxHp = 1e6;
  g.abilities.find((ab) => ab.def.id === 'cleaver_charge').timer = 1e9; // only the jump
  const jump = enemies.grukk.abilities.find((a) => a.id === 'quake_jump');
  ok('Rally Shout is gone (no heal)', !enemies.grukk.abilities.some((a) => a.healAllies));
  g.hp = g.maxHp * (jump.hpBelow - 1) / 100;
  const hp0 = h.map((x) => x.hp);
  const ev = run(s, jump.castMs + 200);
  const slam = ev.find((e) => e.type === 'bossAbility' && e.ability.id === 'quake_jump');
  ok('Quake Jump below half health: goes for EVERY hero (a dodge can still miss)', slam && h.every((x) => slam.targets.includes(x)) && h.some((x, i) => x.hp < hp0[i]), h.map((x, i) => hp0[i] - x.hp).join(','));
  ok('...and stuns every hero', h.every((x) => s.isStunned(x)));
  ok('...once only', (run(s, 10000), g.abilities.find((ab) => ab.def.id === 'quake_jump').done) && !g.bossCast); }
{ const { s, es } = mk(['grukk']); const g = es[0]; g.hp = g.maxHp = 1e6;
  const ev = run(s, 5100);
  ok('Grukk winds up Cleaver Charge (a boss cast with a red bar)', ev.some((e) => e.type === 'castStart' && e.boss) && g.bossCast);
  s.applyStatus(g, { status: 'stun', durationMs: 2000 }, s.heroes[0], 'test', []);
  const ev2 = run(s, 200);
  ok('...a stun INTERRUPTS it', ev2.some((e) => e.type === 'castCancel' && e.unit === g && e.reason === 'interrupted') && !g.bossCast); }

// ---- Brood Mother
{ const { s, es } = mk(['brood_mother']); const b = es[0]; b.hp = b.maxHp = 1e6; s.placeLines(); b.stats.attack = 0;
  const ev = run(s, 4700);
  const sacs = s.enemies.filter((e) => e.def.id === 'egg_sac');
  ok('Brood Mother lays egg sacs', sacs.length === 2, sacs.length);
  const px = enemies.brood_mother.abilities.find((a) => a.id === 'lay_eggs').summon.beside;
  ok('...to her SIDES (one left, one right, level with her), not in front', sacs.some((e) => e.x < b.x) && sacs.some((e) => e.x > b.x) && sacs.every((e) => Math.abs(e.x - b.x) >= px * 0.8 && Math.abs(e.y - b.y) <= 25), sacs.map((e) => `${Math.round(e.x - b.x)},${Math.round(e.y - b.y)}`).join(' '));
  const ev2 = run(s, 6200);
  ok('...an egg sac left alone hatches into 3 spiderlings', ev2.some((e) => e.type === 'hatch') && s.enemies.filter((e) => e.alive && e.def.id === 'spiderling').length >= 3); }
{ const { s, es } = mk(['egg_sac']); const sac = es[0];
  run(s, enemies.egg_sac.hatch.afterMs - 200);
  ok('Egg Sac: still an egg just before its hatch time', sac.alive);
  const ev = run(s, 400);
  ok('...hatches right on time', ev.some((e) => e.type === 'hatch' && e.unit === sac)); }
ok('Spiderling: EVERY hit poisons (a weak poison)', enemies.spiderling.onHit.some((o) => o.status === 'poison' && o.chance === 100 && o.damageMultiplier < enemies.brood_mother.onHit[0].damageMultiplier));
{ const { s, es, h } = mk(['brood_mother']); const b = es[0]; b.hp = b.maxHp = 1e6;
  const sw = enemies.brood_mother.abilities.find((a) => a.id === 'sticky_webs');
  for (const ab of b.abilities) if (ab.def.id !== 'sticky_webs') ab.timer = 1e9;
  const before = h.map((x) => s.interval(x));
  const ev = run(s, sw.firstMs + sw.castMs + 100);
  const tangled = h.filter((x) => x.statuses.some((st) => st.type === 'tangled'));
  ok('Sticky Webs: tangles exactly 2 different heroes', tangled.length === sw.count, tangled.length);
  const i = h.indexOf(tangled[0]);
  ok('...their attacks come much slower (-70% attack speed)', s.interval(tangled[0]) > before[i] * 2.5, `${Math.round(before[i])} -> ${Math.round(s.interval(tangled[0]))}`);
  run(s, sw.apply[0].durationMs + 100);
  ok('...and it wears off', !h.some((x) => x.statuses.some((st) => st.type === 'tangled'))); }

// ---- Frost Warden
{ const { s, es, h } = mk(['frost_warden']); const w = es[0]; w.hp = w.maxHp = 1e6;
  const ev = []; s.applyStatus(w, { status: 'chill', durationMs: 3000, stacks: 1 }, h[0], 'test', ev);
  ok('Frost Warden cannot be chilled', !w.statuses.some((x) => x.type === 'chill') && ev.some((e) => e.type === 'immuneStatus'));
  h[0].stats.attack = 50; const hp0 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'melee' }); const plated = hp0 - w.hp;
  w.plates = 0; const hp1 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'melee' }); const bare = hp1 - w.hp;
  ok('...her armor plates cut the damage a lot', plated < bare * 0.5, `${plated} vs ${bare}`);
  w.plates = 3; w.plateHp = 10; const ev3 = []; s.strike(h[0], w, ev3, { multiplier: 1, damageType: 'fire' });
  ok('...fire breaks a plate', w.plates === 2 && ev3.some((e) => e.type === 'plateBreak'));
  w.plates = 0; h[0].stats.attack = 100; const hp2 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'melee' }); const melee = hp2 - w.hp;
  const hp3 = w.hp; s.strike(h[0], w, [], { multiplier: 1, damageType: 'ice' }); const ice = hp3 - w.hp;
  ok('...ice does very little to him (his own resist multiplier)', ice < melee * w.def.resistMultiplier * 1.5, `${ice} vs ${melee}`); }

// Frost Warden: Hailstorm, Ice Spikes (50%), Frozen Rest + Ice Knights (25%)
{ const { s, es, h } = mk(['frost_warden'], 60); const w = es[0]; w.hp = w.maxHp = 1e6; w.stats.attack = 0;
  const ab = (id) => w.def.abilities.find((a) => a.id === id);
  const hs = ab('hailstorm');
  for (const x of h) x.statuses = [];
  s.placeLines(); w.abilities.forEach((x) => { x.timer = 1e9; x.done = true; });
  const ev = []; s.releaseAbility(w, hs, ev);
  const evs = run(s, hs.sweep.ms + 100);
  const order = evs.filter((e) => e.type === 'windHit').map((e) => e.unit);
  ok('Hailstorm: the wind crosses left to right, hitting each hero as it passes', ev.some((e) => e.type === 'windSweep') && order.length === h.length && order.every((x, i) => i === 0 || order[i - 1].x <= x.x));
  ok('Hailstorm: every hero loses its % of max health and gets 1 Chill', h.every((x) => Math.abs(x.maxHp - x.hp - x.maxHp * hs.percentMaxHp / 100) <= x.maxHp * 0.002 && s.stacks(x, 'chill') === 1), h.map((x) => x.maxHp - x.hp).join(','));
  ok('...that Chill lasts a long time', h[0].statuses.find((x) => x.type === 'chill').remaining > hs.apply[0].durationMs - hs.sweep.ms - 200);
  for (let i = 1; i < 5; i++) { s.releaseAbility(w, hs, []); run(s, hs.sweep.ms + 100); }
  ok('...5 Hailstorms freeze a hero', h.every((x) => x.statuses.some((st) => st.type === 'freeze') && s.stacks(x, 'chill') === 0));
  // Ice Spikes: once below 50%
  const { s: s2, es: es2, h: h2 } = mk(['frost_warden'], 60); const w2 = es2[0]; w2.stats.attack = 0; s2.placeLines();
  const sp = w2.def.abilities.find((a) => a.id === 'ice_spikes').spikes;
  w2.hp = Math.floor(w2.maxHp * 0.49);
  for (const x of h2) x.statuses = [];
  const ev2 = run(s2, sp.warnMs + sp.count * sp.gapMs + 1500);
  const warns = ev2.filter((e) => e.type === 'spikeWarn'), lands = ev2.filter((e) => e.type === 'spikeLand');
  ok('Ice Spikes: below 50% a barrage of spikes is warned, then lands', warns.length === sp.count && lands.length === sp.count, `${warns.length}/${lands.length}`);
  const struck = lands.flatMap((e) => e.targets);
  ok('...a hero under a spike freezes and loses health', struck.length > 0 && ev2.some((e) => e.type === 'status' && e.status.type === 'freeze' && e.status.key === 'freeze:ice_spike'));
  const ev3 = run(s2, 10000);
  ok('...only once', !ev3.some((e) => e.type === 'spikeWarn'));
  // Frozen Rest: below 25% he summons 3 Ice Knights and heals while frozen (can still be hit)
  const { s: s3, es: es3 } = mk(['frost_warden'], 60); const w3 = es3[0]; w3.stats.attack = 0;
  const rest = w3.def.abilities.find((a) => a.id === 'ice_knights');
  w3.abilities.forEach((x) => { if (x.def.id !== 'ice_knights') x.done = true, x.timer = 1e9; });
  w3.hp = Math.floor(w3.maxHp * 0.24); const before = w3.hp;
  run(s3, rest.castMs + rest.channel.ticks * rest.channel.intervalMs + 300);
  const knights = s3.enemies.filter((e) => e.alive && e.def.id === 'ice_knight');
  ok('Frozen Rest: 3 Ice Knights join the fight', knights.length === rest.summon.count, knights.length);
  const healed = (w3.hp - before) / w3.maxHp * 100;
  ok('...and he heals about 20% of his health', Math.abs(healed - rest.channel.ticks * rest.channel.healSelfPercent) < 1.5, healed.toFixed(1));
  ok('...he can still be hit meanwhile', !s3.untargetable(w3)); }

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
