// Boss move effects (no Phaser). Same pixel pen as hitFx.js: everything in CHARACTER pixels (screen / CHAR_SCALE),
// the scene multiplies. Frost Warden (session 30): Hailstorm, Ice Spikes.
import { pen, rnd, FX_COLORS as C } from './statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Hailstorm: an icy wind sweeps the fight from left to right. q = 0..1, area = { x0, x1, y0, y1 } (char px).
// The FRONT crosses the area as q goes 0 -> SWEEP_END; behind it trail wind streaks, hail and snow, which fade out.
export const HAIL_SWEEP_END = 0.8;
export function hailstormFx(q, area) {
  const g = pen();
  const W = area.x1 - area.x0, H = area.y1 - area.y0;
  const front = area.x0 - 10 + (W + 50) * (q / HAIL_SWEEP_END); // where the wind's leading edge is now
  const fade = 1 - clamp((q - HAIL_SWEEP_END) / (1 - HAIL_SWEEP_END)); // all of it fades after the front has gone
  // Wind streaks: white and pale ice lines, each its own row, length and lag behind the front.
  for (let i = 0; i < 105; i++) {
    const y = area.y0 + rnd(i * 7 + 1) * H;
    const lag = rnd(i * 7 + 2) * 46, len = 6 + rnd(i * 7 + 3) * 14;
    const head = front - lag;
    if (head < area.x0 - 2) continue;
    const a = (1 - lag / 52) * fade;
    const col = rnd(i * 7 + 4) < 0.45 ? C.white : C.ice2;
    g.line(Math.max(area.x0, head - len), y, Math.min(area.x1, head), y, col, a * 0.85);
    if (i % 3 === 0) g.line(Math.max(area.x0, head - len * 0.6), y + 1, Math.min(area.x1, head - 2), y + 1, C.ice, a * 0.5); // some gusts are 2 rows thick
    if (head < area.x1) g.px(head, y, C.white, a); // a bright tip
  }
  // Hail: small ice pellets driven along with the wind, slanting down a little.
  for (let i = 0; i < 140; i++) {
    const lag = rnd(i * 11 + 5) * 50;
    const x = front - lag;
    if (x < area.x0 || x > area.x1) continue;
    const y = area.y0 + rnd(i * 11 + 6) * H + (x - area.x0) * 0.12;
    const a = (1 - lag / 56) * fade;
    g.px(x, y, C.white, a);
    g.px(x - 1, y, C.ice, a * 0.8);
    g.px(x - 2, y - 0.3, C.ice2, a * 0.4);
  }
  // Snow left behind the front: flakes that drift down and fade.
  for (let i = 0; i < 88; i++) {
    const sx = area.x0 + rnd(i * 13 + 8) * W;
    if (sx > front - 8) continue;
    const since = clamp((front - 8 - sx) / 60);
    const y = area.y0 + rnd(i * 13 + 9) * H + since * 10;
    g.px(sx + Math.sin(since * 6 + i) * 2, y, rnd(i) < 0.5 ? C.white : C.ice2, (1 - since) * fade * 0.8);
  }
  return g.out;
}

// Ice Spikes: where a spike will burst up, a frost circle grows on the floor (radius r = the hit radius) and blinks
// faster as it gets close; frost cracks reach in. The icicle itself is itemFx.iceSpikeFx (the Frozen Demon Head's).
export const FREE_SPIKE_MS = 650; // how long a spike that caught nobody stands before it shatters
export function spikeWarnFx(q, x, y, r, t) {
  const g = pen();
  const grow = 0.35 + 0.65 * Math.min(1, q * 1.6);
  const blink = 0.55 + 0.45 * Math.sin(t / (q > 0.7 ? 45 : 110)); // faster just before it lands
  const ry = r * 0.45; // flat on the floor
  for (let k = 1; k < r * grow - 1; k += 2) g.ring(x, y, k, C.ice, 0.16 * blink, k * 0.45); // a pale frost patch
  g.ring(x, y, r * grow, C.white, 0.95 * blink, ry * grow);
  g.ring(x, y, r * grow - 1, C.ice, 0.8 * blink, ry * grow - 0.5);
  // frost cracks from the edge towards the middle
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd(i + Math.round(x)) * 0.5;
    const r0 = r * grow, r1 = r * grow * (1 - 0.55 * Math.min(1, q * 1.3));
    g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.45, x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.45, C.ice2, 0.6 * blink);
  }
  if (q > 0.75) g.disc(x, y, 1 + (q - 0.75) * 8, C.white, (q - 0.75) * 3); // the middle lights up as it comes
  return g.out;
}

