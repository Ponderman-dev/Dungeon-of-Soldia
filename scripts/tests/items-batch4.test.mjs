// New items batch 4 (session 27): Sweeping Strap (melee swings also hit neighbours), Kinetic Coil (dodges store
// electric charges for the next attack), Sharpest Blade (plain physical attacks may strike the heart: big hit + stun).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin', 'goblin', 'goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const melee = (s) => s.heroes.find((h) => h.damageType === 'melee');
const lost = (e) => 1e7 - e.hp;

// Sweeping Strap
{ const sw = val('sweeping_strap', 'sweep');
  const { s, es } = mk(); const k = melee(s); give(s, k, 'sweeping_strap', 2);
  const [t, near, far] = es; t.x = 100; t.y = 100; near.x = 100 + sw.radius - 5; near.y = 100; far.x = 100 + sw.radius * 3; far.y = 100;
  s.landAttack(k, t, []);
  ok('Sweeping Strap: 2 copies, a neighbour within ' + sw.radius + 'px takes ' + (sw.percent + sw.perExtra) + '%', lost(near) === Math.round((lost(t) * (sw.percent + sw.perExtra)) / 100), `${lost(t)} ${lost(near)}`);
  ok('...an enemy further away takes nothing', lost(far) === 0);
  const { s: s2, es: es2 } = mk(); const a = melee(s2); a.damageType = 'ranged'; give(s2, a, 'sweeping_strap');
  for (const e of es2) { e.x = 100; e.y = 100; } s2.landAttack(a, es2[0], []);
  ok('...ranged attacks do not sweep', lost(es2[1]) === 0 && lost(es2[2]) === 0); }
// Kinetic Coil
{ const kc = val('kinetic_coil', 'kineticCoil');
  const { s, e } = mk(['goblin'], () => 0); const k = melee(s); give(s, k, 'kinetic_coil', 2);
  k.stats.evasion = 100;
  for (let i = 0; i < 5; i++) s.strike(e, k, [], {});
  ok('Kinetic Coil: dodges store charges, at most ' + kc.count, k.floor.coil === kc.count, `${k.floor.coil}`);
  k.stats.crit = 0; const plainHit = (() => { const { s: p, e: pe } = mk(['goblin']); const pk = melee(p); p.landAttack(pk, pe, []); return lost(pe); })();
  const ev = []; s.rng = () => 0.99; s.landAttack(k, e, ev);
  const per = kc.percent + kc.perExtra, hit = ev.find((x) => x.type === 'attack' && x.attacker === k);
  ok('...the next attack: +' + per + '% electric per charge x ' + kc.count, Math.abs(lost(e) - plainHit * (1 + (kc.count * per) / 100)) <= 2 && hit.result.riders.some((rd) => rd.damageType === 'electric'), `${plainHit} -> ${lost(e)}`);
  ok('...and the charges are used up', k.floor.coil === 0);
  s.spawnEnemies(['goblin'], 2);
  ok('...reset every floor', !k.floor.coil); }
// Sharpest Blade
{ const hs = val('sharpest_blade', 'heartStrike'), hm = val('sharpest_blade', 'heartStrikeMult');
  const plain = (() => { const { s, e } = mk(['goblin']); s.landAttack(melee(s), e, []); return lost(e); })();
  const { s, e } = mk(['goblin'], () => 0); const k = melee(s); give(s, k, 'sharpest_blade', 2);
  ok('Sharpest Blade: 2 copies = ' + (hs.percent + hs.perExtra) + '% chance', k.specials.heartStrike === hs.percent + hs.perExtra);
  k.stats.crit = 0; s.rng = () => 0; k.stats.crit = 0;
  const ev = []; s.landAttack(k, e, ev);
  const mult = (hm.percent + hm.perExtra) / 100;
  ok('...a heart strike: ' + mult + 'x damage and a ' + hs.spec.durationMs / 1000 + 's stun', ev.some((x) => x.type === 'proc' && x.itemId === 'sharpest_blade') && e.statuses.some((st) => st.type === 'stun'), `${plain} -> ${lost(e)}`);
  const { s: s2, e: e2 } = mk(['goblin'], () => 0); const k2 = melee(s2); give(s2, k2, 'sharpest_blade'); give(s2, k2, 'frost_charm');
  const ev2 = []; s2.landAttack(k2, e2, ev2);
  ok('...an element on the attack (a charm) turns it off', !ev2.some((x) => x.itemId === 'sharpest_blade'));
  const { s: s3, e: e3 } = mk(['goblin'], () => 0); const k3 = melee(s3); give(s3, k3, 'sharpest_blade'); k3.hitType = 'fire';
  const ev3 = []; s3.landAttack(k3, e3, ev3);
  ok('...an elemental attack (like the Mage) never strikes the heart', !ev3.some((x) => x.itemId === 'sharpest_blade'));
  const { s: s4, e: e4 } = mk(['goblin'], () => 0.99); const k4 = melee(s4); give(s4, k4, 'sharpest_blade');
  const ev4 = []; s4.landAttack(k4, e4, ev4);
  ok('...nothing when the chance misses', !ev4.some((x) => x.itemId === 'sharpest_blade') && lost(e4) === plain, `${lost(e4)}`);
  // Size of the heart strike against a plain hit, both without crits (rng 0 also means a sure hit).
  const { s: s5, e: e5 } = mk(['goblin'], () => 0); const k5 = melee(s5); k5.stats.crit = 0; give(s5, k5, 'sharpest_blade');
  k5.stats.crit = 0; const m = s5.heartStrike(k5); s5.strike(k5, e5, [], { basic: true, multiplier: m });
  ok('...1 copy: ' + hm.percent / 100 + 'x', m === hm.percent / 100); }
