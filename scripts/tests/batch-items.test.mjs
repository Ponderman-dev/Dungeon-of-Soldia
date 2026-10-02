import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const mk = () => new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const dummy = (s, ids = ['goblin']) => { const es = s.spawnEnemies(ids, 1); es.forEach((e) => { e.hp = e.maxHp = 1e12; e.stats.evasion = 0; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }); return es; };
const attacks = (ev, who) => ev.filter((x) => x.type === 'attack' && x.attacker === who);

// Whetstone: +12% and +3 attack (Knight base 20 -> 25.4)
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'whetstone'); ok('whetstone +12% +3', Math.abs(k.stats.attack - 25.4) < 0.01, `${k.stats.attack}`); }
// Quick Gloves: 18% speed and a 5% double hit
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'quick_gloves'); ok('gloves +18% speed', Math.abs(k.stats.attackEfficiency - 118) < 0.01);
  const [e] = dummy(s); s.rng = () => 0; let ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  ok('double hit strikes the target again', attacks(ev, k).length === 1 && ev.some((x) => x.type === 'proc'));
  s.rng = Math.random; let procs = 0, n = 0; const [t] = dummy(s); for (let i = 0; i < 100000; i++) { ev = []; s.rollProcs(k, 'onAttack', ev, { target: t }); n++; if (ev.some((x) => x.type === 'proc')) procs++; }
  ok('double hit ~5%', Math.abs(procs / n - 0.05) < 0.005, `${(100 * procs / n).toFixed(2)}%`); }
// Fire Bombs: fire damage, 250%, projectile
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'fire_bombs'); const [e] = dummy(s); s.rng = () => 0.001; k.stats.crit = 0; const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e });
  const a = attacks(ev, k)[0]; ok('bomb is fire, 250% of attack', a && a.damageType === 'fire' && a.result.amount === Math.round(k.stats.attack * 2.5), JSON.stringify(a && a.result));
  ok('bomb draws a projectile', ev.some((x) => x.type === 'projectile' && x.kind === 'bomb')); }
// Chill Band: ice hit (10%) + slow, does not stack, max 1
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'chill_band'); const [e] = dummy(s); s.rng = () => 0.001; k.stats.crit = 0;
  const before = s.interval(e); let ev = []; s.rollProcs(k, 'onAttack', ev, { target: e }); s.rollProcs(k, 'onAttack', ev, { target: e });
  ok('chill band slows enemy by 25%', Math.abs(s.interval(e) - before / 0.75) < 1, `${before} -> ${s.interval(e)}`);
  ok('slow does not stack', e.statuses.filter((x) => x.type === 'slow').length === 1);
  ok('ice hit is 10% attack', attacks(ev, k)[0].damageType === 'ice' && attacks(ev, k)[0].result.amount === Math.max(1, Math.round(k.stats.attack * 0.1)));
  ok('max 1 chill band', itemDefs.chill_band.maxStacks === 1); }
// Static Crystal: hits 3 different enemies for 300% electric
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'static_crystal'); const es = dummy(s, ['goblin', 'goblin', 'goblin', 'bat']); s.rng = () => 0.001; k.stats.crit = 0;
  const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[1] }); const a = attacks(ev, k);
  ok('chain hits 3 different enemies', a.length === 3 && new Set(a.map((x) => x.target)).size === 3, `${a.length}`);
  ok('each bolt 300% electric', a.every((x) => x.damageType === 'electric' && x.result.amount === Math.round(k.stats.attack * 3)));
  ok('lightning projectiles drawn', ev.filter((x) => x.kind === 'lightning').length === 3);
  const s2 = mk(); const k2 = s2.heroes[0]; s2.giveItem(k2.uid, 'static_crystal'); const e2 = dummy(s2, ['goblin']); s2.rng = () => 0.001; const ev2 = []; s2.rollProcs(k2, 'onAttack', ev2, { target: e2[0] });
  ok('lone enemy: only one bolt', attacks(ev2, k2).length === 1); }
// Siege Cannon: 5% chance skill also hits neighbours
{ const s = mk(); const k = s.heroes[0]; s.giveItem(k.uid, 'siege_cannon'); const es = dummy(s, ['goblin', 'goblin', 'goblin']); k.mana = 999; s.focusUid = es[1].uid; s.rng = () => 0.001;
  const idx = k.skills.findIndex((x) => s.skillDefs[x.id].target === 'enemy' && s.skillDefs[x.id].damageMultiplier);
  if (idx < 0) ok('knight has a single-target damage skill', false); else { const ev = s.castSkill(k.uid, idx); const hit = new Set(attacks(ev, k).map((x) => x.target));
    ok('splash hits target and both neighbours', hit.size === 3 && hit.has(es[0]) && hit.has(es[2])); }
  const s2 = mk(); const k2 = s2.heroes[0]; s2.giveItem(k2.uid, 'siege_cannon'); const es2 = dummy(s2, ['goblin', 'goblin', 'goblin']); k2.mana = 999; s2.focusUid = es2[1].uid; s2.rng = () => 0.99;
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
  ok('crit gives slow, poison and stun over time', seen.has('slow') && seen.has('poison') && seen.has('stun'), [...seen].join());
  e.statuses = []; s.afterHit(k, e, 10, [], { crit: false }); ok('no debuff without a crit', e.statuses.length === 0); }
// Aid Kit: heals % on clear, diminishing
{ const s = mk(); const k = s.heroes[0]; k.hp = 1; s.giveItem(k.uid, 'aid_kit'); const pct = (p) => { k.hp = 1; return s.winHeal(p).find((x) => x.unit === k).amount / k.maxHp * 100; };
  const one = pct(0); s.giveItem(k.uid, 'aid_kit'); const two = pct(0); s.giveItem(k.uid, 'aid_kit'); const three = pct(0);
  ok('1 kit = 5%', Math.abs(one - 5) < 0.5, one.toFixed(1)); ok('2 kits = 5+4.25', Math.abs(two - 9.25) < 0.5, two.toFixed(1)); ok('3 kits add less each time', three - two < two - one, three.toFixed(1)); }
