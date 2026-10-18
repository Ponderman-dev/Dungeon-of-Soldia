// Special rooms (no Phaser): which floors are not fights but a treasure room, a Mimic, a rest fountain,
// a skill dealer or a puzzle (src/systems/puzzles.js). Data: src/data/rooms.json. The scene part: src/scenes/roomMethods.js.

// The room kind for floor n, or null for a normal fight. `prev` = the kind of the floor before (null = a fight).
// Never a boss floor, never the floor just before a boss, never two rooms in a row.
export function roomForFloor(rules, dungeon, n, prev = null, rng = Math.random) {
  const bosses = (dungeon && dungeon.bosses) || {};
  if (n < rules.fromFloor || bosses[n] || bosses[n + 1] || prev) return null;
  if (rng() >= rules.chance) return null;
  const kinds = Object.entries(rules.kinds).filter(([, k]) => (k.weight ?? 0) > 0);
  const total = kinds.reduce((t, [, k]) => t + k.weight, 0);
  let roll = rng() * total;
  for (const [id, k] of kinds) if ((roll -= k.weight) < 0) return id;
  return kinds[kinds.length - 1][0];
}
