// Tiny pixel-effects engine for the proposal page. Logical stage W x H pixels, drawn at Z x.
const W = 120, H = 64, Z = 3;
const OUTL = '#1a1020';
const rnd = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = { out: (p) => 1 - (1 - p) * (1 - p), in: (p) => p * p, inOut: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2), back: (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); } };
// Phase helper: 0..1 progress of t inside [a, b] (ms).
const ph = (t, a, b) => clamp((t - a) / (b - a));
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

// 3x5 font
const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', A: '010101111101101', B: '110101110101110',
  C: '011100100100011', D: '110101101101110', E: '111100110100111', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', W: '101101111111101',
  Y: '101101010010010', X: '101101010101101', H: '101101111101101', G: '011100101101011', F: '111100110100100', V: '101101101101010',
};

// Sprites: grid -> list of pixels with an outline. `isCore(letter)` marks the BODY pixels (not the
// weapon): the sprite is placed so its body centre sits on the unit's x, and effects aim at the body.
function prepSprite(pal, rows, flip = false, isCore = () => true) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const ch = (x, y) => { const r = rows[y]; if (!r || x < 0) return null; const c = r[x]; return c && c !== '.' && pal[c] ? c : null; };
  const px = [];
  let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const c = ch(x, y);
    const fx = flip ? w - 1 - x : x;
    if (c) { const core = isCore(c); px.push([fx, y, pal[c], false, core]); if (core) { x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    else if (ch(x - 1, y) || ch(x + 1, y) || ch(x, y - 1) || ch(x, y + 1)) px.push([fx, y, OUTL, true, false]);
  }
  return { w, h, px, cx: (x0 + x1 + 1) / 2, cTop: y0, cBot: y1 + 1, hw: (x1 - x0 + 1) / 2 };
}
// Where a unit's body is on the stage: x = body centre, y = feet. mid = body middle, top = top of
// the body (above the head = top - 2), hw = half the body width (front = x -/+ hw).
function U(sp, x, y, o = {}) {
  const X = x + (o.dx || 0), Y = y + (o.dy || 0);
  return { sp, x: X, y: Y, top: Y - sp.h + sp.cTop, mid: Y - sp.h + (sp.cTop + sp.cBot) / 2, hw: sp.hw, bot: Y - sp.h + sp.cBot };
}

