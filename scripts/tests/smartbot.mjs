// A SMART PLAYER for full-run simulations (difficulty curve work). Unlike the old balance bot (random item, random
// hero) it drafts like a thoughtful player:
//  - every reward card is scored for every hero: rarity, does it fit the squad (`needs`), the hero's damage type,
//    what the item is for (damage items go to the strongest attacker, defense items to the front-liner, minion items
//    to the summoner, skill items to skill-heavy heroes) and it keeps STACKING what a hero already started;
//  - takes a potion when the squad is hurt, a skill book when it beats the best item, picks sensible pages and puts
//    them on the skill that gains most;
//  - plays the SPECIAL ROOMS (treasure, Mimic, fountain, dealer, puzzle) like the game does;
//  - in a fight: taps boss objects first, else focuses the weakest enemy (finish kills), casts every ready skill.
// `opts.random` = the old behaviour (random card, random hero) for comparison.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive, countOf } from '../../src/systems/items.js';
import { rollChoices, squadSources } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit } from '../../src/systems/books.js';
import { roomForFloor } from '../../src/systems/rooms.js';

const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
export const DATA = {
  heroes: r('heroes.json'), enemyDefs: r('enemies.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'),
  dungeon: r('dungeons.json').A, itemDefs: loadItems(r('items.json')), skillDefs: r('skills.json'), rw: r('rewards.json'),
  minionDefs: r('minions.json'), statusDefs: r('statuses.json'), bookData: r('skillBooks.json'), rooms: r('rooms.json'),
};
const RARITY = { common: 1, rare: 1.6, epic: 2.3, legendary: 3 };
const pick = (a, rng) => a[Math.floor(rng() * a.length)];

// Which items protect (go to the hero who gets hit most) and which add damage (go to the strongest attacker).
const DEFENSIVE = new Set(['padded_vest', 'heart_charm', 'shield_totem', 'bulwark_plate', 'tough_skin', 'mage_cloak', 'iron_will_talisman', 'warding_charm', 'spite_mail', 'martyrs_shield', 'provokers_horn', 'phoenix_feather', 'second_wind_flask', 'mirror_buckler', 'spirit_axe', 'fire_heart', 'overheal_ring', 'heart_of_the_beast', 'feather_boots', 'spiked_aegis', 'lost_clerics_grimoire']);
const TEAM = new Set(['war_banner', 'jolly_banner', 'spotters_lens', 'aid_kit', 'bandage_roll', 'soul_lantern', 'giantslayers_brand']);
const SKILLY = new Set(['hourglass', 'conductors_baton', 'echo_rune', 'scholars_bookmark', 'siege_cannon']);
const ELEMENT = { kindling: 'fire', frost_charm: 'ice', storm_charm: 'electric', shadow_charm: 'dark' };
const SKILL_HEROES = { mage: 1.3, cleric: 1.2, alchemist: 1.3, bard: 1.2, archer: 1.1, necromancer: 1.1 };
// Modifier pages a sensible player likes (others are taken only if nothing better shows up).
const GOOD_PAGES = { sharpen: 3, swift: 3, steady: 2, lasting: 2, aftershock: 4, ricochet: 4, siphon: 3, bulwark: 3, emberInk: 3, venomInk: 3, razorInk: 3, frostInk: 3, huntersInk: 3, titan: 3, rally: 3, concussive: 3, purify: 2, roar: 2, gravecall: 2, bloodPrice: 2, cyclone: 2, desperate: 1, overcharge: 1, reckless: 1, hasty: 1 };

// How hard a hero hits with basic attacks (attack x speed x crit), and how much it is in the front line.
const dps = (h) => h.stats.attack * (h.stats.attackEfficiency / 100) * (1 + (h.stats.crit || 0) / 100);
const front = (h) => (h.def.role === 'Tank' ? 1.2 : h.def.damageType === 'melee' ? 0.9 : 0.45);

