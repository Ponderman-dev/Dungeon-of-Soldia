// Element charms (and Chill Band, Magma Core: `mergeCopies` onAttack strikes) ride INSIDE the attack: one hit, one number
// (user, 2026-10-21). The ice part = attack x its multiplier (the +ice damage % does NOT boost it: grows evenly).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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
  return { hits: ev.filter((e) => e.type === 'attack'), k };
};
const plain = mk([]), one = mk(['frost_charm']), two = mk(['frost_charm', 'frost_charm']), band = mk(['frost_charm', 'chill_band']);
ok('Frost Charm: still ONE hit per attack', one.hits.length === 1, `${one.hits.length} hits`);
ok('...and it is bigger than without the charm', one.hits[0].result.amount > plain.hits[0].result.amount, `${plain.hits[0].result.amount} -> ${one.hits[0].result.amount}`);
ok('...the hit says it carries ice (for the look)', (one.hits[0].result.riders || []).some((x) => x.damageType === 'ice'));
ok('2 charms: still one hit, more ice', two.hits.length === 1 && two.hits[0].result.riders[0].amount > one.hits[0].result.riders[0].amount);
ok('Frost Charm + Chill Band: one hit, one ice part', band.hits.length === 1 && band.hits[0].result.riders.length === 1);
const fc = itemDefs.frost_charm.effects.find((e) => e.strike);
const want = one.k.stats.attack * fc.strike.damageMultiplier;
ok('ice part = attack x multiplier (no +ice %), before resist', one.hits[0].result.riders[0].amount <= want + 1e-9 && one.hits[0].result.riders[0].amount > 0, `${one.hits[0].result.riders[0].amount.toFixed(2)} <= ${want.toFixed(2)}`);
ok('2 charms = twice the ice of 1 (grows evenly)', Math.abs(two.hits[0].result.riders[0].amount - 2 * one.hits[0].result.riders[0].amount) < 1e-6);
