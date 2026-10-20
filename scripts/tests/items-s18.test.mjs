// Session 18 items. Thunderstruck (legendary, electric): 5% on attack, a circle grows under the strongest enemy, then a giant bolt hits it
// (can't be dodged) and sets off the holder's on-hit items. One circle at a time, never stacks.
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const spec = itemDefs.thunderstruck.effects[0].thunderstruck;
const mk = (rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(['goblin', 'orcBrute', 'goblin'], 1);
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, k: s.heroes[0] };
};
const force = (s, k, target) => { const ev = []; s.rollProcs(k, 'onAttack', ev, { target, hit: true, force: true }); return ev; };
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };

ok('Thunderstruck exists: legendary, electric, offered once per run', itemDefs.thunderstruck.rarity === 'legendary' && itemDefs.thunderstruck.provides.includes('electric') && itemDefs.thunderstruck.oncePerRun);
{ const { s, es, k } = mk(); s.giveItem(k.uid, 'thunderstruck');
  for (const e of es) e.hp = e.maxHp = 1e7;
  es[1].maxHp = 2e7; es[1].hp = 2e7;
  force(s, k, es[0]);
  ok('the circle goes under the STRONGEST enemy (most max health), not the one hit', s.thunders.length === 1 && s.thunders[0].target === es[1]);
  force(s, k, es[0]);
  ok('...only one circle at a time', s.thunders.length === 1);
  const early = run(s, spec.delayMs - 100).filter((e) => e.type === 'thunderstruck');
  ok('...nothing hits before the circle is full', early.length === 0);
  const before = es[1].hp, ev = run(s, 200);
  const bolt = ev.filter((e) => e.type === 'thunderstruck'), hit = ev.find((e) => e.type === 'attack' && e.attacker === k && e.target === es[1] && e.damageType === 'electric');
  ok('...then the bolt hits it', bolt.length === 1 && hit && before - es[1].hp >= hit.result.amount * 0.99, `${hit && hit.result.amount}`);
  const { s: s0, es: e0, k: k0 } = mk(); e0[1].hp = e0[1].maxHp = 2e7; const plain = s0.strike(k0, e0[1], [], { multiplier: spec.damageMultiplier, damageType: 'electric' }).amount;
  ok('...for the data\'s multiplier of attack', hit && Math.abs(hit.result.amount / plain - 1) < 0.06, `${hit && hit.result.amount} vs ${plain}`); }
{ const { s, es, k } = mk(); s.giveItem(k.uid, 'thunderstruck'); for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.evasion = 100; }
  force(s, k, es[0]); const ev = run(s, spec.delayMs + 100);
  ok('the bolt can\'t be dodged', ev.some((e) => e.type === 'attack' && e.attacker === k && e.damageType === 'electric' && !e.result.dodged)); }
{ const { s, es, k } = mk(); s.giveItem(k.uid, 'thunderstruck'); s.giveItem(k.uid, 'frost_charm'); for (const e of es) e.hp = e.maxHp = 1e7;
  force(s, k, es[0]); const ev = run(s, spec.delayMs + 100);
  ok('the bolt sets off on-hit items (Frost Charm\'s ice hit)', ev.some((e) => e.type === 'attack' && e.attacker === k && e.damageType === 'ice'));
  ok('...but never a new Thunderstruck from its own bolt', s.thunders.length === 0); }
{ const { s, es, k } = mk(); s.giveItem(k.uid, 'thunderstruck'); for (const e of es) e.hp = e.maxHp = 1e7; es[1].hp = es[1].maxHp = 2e7;
  force(s, k, es[0]); es[1].hp = 0; es[1].alive = false; const ev = run(s, spec.delayMs + 100);
  ok('if the marked enemy dies first, the bolt hits the next strongest', ev.some((e) => e.type === 'thunderstruck' && e.target !== es[1] && e.target.alive)); }
{ const { s, es, k } = mk(); s.giveItem(k.uid, 'thunderstruck'); s.giveItem(k.uid, 'thunderstruck');
  ok('two copies still roll ONE chance (does not stack)', k.procs.filter((p) => p.itemId === 'thunderstruck').length === 1); }
// Guardian's Banner (epic, squad): every living hero gets its defense and resist while the holder lives
{ const { s, k } = mk(); const eff = itemDefs.guardians_banner.effects, def = eff.find((e) => e.stat === 'defense').flat, res = eff.find((e) => e.stat === 'resist').flat;
  const before = s.heroes.map((h) => [h.stats.defense, h.stats.resist]); s.giveItem(k.uid, 'guardians_banner');
  ok('Guardian\'s Banner: all 3 heroes get its defense and resist', s.heroes.every((h, i) => h.stats.defense === before[i][0] + def && h.stats.resist === before[i][1] + res), JSON.stringify(s.heroes.map((h) => [h.stats.defense, h.stats.resist])));
  const fall = (state) => { state.heroes[0].alive = false; state.heroes[0].hp = 0; state.refreshStats(); return [state.heroes[1].stats.defense, state.heroes[1].stats.resist]; };
  const { s: s0 } = mk(); const plain = fall(s0), got = fall(s);
  ok('...and lose it when the holder falls (same as a squad without it)', got[0] === plain[0] && got[1] === plain[1], JSON.stringify([plain, got])); }
// Assault Breastplate (epic): +defense for the holder, and EVERY enemy has less defense (aura, per copy) while it lives
{ const eff = itemDefs.assault_breastplate.effects, def = eff.find((e) => e.stat === 'defense').flat, shred = eff.find((e) => e.special === 'assaultShred').percent;
  const hitWith = (n, enemyDef = 40, dead = false) => { const { s, es, k } = mk(); for (let i = 0; i < n; i++) s.giveItem(k.uid, 'assault_breastplate'); es[1].stats.defense = enemyDef; es[1].hp = es[1].maxHp = 1e7; if (dead) { k.alive = false; k.hp = 0; } return { s, k, amount: s.strike(s.heroes[1], es[1], [], { damageType: 'melee' }).amount }; };
  const { s: s0, k: k0 } = mk(); const d0 = k0.stats.defense; const { k: k2 } = hitWith(2);
  ok('Assault Breastplate: +defense per copy for its holder', Math.abs(k2.stats.defense - d0 - 2 * def) < 0.01, `${d0} -> ${k2.stats.defense}`);
  const plain = hitWith(0).amount, one = hitWith(1).amount, two = hitWith(2).amount, same = hitWith(0, 40 - shred).amount, same2 = hitWith(0, 40 - 2 * shred).amount;
  ok('...an ALLY\'s hit on an enemy goes through ' + shred + ' less defense per copy', one === same && two === same2 && two > one && one > plain, `${plain} ${one}=${same} ${two}=${same2}`);
  ok('...gone when the holder is dead', hitWith(1, 40, true).amount === plain); }