// How good `item` is on `hero` right now (0 = useless). The card with the best (item, hero) wins.
export function scoreFor(item, hero, s, sources) {
  if (!hero.alive || !canReceive(hero, item)) return 0;
  let v = RARITY[item.rarity] || 1;
  if (item.needs) v *= [].concat(item.needs).some((n) => sources.has(n)) ? 1.3 : 0.15;
  const melee = hero.def.damageType === 'melee';
  if (['sharp_edge', 'excalibur'].includes(item.id) && !melee) return 0.05;
  if (['eagle_eye', 'fire_arrows', 'quiver_of_plenty'].includes(item.id) && hero.def.damageType !== 'ranged') return 0.05;
  if (ELEMENT[item.id]) v *= hero.def.damageType === ELEMENT[item.id] || (hero.def.provides || []).includes(ELEMENT[item.id]) ? 1.3 : 0.9; // charms add their element to every attack: good on anyone
  const living = s.heroes.filter((h) => h.alive);
  const maxDps = Math.max(...living.map(dps));
  if (DEFENSIVE.has(item.id)) v *= front(hero);
  else if (TEAM.has(item.id)) v *= 0.6 + 0.4 * front(hero); // squad items: keep them on someone who survives
  else if (SKILLY.has(item.id)) v *= SKILL_HEROES[hero.def.id] || 0.8;
  else if (item.type === 'minion') v *= hero.def.id === 'necromancer' ? 1.5 : 0.8;
  else v *= 0.4 + 0.6 * (dps(hero) / maxDps); // damage / on-hit / attack stats: the strongest attacker
  v *= 1 + 0.25 * Math.min(4, countOf(hero, item.id)); // keep stacking what the hero already started
  return v;
}

// The best home for a page: [hero, skill index, fit, value].
function bestPageSpot(s, page) {
  let best = null;
  const living = s.heroes.filter((h) => h.alive);
  const maxDps = Math.max(...living.map(dps));
  for (const h of living) h.skills.forEach((sk, i) => {
    const fit = pageFit(h, i, page, DATA.rules.books);
    if (fit !== 'ok' && fit !== 'replace') return;
    const def = DATA.skillDefs[sk.id] || {};
    const isAttack = def.kind === 'attack';
    const supportPage = ['bulwark', 'purify', 'rally', 'lasting', 'bloodPrice'].includes(page.id);
    let v = (GOOD_PAGES[page.id] || 1) * (isAttack === !supportPage ? 1.3 : 0.8) * (SKILL_HEROES[h.def.id] || 0.9) * (0.6 + 0.4 * dps(h) / maxDps);
    if (fit === 'replace') v *= 0.6;
    if (!best || v > best[3]) best = [h, i, fit, v];
  });
  return best;
}

function usePages(s, pages) {
  let best = null;
  for (const p of pages) { const spot = bestPageSpot(s, p); if (spot && (!best || spot[3] > best[1][3])) best = [p, spot]; }
  if (!best) return null;
  const [page, [h, i, fit]] = best;
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  const weakest = mods.length ? mods.reduce((a, b, k) => ((GOOD_PAGES[b.id] || 1) < (GOOD_PAGES[mods[a].id] || 1) ? k : a), 0) : null;
  s.addPage(h.uid, i, page, fit === 'replace' ? weakest : null);
  return page.id;
}

// One reward pick (cards = items / potion / book). Returns what was taken.
export function takeReward(s, cards, opts, log) {
  if (!cards.length) return null;
  const rng = opts.rng;
  const book = (b) => usePages(s, opts.random ? [pick(rollBookPages(DATA.bookData, b, rng), rng)] : rollBookPages(DATA.bookData, b, rng));
  if (opts.random) {
    const item = pick(cards, rng);
    if (item.kind === 'potion') return s.healHeroes(item.healPercent), 'potion';
    if (item.kind === 'book') return book(item.book);
    const tg = s.heroes.filter((h) => h.alive && canReceive(h, item));
    if (tg.length) s.giveItem(pick(tg, rng).uid, item.id);
    return item.id;
  }
  const living = s.heroes.filter((h) => h.alive);
  const hurt = living.reduce((a, h) => a + h.hp / h.maxHp, 0) / Math.max(1, living.length);
  const sources = squadSources(s.heroes, s.itemDefs);
  let best = null;
  for (const c of cards) {
    if (c.kind === 'potion') { const v = hurt < 0.5 ? 4 : 0.5; if (!best || v > best.v) best = { v, c }; continue; }
    if (c.kind === 'book') { const v = c.book === 'dealer' ? 9 : 2.4; if (!best || v > best.v) best = { v, c }; continue; }
    for (const h of living) { const v = scoreFor(c, h, s, sources); if (!best || v > best.v) best = { v, c, h }; }
  }
  if (!best) return null;
  if (best.c.kind === 'potion') return s.healHeroes(best.c.healPercent), 'potion';
  if (best.c.kind === 'book') return book(best.c.book);
  s.giveItem(best.h.uid, best.c.id);
  if (log) log.push([best.h.def.id, best.c.id]);
  return best.c.id;
}

