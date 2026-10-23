// A4: rarity first (odds by floor), then item by drop weight; items the squad can't use yet show up less.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { rollChoices, rarityOddsFor, squadSources, dropWeight } from '../../src/systems/rewards.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rw = r('rewards.json');
const heroDefs = noPerks(r('heroes.json'));
const mk = (ids) => new BattleState({ heroDefs: ids.map((id) => heroDefs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });

const band = (i) => rw.rarityOdds[i].odds; // the numbers come from rewards.json (tuning needs no test edits)
ok('floor 1-10 odds', rarityOddsFor(1, rw).legendary === band(0).legendary && rarityOddsFor(10, rw).legendary === band(0).legendary);
ok('floor 11-30 odds', rarityOddsFor(11, rw).legendary === band(1).legendary && rarityOddsFor(30, rw).epic === band(1).epic);
ok('floor 31+ odds', rarityOddsFor(31, rw).legendary === band(2).legendary && rarityOddsFor(200, rw).common === band(2).common);

// Rarity mix matches the odds (each card). Measured on many rolls.
const mix = (floor) => { const s = mk(['knight', 'rogue', 'archer']); const t = {}; let n = 0;
  for (let i = 0; i < 20000; i++) for (const it of rollChoices({ itemDefs, rules: rw, floor, count: 1, heroes: s.heroes })) { t[it.rarity] = (t[it.rarity] || 0) + 1; n++; }
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, (100 * v) / n])); };
const m1 = mix(1), m31 = mix(31);
ok('floor 1 card matches the common odds', Math.abs(m1.common - band(0).common) < 1.5, m1.common.toFixed(1));
ok('floor 1 card matches the legendary odds', Math.abs(m1.legendary - band(0).legendary) < 0.5, m1.legendary.toFixed(2));
ok('floor 31 card matches the legendary odds', Math.abs(m31.legendary - band(2).legendary) < 0.8, m31.legendary.toFixed(2));

// No duplicate cards, 3 cards.
{ const s = mk(['knight', 'rogue', 'archer']); let dup = 0;
  for (let i = 0; i < 2000; i++) { const c = rollChoices({ itemDefs, rules: rw, floor: 5, count: 3, heroes: s.heroes }); if (new Set(c.map((x) => x.id)).size !== c.length || c.length !== 3) dup++; }
  ok('3 different cards every time', dup === 0); }

// Soft gating: Eagle Eye needs a ranged hero. The game has it OFF (user, session 26: needsMissingFactor 1 = every item
// the same chance); the rule is tested with its own factor 0.25 so it still works if it is turned back on.
ok('needs rule is off in the data (every item the same chance)', rw.needsMissingFactor === 1);
{ const rw = { ...r('rewards.json'), needsMissingFactor: 0.25 };
  const melee = mk(['knight', 'rogue', 'berserker']), withArcher = mk(['knight', 'rogue', 'archer']);
  ok('all-melee squad has no ranged source', !squadSources(melee.heroes, itemDefs).has('ranged'));
  ok('archer gives a ranged source', squadSources(withArcher.heroes, itemDefs).has('ranged'));
  ok('Eagle Eye weight x0.25 without a ranged hero', dropWeight(itemDefs.eagle_eye, squadSources(melee.heroes, itemDefs), rw) === 25);
  ok('Eagle Eye normal weight with a ranged hero', dropWeight(itemDefs.eagle_eye, squadSources(withArcher.heroes, itemDefs), rw) === 100);
  const count = (s) => { let n = 0; for (let i = 0; i < 20000; i++) if (rollChoices({ itemDefs, rules: rw, floor: 1, count: 1, heroes: s.heroes })[0].id === 'eagle_eye') n++; return n; };
  const a = count(melee), b = count(withArcher);
  ok('Eagle Eye shows up about 4x less for an all-melee squad', b / a > 2.8 && b / a < 5.5, `${a} vs ${b}`);
  // A dead archer no longer counts as a source.
  withArcher.heroes[2].alive = false;
  ok('dead heroes are not a source', !squadSources(withArcher.heroes, itemDefs).has('ranged')); }

// Item drop weight: Chill Band (80) vs Fire Bombs (100), same rarity.
ok('Chill Band has weight 80', dropWeight(itemDefs.chill_band, new Set(), rw) === 80);
ok('items without a weight use the default 100', dropWeight(itemDefs.fire_bombs, new Set(), rw) === 100);

// If a rarity has nothing left, its chance goes to the others: never a missing card.
{ const s = mk(['knight', 'rogue', 'archer']);
  const noCommons = Object.fromEntries(Object.entries(itemDefs).filter(([, it]) => it.rarity !== 'common'));
  let full = true; for (let i = 0; i < 500; i++) if (rollChoices({ itemDefs: noCommons, rules: rw, floor: 1, count: 3, heroes: s.heroes }).length !== 3) full = false;
  ok('no commons left: still 3 cards', full); }
// Boss floors (user, session 25): one card of each rarity in rewards.json bossRarities (2 epic + 1 legendary), all different.
{ const s = mk(['knight', 'rogue', 'archer']); let good = true;
  for (let i = 0; i < 500; i++) { const c = rollChoices({ itemDefs, rules: rw, floor: 20, count: 3, heroes: s.heroes, rarities: rw.bossRarities });
    if (JSON.stringify(c.map((x) => x.rarity)) !== JSON.stringify(rw.bossRarities) || new Set(c.map((x) => x.id)).size !== 3) good = false; }
  ok('boss floor reward: exactly the set rarities (2 epic + 1 legendary), no repeats', good && rw.bossRarities.filter((r) => r === 'epic').length === 2 && rw.bossRarities.includes('legendary')); }
