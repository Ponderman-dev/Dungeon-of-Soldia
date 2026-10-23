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
  // New items batch 1 (session 27).
  hunters_badge(p) { // a silver shield badge with the elites' gold crown
    p.rect(3, 3, 12, 9, 's'); for (let y = 10; y < 15; y++) { const w = 4 - (y - 10); p.line(7.5 - w, y, 7.5 + w + 0.5, y, 's'); }
    p.rect(4, 4, 11, 9, 'S'); p.rect(5, 6, 10, 8, 'y'); p.px(5, 5, 'y'); p.px(7, 4, 'y'); p.px(8, 4, 'y'); p.px(10, 5, 'y'); p.px(7, 7, 'r'); p.px(8, 7, 'r');
    p.px(4, 3, 'w'); p.px(5, 3, 'w');
  },
  elites_badge(p) { // a gold badge with a red horned skull (bosses)
    p.disc(8, 8, 6.2, 'y'); p.disc(8, 8, 5, 'R');
    p.disc(8, 8, 2.8, 'n'); p.rect(7, 10, 9, 11, 'n'); p.px(7, 8, 'k'); p.px(9, 8, 'k'); p.px(8, 10, 'k');
    p.line(5, 6, 4, 3, 'w'); p.line(11, 6, 12, 3, 'w'); p.px(3, 2, 'Y');
  },
  swarm_swatter(p) { // a fly swatter: long handle, green mesh head, a squashed fly
    p.line(2, 14, 7, 9, 'b', 2); p.line(3, 14, 8, 9, 'B');
    p.rect(7, 2, 13, 8, 'd'); for (let y = 2; y <= 8; y += 2) p.line(7, y, 13, y, 'G'); for (let x = 7; x <= 13; x += 2) p.line(x, 2, x, 8, 'G');
    p.px(10, 5, 'k'); p.px(9, 4, 'w'); p.px(11, 4, 'w');
  },
  better_odds(p) { // a fan of three cards, the front one with a red heart
    p.rect(2, 4, 7, 12, 'n'); p.rect(5, 3, 10, 11, 'n'); p.rect(8, 2, 13, 10, 'w');
    p.line(5, 3, 5, 11, 'g'); p.line(8, 2, 8, 10, 'g');
    p.rect(9, 5, 12, 6, 'r'); p.rect(10, 7, 11, 7, 'r'); p.px(9, 4, 'r'); p.px(12, 4, 'r'); p.px(10, 5, 'n'); // a red heart
   
    p.px(3, 6, 'k'); p.px(6, 5, 'k');
  },
  opening_horn(p) { // a curved gold war horn with a brown strap and sound lines
    p.line(2, 4, 4, 9, 'n', 2); p.line(4, 9, 8, 12, 'n', 2); p.line(8, 12, 12, 11, 'y', 2); p.disc(12.5, 10, 2.4, 'y'); p.disc(12.5, 10, 1.2, 'B');
    p.line(3, 9, 8, 6, 'b'); p.px(1, 3, 'w'); p.px(2, 3, 'w');
    p.px(14, 6, 'w'); p.px(15, 5, 'w'); p.px(15, 8, 'w');
  },
  quick_fingers(p) { // a white glove with yellow speed lines
    p.rect(6, 7, 11, 13, 'w'); for (const x of [6, 8, 10]) p.rect(x, 2, x + 1, 6, 'w'); p.line(12, 9, 13, 6, 'w', 2);
    p.rect(6, 13, 11, 14, 's'); p.line(7, 2, 7, 6, 's'); p.line(9, 2, 9, 6, 's');
    p.line(1, 4, 4, 4, 'y'); p.line(1, 8, 4, 8, 'Y'); p.line(2, 11, 4, 11, 'y');
  },
  life_crystal(p) { // a green crystal with a small heart glow
    for (let y = 2; y < 14; y++) { const w = y < 6 ? (y - 2) : Math.max(0, Math.round((14 - y) / 2)); p.line(8 - w, y, 8 + w, y, 'G'); }
    p.line(8, 2, 8, 13, 'd'); p.line(5, 6, 11, 6, 'd');
    p.px(6, 4, 'w'); p.px(7, 3, 'w'); p.px(6, 5, 'w');
    p.px(10, 8, 'r'); p.px(9, 8, 'r'); p.px(9, 9, 'r'); p.px(11, 8, 'r'); p.px(10, 9, 'r'); p.px(10, 10, 'r');
  },
  emergency_buckler(p) { // a small round wooden buckler with a red cross
    p.disc(8, 8, 6, 's'); p.disc(8, 8, 5, 'b'); p.ring(8, 8, 3.5, 'B');
    p.rect(7, 4, 8, 12, 'r'); p.rect(4, 7, 12, 8, 'r'); p.px(4, 4, 'w'); p.px(5, 3, 'w');
  },
  rally_flag(p) { // a red banner on a pole with a gold tip
    p.line(3, 1, 3, 15, 'b'); p.px(3, 0, 'y');
    p.rect(4, 2, 12, 8, 'r'); p.rect(4, 6, 12, 8, 'R'); p.px(13, 3, 'r'); p.px(13, 5, 'r'); p.px(12, 9, 'R');
    p.rect(7, 3, 9, 5, 'y');
  },
  frost_mantle(p) { // a pale blue hooded cloak with frost on its hem
    p.disc(8, 4, 3, 'C'); p.disc(8, 4.5, 1.6, 'k');
    p.rect(4, 7, 11, 8, 'c');
    for (let y = 9; y < 15; y++) { const w = 4 + Math.round((y - 9) / 2.5); p.line(8 - w, y, 7 + w, y, 'c'); }
    p.line(7, 7, 7, 14, 'C'); p.line(8, 7, 8, 14, 'C');
    for (const x of [3, 5, 10, 12]) p.px(x, 14, 'w'); p.px(4, 13, 'w'); p.px(11, 13, 'w'); p.px(6, 2, 'w');
  },
  reapers_bell(p) { // a dark iron bell with a purple skull mark and clapper
    p.rect(7, 1, 8, 2, 'S');
    p.disc(7.5, 6, 3.6, 'g');
    for (let y = 6; y < 13; y++) { const w = 4 + Math.round((y - 6) / 3); p.line(8 - w, y, 7 + w, y, 'g'); }
    p.line(1, 12, 14, 12, 'S'); p.disc(7.5, 14, 1.2, 'p');
    p.disc(7.5, 8, 2, 'P'); p.px(7, 8, 'k'); p.px(8, 8, 'k'); p.px(7, 10, 'P'); p.px(8, 10, 'P');
    p.px(5, 4, 'w'); p.px(5, 5, 'w');
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
