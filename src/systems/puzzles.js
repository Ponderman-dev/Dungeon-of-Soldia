// Puzzle Room rules (no Phaser): the user kept 5 puzzles from the proposal page (docs/proposals/puzzles/): Mimic
// Shuffle, Rune Lock, Mirror Beam, Ice Slide and Picture Puzzle. A Puzzle Room picks one at random; each gets harder
// deeper down (`tiers`). Every level a generator hands out can be solved (checked here, tested in puzzles.test.mjs).
// Data: rooms.json `kinds.puzzle`. Drawing: src/scenes/PuzzleScene.js.

const rnd = (rng, n) => Math.floor(rng() * n);
const shuffled = (list, rng) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Which puzzle a room shows: one of `rules.puzzles` at random.
export const pickPuzzle = (rules, rng = Math.random) => rules.puzzles[rnd(rng, rules.puzzles.length)];

// The settings of puzzle `kind` on floor n: the last tier whose `fromFloor` is reached.
export function puzzleSettings(rules, kind, floor) {
  const tiers = rules.tiers[kind];
  let pick = tiers[0];
  for (const t of tiers) if (floor >= t.fromFloor) pick = t;
  return pick;
}

// ---- Mimic Shuffle: the coin goes into chest `treasure`, then `swaps` pairs of chests trade places.
export function mimicPlan(P, rng = Math.random) {
  const swaps = [];
  for (let k = 0; k < P.swaps; k++) {
    const a = rnd(rng, P.chests);
    let b = rnd(rng, P.chests - 1);
    if (b >= a) b++;
    swaps.push([a, b]);
  }
  return { treasure: rnd(rng, P.chests), swaps };
}

// ---- Rune Lock: `runes` of the glyphs on the door (indices into the glyph list) and the order to repeat.
export function runePlan(P, glyphCount, rng = Math.random) {
  return { runes: shuffled([...Array(glyphCount).keys()], rng).slice(0, P.runes), sequence: Array.from({ length: P.length }, () => rnd(rng, P.runes)) };
}

// ---- Mirror Beam: an n x n room; light comes in from the left edge on row `srow` heading right. Mirrors '/' and
// '\' turn it; pillars stop it. Tapping a mirror flips it. Solved = the beam reaches the crystal.
const DIR = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
const BOUNCE = { '/': { R: 'U', U: 'R', L: 'D', D: 'L' }, '\\': { R: 'D', D: 'R', L: 'U', U: 'L' } };

// Follows the beam. Returns { path: [[x, y]...], hit (reached the crystal), bounces, loop }.
export function traceBeam(level, ori, withCrystal = true) {
  let x = -1;
  let y = level.srow;
  let d = 'R';
  const path = [];
  let bounces = 0;
  for (let s = 0; s < 400; s++) {
    x += DIR[d][0];
    y += DIR[d][1];
    if (x < 0 || y < 0 || x >= level.n || y >= level.n) return { path, hit: false, bounces };
    path.push([x, y]);
    const key = `${x},${y}`;
    if (level.pillars.includes(key)) return { path, hit: false, bounces, blocked: true };
    if (withCrystal && level.crystal === key) return { path, hit: true, bounces };
    const m = level.mirrors.findIndex(([mx, my]) => mx === x && my === y);
    if (m >= 0) {
      d = BOUNCE[ori[m]][d];
      bounces++;
    }
  }
  return { path, hit: false, bounces, loop: true };
}

export const flipMirror = (ori, i) => ori.map((o, k) => (k === i ? (o === '/' ? '\\' : '/') : o));

