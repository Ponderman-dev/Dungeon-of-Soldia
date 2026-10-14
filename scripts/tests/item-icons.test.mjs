// Every item has a 16x16 pixel icon (itemIcons.json); the framed icon is 20x20 with the rarity frame.
import fs from 'fs';
import { framedIconPixels, FRAMED_SIZE } from '../../src/systems/itemIcons.js';
import { artPixels } from '../../src/systems/pixelArt.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const items = r('items.json'), icons = r('itemIcons.json'), rar = r('rarities.json');
const ids = Object.keys(items).filter((k) => !k.startsWith('_'));
const missing = ids.filter((id) => !icons[id]);
ok('every item has an icon', missing.length === 0, missing.join());
const bad = Object.entries(icons).filter(([, a]) => a.rows.length !== 16 || a.rows.some((row) => row.length !== 16) || artPixels(a).flat().every((c) => c === null));
ok('every icon is 16x16 and not empty', bad.length === 0, bad.map(([id]) => id).join());
// Centred: the filled pixels sit in the middle (at most 1 pixel off on each axis).
const off = Object.entries(icons).filter(([, a]) => {
  const px = artPixels(a); const xs = [], ys = [];
  px.forEach((row, y) => row.forEach((c, x) => { if (c !== null) { xs.push(x); ys.push(y); } }));
  const left = Math.min(...xs), right = 15 - Math.max(...xs), top = Math.min(...ys), bottom = 15 - Math.max(...ys);
  return Math.abs(left - right) > 1 || Math.abs(top - bottom) > 1;
});
ok('every icon is centred', off.length === 0, off.map(([id]) => id).join());
const g = framedIconPixels(icons.excalibur, rar.legendary.frame);
ok('framed icon is 20x20 with the rarity edge colour', g.length === FRAMED_SIZE && g[0].length === FRAMED_SIZE && g[0][5] === Number(rar.legendary.frame.edge) && g[1][1] === Number(rar.legendary.frame.stud));
ok('every rarity has a frame', Object.values(rar).every((x) => x.frame && x.frame.edge));
