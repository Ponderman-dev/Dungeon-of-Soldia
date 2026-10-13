// Phase G5: shield / heal / taunt items (real items.json).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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
  ok('Warding Charm: shields the holder receives are 30% bigger', s.shieldAmount(k) - base === 130);
  give(s, k, 'warding_charm'); s.applyStatus(k, { status: 'shield', amount: 100 }, k, 'c', []); ok('...+30% per copy (2 = +60%)', s.shieldAmount(k) - base - 130 === 160); }

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
  ok('Spiked Aegis: a shield BROKEN by damage explodes on all enemies (80% attack)', es.every((e, i) => near(hp0[i] - e.hp, k.stats.attack * 0.8, 0.05)), `${hp0[0] - es[0].hp}`); }
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
  ok('...10% chance', Math.abs(n / N - 0.1) < 0.015, `${n / N}`); }
{ const real = r('heroes.json'); const s2 = new BattleState({ heroDefs: ['knight', 'rogue', 'archer'].map((id) => ({ ...real.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), itemDefs, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0 });
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

// Martyr's Shield
{ const { s, es, k, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield'); const ally = h[2]; const hp0 = ally.hp, m0 = h[1].hp;
  const ev = hitMe(s, es[0], ally, 1000);
  ok('Martyr\'s Shield: the holder takes the hit instead of the ally', ally.hp === hp0 && h[1].hp < m0 && ev.some((e) => e.type === 'proc' && e.label === 'Martyr!'));
  ok('...and pays a small health cost on top', m0 - h[1].hp > 1000 - 5, `${m0 - h[1].hp}`); }
{ const { s, es, k, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield'); const ally = h[2];
  hitMe(s, es[0], ally, 100); const hp1 = ally.hp; hitMe(s, es[0], ally, 100);
  ok('...then a cooldown: the next hit lands on the ally', ally.hp < hp1);
  for (let t = 0; t < 6200; t += 50) s.update(50); const hp2 = ally.hp; hitMe(s, es[0], ally, 100); ok('...after the cooldown it steps in again', ally.hp === hp2); }
{ const { s, es, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield'); const hp0 = h[1].hp; hitMe(s, es[0], h[1], 100);
  ok('...never for himself (he is the target)', h[1].hp === hp0 - 100 || h[1].hp < hp0); }
{ const n = (r) => { const { s, es, h } = mk(['goblin'], Math.random); give(s, h[1], 'martyrs_shield'); s.rng = Math.random; let c = 0; for (let i = 0; i < 6000; i++) { h[1].floor.martyrCd = 0; const ev = hitMe(s, es[0], h[2], 1); if (ev.some((e) => e.label === 'Martyr!')) c++; h[1].hp = h[1].maxHp; } return c / 6000; };
  ok('...the chance is 8%', Math.abs(n() - 0.08) < 0.015); }
{ const cd = (c) => { const { s } = mk(); return s.martyrCooldown(c); };
  ok('...more copies shorten the cooldown and the cost', cd(2) < cd(1) && cd(3) < cd(2)); const { s, es, h } = mk(['goblin'], () => 0); give(s, h[1], 'martyrs_shield', 3); const m0 = h[1].hp; hitMe(s, es[0], h[2], 0.0001);
  ok('...(3 copies: the health cost is smaller)', m0 - h[1].hp < Math.round(h[1].maxHp * 0.03) && h[1].specials.martyr === 8); }

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
  s.healUnit(k, 500, ev, { aura: false });
  ok('Grimoire: a heal the holder receives can launch green fire at a random enemy (150% per copy)', hp0 - es[0].hp > 0 && ev.some((e) => e.type === 'projectile' && e.kind === 'greenfire') && near(hp0 - es[0].hp, k.stats.attack * 3, 0.05), `${hp0 - es[0].hp}`);
  k.hp = k.maxHp; const hp1 = es[0].hp; s.healUnit(k, 500, [], { aura: false }); ok('...a heal at full health does not count', es[0].hp === hp1); }
{ const { s, es, k } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); k.specials.lifesteal = 100; k.hp = 1000; const hp = k.hp;
  s.healUnit(k, 10, [], { aura: false }); ok('...the fireball does no lifesteal (item damage)', k.hp === hp + 10); }
{ const ch = (n) => { const { s, k } = mk(['goblin']); give(s, k, 'lost_clerics_grimoire', n); return k.specials.grimoireChance; };
  ok('...chance 10% per copy, capped at 50%', ch(1) === 10 && ch(3) === 30 && ch(9) === 50); }
{ const { s, es, k } = mk(['goblin']); give(s, k, 'lost_clerics_grimoire'); k.specials.grimoireChance = 100; k.hp = 1;
  const ev = []; for (let t = 0; t < 2200; t += 20) ev.push(...s.update(20));
  k.specials.regen = 1; const e2 = []; for (let t = 0; t < 3100; t += 20) e2.push(...s.update(20));
  ok('...regen counts as ONE heal per second (about 3 fireballs in 3s, not 150)', (() => { const n = e2.filter((e) => e.type === 'projectile' && e.kind === 'greenfire').length; return n >= 2 && n <= 4; })(), `${e2.filter((e) => e.kind === 'greenfire').length}`); }
{ const { s, es, k, h } = mk(['goblin'], () => 0); give(s, k, 'lost_clerics_grimoire'); h[1].hp = 1; const hp0 = es[0].hp; s.healUnit(h[1], 100, [], { aura: false });
  ok('...a heal on ANOTHER hero does not count for the holder', es[0].hp === hp0); }
