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

// ---- ELITE BODY LOOK (session 54, user picks on the elite look review page, docs/proposals/skill-fx/elites.js) ----
// Every element = 'Living': the body is tinted in its colour plus moving detail (Burning: the top edge burns and embers
// rise; Frozen: a frost cap, falling snow, a twinkling frost star; Storm: sparks crawl over it and snap off its edges;
// Cursed: darkened purple with faint glowing marks and rising wisps; Toxic: green sides / feet and dripping drops).
// Every trait = a sign ON the body (Vampiric blood-red pulsing outline, Shielded blue outline with a running shine,
// Thorny thorns, Splitting a glowing crack, Regenerating rising plus signs, Unstoppable steam, Explosive glowing cracks
// + a sparking fuse). Coordinates: the sprite's own character pixels at rest (gx right, gy down, 0 = feet middle,
// NOT mirrored: the scene mirrors with the fighter's facing).
export const ELITE_FRAME_MS = 120, ELITE_FRAMES = 8; // the body colours cycle through 8 baked frames
const ELC = { burning: 0xff7a3d, frozen: 0x7fd8ff, storm: 0xffe94d, cursed: 0xb07cff, toxic: 0x6de07a };
const F = { fire: 0xff9a2e, fire2: 0xffe066, ice: 0x9fe0ff, elec: 0xffe94d, white: 0xffffff };
const mixC = (a, b, k) => { const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };

// The whole sprite's pixels at rest, with edge flags, its outline (empty pixels touching it) and bounds. parts = def.parts,
// pixelsOf(part) = its pixel rows (pixelArt artPixels(partArt(part))).
export function eliteSprite(parts, pixelsOf) {
  const px = new Map();
  for (const [name, p] of Object.entries(parts)) {
    if (name === 'weapon') continue; // the weapon is not the body
    const g = pixelsOf(p), h = g.length, w = Math.max(...g.map((r) => r.length));
    // a part of odd size sits on a half pixel: keep its true place (fx, fy) to draw, its floor (the key) to look up
    g.forEach((row, y) => row.forEach((c, x) => { if (c !== null) { const fx = p.x - w / 2 + x, fy = p.y - h / 2 + y; px.set(Math.floor(fx) + ',' + Math.floor(fy), { c, fx, fy }); } }));
  }
  const has = (x, y) => px.has(x + ',' + y);
  const list = [...px].map(([k, v]) => { const [kx, ky] = k.split(',').map(Number); return { x: v.fx, y: v.fy, c: v.c, top: !has(kx, ky - 1), bot: !has(kx, ky + 1), side: !has(kx - 1, ky) || !has(kx + 1, ky) }; });
  const at = new Map([...px.keys()].map((k, i) => [k, list[i]]));
  const outline = [], seen = new Set();
  for (const p of list) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = Math.floor(p.x + dx) + ',' + Math.floor(p.y + dy); if (!px.has(k) && !seen.has(k)) { seen.add(k); outline.push({ x: p.x + dx, y: p.y + dy }); } }
  const ys = list.map((p) => p.y), xs = list.map((p) => p.x);
  return { list, at, outline, top: Math.min(...ys), bot: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
}

// A body pixel's colour for frame f (0..ELITE_FRAMES-1). p = its entry in eliteSprite().at (key = floored place; or
// null: e.g. the weapon).
export function eliteBodyColor(element, c, p, f) {
  const t = f * ELITE_FRAME_MS;
  if (!p) return element === 'cursed' ? mixC(c, 0x3a1860, 0.45) : mixC(c, ELC[element], 0.3);
  const r = rnd(p.x * 13 + p.y * 7 + f);
  if (element === 'cursed') { const mark = rnd(p.x * 5 + p.y * 3) < 0.06; return mark ? mixC(0xd090ff, F.white, 0.5 + 0.5 * Math.sin((t / (ELITE_FRAMES * ELITE_FRAME_MS)) * Math.PI * 2 + p.x)) : mixC(c, 0x3a1860, 0.45); }
  let col = mixC(c, ELC[element], 0.3);
  if (element === 'burning' && p.top) col = r < 0.5 ? F.fire2 : F.fire;
  if (element === 'frozen' && p.top) col = r < 0.8 ? F.white : F.ice;
  if (element === 'storm' && rnd(p.x * 31 + p.y * 17 + f * 3) < 0.04) col = r < 0.5 ? F.white : F.elec;
  if (element === 'toxic' && (p.bot || p.side)) col = mixC(col, 0x6de07a, 0.6);
  return col;
}

