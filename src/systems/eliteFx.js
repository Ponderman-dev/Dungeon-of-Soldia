// How an ELITE enemy looks on top of its sprite (no Phaser): a glow in its element colour and a small gold crown.
// Same format as statusFx.js: pixels [x, y, w, h, colour, alpha] in CHARACTER pixels around the feet
// (x = 0 the body's middle, y = 0 the feet, up is negative). The scene paints them with paintFx().
import { pen, rnd } from './statusFx.js';

// Mixes a colour towards white (0..1).
const lighten = (c, k) => {
  const ch = (s) => Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// The glow: a pulsing double ring on the floor, motes of its colour rising along the body, and a faint ring that
// swells out every 1.4s. `box` = bodyBox() of the sprite, `color` = 0xRRGGBB, `t` = ms.
export function eliteGlow(box, color, t) {
  const g = pen();
  const light = lighten(color, 0.55);
  const pulse = 0.5 + 0.5 * Math.sin(t / 260);
  const rx = box.hw + 3;
  g.ring(0, 0, rx, color, 0.35 + 0.3 * pulse, 2);
  g.ring(0, 0, rx + 2, color, 0.15 + 0.15 * pulse, 3);
  const swell = (t % 1400) / 1400;
  g.ring(0, 0, rx + 2 + swell * 8, light, 0.35 * (1 - swell), 3 + swell * 3);
  const H = box.bot - box.top;
  for (let i = 0; i < 9; i++) {
    const life = 1100 + rnd(i * 7.1) * 500;
    const p = ((t + rnd(i * 3.3) * life) % life) / life; // 0..1 up the body
    const side = i % 2 ? 1 : -1;
    const x = side * (box.hw * (0.5 + rnd(i * 5.7) * 0.6)) + Math.sin(t / 200 + i) * 0.8;
    const y = box.bot - p * (H + 6);
    g.px(x, y, p < 0.3 ? light : color, 1 - p * 0.8);
    if (i % 3 === 0) g.px(x, y + 1, color, 0.6 * (1 - p)); // a short tail on some
  }
  return g.out;
}

// The crown: 5 x 4 pixels with a dark outline (7 x 6 drawn), its bottom-left corner at (x, y) in its own pixels.
const CROWN = ['g.g.g', 'ggggg', 'gjgjg', 'ggggg'];
export function crownPixels() {
  const out = [];
  const cols = { g: 0xf2c544, j: 0xd9452b };
  const on = (c, r) => CROWN[r] && CROWN[r][c] && CROWN[r][c] !== '.';
  for (let r = -1; r <= CROWN.length; r++) for (let c = -1; c <= CROWN[0].length; c++) {
    if (on(c, r)) out.push([c, r, cols[CROWN[r][c]] || cols.g]);
    else if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dc, dr]) => on(c + dc, r + dr))) out.push([c, r, 0x1a1020]);
  }
  // A highlight on the left of the band.
  out.push([0, 1, 0xfff7c0]);
  return out; // [col, row, colour]: rows 0..3, outline at -1 and 4
}
