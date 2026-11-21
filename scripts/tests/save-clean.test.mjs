// A damaged or hand-edited save never crashes a screen: loadProgress / cleanProgress keep every field the right type
// (src/systems/progress.js). Session 51 bug hunt: a save with wrong types crashed the Squad, Profile and Glossary pages.
import { emptyProgress, loadProgress, cleanProgress, saveProgress, recordRun, SAVE_KEY } from '../../src/systems/progress.js';
import { mergeSeen, newSeenBuffer } from '../../src/systems/glossary.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const store = (raw) => ({ getItem: (k) => (k === SAVE_KEY ? raw : null), setItem() {} });
const shapeOk = (p) => {
  const f = emptyProgress();
  const arrays = [p.achievements, p.looks, p.seenUnlocked, p.stats.bossIds, p.seen.met, p.seen.statuses, p.seen.items];
  return Object.keys(f.stats).every((k) => typeof p.stats[k] === typeof f.stats[k]) && Object.values(p.stats).every((v) => typeof v !== 'number' || (Number.isFinite(v) && v >= 0))
    && arrays.every((a) => Array.isArray(a) && a.every((x) => typeof x === 'string')) && Number.isFinite(p.gems) && p.gems >= 0
    && typeof p.profile === 'object' && Object.values(p.profile).every((v) => typeof v === 'string') && typeof p.settings.muted === 'boolean'
    && (p.lastSquad === null || (Array.isArray(p.lastSquad) && p.lastSquad.length <= 3)) && typeof p.unlockAll === 'boolean'
    && Object.values(p.seen.beaten).every(Number.isFinite) && Object.values(p.stats.heroRuns).every(Number.isFinite);
};
const bad = {
  notJson: 'not json{', null: 'null', number: '42', array: '[]', string: '"hi"',
  wrongTypes: JSON.stringify({ stats: 'x', seen: 'x', settings: 5, profile: 'abc', achievements: 'x', looks: 'x', gems: 'lots', lastSquad: 'x', seenUnlocked: 5, unlockAll: 'yes' }),
  wrongInner: JSON.stringify({ stats: { bestFloor: 'abc', runs: null, totalKills: {}, heroRuns: 5, heroRecords: { knight: 'x', rogue: { kills: 'many' } }, bossIds: 'x', playMs: -3 },
    seen: { met: 'x', beaten: 3, statuses: null, items: {} }, settings: { muted: 'yes' }, profile: { name: { a: 1 }, hero: 5 }, achievements: [1, null, 'x'], looks: [null, 5] }),
  huge: JSON.stringify({ gems: 1e308, stats: { bestFloor: 1e300, totalKills: -5 }, lastSquad: ['knight', 'rogue', 'archer', 'mage', 'cleric'] }),
};
for (const [name, raw] of Object.entries(bad)) {
  let p, err = null;
  try { p = loadProgress(store(raw)); recordRun(p, { floor: 5, kills: 3, heroes: ['knight'], heroStats: [{ id: 'rogue', kills: 2 }] }); mergeSeen(p, newSeenBuffer()); } catch (e) { err = e; }
  ok(`a ${name} save loads into a clean shape and a run can be recorded on it`, !err && shapeOk(p), err ? err.message : '');
}
{ const p = cleanProgress(JSON.parse(bad.huge));
  ok('huge numbers are capped and negative ones become 0', p.gems <= 1e12 && p.stats.bestFloor <= 1e12 && p.stats.totalKills === 0);
  ok('the last squad keeps at most 3 heroes', p.lastSquad.length === 3); }
{ const p = emptyProgress();
  recordRun(p, { floor: 12, kills: 40, bosses: ['grukk'], heroes: ['knight', 'rogue', 'archer'], heroStats: [{ id: 'knight', kills: 10, damage: 500 }] });
  p.gems = 7; p.looks = ['a']; p.profile = { name: 'Zed', hero: 'rogue', banner: 'night' }; p.achievements = ['floor_10']; p.lastSquad = ['knight', 'rogue', 'archer'];
  p.seen.beaten.goblin = 4; p.settings.battleSpeed = 2; p.settings.muted = true; p.unlockAll = true; p.seenUnlocked = ['mage'];
  const m = {}; saveProgress(p, { setItem: (k, v) => { m[k] = v; } });
  const back = loadProgress({ getItem: (k) => m[k] });
  ok('a good save comes back exactly the same', JSON.stringify(back) === JSON.stringify(p), JSON.stringify(back).slice(0, 200)); }
