// Speech bubbles (systems/dialogue.js, data/dialogue.json): only living heroes speak, the speaker changes when it can,
// a hero says all its lines of a kind before one repeats, a missing kind falls back to 'clear', and the font can draw
// every line.
import fs from 'fs';
import { pickSpeech, clearKind } from '../../src/systems/dialogue.js';
const data = JSON.parse(fs.readFileSync(new URL('../../src/data/dialogue.json', import.meta.url)));
const heroDefs = JSON.parse(fs.readFileSync(new URL('../../src/data/heroes.json', import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const ids = (Array.isArray(heroDefs) ? heroDefs : Object.values(heroDefs)).map((h) => h.id);

ok('every hero has start and clear lines', ids.every((id) => data.heroes[id] && data.heroes[id].start.length && data.heroes[id].clear.length), ids.filter((id) => !data.heroes[id]).join(','));
const bad = /[$;@\\^_{|}~]/;
const all = Object.values(data.heroes).flatMap((s) => Object.values(s).flat());
ok('no line uses a character the font lacks', all.every((l) => !bad.test(l)), all.filter((l) => bad.test(l)).join(' / '));

const squad = (alive) => ['knight', 'mage', 'bard'].map((id, i) => ({ uid: i + 1, def: { id }, alive: alive[i] }));
const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const mem = {};
let same = 0, prev = null;
for (let i = 0; i < 40; i++) {
  const s = pickSpeech(data, squad([true, true, true]), 'clear', rng, mem);
  if (s.uid === prev) same++;
  prev = s.uid;
}
ok('the speaker changes each time when others are alive', same === 0, `${same} repeats`);

const only = squad([false, true, false]);
const m2 = {}, n = data.heroes.mage.clear.length, said = [];
for (let i = 0; i < n; i++) said.push(pickSpeech(data, only, 'clear', rng, m2));
ok('only a living hero speaks', said.every((s) => s.uid === 2));
ok('a hero says every line once before repeating', new Set(said.map((s) => s.text)).size === n);
ok('it starts over after the last line', data.heroes.mage.clear.includes(pickSpeech(data, only, 'clear', rng, m2).text));

ok('nobody alive: no bubble', pickSpeech(data, squad([false, false, false]), 'clear', rng, {}) === null);
const noBoss = { rules: data.rules, heroes: { knight: { clear: ['x'] } } };
ok('a missing kind uses the clear lines', pickSpeech(noBoss, [{ uid: 1, def: { id: 'knight' }, alive: true }], 'boss', rng, {}).text === 'x');
const never = { rules: { ...data.rules, chance: { clear: 0 } }, heroes: data.heroes };
ok('chance 0: no bubble', pickSpeech(never, squad([true, true, true]), 'clear', rng, {}) === null);
ok('kind: boss > fallen > clear', clearKind({ bossFloor: true, someoneFell: true }) === 'boss' && clearKind({ bossFloor: false, someoneFell: true }) === 'fallen' && clearKind({}) === 'clear');
