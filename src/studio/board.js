// The Character Studio's drawing board: the whole character on a pixel grid (one square = one
// character pixel), where the selected part is drawn with pencil, eraser, line, rectangle, fill,
// colour picker, anchor and move tools. Plain canvas, no Phaser. Part data shape: see pixelArt.js.
import { partArt, artSize, partAnchor, artPixels, pixelsToArt } from '../systems/pixelArt.js';

export const VIEW = { minX: -20, minY: -38, cols: 40, rows: 44, cell: 12 };

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// A part's picture on the character grid: pixels plus the top-left corner and the anchor.
export function partBox(p) {
  const art = partArt(p);
  const { w, h } = artSize(art);
  return { grid: artPixels(art), left: p.x - w / 2, top: p.y - h / 2, w, h, anchor: partAnchor(p, art) };
}

// Turns an old block part into a pixel picture (same look), lined up on whole pixels.
export function ensureArt(p) {
  if (p.art) return;
  const art = partArt(p);
  const { w, h } = artSize(art);
  const anchor = partAnchor(p, art);
  const left = Math.round(p.x - w / 2);
  const top = Math.round(p.y - h / 2);
  p.art = art;
  p.anchor = anchor;
  p.w = w;
  p.h = h;
  p.x = left + w / 2;
  p.y = top + h / 2;
  delete p.color;
  delete p.pivotY;
}

// Changes a part's pixels. fn(set) calls set(cx, cy, colour | null) with character pixels; the picture
// grows to fit anything drawn outside it and shrinks when its edges are erased.
export function editPart(p, fn) {
  ensureArt(p);
  const e = { grid: artPixels(p.art), left: p.x - p.w / 2, top: p.y - p.h / 2, anchor: [...partAnchor(p)] };
  const set = (cx, cy, c) => {
    let gx = cx - e.left;
    let gy = cy - e.top;
    const h = e.grid.length;
    const w = e.grid[0].length;
    if (c === null && (gx < 0 || gy < 0 || gx >= w || gy >= h)) return;
    if (gx < 0) {
      for (const row of e.grid) row.unshift(...Array(-gx).fill(null));
      e.left += gx;
      e.anchor[0] -= gx;
      gx = 0;
    }
    if (gy < 0) {
      for (let i = 0; i < -gy; i++) e.grid.unshift(Array(e.grid[0].length).fill(null));
      e.top += gy;
      e.anchor[1] -= gy;
      gy = 0;
    }
    if (gx >= e.grid[0].length) for (const row of e.grid) row.push(...Array(gx - row.length + 1).fill(null));
    while (gy >= e.grid.length) e.grid.push(Array(e.grid[0].length).fill(null));
    e.grid[gy][gx] = c;
  };
  const get = (cx, cy) => {
    const row = e.grid[cy - e.top];
    return row ? row[cx - e.left] ?? null : null;
  };
  fn(set, get, e);
  trim(e);
  p.art = pixelsToArt(e.grid);
  p.w = e.grid[0].length;
  p.h = e.grid.length;
  p.x = e.left + p.w / 2;
  p.y = e.top + p.h / 2;
  p.anchor = e.anchor;
}

// Cuts empty rows/columns off the edges (keeps at least one pixel).
function trim(e) {
  const empty = (cells) => cells.every((c) => c === null);
  while (e.grid.length > 1 && empty(e.grid[0])) {
    e.grid.shift();
    e.top += 1;
    e.anchor[1] -= 1;
  }
  while (e.grid.length > 1 && empty(e.grid[e.grid.length - 1])) e.grid.pop();
  while (e.grid[0].length > 1 && empty(e.grid.map((r) => r[0]))) {
    for (const r of e.grid) r.shift();
    e.left += 1;
    e.anchor[0] -= 1;
  }
  while (e.grid[0].length > 1 && empty(e.grid.map((r) => r[r.length - 1]))) for (const r of e.grid) r.pop();
}

// Mirror drawing: the middle line of the character (x = 0, between pixel columns -1 and 0).
export const mirrorCell = ([x, y]) => [-1 - x, y];

// Every cell on a straight line between two cells.
export function lineCells(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

function rectCells(x0, y0, x1, y1, filled) {
  const out = [];
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) if (filled || x === ax || x === bx || y === ay || y === by) out.push([x, y]);
  return out;
}

