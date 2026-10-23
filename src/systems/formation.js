// Where enemies stand at the start of a fight (no Phaser). Up to `perRow` enemies stand in one row at y, like
// before. More enemies stand in several rows `rowGap` apart around y: melee fighters in the front rows
// (closest to the heroes), ranged ones at the back. Returns one { x, y } per unit, in the units' order.
// With `room` ({ rowRoom, eliteRowRoom, maxGap }) the gap behind each row grows with its tallest enemy (as drawn),
// so a big enemy's HP bar, icons and elite name stay clear of the row behind; rowGap is then the smallest gap.
// `top` = the highest y a fighter may stand at (the wall): a tall formation shifts down instead of going past it.
// `spread` 'gap' = x at (i + 1) / (n + 1) of the width (the battle screen), 'lane' = (i + 0.5) / n (tests, bots).
export function enemySpots(units, { width, y, perRow = 5, rowGap = 70, spread = 'gap', room = null, top = -Infinity }) {
  const n = units.length;
  const rows = Math.max(1, Math.ceil(n / perRow));
  // Ranged fighters go last, so they end up in the back rows.
  const order = units.map((u, i) => i).sort((a, b) => (isRanged(units[a]) - isRanged(units[b])) || a - b);
  const spots = new Array(n);
  // Which units stand in which row (row 0 = front, lowest on screen).
  const rowsOf = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const count = Math.floor(n / rows) + (r < n % rows ? 1 : 0);
    rowsOf.push(order.slice(k, k + count));
    k += count;
  }
  // Gap behind each row, then the rows are centred around y (moved down if the back row would pass `top`).
  const gaps = rowsOf.slice(0, -1).map((row) => (room ? rowGapFor(row.map((i) => units[i]), rowGap, room) : rowGap));
  const total = gaps.reduce((a, b) => a + b, 0);
  let rowY = y + total / 2 + Math.max(0, top - (y - total / 2));
  rowsOf.forEach((row, r) => {
    row.forEach((i, c) => {
      const x = spread === 'lane' ? (width * (c + 0.5)) / row.length : (width * (c + 1)) / (row.length + 1);
      spots[i] = { x, y: rowY };
    });
    rowY -= gaps[r] || 0;
  });
  return spots;
}

// The gap a row needs behind it: its tallest enemy as drawn + room for the bar/icons (or the elite name).
function rowGapFor(row, minGap, { rowRoom = 0, eliteRowRoom = rowRoom, maxGap = Infinity }) {
  const need = Math.max(0, ...row.map((u) => {
    const def = u.def || u;
    return (def.height || 0) * (def.drawScale ?? 3) + (u.elite ? eliteRowRoom : rowRoom);
  }));
  return Math.min(maxGap, Math.max(minGap, need));
}

function isRanged(unit) {
  const def = unit.def || unit;
  return def.damageType === 'melee' || !def.damageType ? 0 : 1;
}
