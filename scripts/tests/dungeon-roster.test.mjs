// Floors from 4 on pick their enemies at random from the dungeon roster (dungeons.json `roster`):
// an enemy only shows up from its `from` floor, old ones stop after `until`, `max` caps one per fight.
import fs from 'fs';
import { enemiesForFloor, rosterFor, randomEnemies } from '../../src/systems/dungeon.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const A = r('dungeons.json').A, enemies = r('enemies.json');
let seed = 1; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

ok('floor 1 is still the fixed intro fight', JSON.stringify(enemiesForFloor(A, 1, rng)) === JSON.stringify(['slime', 'goblin']));
ok('every roster enemy exists in enemies.json', A.roster.every((e) => enemies[e.id]), A.roster.filter((e) => !enemies[e.id]).map((e) => e.id).join());
let bad = [];
for (let n = 4; n <= 120; n++) {
  for (let k = 0; k < 20; k++) {
    if (A.bosses?.[n]) continue; // boss floors have a fixed line-up
    const ids = enemiesForFloor(A, n, rng);
    const allowed = rosterFor(A, n).map((e) => e.id);
    if (ids.some((id) => !allowed.includes(id))) bad.push(n);
    if (!ids.monsterHouse && (ids.length < A.director.minCount || ids.length > 10)) bad.push('count' + n);
  }
}
ok('random floors only use enemies unlocked for that floor, with a sane count (the director decides how many)', bad.length === 0, bad.slice(0, 5).join());
ok('an enemy past its `until` floor is gone', !rosterFor(A, 100).some((e) => e.until !== undefined && e.until < 100));
const D = { roster: [{ id: 'a', from: 1, max: 1 }, { id: 'b', from: 1 }] };
let capped = true;
for (let k = 0; k < 200; k++) if (randomEnemies(D, 1, 3, rng).filter((x) => x === 'a').length > 1) capped = false;
ok('`max` caps an enemy per fight', capped);
const E = { roster: [{ id: 'a', from: 1, weight: 300 }, { id: 'b', from: 1, weight: 100 }] };
let a = 0; for (let k = 0; k < 4000; k++) if (randomEnemies(E, 1, 1, rng)[0] === 'a') a++;
ok('weights are respected (about 75% a)', a > 2800 && a < 3200, String(a));
import { validateDungeon } from '../../src/systems/validate.js';
ok('validateDungeon accepts random floors and checks the roster', validateDungeon(A, enemies).length === 0 && validateDungeon({ floors: [{ floor: 1, enemies: 2 }], roster: [{ id: 'nope', from: 1 }] }, enemies).length === 1);
ok('boss floors 20-160 return their fixed boss line-up', [20, 40, 60, 80, 100, 120, 140, 160].every((n) => JSON.stringify(enemiesForFloor(A, n, rng)) === JSON.stringify(A.bosses[n])));
