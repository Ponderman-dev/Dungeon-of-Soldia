import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const mk = () => { let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = new BattleState({ heroDefs: r('heroes.json'), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  return s; };
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);

// Stun: Shield Bash (Knight, slot 0) stops the enemy attacking
{ const s = mk(); const [g] = s.spawnEnemies(['goblin'], 1); g.stats.evasion = 0; g.hp = g.maxHp = 99999;
  const ev = s.castSkill(s.heroes[0].uid, 0);
  ok('shield bash stuns', s.isStunned(g) && ev.some((e) => e.type === 'status'));
  ok('mana spent', s.heroes[0].mana === 60 - 12, `mana=${s.heroes[0].mana}`);
  ok('cooldown set', s.heroes[0].skills[0].cooldownLeft === 8000);
  ok('cannot recast on cooldown', s.castSkill(s.heroes[0].uid, 0).length === 0);
  const hits = []; for (let t = 0; t < 1400; t += 50) hits.push(...s.update(50).filter((e) => e.type === 'attack' && e.attacker === g));
  ok('stunned enemy does not attack for 1.4s', hits.length === 0);
  let after = []; for (let t = 0; t < 3000; t += 50) after.push(...s.update(50).filter((e) => e.type === 'attack' && e.attacker === g));
  ok('enemy attacks again after stun', after.length > 0); }

// Slow: Ensnare Shot (Archer, slot 1) lengthens the enemy's attack interval by 1/0.6
{ const s = mk(); const [g] = s.spawnEnemies(['goblin'], 1); const before = s.interval(g);
  g.stats.evasion = 0; s.castSkill(s.heroes[3].uid, 1);
  ok('slow lengthens interval', Math.abs(s.interval(g) - before / 0.6) < 1, `${before} -> ${s.interval(g).toFixed(0)}`); }

// Poison: Venom Strike (Rogue, slot 0) ticks dark damage and can kill (and award XP)
{ const s = mk(); const [sl] = s.spawnEnemies(['slime'], 1); sl.stats.evasion = 0; sl.hp = 12; sl.resists = [];
  const ev = s.castSkill(s.heroes[2].uid, 0);
  const dots = []; for (let t = 0; t < 7000 && sl.alive; t += 50) dots.push(...s.update(50).filter((e) => e.type === 'dot'));
  ok('poison status applied or target died', ev.some((e) => e.type === 'status') || !sl.alive);
  ok('poison ticks', dots.length > 0 || !sl.alive, `ticks=${dots.length}`); }
{ const s = mk(); const [g] = s.spawnEnemies(['goblin'], 1); g.stats.evasion = 0; g.hp = 5000; g.maxHp = 5000;
  s.castSkill(s.heroes[2].uid, 0); const hp0 = g.hp; let ticks = 0; for (let t = 0; t < 6500; t += 50) ticks += s.update(50).filter((e) => e.type === 'dot').length;
  ok('poison ticks ~6 times over 6s', ticks >= 5 && ticks <= 7, `ticks=${ticks}`);
  ok('poison status expires', !g.statuses.some((x) => x.type === 'poison')); }

// Buff: Guard adds +25 defense then expires
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; const d0 = k.stats.defense;
  s.castSkill(k.uid, 1);
  ok('guard +25 defense', k.stats.defense === d0 + 25, `${d0} -> ${k.stats.defense}`);
  for (let t = 0; t < 6200; t += 50) s.update(50);
  ok('guard expires', k.stats.defense === d0, `${k.stats.defense}`); }

// Rage: +50% attack speed
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const b = s.heroes[1]; const i0 = s.interval(b); s.castSkill(b.uid, 1);
  ok('rage speeds attacks up', Math.abs(s.interval(b) - i0 / 1.5) < 1, `${i0.toFixed(0)} -> ${s.interval(b).toFixed(0)}`); }

// Cleave hits all
{ const s = mk(); const es = s.spawnEnemies(['slime', 'goblin', 'slime'], 1); es.forEach((e) => (e.stats.evasion = 0));
  const ev = s.castSkill(s.heroes[1].uid, 0); ok('cleave hits all 3', ev.filter((e) => e.type === 'attack').length === 3); }

// Not enough mana / boss status scale
{ const s = mk(); s.spawnEnemies(['goblin'], 1); s.heroes[0].mana = 5; ok('no cast without mana', s.castSkill(s.heroes[0].uid, 0).length === 0); }
{ const s = mk(); const [g] = s.spawnEnemies(['goblin'], 1); g.def = { ...g.def, statusDurationScale: 0.5 }; g.stats.evasion = 0; s.castSkill(s.heroes[0].uid, 0);
  ok('boss status half length', g.statuses[0] && g.statuses[0].remaining === 750, `${g.statuses[0] && g.statuses[0].remaining}`); }
// Mana regen
{ const s = mk(); s.spawnEnemies(['goblin'], 1); s.heroes[0].mana = 10; for (let t = 0; t < 5000; t += 50) s.update(50); ok('mana regen 2/s', Math.abs(s.heroes[0].mana - 20) < 0.5, `${s.heroes[0].mana}`); }
