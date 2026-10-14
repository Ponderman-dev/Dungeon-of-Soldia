// Status icons (statusIcons.json): a 7x7 pixel picture per status (a 5x5 design + its dark outline), shown in
// rows of 3 over the health bar, with the stack count just right of the icon. No Phaser here: the scene
// passes the icon data in and draws what `iconLayout()` returns.

export const ICON_PX = 7; // icon size in icon pixels (before the game's CHAR_SCALE)
export const PER_ROW = 3;
const DIGIT_PX = 4; // one digit of the stack number (3 wide + 1 gap), in icon pixels

// Which icons a fighter shows, in display order: [{ id, n }]. `kinds` = the status types it has,
// `count(kind)` = how many stacks, `extra` = icon ids that are not statuses (e.g. 'steady').
// Statuses without an icon are left out (knockback is instant and never shown).
export function iconList(icons, kinds, count, extra = []) {
  const order = icons._order || [];
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
  return [...new Set([...extra, ...kinds])]
    .filter((id) => icons[id])
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => ({ id, n: count(id) }));
}

// How wide one entry is: the icon plus room for its stack number (shown when 2 or more).
export const entryWidth = (n) => ICON_PX + (n > 1 ? String(n).length * DIGIT_PX : 0);

// Where each icon goes, in icon pixels, relative to the middle of the BOTTOM row (rows go up, `dir` -1)
// or down (`dir` 1). Returns [{ id, n, x, y }]: x, y = the icon's middle.
export function iconLayout(list, { perRow = PER_ROW, dir = -1 } = {}) {
  const out = [];
  for (let r = 0; r * perRow < list.length; r++) {
    const row = list.slice(r * perRow, (r + 1) * perRow);
    let x = -row.reduce((sum, e) => sum + entryWidth(e.n), 0) / 2;
    for (const e of row) {
      out.push({ ...e, x: x + ICON_PX / 2, y: dir * r * ICON_PX });
      x += entryWidth(e.n);
    }
  }
  return out;
}