// The moving extras around the body: element detail + the trait's sign. Returns [gx, gy, colour, alpha].
export function eliteOverlay(element, trait, s, t) {
  const out = [], put = (x, y, c, a = 1) => { if (a > 0) out.push([x, y, c, Math.min(1, a)]); }; // true (maybe half-pixel) places, see eliteSprite
  const W = s.right - s.left;
  if (element === 'burning') for (let i = 0; i < 5; i++) { const life = 700, q = ((t + i * 140) % life) / life, x = s.left + 1 + rnd(i * 3 + Math.floor((t + i * 140) / life)) * (W - 1); put(x + Math.sin(q * 6 + i), s.top - 1 - q * 7, q < 0.4 ? F.fire2 : F.fire, 1 - q); }
  if (element === 'frozen') {
    const k = Math.floor(t / 400), p = s.list[Math.floor(rnd(k) * s.list.length)], a = 1 - (t % 400) / 400;
    put(p.x, p.y, F.white, a); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(p.x + dx, p.y + dy, F.white, a * 0.5);
    for (let i = 0; i < 3; i++) { const q = ((t + i * 500) % 1500) / 1500; put(s.left + (i + 1) * W / 4 + Math.sin(q * 5) * 1.5, s.top - 2 + q * (s.bot - s.top + 2), F.white, 0.7 * (1 - q)); }
  }
  if (element === 'storm') { const f = Math.floor(t / 90); if (f % 7 === 0 && s.outline.length) { const o = s.outline[Math.floor(rnd(f) * s.outline.length)]; put(o.x, o.y, F.elec); put(o.x + (rnd(f + 1) < 0.5 ? 1 : -1), o.y - 1, F.white); put(o.x, o.y - 2, F.elec, 0.7); } }
  if (element === 'cursed') for (let i = 0; i < 4; i++) { const q = ((t + i * 350) % 1400) / 1400; put(s.left + 1 + i * (W - 1) / 3 + Math.sin(q * 6 + i) * 1.5, s.top + 2 - q * 8, i % 2 ? 0xb07cff : 0x5a2d8a, 0.8 * (1 - q)); }
  if (element === 'toxic') for (let i = 0; i < 3; i++) { const q = ((t + i * 470) % 1400) / 1400, bx = s.left + 2 + rnd(i * 7 + Math.floor((t + i * 470) / 1400)) * (W - 3); put(bx, s.bot - 4 + q * 6, 0x6de07a, 1 - q * 0.6); if (q > 0.85) { put(bx - 1, s.bot + 1, 0x6de07a, 0.6); put(bx + 1, s.bot + 1, 0x6de07a, 0.6); } }
  const mid = (s.left + s.right) / 2, midY = (s.top + s.bot) / 2;
  if (trait === 'vampiric') { const a = 0.55 + 0.35 * Math.sin(t / 320); for (const o of s.outline) put(o.x, o.y, 0x9a1020, a); }
  if (trait === 'shielded' && s.outline.length) { for (const o of s.outline) put(o.x, o.y, 0x8fe0ff, 0.75); const k = Math.floor(t / 90) % s.outline.length; for (let i = 0; i < 3; i++) { const o = s.outline[(k + i) % s.outline.length]; put(o.x, o.y, F.white, 1 - i * 0.3); } }
  if (trait === 'thorny') s.outline.forEach((o, i) => { if (i % 5) return; put(o.x, o.y, 0xc8b89a); put(o.x + Math.sign(o.x - mid), o.y + (o.y < midY ? -1 : 0), 0x8a7a5a); });
  if (trait === 'splitting') { const mx = Math.floor(mid), a = 0.6 + 0.4 * Math.sin(t / 250); for (const p of s.list) if (Math.floor(p.x) === mx + (Math.floor(p.y / 2) % 2 ? 0 : 1) && p.y > s.top + 1 && p.y < s.bot - 1) put(p.x, p.y, 0xfff0c0, a); }
  if (trait === 'regenerating') for (let i = 0; i < 3; i++) { const q = ((t + i * 400) % 1200) / 1200, x = s.left + 2 + i * (W - 4) / 2, y = s.bot - 2 - q * (s.bot - s.top), a = 1 - q; put(x, y, 0x6dff8f, a); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, 0x6dff8f, a * 0.6); }
  if (trait === 'unstoppable') for (const side of [-1, 1]) for (let i = 0; i < 2; i++) { const q = ((t + i * 300 + (side > 0 ? 150 : 0)) % 600) / 600, x = (side < 0 ? s.left + 2 : s.right - 2) + side * q * 3; put(x, s.top + 1 - q * 5, 0xd0d0d8, 0.8 * (1 - q)); put(x + side, s.top - q * 5, 0xa0a0a8, 0.5 * (1 - q)); }
  if (trait === 'explosive') { const a = 0.5 + 0.5 * Math.sin(t / 180); for (const p of s.list) if (!p.top && rnd(p.x * 3.1 + p.y * 7.7) < 0.09) put(p.x, p.y, mixC(0xff7a1a, 0xffe066, a), 0.5 + 0.5 * a);
    const k = Math.floor(t / 100) % 2; put(s.right + 1, s.top - 1, k ? 0xffe066 : 0xff7a1a); put(s.right + 2, s.top - 2, F.white, k ? 0.8 : 0.3); }
  return out;
}
