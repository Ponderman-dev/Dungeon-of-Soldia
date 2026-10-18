// Writes src/data/skillIcons.json: a 16x16 pixel icon for every hero skill (by skill id) and every hero
// passive (`passive_<heroId>`), drawn with the same tiny pixel pen as the item icons (dark outline added).
// Run: node scripts/art/skill-icons.mjs   (then review them on the skill icon proposal page)
import fs from 'fs';

const PAL = { k: '#16101f', w: '#f3eefc', g: '#8f8aa3', K: '#3a3646', s: '#c8cbd8', S: '#6a6e80', b: '#8a5a32', B: '#5a3820', y: '#f2b632', Y: '#fff0a8', r: '#e0453a', R: '#8a1f2a', o: '#ff8a3d', G: '#5ddf6a', d: '#2f7a3a', p: '#a45be6', P: '#d6a8ff', c: '#7fd8ff', C: '#3b8ee0', n: '#efe2c0', m: '#f06ab4' };

function pen() {
  const g = Array.from({ length: 16 }, () => Array(16).fill(null));
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; };
  const line = (x0, y0, x1, y1, c, t = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; px(x, y, c); if (t > 1) px(x + 1, y, c); } };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c); };
  const disc = (cx, cy, r, c) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) px(x, y, c); };
  const ring = (cx, cy, r, c) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - cx, y - cy); if (d > r - 0.7 && d <= r + 0.5) px(x, y, c); } };
  const clear = (test) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (test(x, y)) g[y][x] = null; };
  const recolor = (from, to, test = () => true) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x] === from && test(x, y)) g[y][x] = to; };
  return { g, px, line, rect, disc, ring, clear, recolor };
}
// Every empty pixel next to a filled one becomes the dark outline.
function outline(g) {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== 'k')) out[y][x] = 'k';
  return out;
}

// Shared shapes.
const shield = (p, x0, y0, w, h, edge, fill) => { // a kite shield: square top, pointed bottom
  for (let y = 0; y < h; y++) {
    const inset = y < h * 0.55 ? 0 : Math.round(((y - h * 0.55) / (h * 0.45)) * (w / 2 - 0.5));
    p.line(x0 + inset, y0 + y, x0 + w - 1 - inset, y0 + y, edge);
    if (y > 0 && y < h - 2 && w - 2 * inset > 2) p.line(x0 + inset + 1, y0 + y, x0 + w - 2 - inset, y0 + y, fill);
  }
};
const heart = (p, c) => { p.disc(5, 6, 3.2, c); p.disc(11, 6, 3.2, c); for (let y = 6; y < 15; y++) { const w = Math.max(0, 7 - (y - 6)); p.line(8 - w, y, 8 + w, y, c); } };
const skull = (p, cx, cy, bone, small = false) => {
  if (small) { p.disc(cx, cy, 2.2, bone); p.rect(cx - 1, cy + 2, cx + 1, cy + 3, bone); p.px(cx - 1, cy, 'k'); p.px(cx + 1, cy, 'k'); return; }
  p.disc(cx, cy, 3.2, bone); p.rect(cx - 2, cy + 2, cx + 2, cy + 4, bone);
  p.rect(cx - 2, cy - 1, cx - 1, cy, 'k'); p.rect(cx + 1, cy - 1, cx + 2, cy, 'k'); p.px(cx, cy + 2, 'k'); p.px(cx - 1, cy + 4, 'k'); p.px(cx + 1, cy + 4, 'k');
};
const arrowDown = (p, x, y, len) => { p.line(x, y, x, y + len, 'b'); p.px(x - 1, y, 'r'); p.px(x + 1, y, 'r'); p.px(x - 1, y + 1, 'r'); p.px(x + 1, y + 1, 'r'); p.rect(x - 1, y + len, x + 1, y + len, 'S'); p.px(x, y + len + 1, 's'); };
const flask = (p, cx, cy, liquid) => { p.rect(cx - 1, cy - 4, cx + 1, cy - 2, 'S'); p.px(cx, cy - 5, 'b'); p.disc(cx, cy + 1, 2.6, 'S'); p.disc(cx, cy + 1, 1.7, liquid); p.px(cx - 1, cy, 'w'); };
const note = (p, x, y, c) => { p.disc(x, y, 1.6, c); p.line(x + 1, y, x + 1, y - 7, c); p.line(x + 2, y - 7, x + 3, y - 5, c); };

