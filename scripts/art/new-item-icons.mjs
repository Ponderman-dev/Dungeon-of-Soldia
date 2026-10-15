// Writes the 16x16 icons of the phase H new items into src/data/itemIcons.json, using the pixel recipes of the
// proposal page (docs/proposals/item-sheet/new-items-10.html): run once, then edit them in the Studio.
import fs from 'fs';
const html = fs.readFileSync(new URL('../../docs/proposals/item-sheet/new-items-10.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('const PAL'), html.indexOf('function drawIcon'));
const { PAL, pen, outline, ICONS } = new Function(`${src}; return { PAL, pen, outline, ICONS };`)();
const MAP = { quiver_of_plenty: 'quiver', spotters_lens: 'lens', giantslayers_brand: 'giant', catalyst_vial: 'vial', scholars_bookmark: 'bookmark', last_stand_banner: 'banner', mirror_buckler: 'buckler', soul_lantern: 'lantern', phoenix_feather: 'feather', iron_will_talisman: 'talisman' };
const path = new URL('../../src/data/itemIcons.json', import.meta.url);
const icons = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const [id, name] of Object.entries(MAP)) {
  const p = pen(); ICONS[name](p); const g = outline(p.g);
  // centre the drawing
  let x0 = 16, x1 = -1, y0 = 16, y1 = -1;
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const dx = Math.floor((15 - x1 - x0) / 2), dy = Math.floor((15 - y1 - y0) / 2);
  const keys = [], rows = Array.from({ length: 16 }, () => Array(16).fill('.'));
  g.forEach((row, y) => row.forEach((c, x) => { if (!c) return; let i = keys.indexOf(c); if (i < 0) { keys.push(c); i = keys.length - 1; } rows[y + dy][x + dx] = i.toString(36); }));
  icons[id] = { palette: keys.map((k) => '0x' + PAL[k].slice(1)), rows: rows.map((r) => r.join('')) };
}
fs.writeFileSync(path, JSON.stringify(icons, null, 2) + '\n');
console.log('icons written:', Object.keys(MAP).join(', '));