// One fight to the end. Returns { won, ms }.
export function fight(s, stats, floor) {
  s.placeLines(); s.startFloor();
  let t = 0;
  while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 300000) {
    s.update(50); t += 50;
    const obj = s.enemies.find((e) => e.alive && e.def.object && !s.untargetable(e));
    if (obj) { if (!s.focusUnit || s.focusUnit !== obj) s.setFocus(obj.uid); }
    else if (!s.focusUnit) {
      const live = s.enemies.filter((e) => e.alive && !s.untargetable(e));
      if (live.length) s.setFocus(live.reduce((a, b) => (b.hp < a.hp ? b : a)).uid);
    }
    for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
  }
  if (t >= 300000 && stats) stats.timeouts = (stats.timeouts || 0) + 1;
  return { won: s.allEnemiesDead() && !s.allHeroesDead(), ms: t };
}

// Plays a whole run. Returns { floor (where it ended), log, bosses: {floor: won} , rooms }.
export function playRun(squad, opts = {}) {
  const rng = opts.rng || Math.random;
  opts = { ...opts, rng };
  const rules = opts.rules || DATA.rules;
  const heroDefs = squad.map((id) => DATA.heroes.find((h) => h.id === id));
  const s = new BattleState({ heroDefs, enemyDefs: opts.enemyDefs || DATA.enemyDefs, itemDefs: DATA.itemDefs, skillDefs: DATA.skillDefs, minionDefs: DATA.minionDefs, statusDefs: DATA.statusDefs, rules, damageTypes: DATA.damageTypes, leveling: DATA.leveling, rng });
  s.offeredOnce = new Set();
  const dungeon = opts.dungeon || DATA.dungeon;
  const out = { floor: 1, log: [], bosses: {}, rooms: {}, deaths: [], fightMs: {} };
  const reward = (count = DATA.rw.choices, odds = null) => {
    let cards = rollChoices({ itemDefs: DATA.itemDefs, rules: DATA.rw, floor: out.floor, count, heroes: s.heroes, potionChance: odds ? 0 : DATA.rw.potionChance, offered: s.offeredOnce, rng, odds, bump: (!odds || s.monsterHouse) && s.floorHadElite ? DATA.rules.elites.rewardBump : 0 });
    if (!odds) cards = maybeAddBook(cards, DATA.bookData, s.heroes, DATA.bookData.bookChancePerScreen, rng);
    takeReward(s, cards, opts, out.log);
  };
  let prevRoom = null;
  for (let floor = 1; floor <= (opts.maxFloor || 400); floor++) {
    out.floor = floor;
    const room = opts.noRooms ? null : roomForFloor(DATA.rooms, dungeon, floor, prevRoom, rng);
    prevRoom = room;
    if (room) {
      out.rooms[room] = (out.rooms[room] || 0) + 1;
      const k = DATA.rooms.kinds[room];
      s.spawnEnemies([], floor);
      if (room === 'treasure') { reward(); if (rng() < k.twoChestChance) reward(); }
      else if (room === 'puzzle') reward();
      else if (room === 'fountain') { s.healHeroes(k.healPercent); s.bless(k.regenPercentPerSec, k.fights); }
      else if (room === 'dealer') takeReward(s, [DATA.bookData.cards.dealer], opts, out.log);
      else if (room === 'mimic') {
        s.spawnEnemies([k.enemy], floor);
        const res = fight(s, out, floor);
        if (!res.won) { out.deaths.push('mimic'); break; }
        s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
        reward(DATA.rw.choices, k.rewardOdds);
      }
      continue;
    }
    const line = enemiesForFloor(dungeon, floor, rng, (out.director ||= {}), opts.enemyDefs || DATA.enemyDefs);
    s.spawnEnemies(line, floor);
    const res = fight(s, out, floor);
    out.fightMs[floor] = res.ms;
    const boss = dungeon.bosses && dungeon.bosses[floor];
    if (boss) out.bosses[floor] = res.won;
    if (!res.won) { out.deaths.push(boss ? 'BOSS ' + boss[0] : line.monsterHouse ? 'MONSTER HOUSE' : line.join('+')); break; }
    s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
    if (s.monsterHouse) { out.houses = (out.houses || 0) + 1; reward(DATA.rw.choices, dungeon.director.monsterHouse.rewardOdds); continue; } // its own prize
    reward();
    if (boss) takeReward(s, [DATA.bookData.cards.golden], opts, out.log);
  }
  if (opts.keepState) out.state = s; // the fight state at the end (make-demo-squad.mjs saves its heroes; not sent between workers)
  out.levels = s.heroes.map((h) => h.level);
  out.items = s.heroes.map((h) => h.items.length);
  return out;
}

// Every 3-hero squad (or a given list).
export function allSquads() {
  const ids = DATA.heroes.map((h) => h.id);
  const out = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) out.push([ids[a], ids[b], ids[c]]);
  return out;
}

// A small seeded random (same dice for comparisons).
export function seeded(seed) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}
