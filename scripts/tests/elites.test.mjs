// Elite enemies (elites.js, combat.json `elites`, director odds in dungeons.json director.elites).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { directFloor, pickElites, pointValue } from '../../src/systems/dungeon.js';
import { rollChoices } from '../../src/systems/rewards.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const E = rules.elites;
const enemyDefs = r('enemies.json');
const A = r('dungeons.json').A;
const seeded = (seed) => { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

const mk = (ids, { elite = null, floor = 12, place = true, rng = () => 0.5 } = {}) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs, minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, floor);
  if (elite) s.makeElite(es[0], elite[0], elite[1]);
  for (const u of s.heroes) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; }
  if (place) s.placeLines();
  return { s, es, h: s.heroes };
};
const has = (u, st) => u.statuses.some((x) => x.type === st);

// --- the director's odds ---
ok('odds read off the points: 0 before floor 10, 5% at 10, 33% at 40, 60% at 60, 80% from 100', pointValue(A.director.elites.chance, 9) === 0 && pointValue(A.director.elites.chance, 10) === 5 && pointValue(A.director.elites.chance, 40) === 33 && pointValue(A.director.elites.chance, 60) === 60 && pointValue(A.director.elites.chance, 300) === 80);
ok('a second elite: none before 60, 15% at 60, 35% from 100', pointValue(A.director.elites.second, 59) === 0 && pointValue(A.director.elites.second, 60) === 15 && pointValue(A.director.elites.second, 200) === 35);
{
  const rate = (n) => { const rng = seeded(7); let k = 0; for (let i = 0; i < 2000; i++) if (directFloor(A, n, rng, {}, enemyDefs).elites.length) k++; return k / 2000; };
  const r9 = rate(9), r10 = rate(10), r40 = rate(40), r100 = rate(100);
  ok('elite fights by floor match the plan (about 1 in 20 at 10, 1 in 3 at 40, 80% at 100+)', r9 === 0 && r10 > 0.02 && r10 < 0.09 && r40 > 0.27 && r40 < 0.4 && r100 > 0.74 && r100 < 0.86, `${r9} ${r10} ${r40} ${r100}`);
  const rng = seeded(3); let two = 0, badTier = 0;
  for (let i = 0; i < 2000; i++) {
    const ids = directFloor(A, 120, rng, {}, enemyDefs);
    if (ids.elites.length === 2) two++;
    for (const k of ids.elites) if (!['normal', 'strong'].includes(enemyDefs[ids[k]].tier || 'normal')) badTier++;
  }
  ok('deep down some fights have two elites', two / 2000 > 0.15 && two / 2000 < 0.35, String(two / 2000));
  ok('only normal and strong enemies become elite (never fodder)', badTier === 0);
  ok('no elite when the fight has only fodder', pickElites(A.director.elites, 100, [{ tier: 'fodder' }, { tier: 'fodder' }], () => 0).length === 0);
}

