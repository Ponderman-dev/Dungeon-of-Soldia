// Which enemies appear on a floor (no Phaser here).
// A floor entry applies until the next listed floor. An entry can also repeat: with `every: N`
// its `enemies` are used on its floor, then every Nth floor after it, and `otherwise` is used on
// the floors in between (e.g. a rare 4-enemy fight).
export function enemiesForFloor(dungeon, n) {
  const entry = [...dungeon.floors].reverse().find((f) => f.floor <= n) || dungeon.floors[0];
  if (entry.every && (n - entry.floor) % entry.every !== 0) return entry.otherwise;
  return entry.enemies;
}
