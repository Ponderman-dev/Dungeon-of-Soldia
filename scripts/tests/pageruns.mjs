// RANK EVERY SKILL BOOK PAGE in full runs (session 46, user: 'evaluate these skills'). Like rankitems.mjs: the bot plays
// whole runs (random rewards, skill books, taps objects, casts skills) with the SAME dice with and without the page, so
// the only difference is the page. A normal page starts on the ATTACK skill of ALL 3 heroes (a clear signal, like the
// item ranking's 3 copies); a hero page starts on its own hero's named skill, in the squads that have that hero.
// Score = floors gained over the same runs without the page (mean), and how often the page run went deeper.
// Usage: node scripts/tests/pageruns.mjs [runsPerSquad=16] [ids comma list]   (uses every CPU core; prints a ranked table)
import fs from 'fs';
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit, pageOf } from '../../src/systems/books.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json'), bookData = r('skillBooks.json');
const SQUADS = [['knight', 'rogue', 'archer'], ['knight', 'mage', 'cleric'], ['berserker', 'samurai', 'bard'], ['samurai', 'necromancer', 'alchemist'], ['berserker', 'archer', 'necromancer'], ['knight', 'alchemist', 'mage']];
const MAX = 170, STEP = 50, TIMEOUT = 300000;
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function useBook(s, book) {
  const page = pick(rollBookPages(bookData, book, Math.random, s.heroes.filter((h) => h.alive).map((h) => h.def.id)));
  const spots = [];
  for (const h of s.heroes) h.skills.forEach((_, i) => { const fit = pageFit(h, i, page, rules.books); if (fit === 'ok' || fit === 'replace' || fit === 'swap') spots.push([h, i, fit]); });
  if (!spots.length) return;
  const [h, i, fit] = pick(spots);
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  s.addPage(h.uid, i, page, fit === 'replace' ? Math.floor(Math.random() * mods.length) : null);
}

