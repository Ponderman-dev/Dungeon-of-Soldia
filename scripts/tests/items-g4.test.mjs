// Phase G4: debuff payoffs (real items.json).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.health = 1e6; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const dmg = (s, a, t, opts = {}) => s.strike(a, t, [], opts).amount;
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const burn = (s, t, src) => s.applyStatus(t, { status: 'burn', durationMs: 9000, damageMultiplier: 0.001, damageType: 'fire' }, src, 'b', []);
const bleed = (s, t, src) => s.applyStatus(t, { status: 'bleed', durationMs: 9000, damageMultiplier: 0.001 }, src, 'bl', []);
const poison = (s, t, src) => s.applyStatus(t, { status: 'poison', durationMs: 9000, damageMultiplier: 0.001, damageType: 'dark' }, src, 'p', []);

ok('all 9 G4 items exist', ['executioners_axe', 'magma_core', 'shatter_hammer', 'blood_chalice', 'plague_flask', 'exploiters_lens', 'hunters_sigil', 'thousand_cuts', 'frozen_thunderbolt'].every((id) => itemDefs[id] && itemDefs[id].description));

// Executioner's Axe
{ const { s, es, k } = mk(); give(s, k, 'executioners_axe'); const full = dmg(s, k, es[0]); es[0].hp = es[0].maxHp * 0.2; const low = dmg(s, k, es[0]);
  ok('Executioner\'s Axe: +30% damage under 25% health', near(low / full, 1.3), `${full} -> ${low}`);
  es[0].hp = es[0].maxHp * 0.3; ok('...not at 30%', near(dmg(s, k, es[0]) / full, 1)); }
{ const { s, es, k } = mk(); give(s, k, 'executioners_axe', 3); es[0].hp = 1; const x = dmg(s, k, es[0]); const { s: s0, es: e0, k: k0 } = mk(); e0[0].hp = 1; const base = dmg(s0, k0, e0[0]);
  ok('...extra copies add a little less each (30 + 28.5 + 27 = +85.5%)', near(x / base, 1.855, 0.04), `${x / base}`); }
// Magma Core
{ const { s, es, k } = mk(); give(s, k, 'magma_core'); const clean = dmg(s, k, es[0]); burn(s, es[0], k); const hot = dmg(s, k, es[0]);
  ok('Magma Core: burning enemies take +35% damage from the holder', near(hot / clean, 1.35), `${clean} -> ${hot}`);
  ok('...only from the holder', near(dmg(s, s.heroes[1], es[0]) / dmg(mk().s, mk().k, mk().es[0]) , 1, 0.2)); }
{ const tickRate = (n) => { const { s, es, k } = mk(); give(s, k, 'magma_core', n); es[0].hp = es[0].maxHp; s.applyStatus(es[0], { status: 'burn', durationMs: 60000, damageMultiplier: 0.001, damageType: 'fire' }, k, 'b', []); let ticks = 0; for (let t = 0; t < 5000; t += 20) ticks += s.update(20).filter((e) => e.type === 'dot').length; return ticks; };
  const base = tickRate(0), one = tickRate(1), five = tickRate(5);
  ok('...burn ticks 40% faster', near(one / base, 1.4, 0.06), `${base} -> ${one}`);
  ok('...and the speed does NOT grow with more cores', near(five / base, 1.4, 0.06), `${five / base}`); }
{ const burn = (n) => { const { s, es, k } = mk(); give(s, k, 'magma_core', n); s.applyStatus(es[0], { status: 'burn', durationMs: 3000, damageMultiplier: 1, damageType: 'fire' }, k, 'b', []); return es[0].statuses.find((x) => x.type === 'burn').damage; };
  const b0 = burn(0); ok('...burn ticks +15% harder per core (3 cores = +45%)', near(burn(3) / b0, 1.45, 0.03), `${b0} ${burn(3)}`); }
// Shatter Hammer
{ const { s, es, k } = mk(); give(s, k, 'shatter_hammer'); const clean = dmg(s, k, es[0]);
  s.applyStatus(es[0], { status: 'freeze', durationMs: 5000 }, k, 'f', []); const ev = []; const hit = s.strike(k, es[0], ev, {});
  ok('Shatter Hammer: +85% damage on a frozen enemy', near(hit.amount / clean, 1.85), `${clean} -> ${hit.amount}`);
  ok('...and the hit breaks the freeze', !es[0].statuses.some((x) => x.type === 'freeze') && ev.some((e) => e.type === 'proc' && e.label === 'Shatter!'));
  const again = dmg(s, k, es[0]); ok('...so the next hit is normal damage', near(again / clean, 1)); }
{ const { s, es, k } = mk(); give(s, k, 'shatter_hammer'); give(s, k, 'chill_band'); for (let i = 0; i < 5; i++) s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'c', []);
  ok('(Chill reaching 5 stacks freezes, so Chill sources feed it)', es[0].statuses.some((x) => x.type === 'freeze')); }
