// A3: defense/resist use a curve (no hard cap), evasion cap 70%, crit cap 100%.
import fs from 'fs';
import { armorPercent, computeDamage } from '../../src/systems/combat.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const rules = r('combat.json'), damageTypes = r('damageTypes.json');
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);

ok('10 defense = 10% (same as before)', armorPercent(10, rules) === 10);
ok('50 defense = 50% (same as before)', armorPercent(50, rules) === 50);
ok('75 defense is a bit under the old 75% cap', armorPercent(75, rules) > 65 && armorPercent(75, rules) < 75, armorPercent(75, rules).toFixed(1));
ok('more defense always helps', armorPercent(150, rules) > armorPercent(100, rules) && armorPercent(100, rules) > armorPercent(75, rules));
ok('never reaches 100%', armorPercent(1000, rules) < 100, armorPercent(1000, rules).toFixed(4));
ok('curve is smooth at the knee', Math.abs(armorPercent(51, rules) - 51) < 0.02, armorPercent(51, rules).toFixed(3));

// Hits: resist uses the same curve on magic damage.
const unit = (stats, extra = {}) => ({ stats: { attack: 100, crit: 0, evasion: 0, defense: 0, resist: 0, ...stats }, weak: [], resists: [], damageType: 'melee', ...extra });
const never = () => 0.999;
const phys = computeDamage(unit({}), unit({ defense: 100 }), rules, damageTypes, never);
ok('100 defense cuts a physical hit by the curve', phys.amount === Math.round(100 * (1 - armorPercent(100, rules) / 100)), `${phys.amount}`);
const fire = computeDamage(unit({}), unit({ resist: 100 }), rules, damageTypes, never, { damageType: 'fire' });
ok('100 resist cuts a fire hit the same way', fire.amount === phys.amount, `${fire.amount}`);

// Evasion cap 70%: a roll of 0.69 is dodged, 0.71 is not, even with 200 evasion.
ok('evasion cap is 70%', rules.caps.evasion === 70);
ok('0.69 roll dodged at 200 evasion', computeDamage(unit({}), unit({ evasion: 200 }), rules, damageTypes, () => 0.69).dodged);
ok('0.71 roll hits at 200 evasion', !computeDamage(unit({}), unit({ evasion: 200 }), rules, damageTypes, () => 0.71).dodged);
// Crit cap 100%: 150 crit simply always crits.
ok('crit cap is 100%', rules.caps.crit === 100);
ok('150 crit always crits', computeDamage(unit({ crit: 150 }), unit({}), rules, damageTypes, never).crit);