function makeG(ctx) {
  const g = {};
  g.clear = () => {
    ctx.fillStyle = '#1b1629'; ctx.fillRect(0, 0, W * Z, H * Z);
    ctx.fillStyle = '#221b33'; ctx.fillRect(0, 36 * Z, W * Z, (H - 36) * Z);
    ctx.fillStyle = '#2e2542'; for (let x = 0; x < W; x += 20) ctx.fillRect(x * Z, 36 * Z, Z, (H - 36) * Z);
    ctx.fillRect(0, 36 * Z, W * Z, Z);
  };
  g.px = (x, y, c, a = 1) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = c; ctx.fillRect(x * Z, y * Z, Z, Z); ctx.globalAlpha = 1; };
  g.rect = (x, y, w, h, c, a = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) g.px(x + i, y + j, c, a); };
  g.disc = (cx, cy, r, c, a = 1, ry = r) => { for (let y = -Math.ceil(ry); y <= ry; y++) for (let x = -Math.ceil(r); x <= r; x++) if ((x * x) / (r * r + 0.6) + (y * y) / (ry * ry + 0.6) <= 1) g.px(cx + x, cy + y, c, a); };
  g.ring = (cx, cy, r, c, a = 1, ry = r) => { if (r < 0.5) return g.px(cx, cy, c, a); const n = Math.max(8, Math.round(r * 7)); const seen = {}; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * ry); if (!seen[x + ',' + y]) { seen[x + ',' + y] = 1; g.px(x, y, c, a); } } };
  g.line = (x0, y0, x1, y1, c, a = 1) => { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (let i = 0; i < 300; i++) { g.px(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
  g.bolt = (x0, y0, x1, y1, c, seed, segs = 6, jag = 4, core = '#ffffff') => { let px = x0, py = y0; for (let i = 1; i <= segs; i++) { const p = i / segs; const nx = x0 + (x1 - x0) * p + (i < segs ? (rnd(seed + i) - 0.5) * jag * 2 : 0); const ny = y0 + (y1 - y0) * p + (i < segs ? (rnd(seed + i * 7) - 0.5) * jag * 2 : 0); g.line(px, py + 1, nx, ny + 1, c); g.line(px, py, nx, ny, core); px = nx; py = ny; } };
  g.text = (str, cx, y, c, s = 1, a = 1, outline = true) => { const w = str.length * 4 * s - s; let x = Math.round(cx - w / 2); if (outline) for (const ch of str) { const f = FONT[ch]; if (f) { for (let i = 0; i < 15; i++) if (f[i] === '1') { const fx = x + (i % 3) * s, fy = y + Math.floor(i / 3) * s; for (let a1 = -1; a1 <= s; a1++) for (let b1 = -1; b1 <= s; b1++) g.px(fx + a1, fy + b1, OUTL, a); } } x += 4 * s; } x = Math.round(cx - w / 2); for (const ch of str) { const f = FONT[ch]; if (f) for (let i = 0; i < 15; i++) if (f[i] === '1') g.rect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s, c, a); x += 4 * s; } };
  // A number that pops up and floats away (p = 0..1 of its life).
  g.pop = (str, cx, cy, c, p, s = 1) => { if (p <= 0 || p >= 1) return; const k = p < 0.15 ? ease.back(p / 0.15) : 1; g.text(str, cx, cy - 4 - p * 10, c, Math.max(1, Math.round(s * k)), p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1); };
  // Draws a sprite with its body centre on x and its feet on y. o: dx, dy, flash (0..1), tint [colour, amount],
  // alpha, squash (0..1 = flattened into the floor), recolor(c, px, py, isOutline) -> colour or null (hide).
  g.sprite = (sp, x, y, o = {}) => {
    const left = Math.round(x + (o.dx || 0) - sp.cx), top = Math.round(y + (o.dy || 0) - sp.h);
    const sq = o.squash || 0;
    for (const [px, py, c, out] of sp.px) {
      let col = c;
      if (!out && o.tint) col = mix(c, o.tint[0], o.tint[1]);
      if (!out && o.flash) col = mix(col, '#ffffff', o.flash);
      if (o.recolor) { col = o.recolor(col, px, py, out); if (!col) continue; }
      const yy = sq ? sp.h - (sp.h - py) * (1 - sq) : py;
      g.px(left + px, top + yy, col, o.alpha ?? 1);
    }
  };
  g.shadow = (x, y, w) => { for (let i = -Math.round(w / 2); i <= Math.round(w / 2); i++) g.px(x + i, y, '#000000', 0.3); };
  // A burst of particles from (x,y): n bits flying outwards, p = 0..1.
  g.burst = (x, y, n, cols, p, dist = 12, seed = 1, grav = 0) => { if (p <= 0 || p >= 1) return; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.6; const d = dist * ease.out(p) * (0.5 + rnd(seed + i * 3) * 0.6); g.px(x + Math.cos(a) * d, y + Math.sin(a) * d + grav * p * p * 10, cols[i % cols.length], 1 - p); } };
  g.rays = (x, y, n, len, c, p, rot = 0) => { if (p <= 0 || p >= 1) return; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot; const r0 = len * ease.out(p) * 0.4, r1 = len * ease.out(p); g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, c, 1 - p); } };
  g.slash = (x, y, r, c, p, dir = 1) => { if (p <= 0 || p >= 1) return; const a0 = -2.2, a1 = 0.6; const end = a0 + (a1 - a0) * ease.out(Math.min(1, p * 1.6)); for (let a = a0; a <= end; a += 0.08) { const fade = 1 - p; g.px(x + Math.cos(a) * r * dir, y + Math.sin(a) * r, c, fade); g.px(x + Math.cos(a) * (r - 1) * dir, y + Math.sin(a) * (r - 1), '#ffffff', fade * 0.8); } };
  // A projectile from a to b at progress p with an optional arc height; returns [x,y].
  g.fly = (ax, ay, bx, by, p, arc = 0) => [ax + (bx - ax) * p, ay + (by - ay) * p - Math.sin(p * Math.PI) * arc];
  return g;
}
