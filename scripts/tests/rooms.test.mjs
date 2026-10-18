// Special rooms: which floors become rooms, the puzzle room (see puzzles.test.mjs), the fountain blessing, the Mimic's prize, the dealer's book.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { rollBookPages } from '../../src/systems/books.js';
import { roomForFloor } from '../../src/systems/rooms.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rooms = r('rooms.json'), dungeon = r('dungeons.json').A, itemDefs = loadItems(r('items.json')), rw = r('rewards.json');
const heroDefs = noPerks(r('heroes.json'));
const mk = () => new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => heroDefs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });

// Which floors
const always = () => 0; // rng 0: the chance roll passes, the first kind is picked
ok('no rooms before floor 4', [1, 2, 3].every((n) => roomForFloor(rooms, dungeon, n, null, always) === null));
ok('floor 4 can be a room', roomForFloor(rooms, dungeon, 4, null, always) === 'treasure');
ok('never on a boss floor or the floor before it', roomForFloor(rooms, dungeon, 20, null, always) === null && roomForFloor(rooms, dungeon, 19, null, always) === null && roomForFloor(rooms, dungeon, 39, null, always) === null);
ok('never two rooms in a row', roomForFloor(rooms, dungeon, 6, 'treasure', always) === null);
{ let n = 0, seen = new Set(); for (let i = 0; i < 20000; i++) { const k = roomForFloor(rooms, dungeon, 10); if (k) { n++; seen.add(k); } }
  ok('about 1 floor in 4 is a room', Math.abs(n / 20000 - rooms.chance) < 0.015, (n / 200).toFixed(1) + '%');
  ok('all 5 kinds show up', ['treasure', 'mimic', 'fountain', 'dealer', 'puzzle'].every((k) => seen.has(k)), [...seen].join()); }

// Fountain blessing: the next 3 fights start with a regen buff
{ const s = mk(); s.heroes.forEach((h) => (h.hp = h.maxHp / 2)); s.healHeroes(rooms.kinds.fountain.healPercent);
  ok('fountain heals 50%', s.heroes.every((h) => h.hp === h.maxHp));
  s.bless(rooms.kinds.fountain.regenPercentPerSec, rooms.kinds.fountain.fights);
  let buffed = 0;
  for (let f = 0; f < 5; f++) { s.spawnEnemies(['slime'], 5); s.startFloor(); if (s.heroes.every((h) => h.statuses.some((st) => st.type === 'regenBoost'))) buffed++; s.clearStatuses(); }
  ok('regen buff on the next 3 fights only', buffed === 3, buffed);
  s.bless(0.5, 1); s.spawnEnemies(['slime'], 5); s.startFloor(); const h = s.heroes[0]; h.hp = h.maxHp / 2; const before = h.hp;
  for (let i = 0; i < 20; i++) s.update(50);
  ok('the buff heals over time (0.5%/s)', h.hp > before, `${before} -> ${h.hp.toFixed(1)}`); }

// Mimic: tougher than normal enemies, its prize is rare or epic only
{ const e = r('enemies.json'); ok('Mimic is tougher than an Orc Brute', e.mimic.stats.health > e.orcBrute.stats.health && e.mimic.stats.attack > e.orcBrute.stats.attack);
  const s = mk(); const t = {}; for (let i = 0; i < 300; i++) for (const it of rollChoices({ itemDefs, rules: rw, floor: 10, count: 3, heroes: s.heroes, odds: rooms.kinds.mimic.rewardOdds })) t[it.rarity] = 1;
  ok('Mimic prize: only rare and epic', Object.keys(t).sort().join() === 'epic,rare', Object.keys(t).join()); }

// Dealer: 5 different pages (2 stat + 3 modifier)
{ const b = r('skillBooks.json'); let bad = 0; for (let i = 0; i < 200; i++) { const p = rollBookPages(b, 'dealer'); if (p.length !== 5 || new Set(p.map((x) => x.id)).size !== 5 || p.filter((x) => x.kind === 'stat').length !== 2) bad++; }
  ok('dealer offers 5 different pages', bad === 0); }

// Room props exist and every kind has a name and a hint
{ const props = r('roomProps.json'); ok('props: chest, fountain, dealer, tablet', ['chest', 'fountain', 'dealer', 'tablet'].every((k) => props[k] && props[k].parts));
  ok('every room kind has a name and hint', Object.values(rooms.kinds).every((k) => k.name && k.hint)); }
