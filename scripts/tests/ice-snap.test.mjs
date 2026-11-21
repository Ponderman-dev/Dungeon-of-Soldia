// Freeze ice is snapped to the rows it covers (systems/statusFx.js snapIce, used by Character.setStatusLook): the
// same pixels turn to ice as with the raw amount, but far fewer cached part pictures are made (session 51 leak).
import fs from 'node:fs';
import { snapIce } from '../../src/systems/statusFx.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const defs = [...r('heroes.json'), ...Object.values(r('enemies.json')), ...Object.values(r('minions.json'))].filter((d) => d.parts);
// Character.texture: a pixel row y of a part turns to ice when part.top0 + y + 1 > -ice * (height + 2).
const iced = (def, ice) => Object.values(def.parts).map((p) => {
  const h = p.art ? p.art.rows.length : Math.max(1, Math.round(p.h)), top0 = p.y - h / 2, cut = ice > 0 ? -ice * ((def.height || 24) + 2) : Infinity;
  return Array.from({ length: h }, (_, y) => (top0 + y + 1 > cut ? 1 : 0)).join('');
}).join('|');
let same = true, bad = '', raw = 0, snapped = 0;
for (const def of defs) {
  const seenRaw = new Set(), seenSnap = new Set();
  for (let i = 0; i <= 1000; i++) {
    const ice = i / 1000;
    if (iced(def, ice) !== iced(def, snapIce(ice, def.height || 24))) { same = false; bad = `${def.name} ${ice}`; }
    seenRaw.add(Math.round(ice * 100)); seenSnap.add(Math.round(snapIce(ice, def.height || 24) * 100));
  }
  raw += seenRaw.size; snapped += seenSnap.size;
}
ok('snapped ice turns exactly the same pixels to ice for every hero, enemy and minion', same, bad);
ok('...and makes far fewer cached looks per character', snapped < raw / 1.5, `${snapped} vs ${raw}`);
ok('no ice stays no ice; full ice stays full', snapIce(0) === 0 && snapIce(-1) === 0 && snapIce(1, 24) > 0.999999);
