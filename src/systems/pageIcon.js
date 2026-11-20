// A skill book page's icon (no Phaser): a 16x16 SPELL TOME in the page's own colour with its symbol on the cover
// (user's pick 'F', session 45; the clasp gem was removed in session 46, user: 'the lock feels weird'; the tier shows in
// the frame). Data: src/data/pageIcons.json. Returns
// { palette, rows } like the item icons, so systems/itemIcons.js framedIconPixels() can put it in a frame.
// tierFrame = the tier's frame colours (unused now that the clasp is gone; kept so callers need no change).
const INK = '0x1a1020', PAPER = '0xf3eadb';
const darker = (hex, k = 0.45) => {
  const n = Number(hex);
  const ch = (s) => Math.round(((n >> s) & 255) * k);
  return '0x' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
};
export function pageIconArt(pageIcons, pageId, tierFrame) {
  const d = pageIcons[pageId] || pageIcons._default;
  // palette: 0 ink outline, 1 symbol, 2 symbol highlight, 3 page edges, 4 cover
  const palette = [INK, d.color, d.light, PAPER, darker(d.color)];
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (let y = 1; y <= 14; y++) for (let x = 2; x <= 13; x++) g[y][x] = x === 2 || x === 13 || y === 1 || y === 14 ? '0' : '4';
  for (let y = 2; y <= 13; y++) g[y][3] = '1'; // the spine in the page's colour
  for (let y = 12; y <= 13; y++) for (let x = 4; x <= 12; x++) g[y][x] = '3'; // page edges
  d.symbol.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[3 + y][5 + x] = ch; }));
  return { palette, rows: g.map((r) => r.join('')) };
}
