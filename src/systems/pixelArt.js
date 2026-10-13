// Pixel-art parts. A character part is a small pixel picture ("art") instead of a plain block:
//   art = { palette: ["0x3b6fd4", "0x1a1020"], rows: ["..00..", ".0110."] }
// Each character in a row is a palette index (0-9, then a-z) or "." for an empty pixel.
// The part's x / y (in heroes.json etc.) is the MIDDLE of the picture, in character pixels (feet = 0,0).
// "anchor": [ax, ay] is the turning point inside the picture (0,0 = its top-left corner; 2.5 = the
// middle of the third pixel). A part without art is drawn as its old block (w x h, colour, outline).
// No Phaser here: Character.js turns these pixels into textures.

export const OUTLINE = '0x1a1020';
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

// The part's picture: its own art, or one made from its block (filled, with a dark outline).
export function partArt(p) {
  if (p.art) return p.art;
  const w = Math.max(1, Math.round(p.w));
  const h = Math.max(1, Math.round(p.h));
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '1' : '0';
    rows.push(r);
  }
  return { palette: [p.color, OUTLINE], rows };
}

export function artSize(art) {
  return { w: Math.max(1, ...art.rows.map((r) => r.length)), h: Math.max(1, art.rows.length) };
}

// The turning point inside the picture. Old data: middle, or `pivotY` (0 = top, 1 = bottom) of the middle column.
export function partAnchor(p, art = partArt(p)) {
  if (p.anchor) return [p.anchor[0], p.anchor[1]];
  const { w, h } = artSize(art);
  return [w / 2, (p.pivotY ?? 0.5) * h];
}

// Art -> grid[y][x] of colour numbers (null = empty).
export function artPixels(art) {
  const { w, h } = artSize(art);
  const pal = art.palette.map((c) => Number(c));
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = (art.rows[y] || '')[x];
      const i = ch === undefined || ch === '.' ? -1 : DIGITS.indexOf(ch);
      row.push(i >= 0 && i < pal.length ? pal[i] : null);
    }
    grid.push(row);
  }
  return grid;
}

// grid[y][x] of colour numbers (null = empty) -> art (palette = the colours used, in order of first use).
export function pixelsToArt(grid) {
  const palette = [];
  const rows = grid.map((row) =>
    row
      .map((c) => {
        if (c === null || c === undefined) return '.';
        let i = palette.indexOf(c);
        if (i < 0) {
          i = palette.length;
          palette.push(c);
        }
        return DIGITS[i] ?? '.';
      })
      .join(''),
  );
  return { palette: palette.map((c) => '0x' + c.toString(16).padStart(6, '0')), rows };
}

// Mixes colour a towards colour b by t (0..1).
export function mixColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

// A short id for a picture, so the same picture makes the same texture.
export function artKey(art) {
  const s = JSON.stringify(art);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

// ---- Studio tools on a picture (grid[y][x] of colours, null = empty) -----------------------------
// Each returns { grid, anchor } (the anchor moves with the pixels).

export function flipGridH(grid, [ax, ay]) {
  const w = grid[0].length;
  return { grid: grid.map((row) => [...row].reverse()), anchor: [w - ax, ay] };
}

export function flipGridV(grid, [ax, ay]) {
  const h = grid.length;
  return { grid: [...grid].reverse().map((row) => [...row]), anchor: [ax, h - ay] };
}

// Turns a quarter turn clockwise.
export function rotateGrid90(grid, [ax, ay]) {
  const h = grid.length;
  const w = grid[0].length;
  const out = [];
  for (let y = 0; y < w; y++) {
    const row = [];
    for (let x = 0; x < h; x++) row.push(grid[h - 1 - x][y]);
    out.push(row);
  }
  return { grid: out, anchor: [h - ay, ax] };
}

// Adds a 1-pixel outline in `color` around every drawn pixel (the picture grows by 1 on each side).
export function outlineGrid(grid, [ax, ay], color) {
  const h = grid.length;
  const w = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y][x] : null);
  const out = [];
  for (let y = -1; y <= h; y++) {
    const row = [];
    for (let x = -1; x <= w; x++) {
      const c = at(x, y);
      if (c !== null) row.push(c);
      else {
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) !== null) near = true;
        row.push(near ? color : null);
      }
    }
    out.push(row);
  }
  return { grid: out, anchor: [ax + 1, ay + 1] };
}

export function replaceColorGrid(grid, from, to) {
  return grid.map((row) => row.map((c) => (c === from ? to : c)));
}
