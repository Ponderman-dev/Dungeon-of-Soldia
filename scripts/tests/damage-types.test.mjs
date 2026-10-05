// A5: every damage type works: weak/resist by type or category, magic uses resist,
// damage-type bonuses also boost damage over time, and the data only names real types.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { computeDamage, computeDotDamage } from '../../src/systems/combat.js';
import { loadItems } from '../../src/systems/items.js';
import { validateDamageTypes } from '../../src/systems/validate.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const rules = r('combat.json'), damageTypes = r('damageTypes.json');
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const unit = (stats = {}, extra = {}) => ({ stats: { attack: 100, crit: 0, evasion: 0, defense: 0, resist: 0, ...stats }, weak: [], resists: [], damageType: 'melee', ...extra });
const hit = (type, defender) => computeDamage(unit(), defender, rules, damageTypes, () => 0.999, { damageType: type }).amount;

for (const type of ['fire', 'ice', 'electric', 'dark']) {
  ok(`${type}: normal hit 100`, hit(type, unit()) === 100);
  ok(`${type}: weak = +50%`, hit(type, unit({}, { weak: [type] })) === 150);
  ok(`${type}: resists = -50%`, hit(type, unit({}, { resists: [type] })) === 50);
  ok(`${type}: cut by resist, not defense`, hit(type, unit({ resist: 20, defense: 90 })) === 80);
}
ok('physical cut by defense, not resist', hit('melee', unit({ defense: 20, resist: 90 })) === 80);
ok('weak to "magical" covers fire', hit('fire', unit({}, { weak: ['magical'] })) === 150);
ok('weak to "magical" does not cover melee', hit('melee', unit({}, { weak: ['magical'] })) === 100);
ok('resists "physical" covers ranged', hit('ranged', unit({}, { resists: ['physical'] })) === 50);
ok('damage over time also uses weak/resist', computeDotDamage(unit({}, { weak: ['dark'] }), 10, 'dark', rules, damageTypes) === 15);

// A +50% dark bonus makes the caster's poison ticks 50% bigger.
{ const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes, leveling: r('leveling.json') });
  const [g] = s.spawnEnemies(['goblin'], 1); const rogue = s.heroes[2];
  const spec = { status: 'poison', durationMs: 6000, damageMultiplier: 0.5, damageType: 'dark' };
  s.applyStatus(g, spec, rogue, 'a', []); const plain = g.statuses[0].damage;
  rogue.damageBonus = { dark: 50 }; s.applyStatus(g, spec, rogue, 'b', []); const boosted = g.statuses[1].damage;
  ok('dark bonus boosts poison', boosted === Math.round(rogue.stats.attack * 0.5 * 1.5) && boosted > plain, `${plain} -> ${boosted}`); }

// Data check: everything named in the JSON is a real damage type.
const data = { heroDefs: r('heroes.json'), enemyDefs: r('enemies.json'), statusDefs: r('statuses.json'), skillDefs: r('skills.json'), itemDefs: loadItems(r('items.json')) };
const problems = validateDamageTypes(data, damageTypes);
ok('all damage types in the data are real', problems.length === 0, problems.join('; '));
ok('checker spots a typo', validateDamageTypes({ ...data, enemyDefs: { x: { name: 'X', damageType: 'fier', weak: ['magical'], resists: [] } } }, damageTypes).length === 1);