// A random room with P.mirrors mirrors and P.pillars pillars. Over every way the mirrors can face, the crystal goes
// at the end of the path with the most bounces (at least P.minBounces), so the room can ALWAYS be solved; the
// mirrors start facing a way that misses it. Returns { level, ori, bounces }.
export function makeBeamLevel(P, rng = Math.random) {
  const n = P.size;
  for (let tries = 0; tries < 400; tries++) {
    const used = new Set();
    const cell = () => {
      let k;
      do k = `${rnd(rng, n)},${rnd(rng, n)}`; while (used.has(k));
      used.add(k);
      return k;
    };
    const srow = rnd(rng, n);
    used.add(`0,${srow}`); // keep the doorway of the light clear
    const mirrors = Array.from({ length: P.mirrors }, () => cell().split(',').map(Number));
    const pillars = Array.from({ length: P.pillars }, cell);
    const level = { n, srow, mirrors, pillars, crystal: null };
    let best = null;
    for (let mask = 0; mask < 1 << P.mirrors; mask++) {
      const ori = mirrors.map((_, i) => ((mask >> i) & 1 ? '/' : '\\'));
      const r = traceBeam(level, ori, false);
      if (r.loop) continue;
      const empty = r.path.filter(([x, y]) => !used.has(`${x},${y}`));
      if (empty.length && (!best || r.bounces > best.bounces)) best = { bounces: r.bounces, at: empty[empty.length - 1] };
    }
    if (!best || best.bounces < P.minBounces) continue;
    level.crystal = best.at.join(',');
    for (let k = 0; k < 60; k++) {
      const ori = mirrors.map(() => (rng() < 0.5 ? '/' : '\\'));
      if (!traceBeam(level, ori).hit) return { level, ori, bounces: best.bounces };
    }
  }
  return null;
}

// ---- Ice Slide: an n x n icy floor with rocks. The key slides until the next square is a rock or the edge.
// Solved = the key STOPS on the keyhole.
export function slideKey(level, [x, y], [dx, dy]) {
  for (;;) {
    const X = x + dx;
    const Y = y + dy;
    if (X < 0 || Y < 0 || X >= level.n || Y >= level.n || level.rocks.includes(`${X},${Y}`)) return [x, y];
    x = X;
    y = Y;
  }
}

// The fewest moves to stop on every square the key can reach from `start` (key "x,y" -> moves).
export function iceDistances(level, start) {
  const dist = new Map([[start.join(','), 0]]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift();
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const s = slideKey(level, p, d);
      const k = s.join(',');
      if (!dist.has(k)) {
        dist.set(k, dist.get(p.join(',')) + 1);
        queue.push(s);
      }
    }
  }
  return dist;
}

// Random rocks and a start; the keyhole goes on a square the key can stop on in P.minMoves or P.minMoves + 1
// moves (searched), so it is ALWAYS solvable and `par` (the fewest moves) fits the depth. Returns { level, start, goal, par }.
export function makeIceLevel(P, rng = Math.random) {
  const n = P.size;
  for (let tries = 0; tries < 500; tries++) {
    const rocks = new Set();
    while (rocks.size < P.rocks) rocks.add(`${rnd(rng, n)},${rnd(rng, n)}`);
    let start;
    do start = [rnd(rng, n), rnd(rng, n)]; while (rocks.has(start.join(',')));
    const level = { n, rocks: [...rocks] };
    const fits = [...iceDistances(level, start).entries()].filter(([, v]) => v >= P.minMoves && v <= P.minMoves + 1);
    if (!fits.length) continue;
    const [goal, par] = fits[rnd(rng, fits.length)];
    return { level, start, goal: goal.split(',').map(Number), par };
  }
  return null;
}

// ---- Picture Puzzle: a picture cut into g x g pieces; `order[spot]` = the piece shown there. Any two spots swap.
export function shufflePieces(count, rng = Math.random) {
  let order;
  do order = shuffled([...Array(count).keys()], rng); while (order.every((v, i) => v === i));
  return order;
}

export const swapPieces = (order, a, b) => order.map((v, i) => (i === a ? order[b] : i === b ? order[a] : v));

export const pictureDone = (order) => order.every((v, i) => v === i);