// Blood Chalice
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'blood_chalice'); const clean = dmg(s, k, es[0]); bleed(s, es[0], k);
  ok('Blood Chalice: bleeding enemies take +28% damage', near(dmg(s, k, es[0]) / clean, 1.28));
  k.hp = 1000; es[0].hp = 1; s.strike(k, es[0], [], {}); ok('...killing a BLEEDING enemy heals the holder 3%', Math.abs(k.hp - (1000 + k.maxHp * 0.03)) < 5, `${k.hp}`);
  k.hp = 1000; es[1].hp = 1; s.strike(k, es[1], [], {}); ok('...killing a non-bleeding one does not', k.hp === 1000); }
// Plague Flask
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'plague_flask');
  for (let i = 0; i < 5; i++) poison(s, es[0], k); const ev = []; es[0].hp = 1; s.strike(k, es[0], ev, {});
  const got = es.slice(1).map((e) => s.stacks(e, 'poison'));
  ok('Plague Flask: 15% of the poison stacks (5 -> 1, at least 1) spread to ONE other enemy', got.filter((n) => n === 1).length === 1 && got.filter((n) => n === 0).length === 1, got.join()); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask', 4); for (let i = 0; i < 10; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...+15% per extra flask (4 flasks = 60%: 10 stacks -> 6)', s.stacks(es[1], 'poison') === 6, `${s.stacks(es[1], 'poison')}`); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask', 10); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...can pass 100% (10 flasks = 150%: 4 stacks -> 6)', s.stacks(es[1], 'poison') === 6, `${s.stacks(es[1], 'poison')}`); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'plague_flask', 2); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...+1 enemy per copy (2 copies: both others get 30% of 4 = 1 stack)', es.slice(1).every((e) => s.stacks(e, 'poison') === 1)); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'plague_flask'); for (let i = 0; i < 4; i++) poison(s, es[0], k); es[0].hp = 1; const ev = [];
  let threw = false; try { s.strike(k, es[0], ev, {}); } catch { threw = true; } ok('...with no other enemy nothing happens (no crash)', !threw); }
{ const { s, es, k, h } = mk(['goblin', 'goblin']); give(s, k, 'plague_flask'); for (let i = 0; i < 4; i++) poison(s, es[0], h[1]); es[0].hp = 1; s.strike(k, es[0], [], {});
  ok('...only the HOLDER\'s own poison spreads', s.stacks(es[1], 'poison') === 0); }
// Exploiter's Lens
{ const { s, es, k } = mk(); give(s, k, 'exploiters_lens'); const clean = dmg(s, k, es[0]);
  burn(s, es[0], k); bleed(s, es[0], k); ok('Exploiter\'s Lens: nothing with only 2 different debuffs', near(dmg(s, k, es[0]) / clean, 1));
  poison(s, es[0], k); ok('...+42% with 3 different debuffs', near(dmg(s, k, es[0]) / clean, 1.42));
  poison(s, es[0], k); poison(s, es[0], k); ok('...extra stacks of the same kind do not count', near(dmg(s, k, es[0]) / clean, 1.42)); }
// Hunter's Sigil
{ const { s, es, k, h } = mk(['goblin', 'goblin']); give(s, k, 'hunters_sigil'); const before = dmg(s, h[1], es[0]);
  const first = []; s.strike(k, es[0], first, {});
  ok('Hunter\'s Sigil: the first hit on an enemy Marks it', es[0].statuses.some((x) => x.type === 'mark' && x.damageTakenPercent === 14));
  const after = dmg(s, h[1], es[0]); ok('...the whole squad hits it +14% harder', near(after / before, 1.14), `${before} -> ${after}`);
  ok('...the other enemy is not marked yet', !es[1].statuses.some((x) => x.type === 'mark')); s.strike(k, es[1], [], {}); ok('...but is after the holder hits it', es[1].statuses.some((x) => x.type === 'mark')); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'hunters_sigil', 3); s.strike(k, es[0], [], {}); const m = es[0].statuses.find((x) => x.type === 'mark');
  ok('...3 copies: +42% and the mark lasts longer', m.damageTakenPercent === 42 && m.remaining === 10000, `${m.damageTakenPercent} ${m.remaining}`);
  const marks = es[0].statuses.filter((x) => x.type === 'mark').length; s.strike(k, es[0], [], {}); ok('...only one mark per enemy (it is not marked again)', es[0].statuses.filter((x) => x.type === 'mark').length === marks); }
