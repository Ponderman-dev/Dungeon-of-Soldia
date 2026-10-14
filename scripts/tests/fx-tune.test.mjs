// Effect settings from the Studio (data/effects.json, systems/fxTune.js): speed and colour swaps per effect.
import fs from 'fs';
import { makeTuner } from '../../src/systems/fxTune.js';
import { statusLook, LOOPING } from '../../src/systems/statusFx.js';
import { HIT_TYPES, MOMENT_MS } from '../../src/systems/hitFx.js';
import { ITEM_FX } from '../../src/systems/itemFx.js';
import { CAST_FX, SHOT_FX } from '../../src/systems/skillFx.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const data = r('effects.json');
const known = {
  status: LOOPING, hit: [...HIT_TYPES, 'crit', ...Object.keys(MOMENT_MS)],
  shot: ['ranged', 'fire', 'ice', 'electric', 'dark', 'holy', ...SHOT_FX], item: [...ITEM_FX, 'tornado'], skill: CAST_FX,
};
const bad = [];
for (const [g, list] of Object.entries(data)) {
  if (g.startsWith('_')) continue;
  if (!known[g]) { bad.push('group ' + g); continue; }
  for (const [n, e] of Object.entries(list)) {
    if (!known[g].includes(n)) bad.push(`${g}.${n}`);
    if (!(e.speed > 0)) bad.push(`${g}.${n} speed`);
    for (const [a, b] of Object.entries(e.colors || {})) if (!/^0x[0-9a-f]{6}$/i.test(a) || !/^0x[0-9a-f]{6}$/i.test(b)) bad.push(`${g}.${n} colour ${a}`);
  }
}
ok('effects.json only names real effects with good values', bad.length === 0, bad.join());
const t = makeTuner({ hit: { fire: { speed: 2, colors: { '0xff9a2e': '0x3d9aff' } } }, status: { burn: { speed: 0.5, colors: { '0xff9a2e': '0x00ff00' } } } });
ok('speed shortens or lengthens an effect', t.ms('hit', 'fire', 400) === 200 && t.ms('hit', 'ice', 400) === 400 && t.speed('status', 'burn') === 0.5);
const d = [[1, 2, 1, 1, 0xff9a2e, 1], [3, 4, 1, 1, 0xffffff, 0.5]];
const p = t.paint('hit', 'fire', d);
ok('colours are swapped, others kept', p[0][4] === 0x3d9aff && p[1][4] === 0xffffff && p[0][0] === 1 && d[0][4] === 0xff9a2e);
ok('an effect without settings is untouched', t.paint('hit', 'melee', d) === d && t.color('hit', 'melee', 5) === 5);
const u = { cx: 0, hw: 6, top: -22, mid: -11, bot: 0 };
const plain = statusLook({ burn: { stacks: 1, age: 0 } }, u, 1000);
const tuned = statusLook({ burn: { stacks: 1, age: 0 } }, u, 1000, t);
ok('status effects use their settings (colour and tint)', tuned.draws.every((x) => x[4] !== 0xff9a2e) && plain.draws.some((x) => x[4] === 0xff9a2e) && tuned.tint[0] === 0x00ff00);
ok('a bad speed falls back to normal', makeTuner({ hit: { fire: { speed: 0 } } }).speed('hit', 'fire') === 1);
