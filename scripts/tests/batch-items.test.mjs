import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(frozenItems());
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const mk = () => new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: { ...r('combat.json'), heroAttack: { percent: 0 }, skillWindUp: { defaultCastMs: 0 } }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const dummy = (s, ids = ['goblin']) => { const es = s.spawnEnemies(ids, 1); es.forEach((e) => { e.hp = e.maxHp = 1e12; e.stats.evasion = 0; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }); return es; };
const attacks = (ev, who) => ev.filter((x) => x.type === 'attack' && x.attacker === who);

// Whetstone: +12% and +3 attack (Knight base 20 -> 25.4)
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'whetstone'); ok('whetstone +12% +3', Math.abs(k.stats.attack - 25.4) < 0.01, `${k.stats.attack}`); }
// Quick Gloves: 18% speed and a 5% double hit
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'quick_gloves'); ok('gloves +18% speed', Math.abs(k.stats.attackEfficiency - 118) < 0.01);
  const [e] = dummy(s); s.rng = () => 0; let ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  ok('double hit strikes the target again', attacks(ev, k).length === 1 && ev.some((x) => x.type === 'proc'));
  s.rng = Math.random; let procs = 0, n = 0; const [t] = dummy(s); for (let i = 0; i < 100000; i++) { ev = []; s.rollProcs(k, 'onAttack', ev, { target: t }); n++; if (ev.some((x) => x.type === 'proc')) procs++; }
  ok('double hit ~8%', Math.abs(procs / n - 0.08) < 0.006, `${(100 * procs / n).toFixed(2)}%`); }
// Fire Bombs: fire damage, 250%, projectile
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'fire_bombs'); const [e] = dummy(s); s.rng = () => 0.001; k.stats.crit = 0; const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  const a = attacks(ev, k)[0]; ok('bomb is fire, 300% of attack', a && a.damageType === 'fire' && a.result.amount === Math.round(k.stats.attack * 3), JSON.stringify(a && a.result));
  ok('bomb draws a projectile', ev.some((x) => x.type === 'projectile' && x.kind === 'bomb')); }
// Chill Band: every attack adds a 10% ice hit per band (copies merge into one hit) AND 1 Chill stack (does not grow with more bands); 5 Chill = Freeze
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'chill_band'); const [e] = dummy(s); s.rng = () => 0.001; k.stats.crit = 0;
  let ev = []; s.rollProcs(k, 'onAttack', ev, { target: e, hit: true });
  const ice = (x) => attacks(x, k).filter((a) => a.damageType === 'ice');
  ok('one band: one ice hit of 10% attack', ice(ev).length === 1 && ice(ev)[0].result.amount === Math.max(1, Math.round(k.stats.attack * 0.1)));
  ok('...and 1 Chill stack on the target', s.stacks(e, 'chill') === 1);
  ok('ice hit and chill make no popup', ev.filter((x) => x.type === 'proc').length === 0);
  s.giveItem(k.uid, 'chill_band'); k.stats.crit = 0; e.statuses = []; ev = []; s.rollProcs(k, 'onAttack', ev, { target: e, hit: true });
  ok('two bands: ONE ice hit of double size (copies merge, one number)', ice(ev).length === 1 && ice(ev)[0].result.amount === Math.max(1, Math.round(k.stats.attack * 0.2)), `${ice(ev).map((a) => a.result.amount)}`);
  ok('two bands: still ONE chill stack per attack', k.procs.filter((p) => p.unique).length === 1 && s.stacks(e, 'chill') === 1);
  e.statuses = []; for (let i = 0; i < 5; i++) s.rollProcs(k, 'onAttack', [], { target: e, hit: true });
  ok('5 attacks = 5 Chill = Freeze (chill used up)', s.isStunned(e) && e.statuses.some((x) => x.type === 'freeze') && s.stacks(e, 'chill') === 0);
  e.statuses = []; s.rollProcs(k, 'onAttack', [], { target: e, hit: false });
  ok('no chill if the attack missed', s.stacks(e, 'chill') === 0); }
// Static Crystal: hits 3 different enemies for 300% electric
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'static_crystal'); const es = dummy(s, ['goblin', 'goblin', 'goblin', 'bat']); s.rng = () => 0.001; k.stats.crit = 0;
  const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[1] }); const a = attacks(ev, k);
  ok('chain hits 3 different enemies', a.length === 3 && new Set(a.map((x) => x.target)).size === 3, `${a.length}`);
  ok('each bolt 420% electric', a.every((x) => x.damageType === 'electric' && x.result.amount === Math.round(k.stats.attack * 4.2)));
  ok('lightning projectiles drawn', ev.filter((x) => x.kind === 'lightning').length === 3);
  const s2 = mk(); const k2 = s2.heroes[0]; s2.giveItem(k2.uid, 'static_crystal'); const e2 = dummy(s2, ['goblin']); s2.rng = () => 0.001; const ev2 = []; s2.rollProcs(k2, 'onAttack', ev2, { target: e2[0] });
  ok('lone enemy: only one bolt', attacks(ev2, k2).length === 1); }
