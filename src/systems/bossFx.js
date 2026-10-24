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
