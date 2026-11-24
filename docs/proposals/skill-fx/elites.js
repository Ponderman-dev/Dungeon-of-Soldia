// ELITE LOOK REVIEW (proposal page, not game code; session 54, user: 'elite enemies should have their own colour of what
// their powers represent': the BODY shows the element (Burning / Frozen / Storm / Cursed / Toxic), plus a sign for the
// TRAIT; calm but clear). Same page API as hits.js (ROWS / drawRow / loopMs), bundled by vite.elites.config.js.
// TODAY = the game's own eliteGlow + crown. Options are drawn here; the pick moves into src/systems/eliteFx.js.
import enemies from '../../../src/data/enemies.json';
import combat from '../../../src/data/combat.json';
import { artPixels, partArt } from '../../../src/systems/pixelArt.js';
import { bodyBox, rnd, FX_COLORS as C } from '../../../src/systems/statusFx.js';
import { eliteGlow, crownPixels } from '../../../src/systems/eliteFx.js';

export const Z = 4, W = 60, H = 44; // the elite drawn 1 pixel size bigger (x4), like in the game
const EL = combat.elites.elements, TR = combat.elites.traits;
const hexN = (s) => parseInt(String(s).replace('#', ''), 16);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const mix = (a, b, k) => { const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
const lum = (c) => (0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255)) / 255;
// Each element's colour ramp: dark, its own colour, light.
const RAMP = { burning: [0x5a1a0a, 0xff7a3d, 0xffe066], frozen: [0x1a3a6a, 0x7fd8ff, 0xffffff], storm: [0x3a3410, 0xe8d040, 0xffffff],
  cursed: [0x2a1040, 0xb07cff, 0xf0d8ff], toxic: [0x10301a, 0x5ed06a, 0xe0ffd0] };
const ramp = (el, c) => { const [d, m, l] = RAMP[el]; const v = lum(c); return v < 0.5 ? mix(d, m, v * 2) : mix(m, l, (v - 0.5) * 2); };

// ---- the elite: its pixels as one grid (x, y relative to the feet middle), facing left like an enemy -------------------
const FEET = { x: 30, y: 37 };
function sprite(id) {
  const def = enemies[id], box = bodyBox(def.parts, def.height), px = new Map();
  for (const p of Object.values(def.parts)) {
    const g = artPixels(partArt(p)), h = g.length, w = Math.max(...g.map((r) => r.length));
    g.forEach((row, y) => row.forEach((c, x) => { if (c === null) return; const gx = Math.round(-(p.x - w / 2 + x) - 1), gy = Math.round(p.y - h / 2 + y); px.set(gx + ',' + gy, c); }));
  }
  const list = [...px].map(([k, c]) => { const [x, y] = k.split(',').map(Number); return { x, y, c }; });
  const has = (x, y) => px.has(x + ',' + y);
  for (const p of list) { p.top = !has(p.x, p.y - 1); p.bot = !has(p.x, p.y + 1); p.side = !has(p.x - 1, p.y) || !has(p.x + 1, p.y); }
  const outline = []; // empty pixels touching the body
  const seen = new Set();
  for (const p of list) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (p.x + dx) + ',' + (p.y + dy); if (!px.has(k) && !seen.has(k)) { seen.add(k); outline.push({ x: p.x + dx, y: p.y + dy }); } }
  const ys = list.map((p) => p.y), xs = list.map((p) => p.x);
  return { def, box, list, outline, top: Math.min(...ys), bot: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
}
const cache = {};
const spr = (id) => (cache[id] = cache[id] || sprite(id));

