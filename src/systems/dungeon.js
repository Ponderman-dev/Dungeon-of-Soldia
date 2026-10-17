// Which enemies appear on a floor (no Phaser here).
// A floor entry applies until the next listed floor. An entry can also repeat: with `every: N`
// its enemies are used on its floor, then every Nth floor after it, and `otherwise` is used on
// the floors in between (e.g. a rare 4-enemy fight).
// An entry's enemies are either a fixed list (["slime", "goblin"]) or a NUMBER: that many enemies
// picked at random from the dungeon's `roster` (see rosterFor).
// From the director's `fromFloor` the floor director picks them instead (directFloor below); `memory` and
// `enemyDefs` are passed on to it.
export function enemiesForFloor(dungeon, n, rng = Math.random, memory = {}, enemyDefs = null) {
  if (dungeon.bosses && dungeon.bosses[n]) return dungeon.bosses[n]; // a boss floor (every 20 floors)
  if (dungeon.director && n >= dungeon.director.fromFloor) return monsterHouse(dungeon, n, rng, enemyDefs) || directFloor(dungeon, n, rng, memory, enemyDefs);
  const entry = [...dungeon.floors].reverse().find((f) => f.floor <= n) || dungeon.floors[0];
  const pick = entry.every && (n - entry.floor) % entry.every !== 0 ? entry.otherwise : entry.enemies;
  return typeof pick === 'number' ? randomEnemies(dungeon, n, pick, rng) : pick;
}

// The roster entries that can appear on floor n: `from` (first floor) <= n, and n <= `until`
// (last floor, optional: old weak enemies drop out deeper down).
export function rosterFor(dungeon, n) {
  return (dungeon.roster || []).filter((e) => e.from <= n && (e.until === undefined || n <= e.until));
}

// `count` enemies drawn by `weight` (default 100) from the roster of floor n. An entry with `max`
// appears at most that many times in one fight (e.g. one Orc Brute).
export function randomEnemies(dungeon, n, count, rng = Math.random) {
  const pool = rosterFor(dungeon, n);
  const picked = [];
  for (let i = 0; i < count; i++) {
    const open = pool.filter((e) => e.max === undefined || picked.filter((id) => id === e.id).length < e.max);
    if (!open.length) break;
    const total = open.reduce((t, e) => t + (e.weight ?? 100), 0);
    let roll = rng() * total;
    const e = open.find((x) => (roll -= x.weight ?? 100) < 0) || open[open.length - 1];
    picked.push(e.id);
  }
  return picked;
}

// THE FLOOR DIRECTOR (dungeon `director`, user's choice: a true roguelike mix, but delicate): from
// `fromFloor` every normal floor gets a THREAT BUDGET (`budget.base` + `budget.perFloor` per floor after
// `budget.startFloor`, swung by up to +-`swing`) and spends it on enemies of the floor's roster. Every enemy
// costs by its tier (enemies.json `tier`: fodder / normal / strong, `costs`). A random SHAPE (`shapes`: tier
// weights, optional `first` tier bought first) decides the mix, so the same budget can be a swarm of fodder or
// a few strong ones. Never the same shape twice in a row, and after a hard floor (big upward swing) the next
// swing is not upwards. Enemy count stays between `minCount` and the floor's `maxCount` ([floor, max] pairs);
// when the count is full and budget is left, fodder are upgraded to normal enemies.
// `memory` ({}) carries lastShape / lastSwing between floors; the returned list has a `shape` field.
export function directFloor(dungeon, n, rng = Math.random, memory = {}, enemyDefs = null) {
  const D = dungeon.director;
  const tierOf = (id) => (enemyDefs && enemyDefs[id] && enemyDefs[id].tier) || dungeon.roster.find((e) => e.id === id)?.tier || 'normal';
  const pool = rosterFor(dungeon, n).map((e) => ({ ...e, tier: e.tier || tierOf(e.id) }));
  const cost = (tier) => D.costs[tier] ?? 1;

  // The shape: weighted, never the last one again, and only if its tiers exist on this floor.
  const has = (tier) => pool.some((e) => e.tier === tier);
  const shapes = Object.entries(D.shapes).filter(([name, s]) => name !== memory.lastShape && (!s.first || has(s.first)) && Object.keys(s.tiers).some(has));
  const shapeName = pickWeighted(shapes, ([, s]) => s.weight ?? 1, rng)?.[0] || 'mixed';
  const shape = D.shapes[shapeName];

  // The budget, with a swing (after a hard floor the swing can only go down).
  let swing = (rng() * 2 - 1) * D.swing;
  if ((memory.lastSwing ?? 0) > D.swing / 2) swing = -Math.abs(swing);
  let budget = (D.budget.base + D.budget.perFloor * Math.max(0, n - D.budget.startFloor)) * (1 + swing);
  const maxCount = [...D.maxCount].reverse().find(([f]) => f <= n)?.[1] ?? D.maxCount[0][1];

  const picked = [];
  const open = (tier) => pool.filter((e) => e.tier === tier && (e.max === undefined || picked.filter((p) => p.id === e.id).length < e.max));
  const buy = (tier) => {
    const e = pickWeighted(open(tier), (x) => x.weight ?? 100, rng);
    if (!e) return false;
    picked.push(e);
    budget -= cost(tier);
    return true;
  };
  if (shape.first) buy(shape.first);
  while (picked.length < maxCount) {
    const tiers = Object.entries(shape.tiers).filter(([t]) => cost(t) <= budget + 1e-9 && open(t).length);
    const t = pickWeighted(tiers, ([, w]) => w, rng);
    if (!t || !buy(t[0])) break;
  }
  // Count full and budget left: fodder become normal enemies.
  while (budget >= cost('normal') - cost('fodder') && open('normal').length) {
    const i = picked.findIndex((e) => e.tier === 'fodder');
    if (i < 0) break;
    picked.splice(i, 1);
    budget += cost('fodder');
    buy('normal');
  }
  while (picked.length < D.minCount && (open('fodder').length || open('normal').length)) buy(open('fodder').length ? 'fodder' : 'normal');

  memory.lastShape = shapeName;
  memory.lastSwing = swing;
  const ids = picked.map((e) => e.id);
  ids.shape = shapeName;
  ids.elites = pickElites(D.elites, n, picked, rng);
  return ids;
}

