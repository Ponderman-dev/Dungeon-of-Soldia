// Boss check (phase H): each squad plays up to a boss floor with the heroes kept alive (so they collect the
// items, pages and levels a real run would), then fights the boss for real. Prints how often each boss wins,
// how long the fight takes and how much health the squad has left.
// Usage: node scripts/tests/bosscheck.mjs [runsPerSquad=2] [bossFloors=20,40,60,...]
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, canReceive } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { enemiesForFloor } from '../../src/systems/dungeon.js';
import { maybeAddBook, rollBookPages, pageFit } from '../../src/systems/books.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const all = r('heroes.json'), enemyDefs = r('enemies.json'), rules = r('combat.json'), damageTypes = r('damageTypes.json'), leveling = r('leveling.json'), dungeon = r('dungeons.json').A;
const itemDefs = loadItems(r('items.json')), skillDefs = r('skills.json'), rw = r('rewards.json'), minionDefs = r('minions.json'), statusDefs = r('statuses.json'), bookData = r('skillBooks.json');
const N = Number(process.argv[2] || 2);
const bossFloors = (process.argv[3] || Object.keys(dungeon.bosses).join(',')).split(',').map(Number);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ids = all.map((h) => h.id), squads = [];
for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) squads.push([ids[a], ids[b], ids[c]]);
function useBook(s, book) {
  const page = pick(rollBookPages(bookData, book)), spots = [];
  for (const h of s.heroes) h.skills.forEach((_, i) => { const fit = pageFit(h, i, page, rules.books); if (fit === 'ok' || fit === 'replace') spots.push([h, i, fit]); });
  if (!spots.length) return;
  const [h, i, fit] = pick(spots);
  const mods = (h.skills[i].pages || []).filter((p) => p.kind === 'modifier');
  s.addPage(h.uid, i, page, fit === 'replace' ? Math.floor(Math.random() * mods.length) : null);
}
function fight(s, floor, protect) {
  s.spawnEnemies(enemiesForFloor(dungeon, floor), floor); s.placeLines(); s.startFloor();
  let t = 0;
  while (!s.allEnemiesDead() && !s.allHeroesDead() && t < 300000) {
    s.update(50); t += 50;
    if (protect) for (const h of s.heroes) h.hp = Math.max(h.hp, h.maxHp * 0.5);
    const obj = !s.focusUnit && s.enemies.find((e) => e.alive && e.def.object && !s.untargetable(e));
    if (obj) s.setFocus(obj.uid);
    for (const h of s.heroes) for (let i = 0; i < h.skills.length; i++) s.castSkill(h.uid, i);
  }
  return t;
}
const res = {};
for (const B of bossFloors) res[B] = { tries: 0, wins: 0, secs: 0, hpLeft: 0, dead: 0, timeouts: 0, bossLeft: 0 };
for (const sq of squads) for (let n = 0; n < N; n++) {
  const s = new BattleState({ heroDefs: sq.map((id) => all.find((h) => h.id === id)), enemyDefs, itemDefs, skillDefs, minionDefs, statusDefs, rules, damageTypes, leveling });
  for (let floor = 1; floor <= Math.max(...bossFloors); floor++) {
    const isTest = bossFloors.includes(floor);
    let t;
    if (isTest) {
      // Arrive healthy-ish like a squad that just won a floor, then fight for real.
      for (const h of s.heroes) h.hp = h.maxHp;
      t = fight(s, floor, false);
      const R = res[floor]; R.tries++; R.secs += t / 1000;
      if (t >= 300000) R.timeouts++;
      else if (s.allHeroesDead()) { const b = s.enemies.find((e) => e.def.boss); if (b) R.bossLeft += b.hp / b.maxHp; }
      if (!s.allHeroesDead() && s.allEnemiesDead()) { R.wins++; R.hpLeft += s.heroes.reduce((a, h) => a + (h.alive ? h.hp / h.maxHp : 0), 0) / 3; R.dead += s.heroes.filter((h) => !h.alive).length; }
      // Carry on with everyone alive again (the next boss gets a fresh test).
      for (const h of s.heroes) { h.alive = true; h.hp = h.maxHp; }
      s.refreshStats && s.refreshStats();
    } else {
      fight(s, floor, true);
      // A big hit can still kill a protected hero inside one step: bring him back, or the squad reached the next
      // boss already dead (bug: Rask/Morthul 'won' in 0.8s against squads that were dead before the fight).
      if (s.heroes.some((h) => !h.alive)) { for (const h of s.heroes) if (!h.alive) { h.alive = true; h.hp = h.maxHp; } s.refreshStats(); }
    }
    s.endFloor(); s.winHeal(rules.winHealPercent); s.clearStatuses();
    let choices = rollChoices({ itemDefs, rules: rw, floor, count: rw.choices, heroes: s.heroes, potionChance: rw.potionChance });
    choices = maybeAddBook(choices, bookData, s.heroes, bookData.bookChancePerScreen);
    if (dungeon.bosses[floor]) useBook(s, 'golden');
    if (choices.length) {
      const item = pick(choices);
      if (item.kind === 'potion') s.healHeroes(item.healPercent);
      else if (item.kind === 'book') useBook(s, item.book);
      else { const tg = s.heroes.filter((h) => h.alive && canReceive(h, item)); if (tg.length) s.giveItem(pick(tg).uid, item.id); }
    }
  }
}
for (const B of bossFloors) {
  const R = res[B];
  console.log(`floor ${B} ${dungeon.bosses[B][0].padEnd(14)} squad wins ${((100 * R.wins) / R.tries).toFixed(0)}% (${R.wins}/${R.tries}), fight ${(R.secs / R.tries).toFixed(1)}s, winners keep ${((100 * R.hpLeft) / Math.max(1, R.wins)).toFixed(0)}% health, lose ${(R.dead / Math.max(1, R.wins)).toFixed(2)} heroes; never ends ${R.timeouts}, wiped squads left the boss at ${((100 * R.bossLeft) / Math.max(1, R.tries - R.wins - R.timeouts)).toFixed(0)}% health`);
}
