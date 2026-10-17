// Long review run (phase H): every 3-hero squad plays whole runs like the balance bot and we collect where
// runs end, boss win rates, fight lengths, stuck fights, hero/item strength and how slow the rules are.
// Usage: node scripts/tests/review.mjs [runsPerSquad=5] [squads=all|a,b,c]
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit } from '../../src/systems/books.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json'), bookData = r('skillBooks.json');
const N = Number(process.argv[2] || 5), MAX = 170, STEP = 50, TIMEOUT = 300000;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ids = all.map((h) => h.id);
let squads = [];
if (process.argv[3] && process.argv[3] !== 'all') squads = [process.argv[3].split(',')];
else for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) squads.push([ids[a], ids[b], ids[c]]);

function useBook(s, book) {
  const page = pick(rollBookPages(bookData, book));
  const spots = [];
  for (const h of s.heroes) h.skills.forEach((_, i) => { const fit = pageFit(h, i, page, rules.books); if (fit === 'ok' || fit === 'replace') spots.push([h, i, fit]); });
  if (!spots.length) return;
  const [h, i, fit] = pick(spots);
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  const res = s.addPage(h.uid, i, page, fit === 'replace' ? Math.floor(Math.random() * mods.length) : null);
  if (res.ok) stats.pages[page.id] = (stats.pages[page.id] || 0) + 1;
}
const stats = { end: {}, fightSec: {}, fightN: {}, timeouts: [], bossTry: {}, bossWin: {}, heroFloors: {}, heroRuns: {}, itemFloors: {}, itemRuns: {}, pages: {}, killers: {}, updMs: 0, upd: 0, slowest: 0, maxEvents: 0, errors: [] };
function playRun(sq) {
  const heroDefs = sq.map((id) => all.find((h) => h.id === id));
  const s = new BattleState({ heroDefs, enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling });
  const owned = new Set();
  let floor = 1;
  for (; floor <= MAX; floor++) {
    const line = enemiesForFloor(dungeon, floor, Math.random, (s.director ||= {}), enemyDefs);
    s.spawnEnemies(line, floor); s.placeLines(); s.startFloor();
    const boss = dungeon.bosses && dungeon.bosses[floor];
    if (boss) stats.bossTry[floor] = (stats.bossTry[floor] || 0) + 1;
    let t = 0;
    while (!s.allEnemiesDead() && !s.allHeroesDead() && t < TIMEOUT) {
      const t0 = performance.now();
      let ev;
      try { ev = s.update(STEP); } catch (err) { stats.errors.push(`${sq} f${floor}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); return { floor, owned }; }
      const dt = performance.now() - t0;
      stats.updMs += dt; stats.upd++; if (dt > stats.slowest) stats.slowest = dt;
      if (ev && ev.length > stats.maxEvents) stats.maxEvents = ev.length;
      t += STEP;
      const obj = !s.focusUnit && s.enemies.find((e) => e.alive && e.def.object && !s.untargetable(e));
      if (obj) s.setFocus(obj.uid);
      for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
    }
    const b = Math.floor((floor - 1) / 10) * 10 + 1;
    stats.fightSec[b] = (stats.fightSec[b] || 0) + t / 1000; stats.fightN[b] = (stats.fightN[b] || 0) + 1;
    if (t >= TIMEOUT) { stats.timeouts.push(`${sq} f${floor}: ${s.enemies.filter((e) => e.alive).map((e) => e.def.id + ':' + Math.round(e.hp)).join(' ')}`); break; }
    if (s.allHeroesDead()) { const k = boss ? 'BOSS ' + boss[0] : line.join('+'); stats.killers[k] = (stats.killers[k] || 0) + 1; break; }
    if (boss) stats.bossWin[floor] = (stats.bossWin[floor] || 0) + 1;
    s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
    let choices = rollChoices({ itemDefs, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance, offered: (s.offeredOnce = s.offeredOnce || new Set()), bump: s.floorHadElite ? rules.elites.rewardBump : 0 });
    choices = maybeAddBook(choices, bookData, s.heroes, bookData.bookChancePerScreen);
    if (boss) useBook(s, 'golden');
    if (choices.length) {
      const item = pick(choices);
      if (item.kind === 'potion') s.healHeroes(item.healPercent);
      else if (item.kind === 'book') useBook(s, item.book);
      else { const tg = s.heroes.filter((h) => h.alive && canReceive(h, item)); if (tg.length) { s.giveItem(pick(tg).uid, item.id); if (floor <= 15) owned.add(item.id); } }
    }
  }
  return { floor, owned };
}
const T0 = Date.now();
const squadRes = [];
for (const sq of squads) {
  const f = [];
  for (let i = 0; i < N; i++) {
    const { floor, owned } = playRun(sq);
    f.push(floor);
    stats.end[floor] = (stats.end[floor] || 0) + 1;
    for (const id of sq) { stats.heroFloors[id] = (stats.heroFloors[id] || 0) + floor; stats.heroRuns[id] = (stats.heroRuns[id] || 0) + 1; }
    for (const id of owned) { stats.itemFloors[id] = (stats.itemFloors[id] || 0) + floor; stats.itemRuns[id] = (stats.itemRuns[id] || 0) + 1; }
  }
  squadRes.push([sq.join('/'), f.reduce((a, b) => a + b) / N]);
}
const allF = Object.entries(stats.end).flatMap(([k, n]) => Array(n).fill(+k)).sort((a, b) => a - b);
const mean = allF.reduce((a, b) => a + b) / allF.length;
console.log(`runs ${allF.length}, squads ${squads.length}, ${((Date.now() - T0) / 1000).toFixed(0)}s`);
console.log('floor reached: mean', mean.toFixed(1), 'p10', allF[Math.floor(allF.length * 0.1)], 'median', allF[allF.length >> 1], 'p90', allF[Math.floor(allF.length * 0.9)], 'max', allF[allF.length - 1]);
const buckets = {}; for (const f of allF) { const k = Math.floor((f - 1) / 10) * 10 + 1; buckets[k] = (buckets[k] || 0) + 1; }
console.log('runs ending per 10 floors:', Object.entries(buckets).map(([k, n]) => `${k}-${+k + 9}:${n}`).join('  '));
console.log('avg fight seconds per 10 floors:', Object.keys(stats.fightSec).map((k) => `${k}:${(stats.fightSec[k] / stats.fightN[k]).toFixed(1)}s`).join('  '));
console.log('bosses (won/tried):', Object.keys(stats.bossTry).map((k) => `${k}: ${stats.bossWin[k] || 0}/${stats.bossTry[k]}`).join('  '));
console.log('top killers:', Object.entries(stats.killers).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(', '));
console.log('hero avg floor (squads with them):', Object.keys(stats.heroRuns).map((id) => [id, stats.heroFloors[id] / stats.heroRuns[id]]).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${id} ${v.toFixed(1)}`).join(', '));
const items = Object.keys(stats.itemRuns).filter((id) => stats.itemRuns[id] >= 20).map((id) => [id, stats.itemFloors[id] / stats.itemRuns[id], stats.itemRuns[id]]).sort((a, b) => b[1] - a[1]);
console.log('items picked by floor 15 -> avg floor (best):', items.slice(0, 10).map(([id, v, n]) => `${id} ${v.toFixed(1)}(${n})`).join(', '));
console.log('items (worst):', items.slice(-10).map(([id, v, n]) => `${id} ${v.toFixed(1)}(${n})`).join(', '));
console.log('best squads:', squadRes.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, v]) => `${s} ${v.toFixed(1)}`).join(', '));
console.log('worst squads:', squadRes.slice(-6).map(([s, v]) => `${s} ${v.toFixed(1)}`).join(', '));
console.log('pages used:', Object.entries(stats.pages).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
console.log(`rules speed: ${(stats.updMs / stats.upd * 1000).toFixed(0)}us per 50ms step avg, slowest ${stats.slowest.toFixed(1)}ms, most events in one step ${stats.maxEvents}`);
console.log('timeouts (stuck fights):', stats.timeouts.length, stats.timeouts.slice(0, 8));
console.log('errors:', stats.errors.length, [...new Set(stats.errors)].slice(0, 8));
