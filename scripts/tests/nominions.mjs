// Runs WITH vs WITHOUT summoning items (phase H): every 3-hero squad plays whole runs twice with the SAME dice,
// once normally and once with every 'minion' type item removed from the reward cards (the bot gets other items
// instead). Prints how deep runs get, boss wins, and the same split for squads with / without the Necromancer.
// Usage: node scripts/tests/nominions.mjs [runsPerSquad=3] [squads=all|a,b,c]
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit } from '../../src/systems/books.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json'), bookData = r('skillBooks.json');
const noMinionDefs = Object.fromEntries(Object.entries(itemDefs).filter(([, it]) => it.type !== 'minion'));
const N = Number(process.argv[2] || 3), MAX = 170, STEP = 50, TIMEOUT = 300000;
const ids = all.map((h) => h.id);
let squads = [];
if (process.argv[3] && process.argv[3] !== 'all') squads = [process.argv[3].split(',')];
else for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) squads.push([ids[a], ids[b], ids[c]]);
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function useBook(s, book) {
  const page = pick(rollBookPages(bookData, book));
  const spots = [];
  for (const h of s.heroes) h.skills.forEach((_, i) => { const fit = pageFit(h, i, page, rules.books); if (fit === 'ok' || fit === 'replace') spots.push([h, i, fit]); });
  if (!spots.length) return;
  const [h, i, fit] = pick(spots);
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  s.addPage(h.uid, i, page, fit === 'replace' ? Math.floor(Math.random() * mods.length) : null);
}
function playRun(sq, pool) {
  const s = new BattleState({ heroDefs: sq.map((id) => all.find((h) => h.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling, rng: Math.random });
  let floor = 1, minionItems = 0;
  const bosses = {};
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
    if (boss) bosses[floor] = !(t >= TIMEOUT || s.allHeroesDead());
    if (t >= TIMEOUT || s.allHeroesDead()) break;
    s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
    let choices = rollChoices({ itemDefs: pool, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance, offered: (s.offeredOnce = s.offeredOnce || new Set()) });
    choices = maybeAddBook(choices, bookData, s.heroes, bookData.bookChancePerScreen);
    if (boss) useBook(s, 'golden');
    if (choices.length) {
      const item = pick(choices);
      if (item.kind === 'potion') s.healHeroes(item.healPercent);
      else if (item.kind === 'book') useBook(s, item.book);
      else { const tg = s.heroes.filter((h) => h.alive && canReceive(h, item)); if (tg.length) { s.giveItem(pick(tg).uid, item.id); if (item.type === 'minion') minionItems++; } }
    }
  }
  return { floor, minionItems, bosses };
}
const T0 = Date.now();
const res = { normal: [], none: [] };
for (let si = 0; si < squads.length; si++) for (let i = 0; i < N; i++) {
  const seed = 7919 * si + i + 1;
  Math.random = seeded(seed); res.normal.push({ sq: squads[si], ...playRun(squads[si], itemDefs) });
  Math.random = seeded(seed); res.none.push({ sq: squads[si], ...playRun(squads[si], noMinionDefs) });
}
const summ = (list) => { if (!list.length) return { n: 0, mean: NaN, median: '-', p90: '-', max: '-' }; const f = list.map((x) => x.floor).sort((a, b) => a - b); return { n: f.length, mean: f.reduce((a, b) => a + b, 0) / f.length, median: f[f.length >> 1], p90: f[Math.floor(f.length * 0.9)], max: f[f.length - 1] }; };
const fmt = (s) => `mean ${s.mean.toFixed(1)}  median ${s.median}  top10% ${s.p90}  best ${s.max}  (${s.n} runs)`;
const bossLine = (list) => [20, 40, 60, 80, 100, 120, 140, 160].map((b) => { const tried = list.filter((x) => b in x.bosses); return tried.length ? `${b}: ${tried.filter((x) => x.bosses[b]).length}/${tried.length}` : null; }).filter(Boolean).join('  ');
console.log(`${((Date.now() - T0) / 1000).toFixed(0)}s, ${squads.length} squads x ${N} runs, same dice for both`);
console.log('NORMAL runs           ', fmt(summ(res.normal)));
console.log('NO summoning items    ', fmt(summ(res.none)));
console.log('  bosses won (normal): ', bossLine(res.normal));
console.log('  bosses won (none):   ', bossLine(res.none));
const withN = (list, yes) => list.filter((x) => x.sq.includes('necromancer') === yes);
console.log('with Necromancer   normal', summ(withN(res.normal, true)).mean.toFixed(1), ' none', summ(withN(res.none, true)).mean.toFixed(1));
console.log('without Necromancer normal', summ(withN(res.normal, false)).mean.toFixed(1), ' none', summ(withN(res.none, false)).mean.toFixed(1));
const took = res.normal.filter((x) => x.minionItems > 0), skip = res.normal.filter((x) => x.minionItems === 0);
console.log(`normal runs that picked 1+ summoning item: ${took.length} (mean floor ${took.length ? summ(took).mean.toFixed(1) : '-'}, avg ${took.length ? (took.reduce((a, x) => a + x.minionItems, 0) / took.length).toFixed(1) : 0} items); picked none: ${skip.length} (mean ${skip.length ? summ(skip).mean.toFixed(1) : '-'})`);
// Same run, both ways: how often did removing summoning items help / hurt?
let better = 0, worse = 0, same = 0;
res.normal.forEach((x, i) => { const d = res.none[i].floor - x.floor; if (d > 0) better++; else if (d < 0) worse++; else same++; });
console.log(`same dice, without summoning items the run went: deeper ${better}, shallower ${worse}, same ${same}`);
