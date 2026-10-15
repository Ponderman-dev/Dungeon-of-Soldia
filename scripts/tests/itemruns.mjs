// Item check in FULL RUNS (phase H): how deep do whole runs get when the front hero starts with 0, 1, 3 or 8 copies
// of an item? The bot plays like review.mjs (random rewards, skill books, taps objects, casts skills). Every copy count
// replays the SAME dice (seeded), so the only difference is the item. Good for defensive items, which the stacking
// bench (kills only) cannot judge.
// Usage: node scripts/tests/itemruns.mjs [runsPerSquad=6] [itemIds comma list] [copies=0,1,3,8]
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit } from '../../src/systems/books.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json'), bookData = r('skillBooks.json');
const N = Number(process.argv[2] || 6);
const ids = (process.argv[3] || 'padded_vest').split(',');
const COPIES = (process.argv[4] || '0,1,3,8').split(',').map(Number);
const SQUADS = [['knight', 'rogue', 'archer'], ['knight', 'mage', 'cleric'], ['berserker', 'samurai', 'bard'], ['samurai', 'necromancer', 'alchemist']];
const MAX = 170, STEP = 50, TIMEOUT = 300000;
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
function playRun(sq, itemId, copies) {
  const s = new BattleState({ heroDefs: sq.map((id) => all.find((h) => h.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling, rng: Math.random });
  for (let i = 0; i < copies; i++) s.giveItem(s.heroes[0].uid, itemId); // the front hero holds the item from the start
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
const T0 = Date.now();
const base = {}; // copies 0 is the same for every item: play it once
for (const id of ids) {
  const row = [];
  for (const c of COPIES) {
    if (c === 0 && base.res) { row.push(base.res); continue; }
    const floors = [];
    for (let si = 0; si < SQUADS.length; si++) for (let i = 0; i < N; i++) { Math.random = seeded(1000 * si + i + 1); floors.push(playRun(SQUADS[si], id, c)); }
    floors.sort((a, b) => a - b);
    const res = { mean: floors.reduce((a, b) => a + b) / floors.length, median: floors[floors.length >> 1] };
    if (c === 0) base.res = res;
    row.push(res);
  }
  const b = row[0].mean;
  console.log(id.padEnd(20), row.map((x, i) => `${COPIES[i]}: ${x.mean.toFixed(1)} (${i ? (x.mean - b >= 0 ? '+' : '') + (x.mean - b).toFixed(1) : 'base'})`).join('   '));
}
console.log(`${((Date.now() - T0) / 1000).toFixed(0)}s, ${N * SQUADS.length} runs per number`);
