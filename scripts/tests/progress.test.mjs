// Phase F: saved progress and hero unlocks (src/systems/progress.js, src/data/unlocks.json).
import fs from 'fs';
import { emptyProgress, loadProgress, saveProgress, recordRun, requirementProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad, SAVE_KEY } from '../../src/systems/progress.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const unlocks = r('unlocks.json'), heroDefs = r('heroes.json');
const memory = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, raw: m }; };

ok('every hero is either a starting hero or has a requirement', heroDefs.every((h) => unlocks.start.includes(h.id) || unlocks.requirements[h.id]));
ok('requirements use known types, each has a label and a stat name', Object.values(unlocks.requirements).every((q) => unlocks.labels[q.type] && unlocks.statNames[q.type] && q.value > 0));
ok('the heroes do NOT all use the same requirement type', new Set(Object.values(unlocks.requirements).map((q) => q.type)).size >= 3);

{ const p = emptyProgress();
  ok('a new player has only the 3 starting heroes', unlockedIds(heroDefs, p, unlocks).join() === 'knight,rogue,archer');
  ok('...nothing to show as NEW', newHeroes(heroDefs, p, unlocks).length === 0); }

{ const p = emptyProgress(); recordRun(p, { floor: 6, kills: 20 });
  ok('a run adds its results: runs, kills, floors CLEARED (floor - 1), best floor', p.stats.runs === 1 && p.stats.totalKills === 20 && p.stats.totalFloors === 5 && p.stats.bestFloor === 6);
  recordRun(p, { floor: 3, kills: 5 });
  ok('...best floor never goes down, the rest add up', p.stats.bestFloor === 6 && p.stats.runs === 2 && p.stats.totalKills === 25 && p.stats.totalFloors === 7);
  ok('reaching floor 5 unlocks the Berserker (best floor)', isUnlocked('berserker', p, unlocks) && !isUnlocked('cleric', p, unlocks)); }
{ const p = emptyProgress(); recordRun(p, { floor: 2, kills: 100 });
  ok('killing 100 enemies unlocks the Mage (total kills)', isUnlocked('mage', p, unlocks) && !isUnlocked('berserker', p, unlocks)); }
{ const p = emptyProgress(); for (let i = 0; i < 10; i++) recordRun(p, { floor: 1, kills: 0 });
  ok('playing 10 runs unlocks the Bard (runs)', isUnlocked('bard', p, unlocks)); }
{ const p = emptyProgress(); recordRun(p, { floor: 61, kills: 0 });
  ok('clearing 60 floors unlocks the Samurai (total floors)', isUnlocked('samurai', p, unlocks)); }

{ const p = emptyProgress(); p.unlockAll = true;
  ok('the toggle unlocks every hero', unlockedIds(heroDefs, p, unlocks).length === heroDefs.length);
  p.unlockAll = false; ok('...and switching it off locks them again', unlockedIds(heroDefs, p, unlocks).length === 3); }

{ const p = emptyProgress(); recordRun(p, { floor: 6, kills: 120 });
  ok('newly unlocked heroes are listed as NEW', newHeroes(heroDefs, p, unlocks).sort().join() === 'berserker,mage');
  p.seenUnlocked.push('berserker'); ok('...until they are seen', newHeroes(heroDefs, p, unlocks).join() === 'mage'); }

{ const p = emptyProgress(); recordRun(p, { floor: 9, kills: 0 }); const req = unlocks.requirements.cleric;
  ok('requirement text and progress', describeRequirement(req, unlocks) === 'Reach floor 15' && describeProgress(req, p, unlocks) === '9 / 15 best floor' && !requirementProgress(req, p).done); }

// ---- saving
{ const st = memory(); const p = emptyProgress(); recordRun(p, { floor: 7, kills: 33 }); p.unlockAll = true; p.seenUnlocked = ['berserker'];
  ok('saving works', saveProgress(p, st) && SAVE_KEY in st.raw);
  const back = loadProgress(st);
  ok('loading gives the same progress back', JSON.stringify(back) === JSON.stringify(p)); }
{ const st = memory(); ok('no save yet: a fresh start', JSON.stringify(loadProgress(st)) === JSON.stringify(emptyProgress())); }
{ const st = memory(); st.setItem(SAVE_KEY, '{not json');
  ok('a damaged save does not crash: fresh start', JSON.stringify(loadProgress(st)) === JSON.stringify(emptyProgress())); }
{ const st = memory(); st.setItem(SAVE_KEY, JSON.stringify({ version: 1, stats: { bestFloor: 12 } }));
  const p = loadProgress(st); ok('an old/partial save is filled in with defaults', p.stats.bestFloor === 12 && p.stats.runs === 0 && Array.isArray(p.seenUnlocked) && p.unlockAll === false); }
{ const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  ok('blocked storage never throws (load = fresh, save = false)', JSON.stringify(loadProgress(broken)) === JSON.stringify(emptyProgress()) && saveProgress(emptyProgress(), broken) === false);
  ok('no storage at all is fine too', saveProgress(emptyProgress(), null) === false && loadProgress(null).stats.runs === 0); }

// ---- random squad
{ const ids = ['a', 'b', 'c', 'd', 'e']; let allOk = true; const seen = new Set();
  for (let i = 0; i < 200; i++) { const sq = randomSquad(ids); seen.add(sq.join()); if (sq.length !== 3 || new Set(sq).size !== 3 || !sq.every((x) => ids.includes(x))) allOk = false; }
  ok('RANDOM picks 3 different heroes from the unlocked ones', allOk && seen.size > 10); }
ok('with only 2 unlocked, random gives 2 (no crash)', randomSquad(['a', 'b']).length === 2);
