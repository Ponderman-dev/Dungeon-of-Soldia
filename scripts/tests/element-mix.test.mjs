// Mixing elements (user, session 31): every different element among a hero's items past the first cuts that hero's
// element damage by combat.json elementMix.penaltyPerExtraPercent. Physical damage is never cut; Euclid removes the cut.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems, elementMix } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const per = rules.elementMix.penaltyPerExtraPercent;
const heroes = r('heroes.json');
const itemDefs = loadItems(frozenItems());
const mk = (items) => {
  const s = new BattleState({ heroDefs: [{ ...heroes.find((h) => h.id === 'knight'), perk: undefined }], enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin'], 1);
  const k = s.heroes[0];
  for (const id of items) s.giveItem(k.uid, id);
  for (const u of [k, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; u.stats.block = 0; }
  const ev = [];
  s.landAttack(k, es[0], ev);
  const hit = ev.find((e) => e.type === 'attack').result;
  const part = (t) => ((hit.riders || []).find((x) => x.damageType === t) || {}).amount || 0;
  return { s, k, e: es[0], hit, part };
};
const close = (a, b) => Math.abs(a - b) < 1e-6;
const one = mk(['frost_charm']), two = mk(['frost_charm', 'storm_charm']), four = mk(['frost_charm', 'storm_charm', 'kindling', 'shadow_charm']);
const same = mk(['frost_charm', 'frost_charm']), euclid = mk(['frost_charm', 'storm_charm', 'kindling', 'shadow_charm', 'euclid_of_elements']);
ok('one element: no cut', one.k.elementCut === 0);
ok('two of the SAME element: no cut', same.k.elementCut === 0);
ok(`two elements: -${per}%`, two.k.elementCut === per, `${two.k.elementCut}`);
ok(`four elements: -${3 * per}%`, four.k.elementCut === 3 * per, `${four.k.elementCut}`);
ok('Euclid of Elements: no cut with four elements', euclid.k.elementCut === 0);
ok('the ice part of the hit is cut', close(two.part('ice'), one.part('ice') * (1 - per / 100)), `${one.part('ice').toFixed(2)} -> ${two.part('ice').toFixed(2)}`);
ok('...and cut more with four elements', close(four.part('ice'), one.part('ice') * (1 - (3 * per) / 100)));
const steel = (x) => x.hit.amount - (x.hit.riders || []).reduce((a, y) => a + y.amount, 0);
ok('the physical part is never cut', Math.abs(steel(one) - steel(four)) <= 1, `${steel(one).toFixed(1)} vs ${steel(four).toFixed(1)}`);
const burn = (x) => { x.s.applyStatus(x.e, { status: 'burn', durationMs: 3000, damageMultiplier: 1 }, x.k, 'test', []); return x.e.statuses.filter((st) => st.type === 'burn').pop().damage; };
const b1 = burn(mk(['kindling'])), b2 = burn(mk(['kindling', 'frost_charm']));
ok('burns are cut too', b2 < b1, `${b1} -> ${b2}`);
ok('elementMix counts provides tags only for the listed elements', elementMix({ items: ['venom_fang', 'kindling'] }, itemDefs, rules.elementMix).elements.join() === 'fire');
