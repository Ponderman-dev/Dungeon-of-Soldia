// A6b: Chill (stacks, 5 = Freeze), Shock (slower + fumbles), Fear (no attacks), Knockback (attack
// timer restarts), Taunt (must attack the taunter), Silence (no skills). Bosses take control for less.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const statusDefs = r('statuses.json');
const mk = (rng = Math.random) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs, rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const [g] = s.spawnEnemies(['goblin'], 1);
  Object.assign(g, { hp: 1e9, maxHp: 1e9 }); g.stats.evasion = 0;
  for (const h of s.heroes) { h.hp = h.maxHp = 1e9; h.stats.evasion = 0; }
  return { s, g, k: s.heroes[0] };
};
const attacksBy = (s, unit, ms) => { let n = 0; for (let t = 0; t < ms; t += 50) n += s.update(50).filter((e) => e.type === 'attack' && e.attacker === unit).length; return n; };

// Chill
{ const { s, g, k } = mk(); const i0 = s.interval(g);
  s.applyStatus(g, { status: 'chill', durationMs: 5000, stacks: 3 }, k, 'a', []);
  ok('3 chill = 3 stacks', s.stacks(g, 'chill') === 3);
  ok('3 chill = 30% slower attacks', Math.abs(s.interval(g) - i0 / 0.7) < 1, `${i0.toFixed(0)} -> ${s.interval(g).toFixed(0)}`);
  const ev = []; s.applyStatus(g, { status: 'chill', durationMs: 5000, stacks: 2 }, k, 'b', ev);
  ok('5 chill = FREEZE', s.has(g, 'freeze') && s.isStunned(g));
  ok('freezing uses up all the chill', s.stacks(g, 'chill') === 0);
  ok('freeze lasts freezeMs', g.statuses.find((x) => x.type === 'freeze').remaining === statusDefs.chill.freezeMs);
  ok('a freeze event is sent', ev.some((e) => e.type === 'status' && e.status.type === 'freeze')); }
{ const { s, g, k } = mk(); g.def = { ...g.def, statusDurationScale: 0.5 };
  s.applyStatus(g, { status: 'chill', durationMs: 4000, stacks: 5 }, k, 'a', []);
  ok('boss: freeze from chill is halved', g.statuses.find((x) => x.type === 'freeze').remaining === statusDefs.chill.freezeMs / 2); }
{ const { s, g, k } = mk();
  s.applyStatus(g, { status: 'chill', durationMs: 1000 }, k, 'a', []);
  for (let t = 0; t < 1100; t += 50) s.update(50);
  ok('chill wears off', s.stacks(g, 'chill') === 0); }

// Shock
{ const { s, g, k } = mk(() => 0.999); const i0 = s.interval(g);
  s.applyStatus(g, { status: 'shock', durationMs: 5000 }, k, 'a', []);
  ok('shock = attacks 20% slower', Math.abs(s.interval(g) - i0 / 0.8) < 1);
  s.applyStatus(g, { status: 'shock', durationMs: 5000 }, k, 'a', []);
  ok('shock refreshes (does not stack)', s.stacks(g, 'shock') === 1); }
{ const { s, g, k } = mk(); s.rng = () => 0.001; // every roll succeeds: always fumbles
  s.applyStatus(g, { status: 'shock', durationMs: 60000 }, k, 'a', []);
  s.heroes.forEach((h) => (h.timer = -1e12));
  g.timer = s.interval(g) - 10; const ev = s.update(50);
  ok('shocked enemy can fumble: no attack, short stun', !ev.some((e) => e.type === 'attack' && e.attacker === g) && ev.some((e) => e.label === 'Fumble!') && s.isStunned(g)); }

// Fear
{ const { s, g, k } = mk(); s.heroes.forEach((h) => (h.timer = -1e12));
  s.applyStatus(g, { status: 'fear', durationMs: 2000 }, k, 'a', []);
  ok('feared enemy does not attack', attacksBy(s, g, 1900) === 0);
  ok('it attacks again after fear', attacksBy(s, g, 3000) > 0); }

// Knockback
{ const { s, g, k } = mk(); g.timer = 900;
  const ev = []; s.applyStatus(g, { status: 'knockback', durationMs: 0 }, k, 'a', ev);
  ok('knockback restarts the attack timer', g.timer === 0);
  ok('knockback leaves no lasting status but shows a popup', g.statuses.length === 0 && ev.some((e) => e.status && e.status.type === 'knockback')); }
{ const { s, g, k } = mk(); g.def = { ...g.def, statusDurationScale: 0.5 }; g.timer = 800;
  s.applyStatus(g, { status: 'knockback', durationMs: 0 }, k, 'a', []);
  ok('boss only loses half its wind-up', g.timer === 400); }

// Taunt
{ const { s, g } = mk(); const archer = s.heroes[3];
  s.applyStatus(g, { status: 'taunt', durationMs: 3000 }, archer, 'a', []);
  let allOnArcher = true; for (let i = 0; i < 50; i++) if (s.pickTarget(g) !== archer) allOnArcher = false;
  ok('taunted enemy always attacks the taunter', allOnArcher);
  archer.alive = false;
  ok('taunter dead: picks someone else', s.pickTarget(g) !== archer); }

// Silence
{ const { s, k } = mk();
  ok('can cast normally', s.canCast(k, 0));
  s.applyStatus(k, { status: 'silence', durationMs: 2000 }, k, 'a', []);
  ok('silenced hero cannot cast', !s.canCast(k, 0)); }

ok('plain Slow no longer exists', !statusDefs.slow);
