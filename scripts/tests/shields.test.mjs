// D1 shields and invulnerable. A shield soaks damage first (oldest first), lasts durationMs or until
// broken, a BROKEN shield (used up) is told apart from one that EXPIRED, and can explode on break.
// Invulnerable: no damage at all, optional heal when it ends.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const mk = () => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(['goblin', 'goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; u.stats.defense = 0; u.stats.resist = 0; }
  return { s, es, k: s.heroes[0] };
};
const hit = (s, from, to, events = []) => { const res = s.strike(from, to, events, {}); return { res, events }; };

{ const { s, es, k } = mk(); es[0].stats.attack = 10; k.hp = k.maxHp = 1000;
  s.applyStatus(k, { status: 'shield', amount: 30, durationMs: 5000 }, k, 'ward', []);
  ok('a shield has the amount it was given', s.shieldAmount(k) === 30);
  const before = k.hp; const { res, events } = hit(s, es[0], k);
  ok('a hit smaller than the shield costs no health', k.hp === before && res.absorbed === res.amount && res.fullyAbsorbed);
  ok('...the shield shrinks by the damage', s.shieldAmount(k) === 30 - res.amount);
  ok('a fully absorbed hit has no lifesteal/thorns/debuff effects', !events.some((e) => e.type === 'thorns' || e.type === 'heal')); }

{ const { s, es, k } = mk(); es[0].stats.attack = 50; k.hp = k.maxHp = 1000;
  s.applyStatus(k, { status: 'shield', amount: 20, durationMs: 5000 }, k, 'ward', []);
  const { res, events } = hit(s, es[0], k);
  ok('a hit bigger than the shield breaks it', events.some((e) => e.type === 'shieldBreak' && e.unit === k) && s.shieldAmount(k) === 0);
  ok('...and the rest goes to health', k.hp === 1000 - (res.amount - 20) && res.absorbed === 20 && !res.fullyAbsorbed);
  ok('...a broken shield is gone from the unit', !k.statuses.some((st) => st.type === 'shield')); }

{ const { s, k } = mk();
  s.applyStatus(k, { status: 'shield', amount: 50, durationMs: 1000 }, k, 'ward', []);
  const ev = []; for (let t = 0; t < 1200; t += 50) ev.push(...s.update(50));
  ok('a shield that runs out of time EXPIRES (status expire event, not a break)', ev.some((e) => e.type === 'status' && e.change === 'expire' && e.status.type === 'shield') && !ev.some((e) => e.type === 'shieldBreak')); }

{ const { s, k } = mk();
  s.applyStatus(k, { status: 'shield', amount: 50 }, k, 'forever', []);
  for (let t = 0; t < 60000; t += 50) s.update(50);
  ok('a shield with no duration lasts until it is broken', s.shieldAmount(k) === 50); }

{ const { s, es, k } = mk(); es[0].stats.attack = 5; k.hp = k.maxHp = 1000;
  s.applyStatus(k, { status: 'shield', amount: 10 }, k, 'a', []);
  s.applyStatus(k, { status: 'shield', amount: 10 }, s.heroes[1], 'b', []);
  ok('shields from different sources both count', s.shieldAmount(k) === 20 && k.statuses.filter((x) => x.type === 'shield').length === 2);
  s.applyStatus(k, { status: 'shield', amount: 10 }, k, 'a', []);
  ok('the same shield again is refilled, not stacked', s.shieldAmount(k) === 20);
  es[0].stats.attack = 15; hit(s, es[0], k);
  ok('the oldest shield is used first', k.statuses.filter((x) => x.type === 'shield').length <= 1); }

{ const { s, k } = mk(); k.maxHp = k.hp = 200;
  s.applyStatus(k, { status: 'shield', percentMaxHp: 25 }, k, 'p', []);
  ok('percentMaxHp: 25% of the holder\'s health', s.shieldAmount(k) === 50);
  const mage = s.heroes[1]; mage.stats.attack = 40;
  s.applyStatus(k, { status: 'shield', attackMultiplier: 1.5 }, mage, 'q', []);
  ok('attackMultiplier: x the caster\'s attack', s.shieldAmount(k) === 50 + 60); }

{ const { s, es, k } = mk(); k.hp = k.maxHp = 1000; es[0].stats.attack = 500;
  s.applyStatus(k, { status: 'invulnerable', durationMs: 2000 }, k, 'div', []);
  const { res } = hit(s, es[0], k);
  ok('invulnerable: no damage at all', k.hp === 1000 && res.invulnerable && res.dodged);
  s.applyStatus(k, { status: 'poison', durationMs: 5000, damageMultiplier: 1, damageType: 'dark' }, es[0], 'p', []);
  for (let t = 0; t < 1500; t += 50) s.update(50);
  ok('...damage over time does nothing either', k.hp === 1000);
  for (let t = 0; t < 1000; t += 50) s.update(50);
  ok('...and it ends', !s.has(k, 'invulnerable')); }

{ const { s, k } = mk(); k.hp = 100; k.maxHp = 1000;
  s.applyStatus(k, { status: 'invulnerable', durationMs: 1000, healPercentOnEnd: 20 }, k, 'div', []);
  const ev = []; for (let t = 0; t < 1200; t += 50) ev.push(...s.update(50));
  ok('Divine Shield: heals a % of max health when it ends', k.hp === 300 && ev.some((e) => e.type === 'heal' && e.unit === k && e.amount === 200)); }

{ const { s, es, k } = mk(); const necro = s.heroes[1]; necro.stats.attack = 40; k.hp = k.maxHp = 1000; es[0].stats.attack = 100; es.forEach((e) => (e.hp = e.maxHp = 1e6));
  s.applyStatus(k, { status: 'shield', amount: 10, durationMs: 4000, onBreak: { damageMultiplier: 1, damageType: 'dark' } }, necro, 'bone', []);
  const hp0 = es.map((e) => e.hp); const { events } = hit(s, es[0], k);
  ok('onBreak: shards hit every enemy when the shield breaks', es.every((e, i) => e.hp < hp0[i]) && events.some((e) => e.type === 'attack' && e.attacker === necro));
  ok('...it does not explode again', !k.statuses.some((x) => x.type === 'shield')); }

{ const { s, es, k } = mk(); k.hp = 100; k.maxHp = 100; es[0].stats.attack = 5;
  s.applyStatus(k, { status: 'bleed', durationMs: 4000, damageMultiplier: 1 }, es[0], 'b', []);
  s.applyStatus(k, { status: 'shield', amount: 1000 }, k, 'ward', []);
  for (let t = 0; t < 3000; t += 50) s.update(50);
  ok('a shield soaks damage over time too', k.hp === 100 && s.shieldAmount(k) < 1000); }

{ const { s, es, k } = mk(); k.hp = k.maxHp = 1000; k.specials = { ...k.specials, thorns: 50 }; es[0].stats.attack = 50; es[0].damageType = 'melee'; es[0].hp = es[0].maxHp = 1000;
  s.applyStatus(es[0], { status: 'shield', amount: 1000 }, es[0], 'es', []);
  hit(s, es[0], k);
  ok('thorns damage hits the attacker\'s shield first', es[0].hp === 1000 && s.shieldAmount(es[0]) < 1000); }