// Siege Cannon: 5% chance skill also hits neighbours
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'siege_cannon'); const es = dummy(s, ['goblin', 'goblin', 'goblin']); s.focusUid = es[1].uid; s.rng = () => 0.001;
  const idx = k.skills.findIndex((x) => s.skillDefs[x.id].target === 'enemy' && s.skillDefs[x.id].damageMultiplier);
  if (idx < 0) ok('knight has a single-target damage skill', false); else { const ev = s.castSkill(k.uid, idx); const hit = new Set(attacks(ev, k).map((x) => x.target));
    ok('splash hits target and both neighbours', hit.size === 3 && hit.has(es[0]) && hit.has(es[2])); }
  const s2 = mk(); const k2 = s2.heroes[0]; s2.giveItem(k2.uid, 'siege_cannon'); const es2 = dummy(s2, ['goblin', 'goblin', 'goblin']); s2.focusUid = es2[1].uid; s2.rng = () => 0.99;
  if (idx >= 0) ok('no splash when the roll fails', new Set(attacks(s2.castSkill(k2.uid, idx), k2).map((x) => x.target)).size === 1); }
// Bloodlust Mask: shared heal + 3s cooldown
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'bloodlust_mask'); dummy(s); s.heroes.forEach((h) => (h.hp = 1)); s.rng = () => 0.001;
  let ev = []; s.afterHit(k, s.enemies[0], 400, ev, {});   // 5% of 400 = 20
  ok('mask heals self 20', ev.some((x) => x.type === 'heal' && x.unit === k && x.amount === 20));
  ok('and the other 3 heroes', ev.filter((x) => x.type === 'heal' && x.unit !== k).length === 3);
  ev = []; s.afterHit(k, s.enemies[0], 400, ev, {}); ok('no second share inside 3s', ev.filter((x) => x.type === 'heal').length === 1);
  s.heroes.forEach((h) => h.statuses.push({ key: 'wait', type: 'stun', remaining: 1e12, total: 1e12 })); // heroes must not attack (and re-arm the cooldown) while we wait
  for (let t = 0; t < 3100; t += 50) s.update(50); s.heroes.forEach((h) => { h.statuses = []; h.hp = 1; }); ev = []; s.afterHit(k, s.enemies[0], 400, ev, {});
  ok('shares again after 3s', ev.filter((x) => x.type === 'heal').length === 4); }
// Gambler's Dice: crit puts a random debuff on the enemy
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'gamblers_dice'); const [e] = dummy(s); const seen = new Set();
  for (let i = 0; i < 300; i++) { e.statuses = []; s.afterHit(k, e, 10, [], { crit: true }); for (const st of e.statuses) seen.add(st.type); }
  ok('crit gives chill, poison, stun and shock over time', seen.has('chill') && seen.has('poison') && seen.has('stun') && seen.has('shock'), [...seen].join());
  e.statuses = []; s.afterHit(k, e, 10, [], { crit: false }); ok('no debuff without a crit', e.statuses.length === 0); }
// Aid Kit (TRIAGE): any hero dropping below 30% is patched by the holder for a % of THEIR max health (first kit, then perExtra), 10s cooldown.
const kit = frozenItems().aid_kit.effects.find((e) => e.special === 'triage');
{ const s = mk(); const [k, a] = s.heroes; s.giveItem(k.uid, 'aid_kit'); const ev = [];
  a.hp = a.maxHp * 0.35; s.dealDamage(a, 1, ev); ok('Aid Kit: nothing above 30%', !ev.some((e) => e.label === 'Triage!'));
  a.hp = a.maxHp * 0.31; const before = a.maxHp * 0.31 - a.maxHp * 0.02; s.dealDamage(a, a.maxHp * 0.02, ev);
  ok('...an ally dropping below 30% is patched for ' + kit.percent + '% of their max health (and a kit flies over)', ev.some((e) => e.label === 'Triage!') && ev.some((e) => e.type === 'flask') && Math.abs(a.hp - (before + (a.maxHp * kit.percent) / 100)) < 0.6, `${a.hp - before}`);
  const ev2 = []; a.hp = a.maxHp * 0.2; s.dealDamage(a, 1, ev2); ok('...then a 10s cooldown', !ev2.some((e) => e.label === 'Triage!'));
  for (let t = 0; t < 10000; t += 50) s.update(50); a.hp = a.maxHp * 0.2; const ev3 = []; s.dealDamage(a, 1, ev3); ok('...ready again after 10s', ev3.some((e) => e.label === 'Triage!')); }
{ const s = mk(); const [k] = s.heroes; for (let i = 0; i < 3; i++) s.giveItem(k.uid, 'aid_kit'); k.hp = k.maxHp * 0.25; const h0 = k.hp - 1; s.dealDamage(k, 1, []);
  ok('...3 kits = ' + (kit.percent + 2 * kit.perExtra) + '%, and the holder can patch itself', Math.abs(k.hp - (h0 + (k.maxHp * (kit.percent + 2 * kit.perExtra)) / 100)) < 0.6, `${k.hp - h0}`); }
// Ranged heroes pick random enemies by default; melee heroes keep one opponent (front line); a tapped enemy is still focused
{ const s = mk(); const es = dummy(s, ['goblin', 'goblin', 'goblin']); const hit = new Set(); for (let i = 0; i < 200; i++) hit.add(s.pickTarget(s.heroes[3]).uid);
  ok('ranged default target is random', hit.size === 3);
  const melee = new Set(); for (let i = 0; i < 200; i++) melee.add(s.pickTarget(s.heroes[0]).uid);
  ok('melee hero keeps one opponent', melee.size === 1);
  s.focusUid = es[2].uid; const f = new Set(); for (let i = 0; i < 50; i++) f.add(s.pickTarget(s.heroes[0]).uid); ok('tapped enemy is still focused', f.size === 1 && f.has(es[2].uid)); }