function room(ctx) {
  ctx.fillStyle = '#1b1624'; ctx.fillRect(0, 0, W * Z, H * Z);
  ctx.fillStyle = '#231d2e';
  for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) ctx.fillRect(x * Z, y * Z, 11 * Z, 7 * Z);
}
const dot = (ctx, x, y, c, a = 1) => { if (a <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = hex(c); ctx.fillRect((FEET.x + Math.round(x)) * Z, (FEET.y + Math.round(y)) * Z, Z, Z); ctx.globalAlpha = 1; };

// ---- ELEMENT looks: body colour (fn(c, p, t) -> colour) + extra pixels (fx(s, t, put)) --------------------------------
const frame = (t, ms = 120) => Math.floor(t / ms);
const ELEMENT = {
  tint: (el) => ({ body: (c) => mix(c, hexN(EL[el].color), 0.38) }),
  recolor: (el) => ({ body: (c) => mix(c, ramp(el, c), 0.8) }),
  living: (el) => ({
    body: (c, p, t) => {
      let col = mix(c, hexN(EL[el].color), 0.3); const f = frame(t), r = rnd(p.x * 13 + p.y * 7 + f);
      if (el === 'burning' && p.top) col = r < 0.5 ? C.fire2 : C.fire;
      if (el === 'frozen' && p.top) col = r < 0.8 ? 0xffffff : C.ice;
      if (el === 'storm' && rnd(p.x * 31 + p.y * 17 + frame(t, 90)) < 0.04) col = r < 0.5 ? 0xffffff : C.elec;
      if (el === 'cursed') { col = mix(c, 0x3a1860, 0.45); if (rnd(p.x * 5 + p.y * 3) < 0.06) col = mix(0xd090ff, 0xffffff, 0.5 + 0.5 * Math.sin(t / 300 + p.x)); }
      if (el === 'toxic' && (p.bot || p.side)) col = mix(col, 0x6de07a, 0.6);
      return col;
    },
    fx: (s, t, put) => {
      if (el === 'burning') for (let i = 0; i < 5; i++) { const life = 700, q = ((t + i * 140) % life) / life, x = s.left + 1 + rnd(i * 3 + Math.floor((t + i * 140) / life)) * (s.right - s.left - 1); put(x + Math.sin(q * 6 + i), s.top - 1 - q * 7, q < 0.4 ? C.fire2 : C.fire, 1 - q); }
      if (el === 'frozen') { const k = Math.floor(t / 400), p = s.list[Math.floor(rnd(k) * s.list.length)], a = 1 - ((t % 400) / 400); put(p.x, p.y, 0xffffff, a); put(p.x + 1, p.y, 0xffffff, a * 0.5); put(p.x - 1, p.y, 0xffffff, a * 0.5); put(p.x, p.y - 1, 0xffffff, a * 0.5); put(p.x, p.y + 1, 0xffffff, a * 0.5);
        for (let i = 0; i < 3; i++) { const q = ((t + i * 500) % 1500) / 1500; put(s.left + (i + 1) * (s.right - s.left) / 4 + Math.sin(q * 5) * 1.5, s.top - 2 + q * (s.bot - s.top + 2), 0xffffff, 0.7 * (1 - q)); } }
      if (el === 'storm') { const f = frame(t, 90); if (f % 7 === 0) { const o = s.outline[Math.floor(rnd(f) * s.outline.length)]; put(o.x, o.y, C.elec); put(o.x + (rnd(f + 1) < 0.5 ? 1 : -1), o.y - 1, 0xffffff); put(o.x, o.y - 2, C.elec, 0.7); } }
      if (el === 'cursed') for (let i = 0; i < 4; i++) { const q = ((t + i * 350) % 1400) / 1400; put(s.left + 1 + i * (s.right - s.left - 1) / 3 + Math.sin(q * 6 + i) * 1.5, s.top + 2 - q * 8, i % 2 ? 0xb07cff : 0x5a2d8a, 0.8 * (1 - q)); }
      if (el === 'toxic') for (let i = 0; i < 3; i++) { const q = ((t + i * 470) % 1400) / 1400, bx = s.left + 2 + rnd(i * 7 + Math.floor((t + i * 470) / 1400)) * (s.right - s.left - 3); const y = s.bot - 4 + q * 6; put(bx, y, 0x6de07a, 1 - q * 0.6); if (q > 0.85) { put(bx - 1, s.bot + 1, 0x6de07a, 0.6); put(bx + 1, s.bot + 1, 0x6de07a, 0.6); } }
    },
  }),
};

// ---- TRAIT signs: A = on the body (fx over the sprite), B = an icon right of the crown --------------------------------
const TRAIT_BODY = {
  vampiric: (s, t, put) => { const a = 0.55 + 0.35 * Math.sin(t / 320); for (const o of s.outline) put(o.x, o.y, 0x9a1020, a); },
  shielded: (s, t, put) => { for (const o of s.outline) put(o.x, o.y, 0x8fe0ff, 0.75); const k = Math.floor(t / 90) % s.outline.length; for (let i = 0; i < 3; i++) { const o = s.outline[(k + i) % s.outline.length]; put(o.x, o.y, 0xffffff, 1 - i * 0.3); } },
  thorny: (s, t, put) => { s.outline.filter((o, i) => i % 5 === 0).forEach((o) => { const dx = Math.sign(o.x - (s.left + s.right) / 2), dy = o.y < (s.top + s.bot) / 2 ? -1 : 0; put(o.x, o.y, 0xc8b89a); put(o.x + dx, o.y + dy, 0x8a7a5a); }); },
  splitting: (s, t, put) => { const mx = Math.round((s.left + s.right) / 2), a = 0.6 + 0.4 * Math.sin(t / 250); for (let y = s.top + 1; y < s.bot - 1; y++) if (s.list.some((p) => p.x === mx && p.y === y)) put(mx + (Math.floor(y / 2) % 2 ? 0 : 1), y, 0xfff0c0, a); },
  regenerating: (s, t, put) => { for (let i = 0; i < 3; i++) { const q = ((t + i * 400) % 1200) / 1200, x = s.left + 2 + i * (s.right - s.left - 4) / 2, y = s.bot - 2 - q * (s.bot - s.top); put(x, y, 0x6dff8f, 1 - q); put(x - 1, y, 0x6dff8f, (1 - q) * 0.6); put(x + 1, y, 0x6dff8f, (1 - q) * 0.6); put(x, y - 1, 0x6dff8f, (1 - q) * 0.6); put(x, y + 1, 0x6dff8f, (1 - q) * 0.6); } },
  unstoppable: (s, t, put) => { for (const side of [-1, 1]) for (let i = 0; i < 2; i++) { const q = ((t + i * 300 + (side > 0 ? 150 : 0)) % 600) / 600, x = (side < 0 ? s.left + 2 : s.right - 2) + side * q * 3; put(x, s.top + 1 - q * 5, 0xd0d0d8, 0.8 * (1 - q)); put(x + side, s.top - q * 5, 0xa0a0a8, 0.5 * (1 - q)); } },
  explosive: (s, t, put) => { const a = 0.5 + 0.5 * Math.sin(t / 180); const cracks = s.list.filter((p) => rnd(p.x * 3.1 + p.y * 7.7) < 0.09 && !p.top); for (const p of cracks) put(p.x, p.y, mix(0xff7a1a, 0xffe066, a), 0.5 + 0.5 * a);
    const k = Math.floor(t / 100) % 2; put(s.right + 1, s.top - 1, k ? 0xffe066 : 0xff7a1a); put(s.right + 2, s.top - 2, 0xffffff, k ? 0.8 : 0.3); },
};
// 5 x 5 icons, '.' = empty; drawn with a dark outline like the crown.
const ICON = {
  vampiric: { rows: ['r...r', 'r...r', 'rr.rr', '.w.w.', '.w.w.'], c: { r: 0x9a1020, w: 0xffffff } },
  shielded: { rows: ['bbbbb', 'bwbbb', 'bbbbb', '.bbb.', '..b..'], c: { b: 0x6fd0ff, w: 0xffffff } },
  thorny: { rows: ['..s..', 's.s.s', '.sss.', 'sssss', '.sss.'], c: { s: 0xc8b89a } },
  splitting: { rows: ['gg.gg', 'gg.gg', 'g..gg', 'gg..g', 'gg.gg'], c: { g: 0xfff0c0 } },
  regenerating: { rows: ['..g..', '..g..', 'ggggg', '..g..', '..g..'], c: { g: 0x6dff8f } },
  unstoppable: { rows: ['o.o..', '.o.o.', '..o.o', '.o.o.', 'o.o..'], c: { o: 0xff9a2e } },
  explosive: { rows: ['...y.', '..k..', '.kkk.', 'kkwkk', '.kkk.'], c: { k: 0x3a3a44, w: 0x8a8a9a, y: 0xffe066 } },
};

// ---- rows -------------------------------------------------------------------------------------------------------------
const elName = (k) => EL[k].name, trName = (k) => TR[k].name || (k[0].toUpperCase() + k.slice(1));
const ELEMENT_ROWS = Object.keys(RAMP).map((el, i) => ({
  id: 'el:' + el, group: 'melee', name: elName(el) + ' elite', element: el, enemy: ['goblin', 'bandit', 'orcBrute', 'goblin', 'bandit'][i] || 'goblin',
  users: `What it does: ${{ burning: 'hits burn, resists fire', frozen: 'hits chill, resists ice', storm: 'hits shock and jump to a 2nd hero', cursed: 'hits curse and heal it', toxic: 'hits poison, a poison cloud when it dies' }[el]}.`,
  opts: { today: { today: true, name: 'Today', desc: 'Only the glow on the floor behind it and the crown.' },
    A: { look: 'tint', name: 'Tint', desc: 'The whole body is tinted in the element colour (the glow stays).' },
    B: { look: 'recolor', name: 'Recolour', desc: 'The body is repainted in the element colours (dark to light), like a different kind of monster.' },
    C: { look: 'living', name: 'Living', desc: { burning: 'Tinted, its top edge burns and embers rise off it.', frozen: 'Tinted, frost caps its top edge, snow falls and a frost star twinkles on it.', storm: 'Tinted, sparks crawl over its body and snap off its edges.', cursed: 'Darkened purple with faint glowing marks, purple wisps rise off it.', toxic: 'Tinted, its sides and feet ooze green, drops drip off and splash.' }[el] } },
}));
const TRAIT_ROWS = Object.keys(ICON).map((tr) => ({
  id: 'tr:' + tr, group: 'ranged', name: trName(tr), trait: tr, enemy: 'bandit',
  users: `What it does: ${{ vampiric: 'heals from its hits', shielded: 'a shield that grows back', thorny: 'hurts melee attackers back', splitting: 'splits in 2 when it dies', regenerating: 'heals over time', unstoppable: 'stuns and slows last half as long', explosive: 'blows up when it dies' }[tr]}. (Shown without an element colour so you can see the sign.)`,
  opts: { today: { today: true, name: 'Today', desc: 'Nothing shows the trait (only its name when the fight starts).' },
    A: { sign: 'body', name: 'On the body', desc: { vampiric: 'A dark blood-red outline that slowly pulses.', shielded: 'A pale blue outline with a shine running round it.', thorny: 'Little thorns stick out of its outline.', splitting: 'A glowing crack down its middle.', regenerating: 'Green plus signs rise up its body.', unstoppable: 'Angry steam puffs off its shoulders.', explosive: 'Glowing cracks pulse on its body and a fuse sparks on its head.' }[tr] },
    B: { sign: 'icon', name: 'Icon by the crown', desc: { vampiric: 'Fangs', shielded: 'A shield', thorny: 'Thorns', splitting: 'A split stone', regenerating: 'A green plus', unstoppable: 'Forward arrows', explosive: 'A bomb' }[tr] + ' next to the crown, over the health bar.' } },
}));
export const ROWS = [...ELEMENT_ROWS, ...TRAIT_ROWS];
export const loopMs = () => 2400;

function drawBar(ctx, s, icon) {
  const top = s.top - 6, w = 16, x0 = -w / 2;
  const at = (x, y, c) => { ctx.fillStyle = hex(c); ctx.fillRect((FEET.x + x) * Z, (FEET.y + y) * Z, Z, Z); };
  for (let x = -1; x <= w; x++) { at(x0 + x, top - 1, 0x1a1020); at(x0 + x, top + 2, 0x1a1020); }
  for (let x = 0; x < w; x++) { at(x0 + x, top, x < 12 ? 0xd9452b : 0x3a2030); at(x0 + x, top + 1, x < 12 ? 0x8e2a2a : 0x2a1828); }
  at(x0 - 1, top, 0x1a1020); at(x0 - 1, top + 1, 0x1a1020); at(x0 + w, top, 0x1a1020); at(x0 + w, top + 1, 0x1a1020);
  for (const [c, r, col] of crownPixels()) at(x0 - 8 + c, top - 2 + r, col);
  if (icon) { const ic = ICON[icon]; const on = (c, r) => ic.rows[r] && ic.rows[r][c] && ic.rows[r][c] !== '.';
    for (let r = -1; r <= 5; r++) for (let c = -1; c <= 5; c++) { const X = x0 + w + 2 + c, Y = top - 2 + r; if (on(c, r)) at(X, Y, ic.c[ic.rows[r][c]]); else if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dc, dr]) => on(c + dc, r + dr))) at(X, Y, 0x1a1020); } }
}