// Frozen Rest: while the Frost Warden heals inside his ice, pale frost motes and small plus signs rise off him and a
// soft frost ring pulses at his feet. b = his body in char px ({ x, y (feet), top, hw }), t = clock (ms).
export function frostHealFx(b, t) {
  const g = pen();
  const tall = b.y - b.top + 12, GLOW = 0x7ff0ff;
  for (let i = 0; i < 18; i++) {
    const p = (t / 1500 + rnd(i * 5 + 1)) % 1;
    const x = b.x + (rnd(i * 5 + 2) - 0.5) * 3 * b.hw + Math.sin(p * 6 + i) * 1.5;
    const y = b.y - 2 - p * tall;
    const a = Math.sin(p * Math.PI);
    if (i % 3 === 0) { // a plus sign
      g.rect(x - 2, y, 5, 1, GLOW, a); g.rect(x, y - 2, 1, 5, GLOW, a); g.px(x, y, C.white, a);
    } else { g.rect(x, y, 2, 2, GLOW, a * 0.9); g.px(x, y, C.white, a); }
  }
  const pulse = 0.5 + 0.5 * Math.sin(t / 260);
  g.ring(b.x, b.y, b.hw + 3 + pulse * 2, GLOW, 0.4 + 0.35 * pulse, (b.hw + 3 + pulse * 2) * 0.35);
  return g.out;
}

// Ice Slam: he crashes down; a jagged frost crack runs along the floor from his feet to the hero, ice shards burst up
// round the hero in a fan, hold, then shatter and fall. from / to = feet in char px ({ x, y }), q = 0..1.
export const ICE_SLAM_MS = 750;
const ICE_DEEP = 0x3a78b0;
function shard(g, x, y, h, lean, a) { // one ice shard standing on the floor (bottom at y), h tall, leaning
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, Math.round((1 - i / h) * 4));
    const cx = x + lean * i;
    for (let k = -w; k <= w; k++) g.px(cx + k, y - i, k === -w || i === h - 1 ? C.white : k === w ? ICE_DEEP : C.ice, a);
  }
}
export function iceSlamFx(q, from, to) {
  const g = pen();
  const crack = Math.min(1, q / 0.25), fade = 1 - clamp((q - 0.6) / 0.4);
  // the crack along the floor
  const dx = to.x - from.x, dy = to.y - from.y, n = Math.max(4, Math.round(Math.hypot(dx, dy) / 4));
  let px = from.x, py = from.y;
  for (let i = 1; i <= n * crack; i++) {
    const p = i / n, j = i < n ? (rnd(i * 3 + 7) - 0.5) * 4 : 0;
    const nx = from.x + dx * p + j, ny = from.y + dy * p + j * 0.4;
    g.line(px, py - 1, nx, ny - 1, C.white, 0.8 * fade); g.line(px, py, nx, ny, C.ice2, 0.95 * fade); g.line(px, py + 1, nx, ny + 1, ICE_DEEP, 0.8 * fade);
    if (i % 3 === 0) g.line(nx, ny, nx + (rnd(i) - 0.5) * 8, ny + (rnd(i + 9) - 0.5) * 3, C.ice2, 0.6 * fade); // little side cracks
    px = nx; py = ny;
  }
  // the shards burst up round the hero, then shatter
  const up = clamp((q - 0.18) / 0.14), broke = clamp((q - 0.62) / 0.38);
  if (up > 0 && broke <= 0) {
    for (let i = 0; i < 7; i++) {
      const off = (i - 3) * 4, h = Math.round((15 + rnd(i * 5) * 12) * (1 - Math.abs(i - 3) * 0.14) * up);
      shard(g, to.x + off, to.y + 1 + Math.abs(i - 3) * 0.6, h, (i - 3) * 0.12, 1);
    }
  }
  if (broke > 0) { // shards fly out and fall
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * (0.1 + 0.8 * rnd(i * 7 + 2)), d = (8 + rnd(i * 7 + 3) * 20) * broke;
      g.px(to.x + Math.cos(a) * d, to.y - 8 + Math.sin(a) * d + broke * broke * 14, [C.white, C.ice, C.ice2, ICE_DEEP][i % 4], 1 - broke);
    }
  }
  // frost puff at the hero's feet as it lands
  if (q < 0.45) for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, d = 4 + q * 26; g.px(to.x + Math.cos(a) * d, to.y + Math.sin(a) * d * 0.35, C.white, 1 - q / 0.45); }
  return g.out;
}

