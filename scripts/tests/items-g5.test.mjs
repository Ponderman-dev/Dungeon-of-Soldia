// Phase G5: shield / heal / taunt items (real items.json).
import fs from 'fs';
import { noPerks, kitsV1, frozenItems } from './util.mjs';
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
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.defense = 0; u.baseStats.health = 10000; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const hitMe = (s, e, u, amount) => { e.stats.attack = amount; const ev = []; s.strike(e, u, ev, {}); return ev; };

ok('all 8 G5 items exist', ['warding_charm', 'overheal_ring', 'spiked_aegis', 'provokers_horn', 'spite_mail', 'martyrs_shield', 'fire_heart', 'lost_clerics_grimoire'].every((id) => itemDefs[id] && itemDefs[id].description));

// Warding Charm
{ const { s, k } = mk(); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'a', []); const base = s.shieldAmount(k);
  give(s, k, 'warding_charm'); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'b', []);
  ok('Warding Charm: shields the holder receives are 20% bigger', s.shieldAmount(k) - base === 120);
  give(s, k, 'warding_charm'); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'c', []); ok('...+20% per copy (2 = +40%)', s.shieldAmount(k) - base - 120 === 140); }

// Overheal Ring
{ const { s, k } = mk(); give(s, k, 'overheal_ring'); k.hp = k.maxHp - 100; const ev = []; s.healUnit(k, 600, ev, { aura: false });
  ok('Overheal Ring: healing above full health becomes a shield (40% of the extra 500 = 200)', k.hp === k.maxHp && Math.abs(s.shieldAmount(k) - 200) < 2, `${s.shieldAmount(k)}`); }
{ const { s, k } = mk(); give(s, k, 'overheal_ring'); s.healUnit(k, 1e6, [], { aura: false });
  ok('...the shield is capped at 25% of max health', s.shieldAmount(k) <= k.maxHp * 0.25 + 1 && s.shieldAmount(k) >= k.maxHp * 0.25 - 1); }
{ const { s, k } = mk(); give(s, k, 'overheal_ring', 3); s.healUnit(k, 1000, [], { aura: false });
  ok('...more copies convert more (3 copies: 100%)', Math.abs(s.shieldAmount(k) - 1000) < 2, `${s.shieldAmount(k)}`); }
{ const { s, k } = mk(); k.hp = k.maxHp - 100; s.healUnit(k, 600, [], { aura: false }); ok('...without the ring there is no shield', s.shieldAmount(k) === 0); }

// Spiked Aegis
{ const { s, es, k } = mk(['goblin', 'goblin']); give(s, k, 'spiked_aegis'); s.applyStatus(k, { status: 'shield', amount: 50, durationMs: 9000 }, k, 'sh', []);
  const hp0 = es.map((e) => e.hp); hitMe(s, es[0], k, 5000);
  ok('Spiked Aegis: a shield BROKEN by damage explodes on all enemies (110% attack)', es.every((e, i) => near(hp0[i] - e.hp, k.stats.attack * 1.1, 0.05)), `${hp0[0] - es[0].hp}`); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'spiked_aegis'); s.applyStatus(k, { status: 'shield', amount: 50, durationMs: 500 }, k, 'sh', []);
  const hp0 = es[0].hp; for (let t = 0; t < 700; t += 50) s.update(50);
  ok('...a shield that just runs out does NOT explode', es[0].hp === hp0); }
{ const { s, es, k, h } = mk(['goblin']); give(s, k, 'spiked_aegis'); s.applyStatus(k, { status: 'shield', amount: 50 }, h[1], 'sh', []); const hp0 = es[0].hp; hitMe(s, es[0], k, 5000);
  ok('...also a shield from ANOTHER hero (e.g. Arcane Ward) explodes', hp0 - es[0].hp > 0); }
{ const { s, es, k, h } = mk(['goblin']); give(s, k, 'spiked_aegis'); s.applyStatus(k, { status: 'shield', amount: 5000, durationMs: 9000 }, k, 'sh', []); const hp0 = es[0].hp; hitMe(s, es[0], k, 100);
  ok('...a shield only damaged but not broken does not explode', es[0].hp === hp0); }

