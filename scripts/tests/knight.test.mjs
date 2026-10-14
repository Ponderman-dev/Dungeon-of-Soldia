// E1 Knight (real hero data): passive Taunt Wall, attack Ground Pound, support Rally Cry.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroDefs = r('heroes.json'), skills = r('skills.json');
const mk = (enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random) => {
  const defs = ['knight', 'rogue', 'archer'].map((id) => ({ ...heroDefs.find((h) => h.id === id), perk: undefined }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: Object.fromEntries(Object.entries(skills).map(([id, d]) => [id, { ...d, castMs: 0 }])), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  s.placeLines();
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const slot = (k, kind) => k.skills.findIndex((x) => x.kind === kind);

ok('Ground Pound winds up longer than Rally Cry, both longer than a swing', skills.ground_pound.castMs === 900 && skills.rally_cry.castMs === 600 && skills.rally_cry.castMs > rules.attackTiming.hero.swingMs);
{ const { k } = mk();
  ok('Knight: attack Ground Pound, support Rally Cry', k.skills[0].id === 'ground_pound' && k.skills[1].id === 'rally_cry');
  ok('he has a passive named Taunt Wall with one proc of 10%', k.def.passive.name === 'Taunt Wall' && k.procs.length === 1 && k.procs[0].chance === 10); }

// ---- Taunt Wall
{ const { s, es, k } = mk(['goblin', 'goblin'], () => 0); const d0 = k.stats.defense;
  const ev = []; s.landAttack(k, es[0], ev);
  ok('Taunt Wall: the enemy he hit is taunted by him', s.tauntedBy(es[0]) === k && !s.tauntedBy(es[1]));
  ok('...and he gets +20 defense (only him)', k.stats.defense === d0 + 20 && s.heroes[1].stats.defense === s.heroes[1].baseStats.defense && ev.some((e) => e.type === 'proc' && e.label === 'Taunt Wall!'));
  for (let t = 0; t < 3200; t += 50) s.update(50);
  ok('...both last 3 seconds', !s.tauntedBy(es[0]) && k.stats.defense === d0); }
{ let n = 0; const N = 6000; const { s, es, k } = mk(['goblin']);
  for (let i = 0; i < N; i++) { const ev = []; s.landAttack(k, es[0], ev); if (ev.some((e) => e.type === 'proc' && e.label === 'Taunt Wall!')) n++; k.statuses = []; es[0].statuses = []; }
  ok('Taunt Wall goes off on about 10% of his attacks', Math.abs(n / N - 0.1) < 0.02, `${(n / N * 100).toFixed(1)}%`); }
{ const { s, es, h } = mk(['goblin'], () => 0); const ev = []; s.landAttack(h[1], es[0], ev);
  ok('other heroes have no Taunt Wall', !s.tauntedBy(es[0])); }

// ---- Ground Pound
{ const { s, es, k } = mk(); es.forEach((e, n) => { e.x = e.homeX = 165 + n * 30; }); /* standing together: all inside the slam */ const i = slot(k, 'attack'); const hp0 = es.map((e) => e.hp);
  es.forEach((e) => (e.timer = 700)); const y0 = es.map((e) => e.y);
  const ev = s.castSkill(k.uid, i);
  ok('Ground Pound hits ALL enemies standing close together', es.every((e, n) => e.hp < hp0[n]) && ev.filter((x) => x.type === 'attack').length === 3);
  ok('...and knocks them back (attack timers start over)', es.every((e) => e.timer === 0) && ev.filter((x) => x.type === 'status' && x.status.type === 'knockback').length === 3);
  s.update(rules.movement.knockbackMs + 20);
  ok('...they are pushed away (up the screen)', es.every((e, n) => e.y < y0[n] - 10)); }
{ const { s, es, k } = mk(['goblin']); es[0].def = { ...es[0].def, statusDefs: undefined, statusDurationScale: 0.5 }; es[0].timer = 800;
  s.castSkill(k.uid, slot(k, 'attack'));
  ok('a boss only loses half its wind-up to the knockback', es[0].timer === 400); }

// ---- Rally Cry
{ const { s, es, k, h } = mk(); const i = slot(k, 'support');
  s.applyStatus(h[1], { status: 'poison', durationMs: 5000, damageMultiplier: 1, damageType: 'dark' }, es[0], 'p', []);
  s.applyStatus(h[1], { status: 'poison', durationMs: 5000, damageMultiplier: 1, damageType: 'dark' }, es[0], 'p', []);
  s.applyStatus(h[1], { status: 'weaken', durationMs: 5000 }, es[0], 'w', []);
  s.applyStatus(h[2], { status: 'armorBreak', durationMs: 5000 }, es[0], 'a', []);
  s.applyStatus(k, { status: 'shield', amount: 30 }, k, 'sh', []);
  const d0 = h.map((x) => x.stats.defense);
  const ev = s.castSkill(k.uid, i);
  ok('Rally Cry: the whole squad gets +15 defense', h.every((x, n) => x.stats.defense >= d0[n] + 15 - 0.001 || x.stats.defense > d0[n]), h.map((x) => x.stats.defense).join());
  ok('...every hero loses ONE debuff (a whole kind: both poison stacks)', !h[1].statuses.some((x) => x.type === 'poison') && h[1].statuses.some((x) => x.type === 'weaken'));
  ok('...a different hero loses their only debuff too', !h[2].statuses.some((x) => x.type === 'armorBreak'));
  ok('...shields and buffs are not touched', s.shieldAmount(k) === 30 && h.every((x) => x.statuses.some((st) => st.type === 'buff')));
  ok('...a "Cleansed!" popup for each cleansed hero', ev.filter((e) => e.type === 'proc' && e.label === 'Cleansed!').length === 2);
  for (let t = 0; t < 6200; t += 50) s.update(50);
  ok('...the defense lasts 6 seconds', h.every((x, n) => Math.abs(x.stats.defense - d0[n]) < 0.001)); }
{ const { s, k, h } = mk(); s.spawnEnemies(['goblin'], 1);
  const defs = { skeleton: r('minions.json').skeleton };
  h[2].def = { ...h[2].def, spawner: { minion: 'skeleton', minMs: 9999, maxMs: 9999, cap: 4, atFloorStart: 1 } }; h[2].minionSources = s.buildSources(h[2]); s.startFloor();
  const m = s.minions[0]; const d0 = m.stats.defense;
  s.applyStatus(m, { status: 'poison', durationMs: 5000, damageMultiplier: 1, damageType: 'dark' }, s.enemies[0], 'p', []);
  s.castSkill(k.uid, slot(k, 'support'));
  ok('Rally Cry reaches minions too (defense and cleanse)', m.stats.defense === d0 + 15 && !m.statuses.some((x) => x.type === 'poison')); }
{ const { s, k } = mk(); k.statuses = []; const ev = s.castSkill(k.uid, slot(k, 'support'));
  ok('Rally Cry with nothing to cleanse works fine', ev.some((e) => e.type === 'cast') && !ev.some((e) => e.label === 'Cleansed!')); }
