// RANK EVERY ITEM in full runs (session 33, user: 'run simulations and rank all the items'). Like itemruns.mjs: the
// bot plays whole runs (random rewards, skill books, taps objects, casts skills) with the SAME dice for every item, so
// the only difference is the item. Each item goes to a hero that fits it (its `needs`: a hero that provides the tag or
// deals that damage type; otherwise the front hero). If no hero in the squad fits, the holder also starts with one
// cheap item that provides the tag (an 'enabler'), and the baseline for that squad gets the same enabler.
// Usage: node scripts/tests/rankitems.mjs [runsPerSquad=6] [copies=1,3] [part=0/1] [ids]   (prints JSON lines)
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
const COPIES = (process.argv[3] || '1,3').split(',').map(Number);
const [part, parts] = (process.argv[4] || '0/1').split('/').map(Number);
const IDS = (process.argv[5] ? process.argv[5].split(',') : Object.keys(itemDefs).filter((id) => itemDefs[id].kind !== 'potion')).filter((_, i) => i % parts === part);
export const SQUADS = [['knight', 'rogue', 'archer'], ['knight', 'mage', 'cleric'], ['berserker', 'samurai', 'bard'], ['samurai', 'necromancer', 'alchemist'], ['berserker', 'archer', 'necromancer'], ['knight', 'alchemist', 'mage']];
const MAX = 170, STEP = 50, TIMEOUT = 300000;
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fits = (hero, tag) => (hero.provides || []).includes(tag) || hero.damageType === tag || (tag === 'melee' && hero.damageType === 'melee') || (tag === 'ranged' && hero.damageType === 'ranged');
const ENABLER = { minion: 'rat_cage', bomb: 'fire_bombs', burn: 'kindling', poison: 'venom_fang', bleed: 'serrated_edge', fire: 'kindling', ice: 'frost_charm', electric: 'storm_charm', dark: 'shadow_charm', freeze: 'chill_band', cc: 'chill_band', shield: 'warding_charm', taunt: 'provokers_horn', heal: 'bandage_roll' };
// Which hero holds the item, and which enabler (if any) it needs in this squad.
function holderFor(sq, item) {
  const needs = [].concat(item.needs || []);
  if (!needs.length) return { idx: 0, enabler: null };
  for (const tag of needs) { const i = sq.findIndex((id) => fits(all.find((h) => h.id === id), tag)); if (i >= 0) return { idx: i, enabler: null }; }
  return { idx: 0, enabler: ENABLER[needs[0]] || null };
}
function useBook(s, book) {
  const page = pick(rollBookPages(bookData, book));
  const spots = [];
  for (const h of s.heroes) h.skills.forEach((_, i) => { const fit = pageFit(h, i, page, rules.books); if (fit === 'ok' || fit === 'replace') spots.push([h, i, fit]); });
  if (!spots.length) return;
  const [h, i, fit] = pick(spots);
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  s.addPage(h.uid, i, page, fit === 'replace' ? Math.floor(Math.random() * mods.length) : null);
}
function playRun(sq, idx, start) {
  const s = new BattleState({ heroDefs: sq.map((id) => all.find((h) => h.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling, rng: Math.random });
  for (const id of start) s.giveItem(s.heroes[idx].uid, id);
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
const runs = (sq, si, idx, start) => { const out = []; for (let i = 0; i < N; i++) { Math.random = seeded(1000 * si + i + 1); out.push(playRun(sq, idx, start)); } return out; };
const baseCache = new Map();
for (const id of IDS) {
  const res = { id, perSquad: [] };
  for (let si = 0; si < SQUADS.length; si++) {
    const sq = SQUADS[si];
    const { idx, enabler } = holderFor(sq, itemDefs[id]);
    const pre = enabler ? [enabler] : [];
    const key = `${si}|${idx}|${enabler}`;
    if (!baseCache.has(key)) baseCache.set(key, runs(sq, si, idx, pre));
    const row = { squad: sq.join('+'), holder: sq[idx], enabler, base: baseCache.get(key) };
    for (const c of COPIES) row['c' + c] = runs(sq, si, idx, [...pre, ...Array(c).fill(id)]);
    res.perSquad.push(row);
  }
  console.log(JSON.stringify(res));
}
