// Base camp pixel art (systems/campArt.js, camp.json): the open floor has no wall left, the firelight is clear near the
// fire and dark far away, prop rows are all one width, flame frames share one size, the hub's heroes and menu buttons fit the screen.
import fs from 'fs';
import { openFloor, darkLayer, lightTint, fireLayers, propLayer } from '../../src/systems/campArt.js';
const camp = JSON.parse(fs.readFileSync(new URL('../../src/data/camp.json', import.meta.url)));
const floorArt = JSON.parse(fs.readFileSync(new URL('../../src/data/floorArt.json', import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const width = 130, height = 282;
const f = openFloor(floorArt, camp, { width, height, tint: '0x6a5a8a' });
ok('open floor: right size, every pixel drawn', f.pixels.length === width * height && f.pixels.every((c) => c >= 0));
const D = darkLayer(camp, { width, height }), L = camp.light;
const a = (x, y) => D.alpha[y * width + x];
ok('dark layer: clear at the fire, dark in the corners', a(L.x, L.y) < 0.05 && a(0, 0) > 0.2 && a(0, 0) <= 1);
const lum = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
ok('props are lit brighter near the fire', lum(lightTint(camp, L.x * camp.pixel, L.y * camp.pixel)) > lum(lightTint(camp, 0, 0)));
for (const [name, def] of Object.entries(camp.props)) {
  ok(`prop ${name}: rows all one width`, def.rows.every((r) => r.length === def.rows[0].length));
  ok(`prop ${name}: colours exist`, [...def.rows.join('')].every((ch) => ch === '.' || def.palette[Number(ch)]));
}
ok('every placed prop exists', camp.place.every(([name]) => camp.props[name]));
const F = fireLayers(camp);
ok('fire: 2+ flame frames, all one size', F.flames.length >= 2 && F.flames.every((fl) => fl.w === F.flames[0].w && fl.h === F.flames[0].h));
ok('fire: glow alpha between 0 and 1', [...F.glow.alpha].every((v) => v >= 0 && v <= 1));
ok('flip mirrors a prop', propLayer(camp.props.tent, true).pixels[0] === propLayer(camp.props.tent).pixels[propLayer(camp.props.tent).w - 1]);
ok('3 hero spots round the fire, on screen', camp.hero.spots.length === 3 && camp.hero.spots.every(([x, y]) => x > 0 && x < 390 && y > 0 && y < camp.ui.expedition.y));
const M = camp.ui.menu;
ok('menu: 4 buttons, different names, inside the screen', M.buttons.length === 4 && new Set(M.buttons.map((b) => b.label)).size === 4 && M.y + M.h <= 844);
for (const b of M.buttons) {
  ok(`menu icon ${b.id}: rows all one width`, b.icon.rows.every((r) => r.length === b.icon.rows[0].length));
  ok(`menu icon ${b.id}: colours exist`, [...b.icon.rows.join('')].every((ch) => ch === '.' || b.icon.palette[Number(ch)]));
}
for (const n of camp.npcs) {
  const parts = Object.entries(n.def.parts);
  ok(`npc ${n.id}: every part's rows match its size`, parts.every(([, p]) => p.art.rows.length === p.h && p.art.rows.every((r) => r.length === p.w)));
  ok(`npc ${n.id}: colours exist`, parts.every(([, p]) => [...p.art.rows.join('')].every((ch) => ch === '.' || p.art.palette[Number(ch)])));
}
ok('4 NPCs with different names', camp.npcs.length === 4 && new Set(camp.npcs.map((n) => n.name)).size === 4);
