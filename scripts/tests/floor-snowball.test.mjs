// Floor 80+ snowball (combat.json floorScaling): past snowballFromFloor, enemy health and attack are multiplied by
// (1 + snowballPercentPerFloor%) per floor, compounding, on top of the normal steps. Nothing changes before it.
// Attack speed: +speedPercentPerFloor% per floor past speedFromFloor, at most speedMaxPercent.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json');
const S = rules.floorScaling;
const goblinAt = (floor, rl = rules) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: rl, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  return s.spawnEnemies(['goblin'], floor)[0];
};
const off = { ...rules, floorScaling: { ...S, snowballFromFloor: 0, speedFromFloor: 0 } };
const F = S.snowballFromFloor, later = F + 20;
ok('snowball is set (from a floor, a percent)', F > 0 && S.snowballPercentPerFloor > 0);
{ const a = goblinAt(F), b = goblinAt(F, off);
  ok('no change up to the snowball floor', a.maxHp === b.maxHp && a.stats.attack === b.stats.attack, `${a.maxHp} ${b.maxHp}`); }
{ const a = goblinAt(later), b = goblinAt(later, off), m = Math.pow(1 + S.snowballPercentPerFloor / 100, later - F);
  ok('20 floors past it: health x(1+p)^20', Math.abs(a.maxHp / b.maxHp - m) < 0.01, `${a.maxHp} ${b.maxHp} x${m.toFixed(2)}`);
  ok('20 floors past it: attack x(1+p)^20', Math.abs(a.stats.attack / b.stats.attack - m) < 0.02, `${a.stats.attack} ${b.stats.attack}`); }
{ const sp = (f) => goblinAt(f).stats.attackEfficiency / goblinAt(f, off).stats.attackEfficiency;
  ok('attack speed: same up to its floor', Math.abs(sp(S.speedFromFloor) - 1) < 1e-9);
  ok('attack speed: +percent per floor past it', Math.abs(sp(S.speedFromFloor + 10) - (1 + (10 * S.speedPercentPerFloor) / 100)) < 1e-9, sp(S.speedFromFloor + 10));
  ok('attack speed: capped at the max', Math.abs(sp(S.speedFromFloor + 500) - (1 + S.speedMaxPercent / 100)) < 1e-9); }