// Provoker's Horn
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'provokers_horn'); s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true });
  ok('Provoker\'s Horn: any holder gets a 10% taunt chance (the target must attack him)', s.tauntedBy(es[0]) === k); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'provokers_horn'); const clean = s.strike(k, es[0], [], {}).amount; s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, s.heroes[1], 't', []);
  ok('...taunted enemies take +15% damage from the holder', near(s.strike(k, es[0], [], {}).amount / clean, 1.15), ''); }
{ const { s, es, k } = mk(['goblin'], Math.random); give(s, k, 'provokers_horn'); s.rng = Math.random; let n = 0; const N = 8000;
  for (let i = 0; i < N; i++) { es[0].statuses = []; s.rollProcs(k, 'onAttack', [], { target: es[0], hit: true }); if (es[0].statuses.some((x) => x.type === 'taunt')) n++; }
  ok('...18% chance', Math.abs(n / N - 0.18) < 0.015, `${n / N}`); }
{ const { s, k } = mk(['goblin']); give(s, k, 'provokers_horn', 3); const p = k.procs.filter((x) => x.itemId === 'provokers_horn');
  ok('...more horns: still ONE 18% roll, taunt +0.3s per extra horn, +15% damage per horn', p.length === 1 && p[0].chance === 18 && k.specials.hornDamage === 45); }
{ const real = kitsV1(r('heroes.json')); const s2 = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => ({ ...real.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0 });
  const e = s2.spawnEnemies(['goblin'], 1)[0]; s2.giveItem(s2.heroes[0].uid, 'provokers_horn');
  ok('the Knight adds the Horn to his own Taunt Wall (two taunt rolls)', s2.heroes[0].procs.filter((p) => p.apply && p.apply.some((a) => a.status === 'taunt')).length === 2); void e; }

// Spite Mail
{ const { s, es, k } = mk(['goblin']); give(s, k, 'spite_mail'); const d0 = k.stats.defense;
  ok('Spite Mail: nothing while the holder taunts nobody', k.stats.defense === d0);
  s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, k, 't', []); s.update(20);
  ok('...while he taunts an enemy: +30 defense', k.stats.defense === d0 + 30 && k.taunting);
  ok('...and he reflects melee damage (25%)', (() => { const e = es[0]; e.hp = e.maxHp = 1e9; e.damageType = 'melee'; const hp0 = e.hp; e.stats.attack = 1000; s.strike(e, k, [], {}); return hp0 - e.hp > 0; })());
  es[0].statuses = []; s.update(20); ok('...it ends when the taunt ends', k.stats.defense === d0 && !k.taunting); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'spite_mail', 2); s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, k, 't', []); s.update(20);
  ok('...2 copies: +60 defense', k.stats.defense === 60); }
{ const { s, es, k, h } = mk(['goblin']); give(s, k, 'spite_mail'); s.applyStatus(es[0], { status: 'taunt', durationMs: 5000 }, h[1], 't', []); s.update(20);
  ok('...a taunt by someone else does not count', !k.taunting); }

