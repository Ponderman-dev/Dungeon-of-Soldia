import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(r('items.json'));
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const mk = () => new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: { ...r('combat.json'), morale: {} }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
// proc rate: ~8% of the holder's attacks
{ const s = mk(); const [e] = s.spawnEnemies(['goblin'], 1); e.hp = e.maxHp = 1e12; e.statuses.push({ key: 'x', type: 'stun', remaining: 1e12, total: 1e12 }); const k = s.heroes[0]; s.giveItem(k.uid, 'war_banner');
  ok('banner gives no flat stats', k.stats.attack === 20, `${k.stats.attack}`);
  let attacks = 0, procs = 0; for (let t = 0; t < 8000000; t += 50) { for (const ev of s.update(50)) { if (ev.type === 'attack' && ev.attacker === k && !ev.skill) attacks++; if (ev.type === 'proc') procs++; } }
  ok('proc rate ~8% of holder attacks', Math.abs(procs / attacks - 0.08) < 0.01, `${(100 * procs / attacks).toFixed(1)}% of ${attacks} attacks`); }
// the buff reaches all living heroes, is +25% attack speed, lasts 2s and refreshes (does not stack)
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; s.giveItem(k.uid, 'war_banner'); s.heroes[3].alive = false; s.refreshStats();
  const before = s.heroes.map((h) => s.interval(h)); const ev = []; s.rng = () => 0;   // force the proc
  s.rollProcs(k, 'onAttack', ev);
  const after = s.heroes.map((h) => s.interval(h));
  ok('+25% attack speed for living heroes', [0, 1, 2].every((i) => Math.abs(after[i] - before[i] / 1.25) < 1), `${before[0].toFixed(0)} -> ${after[0].toFixed(0)}`);
  ok('dead hero not buffed', after[3] === before[3]);
  s.rollProcs(k, 'onAttack', ev); s.rng = () => 0.99; ok('does not stack', Math.abs(s.interval(k) - before[0] / 1.25) < 1);
  for (let t = 0; t < 2100; t += 50) s.update(50);
  ok('expires after 2s', Math.abs(s.interval(k) - before[0]) < 1, `${s.interval(k).toFixed(0)}`); }
// dead holder: no proc
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; s.giveItem(k.uid, 'war_banner'); k.alive = false; s.refreshStats(); s.rng = () => 0; const ev = []; s.rollProcs(k, 'onAttack', ev); ok('dead holder does not roll', ev.length === 0); }
// two banners roll twice
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; s.giveItem(k.uid, 'war_banner'); s.giveItem(k.uid, 'war_banner'); ok('two banners = two rolls', k.procs.length === 2); }
