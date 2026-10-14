// Which enemies appear on a floor (no Phaser here).
// A floor entry applies until the next listed floor. An entry can also repeat: with `every: N`
// its enemies are used on its floor, then every Nth floor after it, and `otherwise` is used on
// the floors in between (e.g. a rare 4-enemy fight).
// An entry's enemies are either a fixed list (["slime", "goblin"]) or a NUMBER: that many enemies
// picked at random from the dungeon's `roster` (see rosterFor).
export function enemiesForFloor(dungeon, n, rng = Math.random) {
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
