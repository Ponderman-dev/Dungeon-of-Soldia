// Glossary memory (systems/glossary.js) and data (glossary.json).
import fs from 'fs';
import { newSeenBuffer, noteEvents, mergeSeen } from '../../src/systems/glossary.js';
import { emptyProgress, saveProgress, loadProgress } from '../../src/systems/progress.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const G = r('glossary.json'), statuses = r('statuses.json'), enemies = r('enemies.json');
ok('every glossary status is a real status with a tab', Object.entries(G.statuses).every(([id, s]) => statuses[id] && ['bad', 'good', 'control'].includes(s.tab)), Object.keys(G.statuses).filter((id) => !statuses[id]).join());
ok('every hidden enemy is a real enemy', G.hiddenEnemies.every((id) => enemies[id]));
ok('basics pages all have a title and text', G.basics.every((b) => b.title && b.text));
{ const buf = newSeenBuffer(), gob = { side: 'enemy', def: { id: 'goblin' } }, bat = { side: 'enemy', def: { id: 'bat' } }, hero = { side: 'hero', def: { id: 'knight' }, items: ['heart_charm'] };
  noteEvents(buf, [
    { type: 'death', unit: gob }, { type: 'death', unit: gob }, { type: 'death', unit: { side: 'enemy', def: { id: 'phylactery' } }, vanish: true },
    { type: 'status', unit: gob, change: 'apply', status: { type: 'burn' } }, { type: 'status', unit: gob, change: 'expire', status: { type: 'stun' } },
  ]);
  const p = emptyProgress();
  mergeSeen(p, buf, { enemies: [gob, bat], heroes: [hero] });
  ok('beaten enemies are counted, vanished ones are not', p.seen.beaten.goblin === 2 && !p.seen.beaten.phylactery);
  ok('enemies on the floor count as met', p.seen.met.includes('bat') && p.seen.met.includes('goblin'));
  ok('only APPLIED statuses are learned', p.seen.statuses.join() === 'burn');
  ok('held items are found', p.seen.items.join() === 'heart_charm');
  ok('the buffer is emptied after a merge', buf.met.size === 0 && Object.keys(buf.beaten).length === 0);
  noteEvents(buf, [{ type: 'death', unit: gob }]);
  mergeSeen(p, buf);
  ok('a second merge adds up, no duplicates', p.seen.beaten.goblin === 3 && p.seen.met.filter((id) => id === 'goblin').length === 1);
  const store = (() => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; })();
  saveProgress(p, store);
  ok('the glossary memory survives a save and load', loadProgress(store).seen.beaten.goblin === 3); }
{ const tile = (id) => { const n = enemies[id].name.toUpperCase(); return G.shortNames[id] || (n.length <= 9 ? n : n.split(' ').pop()); };
  const bad = Object.keys(enemies).filter((id) => !id.startsWith('_') && !enemies[id].boss && !G.hiddenEnemies.includes(id) && tile(id).length > 9);
  ok('every enemy tile name fits (9 letters)', bad.length === 0, bad.join()); }
// Leaders (look only): the sample players use real heroes, enemies and items.
{ const Ld = r('leaders.json'), items = r('items.json'), heroIds = r('heroes.json').map((h) => h.id);
  const all = [...Ld.week, ...Ld.allTime];
  ok('leaders: every sample squad is 3 real heroes', all.every((p) => p.heroes.length === 3 && p.heroes.every((id) => heroIds.includes(id))));
  ok('leaders: every "ended by" is a real enemy and every item a real item', all.every((p) => enemies[p.endedBy] && p.items.every((id) => items[id])), all.flatMap((p) => p.items.filter((id) => !items[id])).join());
  ok('leaders: each board is sorted by floor, best first', [Ld.week, Ld.allTime].every((b) => b.every((p, i) => !i || b[i - 1].floor >= p.floor))); }
