// Shop (look only): stand-in looks (systems/looks.js) and daily deals; shop.json.
import fs from 'fs';
import { recolor, lookDef, dailyDeals, localDay } from '../../src/systems/looks.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const S = r('shop.json'), heroes = r('heroes.json');
ok('every look is for a real hero and has a price', S.looks.every((l) => heroes.find((h) => h.id === l.hero) && l.price > 0));
ok('look ids are unique', new Set(S.looks.map((l) => l.id)).size === S.looks.length);
const look = S.looks[0], knight = heroes.find((h) => h.id === look.hero), dressed = lookDef(knight, look);
ok('a look changes some colours of the sprite', JSON.stringify(dressed.parts) !== JSON.stringify(knight.parts));
ok('...but never the shape (same rows)', Object.keys(knight.parts).every((n) => !knight.parts[n].art || JSON.stringify(knight.parts[n].art.rows) === JSON.stringify(dressed.parts[n].art.rows)));
ok('...and never the hero itself (stats, skills)', dressed.stats === knight.stats && dressed.skills === knight.skills);
ok('outlines (near black) are never recoloured', recolor(0x1a1020, look) === 0x1a1020);
ok('no look = the hero as is', lookDef(knight, null) === knight);
{ const a = dailyDeals(S.looks, S.deals, 20000), b = dailyDeals(S.looks, S.deals, 20000), c = dailyDeals(S.looks, S.deals, 20001);
  ok('deals: the same all day', JSON.stringify(a) === JSON.stringify(b));
  ok('deals: 3 different looks, cheaper than normal', a.length === S.deals.count && new Set(a.map((d) => d.look.id)).size === a.length && a.every((d) => d.price < d.look.price));
  ok('deals: change the next day', JSON.stringify(a.map((d) => d.look.id)) !== JSON.stringify(c.map((d) => d.look.id)) || JSON.stringify(a) !== JSON.stringify(c)); }
ok('local day is a whole number', Number.isInteger(localDay()));
