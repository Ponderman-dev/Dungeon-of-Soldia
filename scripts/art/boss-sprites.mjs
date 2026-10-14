// Turns the boss pixel designs of the proposal page (docs/proposals/bosses-kits-sounds/sprites.js, a tiny
// drawing language) into game parts: { body: { x, y, w, h, art: { palette, rows }, anchor } }.
// Usage: node scripts/art/boss-sprites.mjs  -> prints JSON { key: { parts, height } } for every design.
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('../../docs/proposals/bosses-kits-sounds/sprites.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\n;this.BOSSES_ART = BOSSES_ART; this.makeGrid = makeGrid; this.outline = outline;', ctx);
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';

export function designToParts(key) {
  const art = ctx.BOSSES_ART[key];
  const P = ctx.makeGrid(art.w + 2, art.h + 2);
  const inner = ctx.makeGrid(art.w, art.h);
  art.draw(inner);
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) P.g[y + 1][x + 1] = inner.g[y][x];
  let g = ctx.outline(P.g);
  // trim empty rows/cols
  const used = (r) => r.some((c) => c);
  while (g.length && !used(g[0])) g.shift();
  while (g.length && !used(g[g.length - 1])) g.pop();
  let x0 = Math.min(...g.map((r) => r.findIndex((c) => c)).filter((i) => i >= 0));
  let x1 = Math.max(...g.map((r) => r.length - 1 - [...r].reverse().findIndex((c) => c)).filter((i, j) => used(g[j])));
  g = g.map((r) => r.slice(x0, x1 + 1));
  const palette = [];
  const rows = g.map((r) => r.map((c) => {
    if (!c) return '.';
    const hex = '0x' + c.slice(1);
    let i = palette.indexOf(hex);
    if (i < 0) { palette.push(hex); i = palette.length - 1; }
    return DIG[i];
  }).join(''));
  const w = rows[0].length, h = rows.length;
  return { height: h, parts: { body: { x: 0, y: -h / 2, w, h, art: { palette, rows }, anchor: [w / 2, h] } } };
}

if (process.argv[1].endsWith('boss-sprites.mjs')) {
  const out = {};
  for (const key of Object.keys(ctx.BOSSES_ART)) out[key] = designToParts(key);
  console.log(JSON.stringify(out));
}