// One run; `pageId` (or null) starts on the attack skill of every hero it fits (a support-only page: the support
// skill; a hero page: its own named skill, which may be a support skill).
function playRun(sq, pageId) {
  const s = new BattleState({ heroDefs: sq.map((id) => all.find((h) => h.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling, rng: Math.random });
  if (pageId) {
    const page = pageOf(bookData, pageId);
    const want = page.hero ? null : page.onlyKind || 'attack';
    for (const h of s.heroes) h.skills.forEach((slot, i) => { if ((!want || slot.kind === want) && pageFit(h, i, page, rules.books) === 'ok') s.addPage(h.uid, i, page); });
  }
  for (const h of s.heroes) h.hp = h.maxHp;
  let floor = 1;
  for (; floor <= MAX; floor++) {
    s.spawnEnemies(enemiesForFloor(dungeon, floor), floor); s.placeLines(); s.startFloor();
    const boss = dungeon.bosses && dungeon.bosses[floor];
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < TIMEOUT) {
      s.update(STEP); t += STEP;
      const obj = !s.focusUnit && s.enemies.find((e) => e.alive && e.def.object && !s.untargetable(e));
      if (obj) s.setFocus(obj.uid);
      for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
    }
    if (t >= TIMEOUT || s.allHeroesDead()) break;
    s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
    let choices = rollChoices({ itemDefs, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance, offered: (s.offeredOnce = s.offeredOnce || new Set()) });
    choices = maybeAddBook(choices, bookData, s.heroes, bookData.bookChancePerScreen);
    if (boss) useBook(s, 'golden');
    if (choices.length) {
      const item = pick(choices);
      if (item.kind === 'potion') s.healHeroes(item.healPercent);
      else if (item.kind === 'book') useBook(s, item.book);
      else { const tg = s.heroes.filter((h) => h.alive && canReceive(h, item)); if (tg.length) s.giveItem(pick(tg).uid, item.id); }
    }
  }
  return floor;
}

// The squads a page is tested in (a hero page: only squads with its hero).
const squadsFor = (id) => SQUADS.map((sq, si) => [sq, si]).filter(([sq]) => !bookData.pages[id].hero || sq.includes(bookData.pages[id].hero));

if (!isMainThread) {
  // a worker: plays the jobs it is given ({ id (page or null), si, i }) and sends back the floors
  for (const job of workerData.jobs) {
    Math.random = seeded(1000 * job.si + job.i + 1);
    parentPort.postMessage({ ...job, floor: playRun(SQUADS[job.si], job.id) });
  }
} else {
  const N = Number(process.argv[2] || 16);
  const ids = process.argv[3] ? process.argv[3].split(',') : Object.keys(bookData.pages);
  const runsOf = (id) => (bookData.pages[id].hero ? 3 * N : N); // a hero page is in fewer squads: 3x the runs there
  const jobs = [], baseRuns = Array(SQUADS.length).fill(N);
  for (const id of ids) for (const [, si] of squadsFor(id)) { baseRuns[si] = Math.max(baseRuns[si], runsOf(id)); for (let i = 0; i < runsOf(id); i++) jobs.push({ id, si, i }); }
  for (let si = 0; si < SQUADS.length; si++) for (let i = 0; i < baseRuns[si]; i++) jobs.push({ id: null, si, i });
  const cores = os.cpus().length, T0 = Date.now();
  const res = new Map(); // `${id}|${si}|${i}` -> floor
  let done = 0;
  await Promise.all(Array.from({ length: cores }, (_, w) => new Promise((ok, fail) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { jobs: jobs.filter((_, k) => k % cores === w) } });
    wk.on('message', (m) => { res.set(`${m.id}|${m.si}|${m.i}`, m.floor); if (++done % 200 === 0) process.stderr.write(`${done}/${jobs.length} runs, ${((Date.now() - T0) / 1000).toFixed(0)}s\n`); });
    wk.on('error', fail); wk.on('exit', ok);
  })));
  const rows = ids.map((id) => {
    const p = bookData.pages[id];
    const d = [];
    for (const [, si] of squadsFor(id)) for (let i = 0; i < runsOf(id); i++) d.push(res.get(`${id}|${si}|${i}`) - res.get(`null|${si}|${i}`));
    return { id, name: p.name, tier: p.kind === 'stat' ? 'stat' : p.tier, hero: p.hero || '', mean: d.reduce((a, b) => a + b, 0) / d.length, better: d.filter((x) => x > 0).length / d.length, worse: d.filter((x) => x < 0).length / d.length, n: d.length };
  }).sort((a, b) => b.mean - a.mean);
  const base = []; for (let si = 0; si < SQUADS.length; si++) for (let i = 0; i < N; i++) base.push(res.get(`null|${si}|${i}`));
  console.log(`baseline (no page): mean floor ${(base.reduce((a, b) => a + b, 0) / base.length).toFixed(1)}, ${base.length} runs. Page = on the attack skill of all 3 heroes (support-only page: support skill; hero page: its own hero's skill).`);
  console.log('rank  page               tier       floors+  deeper  shallower  runs');
  rows.forEach((x, k) => console.log(`${String(k + 1).padStart(3)}.  ${(x.name + (x.hero ? ` (${x.hero})` : '')).padEnd(26).slice(0, 26)} ${x.tier.padEnd(10)} ${(x.mean >= 0 ? '+' : '') + x.mean.toFixed(1).padStart(5)}  ${(x.better * 100).toFixed(0).padStart(4)}%  ${(x.worse * 100).toFixed(0).padStart(6)}%   ${x.n}`));
  const tiers = {}; for (const x of rows) (tiers[x.tier] = tiers[x.tier] || []).push(x.mean);
  console.log('tier averages:', Object.entries(tiers).map(([t, v]) => `${t} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(', '));
  console.log(`${((Date.now() - T0) / 1000).toFixed(0)}s on ${cores} cores`);
}