// Thousand Cuts
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Thousand Cuts: a melee hit can apply Bleed, with 1 EXTRA stack (2 stacks)', s.stacks(es[0], 'bleed') === 2, `${s.stacks(es[0], 'bleed')}`); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.applyStatus(es[0], { status: 'bleed', durationMs: 5000, damageMultiplier: 0.1 }, k, 'any', []);
  ok('...EVERY bleed the holder applies gets the extra stack (also from skills)', s.stacks(es[0], 'bleed') === 2); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'thousand_cuts'); s.applyStatus(es[0], { status: 'bleed', durationMs: 5000, damageMultiplier: 0.1 }, s.heroes[1], 'any', []);
  ok('...but not bleeds from other heroes', s.stacks(es[0], 'bleed') === 1); }
{ const { s, es } = mk(['goblin'], () => 0, ); const ar = new BattleState({ heroDefs: ['archer', 'knight', 'rogue'].map((id) => ({ ...r('heroes.json').find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0 });
  const e = ar.spawnEnemies(['goblin'], 1)[0]; ar.giveItem(ar.heroes[0].uid, 'thousand_cuts'); ar.rollProcs(ar.heroes[0], 'onAttack', [], { target: e, hit: true });
  ok('...a ranged holder does not apply bleed from hits (melee only)', ar.stacks(e, 'bleed') === 0); void s; void es; }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'thousand_cuts'); const mid = es[1]; bleed(s, mid, k); const hp0 = es.map((e) => e.hp); mid.hp = 1; s.strike(s.heroes[1], mid, [], {});
  ok('a bleeding enemy dying bursts knives into the enemies next to it', es[0].hp < hp0[0] && es[2].hp < hp0[2], `${hp0[0] - es[0].hp}`); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'thousand_cuts'); const mid = es[1]; const hp0 = es.map((e) => e.hp); mid.hp = 1; s.strike(s.heroes[1], mid, [], {});
  ok('...no burst if it was not bleeding', es[0].hp === hp0[0] && es[2].hp === hp0[2]); }
{ const burst = (n) => { const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'thousand_cuts', n); bleed(s, es[1], k); const hp = es[0].hp; es[1].hp = 1; s.strike(s.heroes[1], es[1], [], {}); return hp - es[0].hp; };
  ok('...more copies = bigger burst', burst(2) > burst(1) * 1.8); }
// Frozen Thunderbolt: an electric hit on a CHILLED / FROZEN enemy shatters (ice burst on it + its neighbours, the cold is used up)
{ const pct = itemDefs.frozen_thunderbolt.effects.find((e) => e.special === 'frozenThunderbolt').percent;
  const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); const hp0 = es.map((e) => e.hp);
  let ev = []; s.strike(k, es[1], ev, { damageType: 'electric', multiplier: 1 });
  ok('Frozen Thunderbolt: an electric hit on an enemy with no chill does nothing', !ev.some((e) => e.type === 'attack' && e.damageType === 'ice') && es[0].hp === hp0[0]);
  s.applyStatus(es[1], { status: 'chill', durationMs: 5000, stacks: 2 }, k, 'test', []); ev = []; const mid = es.map((e) => e.hp);
  s.strike(k, es[1], ev, { damageType: 'electric', multiplier: 1 });
  const ice = ev.filter((e) => e.type === 'attack' && e.damageType === 'ice');
  ok('...on a chilled enemy: an ice burst on it and both neighbours', ice.length === 3 && es[0].hp < mid[0] && es[2].hp < mid[2], `${ice.length}`);
  ok(`...each burst is ${pct}% of attack`, ice.every((e) => near(e.result.amount, k.stats.attack * pct / 100, 0.25 * k.stats.attack)), ice.map((e) => e.result.amount).join());
  ok('...and the chill is used up', s.stacks(es[1], 'chill') === 0);
  s.applyStatus(es[1], { status: 'freeze', durationMs: 2000 }, k, 'test', []); ev = []; s.strike(k, es[1], ev, { damageType: 'electric', multiplier: 1 });
  ok('...a frozen enemy shatters too, the freeze ends', ev.some((e) => e.type === 'attack' && e.damageType === 'ice') && !es[1].statuses.some((x) => x.type === 'freeze')); }
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'test', []); const hp0 = es[1].hp; s.strike(k, es[0], [], { damageType: 'fire' });
  ok('...a fire hit does nothing', es[1].hp === hp0 && s.stacks(es[0], 'chill') === 1); }
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin']); give(s, k, 'frozen_thunderbolt'); give(s, k, 'static_crystal');
  for (const e of es) s.applyStatus(e, { status: 'chill', durationMs: 5000 }, k, 'test', []);
  s.rng = () => 0.001; const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true });
  ok('Static Crystal bolts on chilled enemies set off Frozen Thunderbolt (the one exception to proc depth 1)', ev.some((e) => e.type === 'attack' && e.damageType === 'ice'));
  const bursts = ev.filter((e) => e.type === 'attack' && e.damageType === 'ice').length; ok('...but a burst never starts another burst (finite)', bursts < 12, `${bursts}`); }
{ const dmg = (n) => { const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'frozen_thunderbolt', n); s.applyStatus(es[0], { status: 'chill', durationMs: 5000 }, k, 'test', []); const hp0 = es[1].hp; s.strike(k, es[0], [], { damageType: 'electric', multiplier: 1 }); return hp0 - es[1].hp; };
  ok('...burst damage adds up per copy', near(dmg(2) / dmg(1), 2, 0.1)); }