// MONSTER HOUSE (director `monsterHouse`, user's choice): from `fromFloor` a fight floor is a Monster House with
// `chance` % (never a boss floor or the floor before a boss): `count` [least, most] enemies all at once, picked by
// `tiers` weights from the floor's roster. Returns null when this floor is a normal fight. The list has
// `monsterHouse: true` (BattleState notes it: banner, special prize) and `elites` like any directed fight.
export function monsterHouse(dungeon, n, rng = Math.random, enemyDefs = null) {
  const M = dungeon.director && dungeon.director.monsterHouse;
  const bosses = dungeon.bosses || {};
  if (!M || n < M.fromFloor || bosses[n] || bosses[n + 1] || rng() * 100 >= M.chance) return null;
  const tierOf = (e) => e.tier || (enemyDefs && enemyDefs[e.id] && enemyDefs[e.id].tier) || 'normal';
  const pool = rosterFor(dungeon, n).map((e) => ({ ...e, tier: tierOf(e) }));
  const [least, most] = M.count;
  const count = least + Math.floor(rng() * (most - least + 1));
  const picked = [];
  while (picked.length < count) {
    const open = pool.filter((e) => M.tiers[e.tier] && (e.max === undefined || picked.filter((p) => p.id === e.id).length < e.max));
    if (!open.length) break;
    const tiers = [...new Set(open.map((e) => e.tier))];
    const tier = pickWeighted(tiers, (t) => M.tiers[t], rng);
    picked.push(pickWeighted(open.filter((e) => e.tier === tier), (e) => e.weight ?? 100, rng));
  }
  const ids = picked.map((e) => e.id);
  ids.shape = 'monsterHouse';
  ids.monsterHouse = true;
  ids.elites = pickElites(dungeon.director.elites, n, picked, rng);
  return ids;
}

// ELITES (director `elites`): which enemies of this fight are elite, as indexes into the list (BattleState
// spawnEnemies turns them into elites). `chance` = % that the fight has one, `second` = % for a second one, both
// read off [floor, %] points (pointValue). Only enemies of the `tiers` listed can be elite (not fodder).
export function pickElites(E, n, picked, rng = Math.random) {
  if (!E || n < E.fromFloor) return [];
  const open = picked.map((e, i) => (E.tiers.includes(e.tier) ? i : -1)).filter((i) => i >= 0);
  const out = [];
  if (!open.length || rng() * 100 >= pointValue(E.chance, n)) return out;
  out.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
  if (open.length && rng() * 100 < pointValue(E.second || [], n)) out.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
  return out;
}

// A value read off [x, value] points with straight lines between them: 0 before the first point, the last
// value after the last point.
export function pointValue(points, x) {
  if (!points.length || x < points[0][0]) return 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, v0] = points[i - 1], [x1, v1] = points[i];
    if (x <= x1) return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

function pickWeighted(list, weightOf, rng) {
  if (!list.length) return null;
  const total = list.reduce((t, x) => t + weightOf(x), 0);
  let roll = rng() * total;
  return list.find((x) => (roll -= weightOf(x)) < 0) || list[list.length - 1];
}