export function drawRow(ctx, rowId, key, t) {
  const r = ROWS.find((x) => x.id === rowId), o = r.opts[key], s = spr(r.enemy);
  ctx.imageSmoothingEnabled = false; room(ctx);
  const el = r.element || 'burning';
  const glowCol = r.element ? hexN(EL[el].color) : 0xf2c544;
  for (const [x, y, w, h, c, a] of eliteGlow(s.box, glowCol, t)) { ctx.globalAlpha = a; ctx.fillStyle = hex(c); ctx.fillRect((FEET.x + x) * Z - Z / 2, (FEET.y + y) * Z, w * Z, h * Z); }
  ctx.globalAlpha = 1;
  const look = r.element && o.look ? ELEMENT[o.look](el) : null;
  const bob = Math.round(Math.sin(t / 400) * 0.5);
  for (const p of s.list) dot(ctx, p.x, p.y + bob, look ? look.body(p.c, p, t) : p.c);
  const put = (x, y, c, a = 1) => dot(ctx, x, y + bob, c, a);
  if (look && look.fx) look.fx(s, t, put);
  if (r.trait && o.sign === 'body') TRAIT_BODY[r.trait](s, t, put);
  drawBar(ctx, s, r.trait && o.sign === 'icon' ? r.trait : null);
}
