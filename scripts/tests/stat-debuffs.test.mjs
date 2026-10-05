// A6c: Weaken (-attack), Armor Break (-defense), Curse (-resist), Blind (misses), Mark (+damage taken).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { computeDamage, computeDotDamage, armorPercent } from '../../src/systems/combat.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), damageTypes = r('damageTypes.json'), statusDefs = r('statuses.json');
const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs, rules, damageTypes, leveling: r('leveling.json') });
const src = s.heroes[0];
const unit = (stats = {}) => ({ def: {}, statuses: [], stats: { attack: 100, crit: 0, evasion: 0, defense: 0, resist: 0, ...stats }, weak: [], resists: [], damageType: 'melee' });
const give = (u, status, extra = {}, from = 'a') => s.applyStatus(u, { status, durationMs: 5000, ...extra }, src, from, []);
const hit = (a, d, type = 'melee', rng = () => 0.999) => computeDamage(a, d, rules, damageTypes, rng, { damageType: type });

{ const a = unit(); give(a, 'weaken'); ok('weaken: -20% damage', hit(a, unit()).amount === 80, `${hit(a, unit()).amount}`);
  give(a, 'weaken', {}, 'b'); ok('two weaken sources add up: -40%', hit(a, unit()).amount === 60);
  give(a, 'weaken', {}, 'b'); ok('the same source refreshes (still -40%)', hit(a, unit()).amount === 60); }
{ const d = unit({ defense: 30 }); give(d, 'armorBreak');
  ok('armor break: 30 defense counts as 15', hit(unit(), d).amount === Math.round(100 * (1 - armorPercent(15, rules) / 100)));
  ok('armor break does not touch magic hits', hit(unit(), d, 'fire').amount === 100); }
{ const d = unit({ defense: 0 }); give(d, 'armorBreak');
  ok('below 0 defense: the hit does MORE damage', hit(unit(), d).amount === 115, `${hit(unit(), d).amount}`); }
{ const d = unit({ resist: 20 }); give(d, 'curse');
  ok('curse: 20 resist counts as 5', hit(unit(), d, 'fire').amount === 95);
  ok('curse does not touch physical hits', hit(unit(), unit({ resist: 20 })).amount === 100); }
{ const a = unit(); give(a, 'blind');
  ok('blind: a low roll misses', hit(a, unit(), 'melee', () => 0.2).missed === true);
  ok('blind: a high roll still hits', hit(a, unit(), 'melee', () => 0.3).amount === 100); }
{ const d = unit(); give(d, 'mark');
  ok('mark: +15% damage taken', hit(unit(), d).amount === 115);
  ok('mark also boosts damage over time', computeDotDamage(d, 100, 'dark', rules, damageTypes) === 115);
  give(d, 'mark', {}, 'b'); ok('marks from two sources add up: +30%', hit(unit(), d).amount === 130); }
{ const d = unit(); give(d, 'mark', { damageTakenPercent: 40 });
  ok('a skill can set its own number (mark +40%)', hit(unit(), d).amount === 140); }
{ const a = unit(); give(a, 'weaken', { durationMs: 1000 });
  for (let t = 0; t < 1100; t += 50) { a.statuses.forEach((x) => (x.remaining -= 50)); a.statuses = a.statuses.filter((x) => x.remaining > 0); }
  ok('debuff ends: damage back to normal', hit(a, unit()).amount === 100); }
