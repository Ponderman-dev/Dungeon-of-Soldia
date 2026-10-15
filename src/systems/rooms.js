// Special rooms (no Phaser): which floors are not fights but a treasure room, a Mimic, a rest fountain,
// a skill dealer or a slide puzzle. Data: src/data/rooms.json. The scene part: src/scenes/roomMethods.js.

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

// ---- slide puzzle ---------------------------------------------------------------------------------------------
// A board is a list of size*size numbers read row by row: 1..size*size-1 are tiles, 0 is the empty spot.

export const solvedBoard = (size) => [...Array(size * size - 1).keys()].map((i) => i + 1).concat(0);

export const isSolved = (board) => board.every((v, i) => v === (i === board.length - 1 ? 0 : i + 1));

// The spots next to `index` (up, down, left, right).
export function neighbours(size, index) {
  const r = Math.floor(index / size);
  const c = index % size;
  const out = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

// Slides the tile at `index` into the empty spot if it is next to it. Returns the new board, or null if it can't move.
export function slide(board, size, index) {
  const empty = board.indexOf(0);
  if (!neighbours(size, empty).includes(index)) return null;
  const out = [...board];
  out[empty] = out[index];
  out[index] = 0;
  return out;
}

// A shuffled board made by `moves` random legal slides from the solved one, so it can ALWAYS be solved.
// It never undoes the slide it just made, and is never handed out already solved.
export function shuffleBoard(size, moves, rng = Math.random) {
  let board = solvedBoard(size);
  let last = -1;
  for (let i = 0; i < moves || isSolved(board); i++) {
    const empty = board.indexOf(0);
    const options = neighbours(size, empty).filter((x) => x !== last);
    const pick = options[Math.floor(rng() * options.length)];
    board = slide(board, size, pick);
    last = empty;
  }
  return board;
}
