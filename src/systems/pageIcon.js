// A skill book page's icon (no Phaser): a 16x16 SPELL TOME in the page's own colour with its symbol on the cover and
// a clasp gem in the page's tier colour (user's pick 'F', session 45). Data: src/data/pageIcons.json. Returns
// { palette, rows } like the item icons, so systems/itemIcons.js framedIconPixels() can put it in a frame.
// tierFrame = the tier's frame colours ({ edge, hi }: rarities.json / skillBooks.json heroFrame).
const INK = '0x1a1020', PAPER = '0xf3eadb';
const darker = (hex, k = 0.45) => {
  const n = Number(hex);
  const ch = (s) => Math.round(((n >> s) & 255) * k);
  return '0x' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
};
export function pageIconArt(pageIcons, pageId, tierFrame) {
  const d = pageIcons[pageId] || pageIcons._default;
  // palette: 0 ink outline, 1 symbol, 2 symbol highlight, 3 page edges, 4 cover, 5 gem, 6 gem highlight
  const palette = [INK, d.color, d.light, PAPER, darker(d.color), tierFrame.edge, tierFrame.hi];
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (let y = 1; y <= 14; y++) for (let x = 2; x <= 13; x++) g[y][x] = x === 2 || x === 13 || y === 1 || y === 14 ? '0' : '4';
  for (let y = 2; y <= 13; y++) g[y][3] = '1'; // the spine in the page's colour
  for (let y = 12; y <= 13; y++) for (let x = 4; x <= 12; x++) g[y][x] = '3'; // page edges
  d.symbol.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[3 + y][5 + x] = ch; }));
  g[7][12] = '5'; g[8][12] = '6'; g[7][13] = '5'; g[8][13] = '5'; // the clasp gem = tier
  return { palette, rows: g.map((r) => r.join('')) };
}
