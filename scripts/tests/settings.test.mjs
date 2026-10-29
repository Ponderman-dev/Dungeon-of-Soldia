// Settings screen logic (src/systems/settings.js, src/data/settings.json) and DELETE SAVE (progress.js).
import fs from 'fs';
import { readSettings, changeSetting, stepSetting, cardOf } from '../../src/systems/settings.js';
import { emptyProgress, loadProgress, saveProgress, deleteProgress, SAVE_KEY } from '../../src/systems/progress.js';
const defs = JSON.parse(fs.readFileSync(new URL('../../src/data/settings.json', import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const memory = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, raw: m }; };

ok('every default has a card that shows it', Object.keys(defs.defaults).every((id) => cardOf(defs, id)));
ok('every default is one of its own choices', Object.entries(defs.defaults).every(([id, v]) => {
  const c = cardOf(defs, id);
  return c.type === 'bar' ? v >= 0 && v <= c.max : c.options.some((o) => o.value === v);
}));
{ const p = emptyProgress();
  ok('a new player gets the defaults', JSON.stringify(readSettings(p, defs)) === JSON.stringify(defs.defaults));
  ok('battle speed can be set to a listed choice', changeSetting(p, defs, 'battleSpeed', 2) && readSettings(p, defs).battleSpeed === 2);
  ok('...but not to a value that is not a choice', !changeSetting(p, defs, 'battleSpeed', 5) && readSettings(p, defs).battleSpeed === 2);
  ok('the old sound mute is kept next to the settings', p.settings.muted === false); }
{ const p = emptyProgress(), max = cardOf(defs, 'effects').max;
  for (let i = 0; i < max + 5; i++) stepSetting(p, defs, 'effects', 1);
  ok('a bar never goes over its max', readSettings(p, defs).effects === max);
  for (let i = 0; i < max + 5; i++) stepSetting(p, defs, 'effects', -1);
  ok('...nor under 0', readSettings(p, defs).effects === 0);
  ok('a choice setting cannot be stepped', !stepSetting(p, defs, 'shake', 1)); }
{ const p = emptyProgress(); p.settings.shake = 'maybe'; p.settings.music = 99;
  ok('a broken saved value falls back to the default', readSettings(p, defs).shake === defs.defaults.shake && readSettings(p, defs).music === defs.defaults.music); }
{ const s = memory(), p = emptyProgress();
  changeSetting(p, defs, 'damageNumbers', false); saveProgress(p, s);
  ok('settings survive a save and load', readSettings(loadProgress(s), defs).damageNumbers === false);
  ok('DELETE SAVE wipes the save', deleteProgress(s) && !(SAVE_KEY in s.raw) && JSON.stringify(loadProgress(s)) === JSON.stringify(emptyProgress())); }
