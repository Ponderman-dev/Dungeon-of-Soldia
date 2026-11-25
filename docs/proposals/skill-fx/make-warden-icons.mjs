// Draws the Warden's icon OPTIONS (16x16, the skillIcons.json format: palette + rows, '0' = dark outline) and writes
// them to docs/proposals/skill-fx/warden-icons.json. Option A of each also goes into src/data/skillIcons.json until the
// user picks (review page). Run: node docs/proposals/skill-fx/make-warden-icons.mjs
import fs from 'node:fs';

// palette: 0 outline, 1 light iron, 2 iron, 3 dark iron, 4 gold, 5 rust, 6 white
const PAL = ['0x16101f', '0xe4e8f0', '0xa8aebb', '0x5a5f6a', '0xf2c544', '0xb0643a', '0xffffff'];

function canvas() {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = String(c); };
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, typeof c === 'function' ? c(i) : c); };
  const ring = (cx, cy, rx, ry, c, a0 = 0, a1 = Math.PI * 2) => { for (let a = a0; a <= a1; a += 0.05) set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c); };
  // a chain: alternating light / dark links
  const chain = (x0, y0, x1, y1) => line(x0, y0, x1, y1, (i) => (i % 2 ? 1 : 3));
  // dark outline round everything drawn
  const outline = () => {
    const src = g.map((r) => r.slice());
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (src[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src[y + dy] && src[y + dy][x + dx] && src[y + dy][x + dx] !== '.')) g[y][x] = '0';
    }
  };
  const out = () => { outline(); return { palette: PAL, rows: g.map((r) => r.join('')) }; };
  return { set, line, ring, chain, out };
}

const icons = {};
// CHAIN HOOK A: a big J-shaped hook hanging from a chain that comes in from the top-left
{ const c = canvas();
  c.chain(1, 1, 8, 3); c.ring(10, 3, 1.5, 1.5, 2); // chain into the hook's eye
  c.line(10, 5, 10, 10, 1); c.line(11, 5, 11, 10, 2); // the shank (2 px)
  c.ring(8, 10, 2.5, 2.5, 1, 0, Math.PI); c.ring(8, 10, 3.5, 3.5, 2, 0, Math.PI); // the bend
  c.line(4, 9, 4, 7, 1); c.line(5, 9, 5, 8, 2); c.set(4, 6, 6); c.set(5, 7, 6); // the barb, white tip
  icons['chain_hook:A'] = c.out(); }
// CHAIN HOOK B: the hook flying right, its chain trailing behind, speed lines
{ const c = canvas();
  c.chain(1, 8, 8, 8);
  c.line(9, 7, 12, 7, 1); c.line(9, 8, 12, 8, 2); // shank, pointing right
  c.ring(12, 10, 2.5, 2.5, 1, -Math.PI / 2, Math.PI / 2); c.ring(12, 10, 1.5, 1.5, 2, -Math.PI / 2, Math.PI / 2); // the bend
  c.line(11, 13, 9, 13, 1); c.set(9, 12, 6); c.set(8, 12, 6); // barb back towards him
  c.line(2, 4, 7, 4, 2); c.line(3, 11, 6, 11, 2); // speed lines
  icons['chain_hook:B'] = c.out(); }
// LOCKDOWN A: a ring of chain with a gold padlock in the middle
{ const c = canvas();
  for (let a = 0; a < Math.PI * 2; a += 0.05) { const k = Math.round(a * 4); c.set(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, k % 2 ? 1 : 3); }
  c.ring(8, 6, 1.6, 1.6, 2, Math.PI, Math.PI * 2); c.line(6, 6, 6, 7, 2); c.line(10, 6, 10, 7, 2); // shackle of the lock
  for (let y = 7; y <= 10; y++) c.line(6, y, 10, y, 4); c.set(8, 8, 5); c.set(8, 9, 5); // body + keyhole
  icons['lockdown:A'] = c.out(); }
// LOCKDOWN B: two chains crossing in an X, a padlock where they meet
{ const c = canvas();
  c.chain(1, 1, 14, 14); c.chain(14, 1, 1, 14);
  c.ring(8, 6, 1.6, 1.6, 2, Math.PI, Math.PI * 2); c.line(6, 6, 6, 7, 2); c.line(10, 6, 10, 7, 2);
  for (let y = 7; y <= 10; y++) c.line(6, y, 10, y, 4); c.set(8, 8, 5); c.set(8, 9, 5);
  icons['lockdown:B'] = c.out(); }
// SHACKLES (passive) A: a pair of iron cuffs joined by a chain
{ const c = canvas();
  c.ring(4, 10, 3, 3, 1); c.ring(4, 10, 2, 2, 3, Math.PI * 0.1, Math.PI * 0.9); c.set(4, 13, 4);
  c.ring(11, 10, 3, 3, 1); c.ring(11, 10, 2, 2, 3, Math.PI * 0.1, Math.PI * 0.9); c.set(11, 13, 4);
  c.chain(5, 6, 7, 3); c.chain(8, 3, 10, 6);
  icons['passive_bard:A'] = c.out(); }
// SHACKLES B: the jailer's ring of keys
{ const c = canvas();
  c.ring(5, 5, 3, 3, 1); // the ring
  for (const [x0, y0] of [[7, 7], [5, 8]]) { c.line(x0, y0, x0 + 5, y0 + 5, 4); c.set(x0 + 4, y0 + 6, 4); c.set(x0 + 5, y0 + 3, 4); } // two gold keys
  c.set(3, 3, 6);
  icons['passive_bard:B'] = c.out(); }

fs.writeFileSync(new URL('./warden-icons.json', import.meta.url), JSON.stringify(icons, null, 1) + '\n');
// option A into the game until the user picks
const P = new URL('../../../src/data/skillIcons.json', import.meta.url);
const game = JSON.parse(fs.readFileSync(P, 'utf8'));
for (const id of ['chain_hook', 'lockdown', 'passive_bard']) game[id] = icons[`${id}:${process.argv[2] || 'A'}`] || icons[`${id}:A`];
fs.writeFileSync(P, JSON.stringify(game, null, 2) + '\n');
console.log('icons:', Object.keys(icons).join(', '));
