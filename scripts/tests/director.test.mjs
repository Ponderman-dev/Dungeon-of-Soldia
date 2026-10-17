// The floor director (dungeon.js directFloor): a threat budget per floor spent on fodder / normal / strong
// enemies in a random shape; fodder are weaker, grow slower and are drawn smaller; crowds stand in rows.
import fs from 'fs';
import { enemiesForFloor, directFloor } from '../../src/systems/dungeon.js';
import { enemySpots } from '../../src/systems/formation.js';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const A = r('dungeons.json').A, defs = r('enemies.json'), rules = r('combat.json');
const D = A.director;
let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const tier = (id) => defs[id].tier || 'normal';
const cost = (ids) => ids.reduce((t, id) => t + D.costs[tier(id)], 0);
const budgetAt = (n) => D.budget.base + D.budget.perFloor * Math.max(0, n - D.budget.startFloor);
const maxAt = (n) => [...D.maxCount].reverse().find(([f]) => f <= n)[1];

ok('floors 1-3 stay the fixed intro fights', JSON.stringify(enemiesForFloor(A, 1, rng, {}, defs)) === '["slime","goblin"]');
let overBudget = [], badCount = [], repeats = 0, upAfterHard = 0, shapes = {};
for (let run = 0; run < 30; run++) {
  const mem = {};
  let lastShape = null;
  for (let n = 4; n <= 200; n++) {
    if (A.bosses[n]) continue;
    const before = mem.lastSwing ?? 0;
    const ids = enemiesForFloor(A, n, rng, mem, defs);
    shapes[ids.shape] = (shapes[ids.shape] || 0) + 1;
    if (ids.shape === lastShape) repeats++;
    lastShape = ids.shape;
    if (before > D.swing / 2 && mem.lastSwing > 0) upAfterHard++;
    if (cost(ids) > budgetAt(n) * (1 + D.swing) + 0.001 && ids.length > D.minCount) overBudget.push(n);
    if (ids.length < D.minCount || ids.length > maxAt(n)) badCount.push(n + ':' + ids.length);
  }
}
ok('never spends more than the floor budget', overBudget.length === 0, overBudget.slice(0, 5).join());
ok('enemy count stays between minCount and the floor maxCount', badCount.length === 0, badCount.slice(0, 5).join());
ok('never the same shape twice in a row', repeats === 0, String(repeats));
ok('after a hard floor the next one is not harder', upAfterHard === 0, String(upAfterHard));
ok('every shape shows up', Object.keys(D.shapes).every((s) => shapes[s] > 50), JSON.stringify(shapes));

// The same budget spent differently: crowds deeper down, a strong one in a heavy floor.
const big = [];
for (let k = 0; k < 300; k++) big.push(directFloor(A, 70, rng, {}, defs));
ok('deep floors can have 8+ enemies', big.some((ids) => ids.length >= 8));
ok('a heavy floor buys a strong enemy first', big.filter((ids) => ids.shape === 'heavy').every((ids) => ids.some((id) => tier(id) === 'strong')));
ok('the Orc Brute max of 1 per fight still holds', big.every((ids) => ids.filter((id) => id === 'orcBrute').length <= 1));

// Fodder: weaker, slower growth, smaller, less XP; only from fodder.fromFloor.
const s = new BattleState({ heroDefs: [], enemyDefs: defs, rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
const [slime1] = s.spawnEnemies(['slime'], 1);
ok('a floor-1 slime is unchanged (the intro fights)', slime1.maxHp === defs.slime.stats.health && !slime1.def.drawScale);
const [slime60, gob60] = s.spawnEnemies(['slime', 'goblin'], 60);
const F = rules.enemyTiers.fodder;
ok('a fodder slime is scaled down and grows slower', slime60.maxHp < defs.slime.stats.health * 3 && gob60.maxHp > defs.goblin.stats.health * 6, slime60.maxHp + ' vs goblin ' + gob60.maxHp);
ok('fodder are drawn smaller and give less XP', slime60.def.drawScale === F.drawScale && slime60.xpScale === F.xpScale && gob60.xpScale === 1);

// Rows: up to 5 in one row, more in rows; ranged at the back.
const L = rules.movement.layout;
const fake = (n, ranged = 0) => Array.from({ length: n }, (_, i) => ({ def: { damageType: i < ranged ? 'ranged' : 'melee' } }));
const one = enemySpots(fake(3), { width: 390, y: 340, perRow: 5, rowGap: 70 });
ok('3 enemies: one row at the old spots', one.every((p) => p.y === 340) && Math.round(one[0].x) === Math.round(390 / 4));
const fifteen = enemySpots(fake(15, 5), { width: 390, y: 340, perRow: L.enemyPerRow, rowGap: L.enemyRowGap });
const ys = [...new Set(fifteen.map((p) => p.y))].sort((a, b) => a - b);
ok('15 enemies stand in 3 rows of 5', ys.length === 3 && ys.every((y) => fifteen.filter((p) => p.y === y).length === 5), ys.join());
ok('ranged enemies stand in the back row (highest up)', fifteen.slice(0, 5).every((p) => p.y === ys[0]));

// The new fodder (step 2): in the roster from their floor, tier fodder, with a sprite.
const NEW_FODDER = { swarmling: 13, mushling: 22, boneRat: 25, shadeWisp: 35 };
ok('the 4 new fodder exist, are fodder and join the roster on their floor', Object.entries(NEW_FODDER).every(([id, f]) => defs[id] && defs[id].tier === 'fodder' && defs[id].parts.body.art && A.roster.find((e) => e.id === id)?.from === f));
const seen = new Set();
for (let k = 0; k < 400; k++) directFloor(A, 60, rng, {}, defs).forEach((id) => seen.add(id));
ok('deep swarms use the new fodder too', Object.keys(NEW_FODDER).every((id) => seen.has(id)), [...seen].join());
