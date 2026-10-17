// Where enemies stand at the start of a fight (no Phaser). Up to `perRow` enemies stand in one row at y, like
// before. More enemies stand in several rows `rowGap` apart around y: melee fighters in the front rows
// (closest to the heroes), ranged ones at the back. Returns one { x, y } per unit, in the units' order.
// `spread` 'gap' = x at (i + 1) / (n + 1) of the width (the battle screen), 'lane' = (i + 0.5) / n (tests, bots).
export function enemySpots(units, { width, y, perRow = 5, rowGap = 70, spread = 'gap' }) {
  const n = units.length;
  const rows = Math.max(1, Math.ceil(n / perRow));
  // Ranged fighters go last, so they end up in the back rows.
  const order = units.map((u, i) => i).sort((a, b) => (isRanged(units[a]) - isRanged(units[b])) || a - b);
  const spots = new Array(n);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const count = Math.floor(n / rows) + (r < n % rows ? 1 : 0);
    const rowY = y + ((rows - 1) / 2 - r) * rowGap; // row 0 = front (lowest on screen)
    for (let c = 0; c < count; c++, k++) {
      const x = spread === 'lane' ? (width * (c + 0.5)) / count : (width * (c + 1)) / (count + 1);
      spots[order[k]] = { x, y: rowY };
    }
  }
  return spots;
}

function isRanged(unit) {
  const def = unit.def || unit;
  return def.damageType === 'melee' || !def.damageType ? 0 : 1;
}
