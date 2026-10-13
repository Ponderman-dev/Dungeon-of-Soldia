// E2 Rogue (real hero data): passive Opportunist, attack Fan of Knives, support Smoke Bomb.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroDefs = r('heroes.json'), skills = r('skills.json');
const noCast = Object.fromEntries(Object.entries(skills).map(([id, d]) => [id, { ...d, castMs: 0 }]));
const mk = (enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random, itemDefs = {}) => {
  const defs = ['knight', 'rogue', 'archer'].map((id) => ({ ...heroDefs.find((h) => h.id === id), perk: undefined }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: noCast, rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  return { s, es, h: s.heroes, rogue: s.heroes[1] };
};
const hit = (s, a, t) => { const ev = []; const res = s.strike(a, t, ev, {}); return res; };
const slot = (u, kind) => u.skills.findIndex((x) => x.kind === kind);

{ const { rogue } = mk();
  ok('Rogue: attack Fan of Knives, support Smoke Bomb, passive Opportunist', rogue.skills[0].id === 'fan_of_knives' && rogue.skills[1].id === 'smoke_bomb' && rogue.def.passive.name === 'Opportunist'); }

// ---- Opportunist: damage and crit vs debuffed enemies
{ const { s, es, rogue, h } = mk(['goblin', 'goblin'], () => 0.99); const [clean, bad] = es; // rng .99: no crits, no dodges
  s.applyStatus(bad, { status: 'weaken', durationMs: 9000 }, rogue, 'w', []);
  const a = hit(s, rogue, clean).amount, b = hit(s, rogue, bad).amount;
  ok('Opportunist: +15% damage against a debuffed enemy', Math.abs(b / a - 1.15) < 0.04, `${a} vs ${b}`);
  const k = hit(s, h[0], bad).amount, k0 = hit(s, h[0], clean).amount;
  ok('...only the Rogue gets it', k === k0); }
{ const { s, es, rogue } = mk(['goblin', 'goblin']); const [clean, bad] = es; rogue.stats.crit = 0;
  s.applyStatus(bad, { status: 'armorBreak', durationMs: 9000 }, rogue, 'a', []);
  let c0 = 0, c1 = 0; const N = 4000;
  for (let i = 0; i < N; i++) { if (hit(s, rogue, clean).crit) c0++; if (hit(s, rogue, bad).crit) c1++; }
  ok('...and +10 crit against a debuffed enemy (none against a clean one)', c0 === 0 && Math.abs(c1 / N - 0.1) < 0.025, `${c0} / ${(c1 / N * 100).toFixed(1)}%`); }
{ const { s, es, rogue } = mk(['goblin'], () => 0.99); const [g] = es;
  s.applyStatus(g, { status: 'shield', amount: 5 }, g, 'sh', []); s.applyStatus(g, { status: 'blockCooldown', durationMs: 5000 }, g, 'b', []);
  const a = hit(s, rogue, g).amount; s.applyStatus(g, { status: 'poison', durationMs: 9000, damageMultiplier: 1, damageType: 'dark' }, rogue, 'p', []);
  const b = hit(s, rogue, g).amount;
  ok('shields and other non-debuffs do not count; poison does', Math.abs(b / a - 1.15) < 0.04, `${a} vs ${b}`); }

// ---- Opportunist: his chance-based debuffs are 25% likelier
{ const proc = { proc: 'onAttack', chance: 20, label: 'x', itemId: 'it', targets: 'target', silent: true, apply: [{ status: 'poison', durationMs: 1000, damageMultiplier: 1, damageType: 'dark' }] };
  const rate = (heroIndex) => { const { s, es, h } = mk(['goblin']); const u = h[heroIndex]; u.procs = [proc]; let n = 0; const N = 8000;
    for (let i = 0; i < N; i++) { es[0].statuses = []; s.rollProcs(u, 'onAttack', [], { target: es[0], hit: true }); if (es[0].statuses.length) n++; } return n / N; };
  const rogueRate = rate(1), knightRate = rate(0);
  ok('his debuff procs: 20% becomes 25%; others stay 20%', Math.abs(rogueRate - 0.25) < 0.025 && Math.abs(knightRate - 0.2) < 0.025, `${(rogueRate * 100).toFixed(1)}% / ${(knightRate * 100).toFixed(1)}%`);
  const buff = { ...proc, targets: 'self', apply: [{ status: 'buff', durationMs: 1000, mods: [{ stat: 'defense', flat: 1 }] }] };
  const { s, es, h } = mk(['goblin']); h[1].procs = [buff]; let n = 0;
  for (let i = 0; i < 8000; i++) { h[1].statuses = []; h[1].procs = [buff]; s.rollProcs(h[1], 'onAttack', [], { target: es[0], hit: true }); if (h[1].statuses.length) n++; }
  ok('...but buffs on himself are not boosted', Math.abs(n / 8000 - 0.2) < 0.025); }

// ---- Fan of Knives
{ const { s, es, rogue } = mk(); const i = slot(rogue, 'attack'); const hp0 = es.map((e) => e.hp);
  const ev = s.castSkill(rogue.uid, i);
  ok('Fan of Knives hits ALL enemies', es.every((e, n) => e.hp < hp0[n]) && ev.filter((x) => x.type === 'attack').length === 3);
  ok('...as RANGED damage (so ranged items feed it)', ev.filter((x) => x.type === 'attack').every((x) => x.damageType === 'ranged'));
  ok('...with a knife flying to each enemy', ev.filter((x) => x.type === 'projectile' && x.kind === 'knife').length === 3);
  ok('...and it does not run up (he stays where he stood)', rogue.x === rogue.homeX && rogue.y === rogue.homeY); }
{ const { s, es, rogue } = mk(['bat', 'bat']); es.forEach((e) => { e.flying = true; e.stats.evasion = 0; });
  const ev = s.castSkill(rogue.uid, slot(rogue, 'attack'));
  ok('knives have no flying penalty (ranged)', ev.filter((x) => x.type === 'attack' && !x.result.dodged).length === 2); }
{ const { s, es, rogue } = mk(['goblin', 'goblin', 'goblin'], () => 0); // rng 0: every knife crits
  rogue.stats.crit = 100; s.castSkill(rogue.uid, slot(rogue, 'attack'));
  ok('every knife crits on its own, a crit makes the enemy bleed', es.every((e) => e.statuses.some((x) => x.type === 'bleed'))); }
{ const { s, es, rogue } = mk(); rogue.stats.crit = 0; s.castSkill(rogue.uid, slot(rogue, 'attack'));
  ok('no crit, no bleed', es.every((e) => !e.statuses.some((x) => x.type === 'bleed'))); }

// ---- Smoke Bomb
{ const { s, es, h, rogue } = mk(); s.refreshStats(); const e0 = h.map((x) => x.stats.evasion);
  const ev = s.castSkill(rogue.uid, slot(rogue, 'support'));
  ok('Smoke Bomb: the whole squad gets +30 evasion', h.every((x, n) => x.stats.evasion === e0[n] + 30));
  ok('...and every enemy is Blinded', es.every((e) => e.statuses.some((x) => x.type === 'blind')));
  const hp0 = es.map((e) => e.hp); void hp0;
  for (let t = 0; t < 4200; t += 50) s.update(50);
  ok('...both last 4 seconds', h.every((x, n) => x.stats.evasion === e0[n]) && es.every((e) => !e.statuses.some((x) => x.type === 'blind'))); }
{ const { s, es, h, rogue } = mk(['goblin'], () => 0.1); const [g] = es; // blind 25%: rng 0.1 -> misses
  s.castSkill(rogue.uid, slot(rogue, 'support')); g.stats.attack = 50; const ev = [];
  s.strike(g, h[0], ev, {});
  ok('a Blinded enemy misses (25% of its attacks)', ev.some((e) => e.type === 'attack' && e.result.dodged)); }
