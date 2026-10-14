// Status icons (statusIcons.json): one 7x7 icon per status, shown in rows of 3 with the stack count beside it.
import fs from 'fs';
import { iconList, iconLayout, entryWidth, ICON_PX } from '../../src/systems/statusIcons.js';
import { artPixels } from '../../src/systems/pixelArt.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const icons = r('statusIcons.json'), statuses = r('statuses.json');
const ids = Object.keys(icons).filter((k) => !k.startsWith('_'));
const shown = Object.keys(statuses).filter((k) => !k.startsWith('_') && !statuses[k].instant);
ok('every lasting status has an icon', shown.every((k) => icons[k]), shown.filter((k) => !icons[k]).join());
ok('every icon is 7x7 and not empty', ids.every((id) => icons[id].rows.length === 7 && icons[id].rows.every((row) => row.length === 7) && artPixels(icons[id]).flat().some((c) => c !== null)));
ok('every icon is in the display order', ids.every((id) => icons._order.includes(id)) && icons._order.every((id) => icons[id]));
// Order: control first, then damage over time, then debuffs; unknown kinds (knockback) are left out.
const list = iconList(icons, ['weaken', 'poison', 'knockback', 'stun', 'burn'], (k) => ({ poison: 8, burn: 3 }[k] || 1));
ok('icons sorted control > DoT > debuff, no icon = left out', list.map((e) => e.id).join() === 'stun,burn,poison,weaken', list.map((e) => e.id).join());
ok('stack counts are kept', list.find((e) => e.id === 'poison').n === 8);
ok('extra icons (Steady Aim) are added', iconList(icons, ['buff'], () => 1, ['steady']).map((e) => e.id).join() === 'steady,buff');
// Layout: rows of 3, going up for enemies; an icon with a stack number is wider.
const lay = iconLayout(list);
ok('rows of 3', lay.filter((e) => e.y === 0).length === 3 && lay.filter((e) => e.y === -ICON_PX).length === 1);
ok('rows go down for heroes', iconLayout(list, { dir: 1 })[3].y === ICON_PX);
ok('a stack number makes room', entryWidth(8) === ICON_PX + 4 && entryWidth(12) === ICON_PX + 8 && entryWidth(1) === ICON_PX);
const row = lay.filter((e) => e.y === 0);
const left = row[0].x - ICON_PX / 2, right = row[2].x - ICON_PX / 2 + entryWidth(row[2].n);
ok('each row is centred', Math.abs(left + right) < 1e-9, `${left} ${right}`);
ok('icons do not overlap', row[1].x - row[0].x >= entryWidth(row[0].n) - 1e-9);