// --- what an elite is ---
{
  const plain = mk(['bandit']).es[0];
  const { s, es } = mk(['bandit'], { elite: ['burning', 'vampiric'] });
  const e = es[0];
  ok('name says element + trait + enemy', e.name === 'Burning Vampiric Bandit', e.name);
  ok('x2 health, x1.35 attack, +10 defense and resist', e.maxHp === Math.round(plain.maxHp * 2) && e.stats.attack === Math.round(plain.stats.attack * 1.35) && e.stats.defense === plain.stats.defense + 10 && e.stats.resist === plain.stats.resist + 10);
  ok('drawn one pixel size bigger', e.def.drawScale === (plain.def.drawScale ?? 3) + 1);
  ok('x3 XP', e.xpScale === plain.xpScale * 3);
  ok('resists its element, weak to the opposite one', e.resists.includes('fire') && e.weak.includes('ice'));
  ok('it still walks up like a melee enemy', e.damageType === 'melee' && e.hitType === 'fire');
  const ev = [];
  s.landAttack(e, s.heroes[0], ev);
  const atk = ev.find((x) => x.type === 'attack');
  ok('its hits are fire', atk && atk.damageType === 'fire');
  s.heroes[0].hp = s.heroes[0].maxHp; e.hp = e.maxHp / 2;
  const before = e.hp; s.landAttack(e, s.heroes[0], []);
  ok('Vampiric: heals from the damage it deals', e.hp > before);
  ok('the floor counts as an elite fight (reward bump)', s.floorHadElite === true && mk(['bandit']).s.floorHadElite === false);
}
{
  const { s, es, h } = mk(['bandit'], { elite: ['frozen', 'thorny'], rng: () => 0 });
  s.landAttack(es[0], h[0], []);
  ok('Frozen: its hits Chill', has(h[0], 'chill'));
  const knight = h.find((x) => x.damageType === 'melee');
  s.rng = () => 0.99; // no dodge
  const hp = knight.hp; s.landAttack(knight, es[0], []);
  ok('Thorny: a melee hit on it hurts the attacker', knight.hp < hp);
}
{
  const { s, es, h } = mk(['bandit'], { elite: ['storm', 'regenerating'], rng: () => 0.99 });
  const ev = [];
  for (let i = 0; i < 4; i++) s.landAttack(es[0], h[0], ev);
  const others = ev.filter((x) => x.type === 'attack' && x.target !== h[0]);
  ok('Storm: the 4th hit jumps to a second hero', others.length === 1 && others[0].damageType === 'electric');
  es[0].hp = es[0].maxHp / 2;
  const hp = es[0].hp; s.update(1000);
  ok('Regenerating: about 2% max health a second', es[0].hp - hp > es[0].maxHp * 0.015 && es[0].hp - hp <= es[0].maxHp * 0.021);
}
{
  const { s, es } = mk(['bandit'], { elite: ['cursed', 'shielded'] });
  const e = es[0];
  const sh = () => e.statuses.find((st) => st.key === 'shield:elite');
  ok('Shielded: starts with a shield of 30% max health', sh() && Math.abs(sh().amount - e.maxHp * 0.3) < 1);
  s.dealDamage(e, sh().amount + 1, []);
  e.statuses = e.statuses.filter((st) => st.amount > 0);
  ok('...that can be broken', !sh());
  s.update(3000);
  ok('...does not regrow while it is still being hit soon after', !sh());
  s.update(3100);
  ok('...regrows after 6s without being hit', !!sh());
  ok('Cursed: weak to holy, resists dark, heals 10% of its hits', e.weak.includes('holy') && e.resists.includes('dark') && e.specials.lifesteal === 10);
}
{
  const { s, es } = mk(['bandit'], { elite: ['toxic', 'unstoppable'] });
  const e = es[0];
  e.x = s.heroes[0].x; e.y = s.heroes[0].y - 40; // standing next to the heroes
  s.applyStatus(e, { status: 'stun', durationMs: 2000 }, s.heroes[0], 'x', []);
  const st = e.statuses.find((x) => x.type === 'stun');
  ok('Unstoppable: stuns last half as long', st && st.remaining === 1000);
  const ev = []; s.killUnit(e, ev);
  ok('Toxic: a poison cloud when it dies', ev.some((x) => x.type === 'deathBurst') && s.heroes.some((x) => has(x, 'poison')));
}
{
  const { s, es } = mk(['bandit', 'goblin'], { elite: ['burning', 'splitting'] });
  const e = es[0];
  const ev = []; s.killUnit(e, ev);
  const copies = s.enemies.filter((x) => x.splitCopy);
  ok('Splitting: dies into 2 small normal copies with 25% of its health each', copies.length === 2 && copies.every((c) => !c.elite && c.name === 'Bandit' && c.maxHp === Math.round(e.maxHp * 0.25) && c.alive));
  ok('...the fight is not won yet', !s.allEnemiesDead() && ev.filter((x) => x.type === 'enemySpawn').length === 2);
}
{
  const { s, es } = mk(['bandit'], { elite: ['frozen', 'explosive'], rng: () => 0.99 });
  es[0].x = s.heroes[0].x; es[0].y = s.heroes[0].y - 40;
  const ev = []; s.killUnit(es[0], ev);
  ok('Explosive: bursts on the heroes nearby (ice damage + Chill)', ev.some((x) => x.type === 'attack' && x.damageType === 'ice') && s.heroes.some((x) => has(x, 'chill')));
}
{
  // A Toxic Puffshroom has two death clouds (its own + the element's).
  const { s, es } = mk(['puffshroom'], { elite: ['toxic', 'vampiric'] });
  const ev = []; s.killUnit(es[0], ev);
  ok('two death bursts add up (list of onDeath)', ev.filter((x) => x.type === 'deathBurst').length === 2);
}

// --- the reward bump ---
{
  const itemDefs = loadItems(r('items.json'));
  const heroes = mk(['bandit']).h;
  const rw = r('rewards.json');
  const odds = { common: 100, rare: 0, epic: 0, legendary: 0 };
  const rng = seeded(11);
  let fine = true;
  for (let i = 0; i < 200; i++) {
    const cards = rollChoices({ itemDefs, rules: rw, count: 3, heroes, rng, odds, bump: 1 });
    if (cards.filter((c) => c.rarity === 'rare').length !== 1 || cards.filter((c) => c.rarity === 'common').length !== 2) fine = false;
  }
  ok('after an elite: exactly one of the 3 cards is a rarity higher', fine);
  const leg = rollChoices({ itemDefs, rules: rw, count: 3, heroes, rng, odds: { common: 0, rare: 0, epic: 0, legendary: 100 }, bump: 1 });
  ok('a legendary card stays legendary', leg.every((c) => c.rarity === 'legendary'));
}

// --- a long fight full of elites never breaks ---
{
  let errors = 0, done = 0;
  for (const el of Object.keys(E.elements)) for (const tr of Object.keys(E.traits)) {
    const { s, es } = mk(['bandit', 'skeletonArcher', 'spider'], { elite: [el, tr], floor: 30, rng: seeded(el.length * 31 + tr.length) });
    for (const u of s.heroes) u.hp = u.maxHp = 3000;
    try { for (let t = 0; t < 60000 && !s.allEnemiesDead() && !s.allHeroesDead(); t += 50) s.update(50); done++; }
    catch (err) { errors++; console.log(el, tr, err.stack.split('\n').slice(0, 3).join(' | ')); }
  }
  ok('every element x trait fights without errors', errors === 0, `${done} fights`);
}