// Martyr's Shield (session 18, Bodyguard): an ally under `bodyguardBelow`% health -> the holder takes ALL enemy hits
// on them for `bodyguardMs` (+1s per extra shield), then a `bodyguardCdMs` cooldown.
{ const eff = itemDefs.martyrs_shield.effects, ms = eff.find((e) => e.special === 'bodyguardMs').percent, below = eff.find((e) => e.special === 'bodyguardBelow').percent;
  const { s, es, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield'); const ally = h[2];
  ally.hp = ally.maxHp; const m0 = h[1].hp; hitMe(s, es[0], ally, 10);
  ok('Martyr\'s Shield: no guard while the ally is healthy', ally.hp < ally.maxHp && h[1].hp === m0);
  ally.hp = (ally.maxHp * (below - 5)) / 100; const ev = []; s.afterDamage(ally, ev);
  ok('...ally under ' + below + '%: the holder starts guarding (GUARD icon)', ev.some((e) => e.label === 'Bodyguard!') && ally.statuses.some((x) => x.type === 'guarded'));
  const a1 = ally.hp, m1 = h[1].hp; hitMe(s, es[0], ally, 100); hitMe(s, es[0], ally, 100);
  ok('...EVERY hit on the ally goes to the holder', ally.hp === a1 && h[1].hp < m1);
  for (let t = 0; t < ms + 100; t += 50) s.update(50); const a2 = ally.hp; hitMe(s, es[0], ally, 100);
  ok('...the guard ends after its time', ally.hp < a2);
  const ev2 = []; s.afterDamage(ally, ev2); ok('...and has a cooldown', !ev2.some((e) => e.label === 'Bodyguard!'));
  ok('...+' + eff.find((e) => e.stat === 'defense').flat + ' defense', eff.some((e) => e.stat === 'defense')); }
{ const { s, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield', 3);
  ok('...3 shields guard 2s longer', h[1].specials.bodyguardMs === itemDefs.martyrs_shield.effects.find((e) => e.special === 'bodyguardMs').percent + 2 * itemDefs.martyrs_shield.effects.find((e) => e.special === 'bodyguardMs').perExtra); }

// Fire Heart
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor();
  ok('Fire Heart: a fire shield (20% max health) at the start of the floor', Math.abs(s.shieldAmount(k) - k.maxHp * 0.2) < 2, `${s.shieldAmount(k)}`);
  give(s, k, 'fire_heart'); s.startFloor(); ok('...bigger with more copies (2 = 40%)', Math.abs(s.shieldAmount(k) - k.maxHp * 0.4) < 2); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor(); const full = s.shieldAmount(k); hitMe(s, es[0], k, 1000); const low = s.shieldAmount(k);
  ok('...it blocks damage', k.hp === k.maxHp && low < full);
  ok('...and burns whoever hits it', s.stacks(es[0], 'burn') >= 1);
  for (let t = 0; t < 3000; t += 50) s.update(50); ok('...it slowly regenerates', s.shieldAmount(k) > low); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'fire_heart'); s.startFloor(); hitMe(s, es[0], k, 4000); const after = s.shieldAmount(k);
  for (let t = 0; t < 3000; t += 50) s.update(50); ok('...once BROKEN it stays gone (until the next floor)', after === 0 && s.shieldAmount(k) === 0);
  s.spawnEnemies(['goblin'], 2); s.startFloor(); ok('...and comes back on the next floor', s.shieldAmount(k) > 0); }

// Lost Cleric's Grimoire
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire', 2); k.hp = 1000; const hp0 = es[0].hp; const ev = [];
  const got = s.healUnit(k, 500, ev, { aura: false });
  ok('Grimoire: healing is stored as Soul Energy (100% per copy); at 10% max health it fires a green fireball of 350% of the energy', got >= k.maxHp * 0.05 && ev.some((e) => e.type === 'projectile' && e.kind === 'greenfire') && near(hp0 - es[0].hp, got * 2 * 3.5, 0.05) && k.soul === 0, `${hp0 - es[0].hp} vs ${got * 7}`);
  k.hp = k.maxHp; const hp1 = es[0].hp; s.healUnit(k, 500, [], { aura: false }); ok('...a heal at full health does not count', es[0].hp === hp1); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); k.specials.lifesteal = 100; k.hp = 1000; const hp = k.hp;
  s.healUnit(k, 10, [], { aura: false }); ok('...the fireball does no lifesteal (item damage)', k.hp === hp + 10); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); k.hp = 1; const hp0 = es[0].hp; const small = Math.floor(k.maxHp * 0.04);
  const ev = []; s.healUnit(k, small, ev, { aura: false }); s.healUnit(k, small, ev, { aura: false });
  ok('...small heals are stored until the energy reaches 10% (2 x 4%: no fireball yet)', es[0].hp === hp0 && Math.abs(k.soul - small * 2) < 1);
  s.healUnit(k, small, ev, { aura: false }); ok('...the 3rd heal passes 10% and it fires', es[0].hp < hp0 && k.soul === 0);
  s.healUnit(k, Math.floor(k.maxHp * 0.2), ev, { aura: false }); ok('...at most one fireball per 0.1s (the energy waits)', k.soul > 0 && ev.filter((e) => e.kind === 'greenfire').length === 1);
  s.update(120); s.healUnit(k, 1, ev, { aura: false }); ok('...after 0.1s the stored energy fires', ev.filter((e) => e.kind === 'greenfire').length === 2); }
{ const { s, es, k, h } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); h[1].hp = 1; const hp0 = es[0].hp; s.healUnit(h[1], 100, [], { aura: false });
  ok('...a heal on ANOTHER hero does not count for the holder', es[0].hp === hp0); }