// ARMOR PLATES (Frost Warden): ice armor pieces on his body, one per plate left (left and right shoulder pieces, then
// the breastplate), with a glint that runs over them now and then. b = body in char px, left = plates left, t = clock.
export function plateSpots(b) {
  const h = b.y - b.top;
  return [{ x: b.x - b.hw * 0.78, y: b.top + h * 0.32 }, { x: b.x + b.hw * 0.78, y: b.top + h * 0.32 }, { x: b.x, y: b.top + h * 0.52 }];
}
const PAULDRON = [ // an ice shoulder piece with icicles dripping off its edge
  '....xxxxxxx....',
  '..xxxxxxxxxxx..',
  '.xxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxx',
  'x.xx.xxx.xx.x.x',
  'x..x..x...x...x',
  '...x......x....',
];
const BREASTPLATE = [ // an ice breastplate
  'xxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxx',
  '.xxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxx.',
  '..xxxxxxxxxxx..',
  '..xxxxxxxxxxx..',
  '...xxxxxxxxx...',
  '....xxxxxxx....',
];
function plateArt(g, mask, x, y, t, crack) {
  const H = mask.length, W = mask[0].length, x0 = Math.round(x - W / 2), y0 = Math.round(y - H / 2);
  const on = (c, r) => r >= 0 && r < H && mask[r][c] === 'x';
  const glint = (t % 2000) / 2000 * (W + H + 6) - 3;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!on(c, r)) continue;
    let col = C.ice, a = 0.88;
    if (!on(c, r - 1) || !on(c - 1, r)) { col = C.white; a = 1; } // lit top-left edges
    else if (!on(c, r + 1) || !on(c + 1, r)) { col = ICE_DEEP; a = 1; } // shaded bottom-right edges
    if (Math.abs(c + r - glint) < 0.8) { col = C.white; a = 1; } // a glint runs over it
    g.px(x0 + c, y0 + r, col, a);
  }
  if (mask === BREASTPLATE) for (let r = 1; r < H - 2; r++) g.px(x0 + (W >> 1), y0 + r, C.ice2, 0.9); // its middle ridge
  if (crack) g.line(x0 + 3, y0 + 1, x0 + 6, y0 + 4, ICE_DEEP, 0.9);
}
export function platesFx(b, left, t) {
  const g = pen();
  const spots = plateSpots(b);
  for (let k = 0; k < Math.min(left, spots.length); k++) plateArt(g, k < 2 ? PAULDRON : BREASTPLATE, spots[k].x, spots[k].y, t + k * 400, false);
  return g.out;
}

// A plate breaks: it cracks, then bursts into shards that fly out and fall. at = where the plate was, q = 0..1.
export const PLATE_BREAK_MS = 600;
export function plateBreakFx(q, at) {
  const g = pen();
  if (q < 0.15) for (const [ex, ey] of [[-3, -3], [3, 2], [-1, 4], [2, -4]]) g.line(at.x, at.y, at.x + ex, at.y + ey, C.white, 1);
  const p = clamp((q - 0.1) / 0.9);
  for (let i = 0; i < 22; i++) {
    const a = rnd(i * 5 + 1) * Math.PI * 2, d = (4 + rnd(i * 5 + 2) * 16) * Math.sqrt(p);
    const x = at.x + Math.cos(a) * d, y = at.y + Math.sin(a) * d * 0.8 + p * p * 16;
    const col = [C.white, C.ice, ICE_DEEP, C.ice2][i % 4];
    g.px(x, y, col, 1 - p); if (i % 3 === 0) g.px(x + 1, y, col, 1 - p);
  }
  return g.out;
}