export default class Board {
  // hooks: look(), selected(), select(name), color() (number), pickColor(number), tool(), setTool(name),
  // filled(), dim(), begin() (before an edit: for undo), end() (edit finished), changed(),
  // cancel() (throw away the edit in progress), holdPick(number) (touch and hold picked a colour),
  // mirror() (true = mirror drawing is on: everything drawn is copied to the other side)
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.h = hooks;
    this.drag = null;
    this.hover = null;
    canvas.addEventListener('pointerdown', (ev) => this.down(ev));
    canvas.addEventListener('pointermove', (ev) => this.move(ev));
    canvas.addEventListener('pointerup', (ev) => this.up(ev));
    canvas.addEventListener('pointercancel', (ev) => this.up(ev));
    canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.render();
    });
  }

  cellAt(ev) {
    const r = this.canvas.getBoundingClientRect();
    const mx = ((ev.clientX - r.left) / r.width) * this.canvas.width;
    const my = ((ev.clientY - r.top) / r.height) * this.canvas.height;
    return [Math.floor(mx / VIEW.cell) + VIEW.minX, Math.floor(my / VIEW.cell) + VIEW.minY];
  }

  part() {
    const name = this.h.selected();
    return name ? this.h.look().parts[name] : null;
  }

  // The colour of the front-most pixel at a cell (any part), and which part it belongs to.
  pixelAt(cx, cy) {
    const entries = Object.entries(this.h.look().parts).reverse();
    for (const [name, p] of entries) {
      const b = partBox(p);
      const gx = Math.floor(cx + 0.5 - b.left);
      const gy = Math.floor(cy + 0.5 - b.top);
      const c = b.grid[gy] && b.grid[gy][gx];
      if (c !== null && c !== undefined) return { name, color: c };
    }
    return null;
  }

  down(ev) {
    if (!ev.isPrimary) return; // a second finger is a gesture (two-finger tap = undo), not drawing
    const cell = this.cellAt(ev);
    const tool = this.h.tool();
    this.canvas.setPointerCapture(ev.pointerId);
    if (tool === 'picker') {
      const hit = this.pixelAt(...cell);
      if (hit) this.h.pickColor(hit.color);
      return;
    }
    // Move (or no part picked yet): tapping a part picks it.
    if (tool === 'move' || !this.part()) {
      const hit = this.pixelAt(...cell);
      if (hit) this.h.select(hit.name);
      if (tool !== 'move' || !this.part()) return;
    }
    const p = this.part();
    if (!p) return;
    this.h.begin();
    this.drag = { tool, start: cell, last: cell, x: p.x, y: p.y };
    // A finger (not the Apple Pencil) held still on one pixel picks its colour, like Procreate.
    if (ev.pointerType === 'touch' && ['pencil', 'eraser', 'line', 'rect'].includes(tool)) {
      this.hold = setTimeout(() => {
        const d = this.drag;
        if (!d || d.last[0] !== cell[0] || d.last[1] !== cell[1]) return;
        this.cancel();
        this.h.cancel();
        const hit = this.pixelAt(...cell);
        if (hit) this.h.holdPick(hit.color);
      }, 450);
    }
    if (tool === 'pencil' || tool === 'eraser') this.paint([cell]);
    else if (tool === 'fill') {
      this.fill(cell);
      this.finish();
    } else if (tool === 'anchor') this.setAnchor(cell);
    this.render();
  }

  move(ev) {
    if (!ev.isPrimary) return;
    const cell = this.cellAt(ev);
    this.hover = cell;
    const d = this.drag;
    if (d) {
      if (d.tool === 'pencil' || d.tool === 'eraser') {
        this.paint(lineCells(d.last[0], d.last[1], cell[0], cell[1]));
      } else if (d.tool === 'anchor') {
        this.setAnchor(cell);
      } else if (d.tool === 'move') {
        const p = this.part();
        p.x = d.x + (cell[0] - d.start[0]);
        p.y = d.y + (cell[1] - d.start[1]);
        this.h.changed();
      }
      if (cell[0] !== d.last[0] || cell[1] !== d.last[1]) clearTimeout(this.hold);
      d.last = cell;
    }
    this.render();
  }

  // Stops the stroke in progress without finishing it (the caller throws its changes away).
  cancel() {
    clearTimeout(this.hold);
    this.drag = null;
    this.render();
  }

  up(ev) {
    if (ev && !ev.isPrimary) return;
    clearTimeout(this.hold);
    const d = this.drag;
    if (!d) return;
    if (d.tool === 'line') this.paint(lineCells(d.start[0], d.start[1], d.last[0], d.last[1]));
    if (d.tool === 'rect') this.paint(rectCells(d.start[0], d.start[1], d.last[0], d.last[1], this.h.filled()));
    this.finish();
  }

  finish() {
    this.drag = null;
    this.h.end();
    this.render();
  }

  // With mirror drawing on, the same cells on the other side of the middle line are drawn too.
  withMirror(cells) {
    return this.h.mirror() ? [...cells, ...cells.map(mirrorCell)] : cells;
  }

  paint(cells) {
    cells = this.withMirror(cells);
    const p = this.part();
    const c = this.drag.tool === 'eraser' ? null : this.h.color();
    editPart(p, (set) => {
      for (const [x, y] of cells) set(x, y, c);
    });
    this.h.changed();
  }

  // Fills the area of the same colour around the cell (inside the part; empty pixels count too).
  fill(cell) {
    const p = this.part();
    const c = this.h.color();
    for (const at of this.withMirror([cell])) this.fillAt(p, at, c);
    this.h.changed();
  }

  fillAt(p, cell, c) {
    editPart(p, (set, get, e) => {
      const inside = (x, y) => x >= e.left && y >= e.top && x < e.left + e.grid[0].length && y < e.top + e.grid.length;
      if (!inside(...cell)) return set(cell[0], cell[1], c);
      const from = get(...cell);
      if (from === c) return;
      const todo = [cell];
      const seen = new Set();
      while (todo.length) {
        const [x, y] = todo.pop();
        const k = x + ',' + y;
        if (seen.has(k) || !inside(x, y) || get(x, y) !== from) continue;
        seen.add(k);
        set(x, y, c);
        todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    });
  }

  // The turning point goes to the middle of the tapped pixel.
  setAnchor([cx, cy]) {
    const p = this.part();
    ensureArt(p);
    p.anchor = [cx + 0.5 - (p.x - p.w / 2), cy + 0.5 - (p.y - p.h / 2)];
    this.h.changed();
  }

  render() {
    const { ctx } = this;
    const { cell, minX, minY, cols, rows } = VIEW;
    const W = cols * cell;
    const H = rows * cell;
    const X = (cx) => (cx - minX) * cell;
    const Y = (cy) => (cy - minY) * cell;
    ctx.fillStyle = '#0e0b17';
    ctx.fillRect(0, 0, W, H);
    // Grid: faint lines, a stronger line every 8 pixels.
    for (let i = 0; i <= cols; i++) {
      ctx.fillStyle = (i + minX) % 8 === 0 ? '#2c2444' : '#1b1629';
      ctx.fillRect(i * cell, 0, 1, H);
    }
    for (let j = 0; j <= rows; j++) {
      ctx.fillStyle = (j + minY) % 8 === 0 ? '#2c2444' : '#1b1629';
      ctx.fillRect(0, j * cell, W, 1);
    }
    const look = this.h.look();
    // Feet line and health bar line.
    ctx.fillStyle = '#f2b33d';
    ctx.fillRect(0, Y(0), W, 2);
    ctx.fillStyle = '#d65b5b';
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, Y(-look.height), 6, 2);

    const sel = this.h.selected();
    for (const [name, p] of Object.entries(look.parts)) {
      const b = partBox(p);
      ctx.globalAlpha = sel && name !== sel && this.h.dim() ? 0.3 : 1;
      b.grid.forEach((row, j) =>
        row.forEach((c, i) => {
          if (c === null) return;
          ctx.fillStyle = hex(c);
          ctx.fillRect(X(b.left + i), Y(b.top + j), cell, cell);
        }),
      );
    }
    ctx.globalAlpha = 1;

    // Line / rectangle being dragged: shown before it is drawn.
    const d = this.drag;
    if (d && (d.tool === 'line' || d.tool === 'rect')) {
      const cells = this.withMirror(d.tool === 'line' ? lineCells(...d.start, ...d.last) : rectCells(...d.start, ...d.last, this.h.filled()));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = hex(this.h.color());
      for (const [x, y] of cells) ctx.fillRect(X(x), Y(y), cell, cell);
      ctx.globalAlpha = 1;
    }

    // Mirror drawing: the middle line everything is copied across.
    if (this.h.mirror()) {
      ctx.fillStyle = '#4fd8e8';
      for (let y = 0; y < H; y += 10) ctx.fillRect(X(0) - 1, y, 2, 6);
    }

    // The selected part: dashed box and its anchor.
    const p = sel && look.parts[sel];
    if (p) {
      const b = partBox(p);
      ctx.strokeStyle = '#f2b33d';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(X(b.left) - 1.5, Y(b.top) - 1.5, b.w * cell + 3, b.h * cell + 3);
      ctx.setLineDash([]);
      const ax = X(b.left + b.anchor[0]);
      const ay = Y(b.top + b.anchor[1]);
      ctx.strokeStyle = '#4fd8e8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, cell * 0.45, 0, Math.PI * 2);
      ctx.moveTo(ax - cell, ay);
      ctx.lineTo(ax + cell, ay);
      ctx.moveTo(ax, ay - cell);
      ctx.lineTo(ax, ay + cell);
      ctx.stroke();
    }

    // The square under the finger/mouse.
    if (this.hover) {
      ctx.strokeStyle = '#ece6f7';
      ctx.lineWidth = 1;
      ctx.strokeRect(X(this.hover[0]) + 0.5, Y(this.hover[1]) + 0.5, cell - 1, cell - 1);
    }
  }
}
