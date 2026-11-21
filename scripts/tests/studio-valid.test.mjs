// Studio store rows are untrusted (src/studio/validDesign.js): every real game look and every built-in clip passes,
// bad shapes (wrong types, HTML in part names, '__proto__' groups, huge pictures) are skipped.
import fs from 'node:fs';
import { validLook, validDesign, validEffect } from '../../src/studio/validDesign.js';
import { CLIPS, defaultClip } from '../../src/systems/animClips.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const looks = [...r('heroes.json'), ...Object.values(r('enemies.json')), ...Object.values(r('minions.json'))].filter((d) => d.parts);
const asLook = (d) => ({ height: d.height, parts: d.parts, ...(d.flying ? { hover: d.hover || 0 } : {}) });
const badLooks = looks.filter((d) => !validLook(asLook(d)));
ok('every hero, enemy and minion look in the game passes', looks.length > 50 && !badLooks.length, badLooks.map((d) => d.id || d.name).join());
const icons = Object.values(r('itemIcons.json')).map((art) => ({ height: 16, parts: { icon: { x: 0, y: -8, w: 16, h: 16, art, anchor: [8, 8] } } }));
ok('every item icon passes', icons.every(validLook));
const clipIds = CLIPS.map((c) => c.id);
const withClips = looks.map((d) => ({ ...asLook(d), anims: Object.fromEntries(clipIds.map((id) => [id, defaultClip(id, d.parts)])) }));
ok('every look with every built-in clip passes', withClips.every(validLook), withClips.filter((l) => !validLook(l)).length);
const good = { kind: 'hero', id: 'knight', ...asLook(looks[0]) };
ok('a real saved design passes', validDesign(good));
const bad = {
  'not an object': 'x', 'parts missing': { ...good, parts: null }, 'parts a list': { ...good, parts: [] }, 'unknown kind': { ...good, kind: 'boss' },
  'html in a part name': { ...good, parts: { '<img src=x onerror=alert(1)>': good.parts[Object.keys(good.parts)[0]] } },
  'part with text x': { ...good, parts: { body: { ...good.parts[Object.keys(good.parts)[0]], x: '5' } } },
  'rows not strings': { ...good, parts: { body: { x: 0, y: 0, art: { palette: [1], rows: [5] } } } },
  'huge picture': { ...good, parts: { body: { x: 0, y: 0, art: { palette: [1], rows: Array(500).fill('0') } } } },
  'bad clip': { ...good, anims: { idle: { length: 400, tracks: { body: { x: [{ t: 'a', v: 1 }] } } } } },
  'height NaN': { ...good, height: NaN },
};
for (const [name, d] of Object.entries(bad)) ok(`a design with ${name} is skipped`, !validDesign(d));
ok('a normal effect row passes', validEffect({ group: 'hit', name: 'slash', speed: 1.5, colors: { '0xff0000': '0x00ff00' } }));
ok('effect rows with a __proto__ group, a bad speed or bad colours are skipped', !validEffect({ group: '__proto__', name: 'x' }) && !validEffect({ group: 'a', name: 'b', speed: 'fast' }) && !validEffect({ group: 'a', name: 'b', colors: { x: '<b>' } }));
