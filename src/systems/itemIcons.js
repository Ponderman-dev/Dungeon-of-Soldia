// Item icons (itemIcons.json): a 16x16 pixel picture per item, shown inside a 20x20 frame whose
// colours tell the rarity (rarities.json `frame`: edge, fill, hi = the lighter inner edge, stud =
// corner studs for epic/legendary). No Phaser here: returns grid[y][x] of colour numbers (null = empty).
import { artPixels } from './pixelArt.js';

export const ICON_SIZE = 16;
export const FRAMED_SIZE = 20;

export function framedIconPixels(icon, frame) {
  const N = FRAMED_SIZE;
  const f = frame || { edge: '0x8f8aa3', fill: '0x2a2438', hi: '0xb3aec4' };
  const grid = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      const corner = (x === 0 || x === N - 1) && (y === 0 || y === N - 1);
      row.push(corner ? null : Number(edge ? f.edge : x === 1 || y === 1 ? f.hi : f.fill));
    }
    grid.push(row);
  }
  if (f.stud) for (const [x, y] of [[1, 1], [N - 2, 1], [1, N - 2], [N - 2, N - 2]]) grid[y][x] = Number(f.stud);
  if (icon) {
    const px = artPixels(icon);
    px.forEach((row, y) => row.forEach((c, x) => { if (c !== null && y < ICON_SIZE && x < ICON_SIZE) grid[y + 2][x + 2] = c; }));
  }
  return grid;
}
