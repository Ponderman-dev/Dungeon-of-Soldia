// Writes the 16x16 icons of the phase H new items into src/data/itemIcons.json, using the pixel recipes of the
// proposal page (docs/proposals/item-sheet/new-items-10.html): run once, then edit them in the Studio.
import fs from 'fs';
const html = fs.readFileSync(new URL('../../docs/proposals/item-sheet/new-items-10.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('const PAL'), html.indexOf('function drawIcon'));
const { PAL, pen, outline, ICONS } = new Function(`${src}; return { PAL, pen, outline, ICONS };`)();
// The user's own item ideas (phase H): drawn here with the same pen.
const CUSTOM = {
  flame_spirit(p) { // a dark fireball with a ghostly face and flame tips
    p.disc(8, 10, 4.2, 'p'); p.disc(8, 10, 2.6, 'P');
    p.line(5, 7, 4, 3, 'p'); p.line(8, 6, 8, 1, 'p'); p.line(11, 7, 12, 3, 'p'); p.line(7, 6, 6, 3, 'P'); p.line(10, 6, 10, 3, 'P');
    p.px(7, 10, 'k'); p.px(10, 10, 'k'); p.line(7, 12, 10, 12, 'k');
  },
  spirit_axe(p) { // a ghostly green axe
    p.line(3, 14, 10, 4, 'b', 2); p.line(4, 14, 11, 4, 'B');
    p.disc(11, 5, 3.6, 'G'); p.disc(11, 5, 2.2, 'w');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.g[y][x] && x < 9 && y < 9 && (p.g[y][x] === 'G' || p.g[y][x] === 'w')) p.g[y][x] = null;
    p.px(13, 9, 'G'); p.px(14, 7, 'G');
  },
  heart_of_the_beast(p) { // a big red heart with three claw marks
    p.disc(5, 6, 3.2, 'r'); p.disc(11, 6, 3.2, 'r');
    for (let y = 6; y < 15; y++) { const w = Math.max(0, 7 - (y - 6)); p.line(8 - w, y, 8 + w, y, 'r'); }
    p.px(4, 4, 'w'); p.px(5, 4, 'w'); p.px(4, 5, 'w');
    p.line(6, 5, 8, 11, 'R'); p.line(8, 4, 10, 10, 'R'); p.line(10, 4, 12, 8, 'R');
  },
  moonlight_twinblade(p) { // a pale crescent moon with two thin blades
    p.disc(8, 8, 6, 'c'); p.disc(8, 8, 4.6, 'w');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - 11) ** 2 + (y - 6) ** 2 <= 22) p.g[y][x] = null;
    p.line(2, 14, 7, 9, 's'); p.line(14, 14, 9, 9, 's'); p.px(2, 15, 'b'); p.px(14, 15, 'b');
  },
  ghastly_fire(p) { // a purple flame with a green ghostly heart
    p.disc(8, 11, 4, 'p');
    for (let y = 2; y < 11; y++) { const w = Math.max(0, Math.round((y - 2) / 2.4)); p.line(8 - w, y, 8 + w, y, 'p'); }
    p.line(4, 9, 3, 5, 'p'); p.line(12, 9, 13, 5, 'p');
    p.disc(8, 11, 2.2, 'G'); p.px(8, 8, 'G'); p.px(8, 7, 'P'); p.px(7, 12, 'w');
  },
};
const MAP = { quiver_of_plenty: 'quiver', spotters_lens: 'lens', giantslayers_brand: 'giant', catalyst_vial: 'vial', scholars_bookmark: 'bookmark', mirror_buckler: 'buckler', soul_lantern: 'lantern', phoenix_feather: 'feather', iron_will_talisman: 'talisman' };
const path = new URL('../../src/data/itemIcons.json', import.meta.url);
const icons = JSON.parse(fs.readFileSync(path, 'utf8'));
const ALL = { ...Object.fromEntries(Object.entries(MAP).map(([id, name]) => [id, ICONS[name]])), ...CUSTOM };
const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(ALL);
for (const id of only) {
  const p = pen(); ALL[id](p); const g = outline(p.g);
  // centre the drawing
  let x0 = 16, x1 = -1, y0 = 16, y1 = -1;
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const dx = Math.floor((15 - x1 - x0) / 2), dy = Math.floor((15 - y1 - y0) / 2);
  const keys = [], rows = Array.from({ length: 16 }, () => Array(16).fill('.'));
  g.forEach((row, y) => row.forEach((c, x) => { if (!c) return; let i = keys.indexOf(c); if (i < 0) { keys.push(c); i = keys.length - 1; } rows[y + dy][x + dx] = i.toString(36); }));
  icons[id] = { palette: keys.map((k) => '0x' + PAL[k].slice(1)), rows: rows.map((r) => r.join('')) };
}
fs.writeFileSync(path, JSON.stringify(icons, null, 2) + '\n');
console.log('icons written:', only.join(', '));