const ICONS = {
  // ---- Knight
  defense_bash(p) { shield(p, 2, 3, 9, 12, 's', 'C'); p.rect(6, 5, 6, 11, 'Y'); p.rect(4, 7, 8, 7, 'Y'); p.line(12, 1, 14, 3, 'Y'); p.line(14, 1, 12, 3, 'Y'); p.px(13, 2, 'w'); p.px(13, 5, 'y'); p.px(15, 6, 'y'); p.line(0, 6, 0, 8, 'w'); },
  challenge(p) { p.disc(7, 8, 4.6, 's'); p.rect(3, 8, 11, 13, 's'); p.rect(4, 13, 10, 13, 'S'); p.line(4, 9, 10, 9, 'k'); p.line(7, 3, 7, 5, 'r'); p.px(6, 2, 'r'); p.px(8, 3, 'R'); p.line(13, 6, 15, 4, 'r'); p.line(13, 9, 15, 9, 'r'); p.line(13, 12, 15, 14, 'r'); p.px(5, 6, 'w'); },
  passive_knight(p) { shield(p, 1, 3, 9, 12, 'S', 's'); p.rect(5, 5, 5, 11, 'R'); p.line(15, 2, 11, 7, 'o'); p.line(11, 7, 15, 12, 'o'); p.px(14, 12, 'o'); p.px(15, 11, 'o'); p.px(14, 13, 'o'); p.px(13, 12, 'Y'); },
  // ---- Berserker
  brawl_leap(p) { p.line(2, 14, 10, 6, 'b', 2); p.disc(11, 5, 3.8, 's'); p.clear((x, y) => x < 10 && y < 6 && p.g[y][x] === 's'); p.recolor('s', 'w', (x, y) => x > 12 && y < 4); p.px(13, 9, 'g'); p.px(1, 15, 'g'); p.px(4, 15, 'g'); p.px(6, 14, 'g'); p.line(5, 2, 8, 1, 'w'); p.line(3, 5, 4, 3, 'w'); },
  blood_feast(p) { p.rect(3, 2, 12, 3, 'y'); p.rect(4, 4, 11, 6, 'y'); p.rect(5, 7, 10, 7, 'y'); p.rect(4, 2, 11, 2, 'R'); p.rect(7, 8, 8, 11, 'y'); p.rect(5, 12, 10, 13, 'y'); p.px(5, 4, 'Y'); p.px(3, 4, 'r'); p.px(3, 5, 'r'); p.px(2, 7, 'r'); p.px(12, 4, 'r'); p.px(13, 6, 'r'); },
  passive_berserker(p) { heart(p, 'r'); p.recolor('r', 'R', (x) => x >= 8); p.line(8, 3, 7, 6, 'k'); p.line(7, 6, 9, 9, 'k'); p.line(9, 9, 8, 13, 'k'); p.px(4, 4, 'w'); p.px(5, 4, 'w'); },
  // ---- Rogue
  multistrike(p) { p.line(1, 12, 7, 2, 'w'); p.line(5, 13, 11, 3, 'w'); p.line(9, 14, 15, 4, 'w'); p.line(2, 12, 8, 2, 'c'); p.line(6, 13, 12, 3, 'c'); p.line(10, 14, 15, 5, 'c'); p.px(4, 14, 'r'); p.px(13, 1, 'r'); p.px(14, 2, 'R'); },
  smoke_bomb(p) { p.disc(7, 10, 4.3, 'K'); p.px(5, 8, 'g'); p.px(5, 9, 'g'); p.line(9, 6, 11, 4, 'b'); p.px(12, 3, 'Y'); p.px(12, 2, 'o'); p.disc(12, 7, 1.6, 'g'); p.disc(14, 4, 1.4, 'g'); p.disc(10, 1, 1.2, 'g'); },
  passive_rogue(p) { p.line(4, 11, 11, 4, 's', 2); p.line(5, 11, 12, 4, 'w'); p.line(2, 9, 6, 13, 'y'); p.line(1, 14, 3, 12, 'b'); p.px(13, 3, 's'); p.px(13, 6, 'r'); p.px(13, 7, 'r'); p.px(12, 9, 'r'); p.px(14, 10, 'R'); },
  // ---- Archer
  arrow_rain(p) { arrowDown(p, 3, 1, 9); arrowDown(p, 8, 4, 9); arrowDown(p, 13, 2, 9); },
  hunters_mark(p) { p.ring(8, 8, 6, 'r'); p.ring(8, 8, 3, 'r'); p.line(8, 0, 8, 4, 'r'); p.line(8, 12, 8, 15, 'r'); p.line(0, 8, 4, 8, 'r'); p.line(12, 8, 15, 8, 'r'); p.px(8, 8, 'Y'); },
  passive_archer(p) {
    for (const [ex, ey] of [[14, 2], [14, 7], [9, 1]]) { p.line(2, 13, ex, ey, 'b'); p.px(ex, ey, 's'); p.px(ex - 1, ey, 'S'); p.px(ex, ey + 1, 'S'); }
    p.px(2, 13, 'r'); p.px(1, 14, 'r'); p.px(3, 14, 'r'); p.px(1, 12, 'r');
  },
  // ---- Samurai
  wind_cutter3(p) {
    p.disc(8, 8, 6.4, 'c');
    p.clear((x, y) => (x - 10.5) ** 2 + (y - 6) ** 2 <= 5.2 * 5.2);
    const inside = (x, y) => (x - 10.5) ** 2 + (y - 6) ** 2 <= 6.4 * 6.4;
    p.recolor('c', 'w', inside); // the sharp inner edge of the crescent is white
    p.line(12, 12, 15, 12, 'c'); p.line(13, 14, 15, 14, 'c');
  },
  counter_stance(p) { p.line(2, 13, 13, 2, 's'); p.line(3, 13, 14, 2, 'w'); p.line(2, 2, 13, 13, 's'); p.line(3, 2, 14, 13, 'S'); p.rect(1, 13, 2, 14, 'R'); p.rect(13, 13, 14, 14, 'R'); p.px(7, 6, 'Y'); p.px(8, 7, 'Y'); p.px(9, 6, 'Y'); p.px(8, 5, 'w'); },
  passive_samurai(p) { p.line(2, 13, 11, 4, 'K', 2); p.line(3, 13, 11, 5, 'S'); p.px(1, 14, 'y'); p.line(10, 3, 12, 5, 'y'); p.line(12, 3, 14, 1, 'R', 2); p.px(15, 0, 'y'); },
  // ---- Mage
  mage_rotation(p) { p.disc(8, 4, 3.3, 'o'); p.disc(8, 4, 1.6, 'Y'); p.disc(4, 11, 3.3, 'C'); p.disc(4, 11, 1.6, 'c'); p.disc(12, 11, 3.3, 'y'); p.disc(12, 11, 1.6, 'Y'); p.px(7, 3, 'w'); p.px(3, 10, 'w'); p.px(11, 10, 'w'); },
  mage_ward(p) { p.disc(8, 8, 6.5, 'p'); p.disc(8, 8, 5.3, 'P'); p.disc(8, 8, 4, null); p.disc(8, 8, 4, 'K'); p.recolor('K', 'p'); p.disc(8, 8, 3.2, 'C'); p.px(6, 6, 'w'); p.px(5, 7, 'w'); p.px(10, 10, 'c'); p.px(13, 2, 'w'); p.px(2, 13, 'w'); },
  passive_mage(p) {
    p.ring(8, 8, 5.4, 'o');
    p.recolor('o', 'C', (x, y) => y > 8 && x < 8); p.recolor('o', 'y', (x, y) => y > 8 && x >= 8 || (x > 10 && y > 5));
    p.px(8, 2, 'Y'); p.px(9, 1, 'o'); p.px(9, 3, 'o'); p.disc(8, 8, 1.3, 'w');
  },
  // ---- Cleric
  holy_nova(p) { for (let a = 0; a < 8; a++) { const r = (a * Math.PI) / 4; p.line(8, 8, 8 + Math.cos(r) * 7, 8 + Math.sin(r) * 7, a % 2 ? 'y' : 'Y'); } p.disc(8, 8, 2.8, 'Y'); p.disc(8, 8, 1.4, 'w'); },
  sanctuary(p) { shield(p, 3, 1, 10, 14, 'y', 'n'); p.rect(7, 4, 8, 11, 'y'); p.rect(5, 6, 10, 7, 'y'); p.px(5, 3, 'w'); },
  passive_cleric(p) { p.ring(8, 3, 3, 'y'); p.clear((x, y) => y > 3 && y < 6 && Math.abs(x - 8) < 2); for (let x = 4; x <= 12; x++) { p.px(x, 2, null); } p.line(5, 1, 11, 1, 'Y'); p.line(4, 2, 4, 3, 'y'); p.line(12, 2, 12, 3, 'y'); p.line(5, 4, 11, 4, 'y'); p.rect(7, 6, 9, 15, 'G'); p.rect(4, 9, 12, 11, 'G'); p.px(7, 6, 'w'); },
  // ---- Necromancer
  death_coil3(p) { p.disc(9, 7, 5.6, 'p'); p.disc(9, 7, 4.4, 'K'); skull(p, 9, 6, 'G'); p.line(1, 14, 4, 11, 'P'); p.line(2, 15, 5, 12, 'p'); p.px(0, 12, 'P'); },
  bone_sacrifice(p) { p.ring(8, 8, 6.6, 'C'); p.line(4, 4, 12, 12, 'n', 2); p.line(4, 12, 12, 4, 'n', 2); for (const [x, y] of [[3, 3], [12, 12], [3, 12], [12, 3]]) p.rect(x, y, x + 1, y + 1, 'n'); p.px(2, 8, 'c'); p.px(14, 8, 'c'); },
  passive_necromancer(p) { skull(p, 4, 7, 'g', true); skull(p, 12, 7, 'g', true); skull(p, 8, 9, 'n'); p.px(4, 13, 'G'); p.px(12, 13, 'G'); },
  // ---- Bard
  discord(p) { note(p, 7, 12, 'm'); p.line(1, 4, 3, 2, 'P'); p.line(3, 2, 4, 5, 'P'); p.line(4, 5, 6, 3, 'P'); p.line(11, 9, 13, 7, 'P'); p.line(13, 7, 14, 10, 'P'); p.line(14, 10, 15, 8, 'P'); p.px(10, 14, 'r'); p.px(12, 13, 'r'); },
  change_song(p) { p.disc(6, 10, 4.4, 'b'); p.disc(6, 10, 1.6, 'B'); p.line(8, 8, 14, 2, 'B', 2); p.rect(13, 0, 15, 2, 'b'); p.line(4, 12, 13, 3, 'n'); p.px(3, 13, 'y'); p.px(9, 13, 'Y'); },
  passive_bard(p) { p.disc(4, 12, 2, 'y'); p.disc(11, 10, 2, 'y'); p.line(5, 12, 5, 3, 'y'); p.line(12, 10, 12, 1, 'y'); p.line(5, 3, 12, 1, 'y'); p.line(5, 4, 12, 2, 'y'); p.px(3, 11, 'Y'); p.px(10, 9, 'Y'); },
  // ---- Alchemist
  alch_barrage(p) { flask(p, 3, 11, 'G'); flask(p, 8, 7, 'G'); flask(p, 13, 10, 'G'); p.px(1, 2, 'G'); p.px(5, 1, 'd'); p.px(13, 3, 'G'); },
  alch_brew(p) { p.rect(6, 1, 9, 4, 'S'); p.rect(6, 0, 9, 0, 'b'); p.disc(8, 10, 5, 'S'); p.disc(8, 10, 4, 'G'); p.recolor('G', 'C', (x) => x < 7); p.recolor('G', 'r', (x) => x > 9); p.px(6, 8, 'w'); p.px(5, 9, 'w'); p.px(13, 3, 'G'); p.px(2, 4, 'C'); p.px(14, 6, 'r'); },
  passive_alchemist(p) { flask(p, 12, 10, 'G'); for (const [x, y] of [[1, 12], [2, 9], [4, 6], [6, 4], [8, 4]]) p.px(x, y, 'g'); p.px(14, 14, 'G'); p.px(10, 15, 'd'); p.px(15, 12, 'G'); },
};

const iconOf = (draw) => {
  const p = pen();
  draw(p);
  const g = outline(p.g);
  // centre the drawing
  let x0 = 16, x1 = -1, y0 = 16, y1 = -1;
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const dx = Math.floor((15 - x1 - x0) / 2), dy = Math.floor((15 - y1 - y0) / 2);
  const keys = [], rows = Array.from({ length: 16 }, () => Array(16).fill('.'));
  g.forEach((row, y) => row.forEach((c, x) => { if (!c) return; let i = keys.indexOf(c); if (i < 0) { keys.push(c); i = keys.length - 1; } const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < 16 && xx >= 0 && xx < 16) rows[yy][xx] = i.toString(36); }));
  return { palette: keys.map((k) => '0x' + PAL[k].slice(1)), rows: rows.map((r) => r.join('')) };
};

const out = { _about: 'A 16x16 pixel icon per hero skill (key = skill id) and per hero passive (key = passive_<heroId>). Written by scripts/art/skill-icons.mjs; same format as itemIcons.json.' };
for (const [id, draw] of Object.entries(ICONS)) out[id] = iconOf(draw);
fs.writeFileSync(new URL('../../src/data/skillIcons.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('skill icons written:', Object.keys(ICONS).length);
