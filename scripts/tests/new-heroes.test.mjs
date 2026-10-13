// E3-E10 heroes (real data): Archer, Berserker, Samurai, Mage, Cleric, Necromancer, Bard, Alchemist.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), heroDefs = r('heroes.json'), skills = r('skills.json');
const noCast = Object.fromEntries(Object.entries(skills).map(([id, d]) => [id, { ...d, castMs: 0, ...(d.rotation ? { rotation: d.rotation.map((x) => ({ ...x, castMs: 0 })) } : {}) }]));
const def = (id) => ({ ...heroDefs.find((h) => h.id === id), perk: undefined });
// A squad of 3 (first = the hero under test) against `enemyIds`; rng can be fixed.
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random, sk = noCast) => {
  const s = new BattleState({ heroDefs: ids.map(def), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: sk, rules: { ...rules, skillWindUp: { defaultCastMs: 0 } }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const atk = (ev) => ev.filter((e) => e.type === 'attack');
const T = ['knight', 'rogue'];

// ================= every hero is valid
{ const ids = heroDefs.map((h) => h.id);
  ok('10 heroes exist', ids.length === 10 && ['archer', 'berserker', 'samurai', 'mage', 'cleric', 'necromancer', 'bard', 'alchemist'].every((i) => ids.includes(i)));
  ok('every hero has an attack + support skill that exists, a perk, a passive with a name', heroDefs.every((h) => skills[h.skills.attack] && skills[h.skills.support] && skills[h.skills.attack].kind === 'attack' && skills[h.skills.support].kind === 'support' && h.perk && h.passive && h.passive.name)); }

// ================= ARCHER
{ const { s, a, es } = mk(['archer', ...T], undefined, () => 0.99); s.refreshStats(); const atk0 = a.stats.attackEfficiency, crit0 = a.stats.crit;
  run(s, 2900); ok('Steady Aim: not active before 3s without a hit', !a.steady && a.stats.attackEfficiency === atk0);
  run(s, 300);
  ok('...after 3s without being hit: +25% attack speed and +15 crit', a.steady && Math.abs(a.stats.attackEfficiency - (atk0 + 25)) < 0.01 && Math.abs(a.stats.crit - (crit0 + 15)) < 0.01);
  s.strike(es[0], a, [], {});
  ok('...being hit resets it at once', !a.steady && a.stats.attackEfficiency === atk0 && a.sinceHit === 0);
  run(s, 2000); ok('...and it takes another 3s', !a.steady); run(s, 1200); ok('...then it is back', a.steady); }
{ const { s, a, es } = mk(['archer', ...T]); const i = a.skills.findIndex((x) => x.kind === 'attack'); const hp0 = es.map((e) => e.hp);
  const ev = cast(s, a, 'attack');
  ok('Rain of Arrows: nothing hits at the cast itself, he is BUSY while it rains', atk(ev).length === 0 && a.casting && a.casting.channel);
  const ev2 = run(s, 2200);
  ok('...5 waves of arrows on ALL enemies over about 2s', ev2.filter((e) => e.type === 'wave').length === 5 && atk(ev2).length === 15 && es.every((e, n) => e.hp < hp0[n]));
  ok('...as ranged damage with arrows falling', atk(ev2).every((e) => e.damageType === 'ranged') && ev2.filter((e) => e.type === 'projectile' && e.kind === 'rain').length === 15);
  ok('...and then he is free again', !a.casting); }
{ const { s, a, es } = mk(['archer', ...T], ['goblin', 'goblin'], () => 0.1); // rng .1 < 25%: every hit breaks armor
  cast(s, a, 'attack'); run(s, 2200);
  ok('each arrow hit can Armor Break (25%)', es.every((e) => e.statuses.some((x) => x.type === 'armorBreak'))); }
{ const { s, a } = mk(['archer', ...T]); cast(s, a, 'attack'); run(s, 500);
  s.applyStatus(a, { status: 'stun', durationMs: 500 }, s.enemies[0], 'x', []); const ev = run(s, 2000);
  ok('stunned during the rain: it stops, no more waves', ev.some((e) => e.type === 'castCancel') && ev.filter((e) => e.type === 'wave').length < 3); }
{ const { s, a, es } = mk(['archer', ...T]); const [g] = es; const ev = cast(s, a, 'support');
  ok('Hunter\'s Mark: marks an enemy (+25% damage from everyone)', g.statuses.some((x) => x.type === 'mark' && x.damageTakenPercent === 25) || es.some((e) => e.statuses.some((x) => x.type === 'mark')));
  const marked = es.find((e) => e.statuses.some((x) => x.type === 'mark')); const other = es.find((e) => e !== marked);
  const k = s.heroes[1]; const x = s.strike(k, marked, [], {}).amount, y = s.strike(k, other, [], {}).amount;
  ok('...everyone hits it harder', x > y * 1.15, `${x} vs ${y}`); }

// ================= BERSERKER
{ const { s, a } = mk(['berserker', ...T]); s.refreshStats();
  const full = s.interval(a); a.hp = a.maxHp / 2; const half = s.interval(a);
  ok('Bloodrage: at half health he attacks 30% faster (0.6% per % missing)', Math.abs(full / half - 1.3) < 0.02, `${full.toFixed(0)} -> ${half.toFixed(0)}`);
  a.hp = a.maxHp * 0.1; ok('...and faster still the more hurt he is', s.interval(a) < half); }
{ const { s, a, es } = mk(['berserker', ...T]); const [g, g2, g3] = es; const m = 2.0;
  const hit = (t) => { const ev = cast(s, a, 'attack'); a.skills[0].cooldownLeft = 0; return atk(ev).find((e) => e.target === t); };
  s.setFocus(g.uid); const plain = hit(g);
  s.applyStatus(g, { status: 'bleed', durationMs: 9000, damageMultiplier: 0.1 }, a, 'b', []); const bleeding = hit(g);
  ok('Savage Leap: DOUBLE damage on a bleeding enemy', Math.abs(bleeding.result.amount / plain.result.amount - 2) < 0.15, `${plain.result.amount} -> ${bleeding.result.amount}`);
  g.statuses = []; g.hp = g.maxHp * 0.4; const low = hit(g);
  ok('...and on an enemy below half health', Math.abs(low.result.amount / plain.result.amount - 2) < 0.15);
  const ev = cast(s, a, 'attack'); void ev; }
{ const { s, a, es, h } = mk(['berserker', ...T]); const ev = cast(s, a, 'support'); const a0 = h[1].baseStats.attack;
  ok('War Cry: squad +25% attack and every enemy Weakened', h.every((x) => x.stats.attack > x.baseStats.attack * 1.2) && es.every((e) => e.statuses.some((x) => x.type === 'weaken')));
  run(s, 5200); ok('...both last 5s', h.every((x) => Math.abs(x.stats.attack - x.baseStats.attack) < 0.01) && es.every((e) => !e.statuses.some((x) => x.type === 'weaken'))); void a0; }

// ================= SAMURAI
{ const { s, a } = mk(['samurai', ...T]);
  ok('Samurai: slow (attack speed 70) and hits hard (attack 30)', a.stats.attackEfficiency === 70 && a.stats.attack === 30 && a.damageType === 'melee'); }
{ let n = 0; const N = 5000; const { s, a, es } = mk(['samurai', ...T], ['goblin']);
  for (let i = 0; i < N; i++) { es[0].statuses = []; const ev = []; s.landAttack(a, es[0], ev); if (es[0].statuses.some((x) => x.type === 'bleed')) n++; }
  ok('Focused Strike: about 35% of his hits make the enemy bleed (with +25% easier: ~43%)', Math.abs(n / N - 0.4375) < 0.04, `${(n / N * 100).toFixed(1)}%`); }
{ const { s, a, es } = mk(['samurai', ...T]); const ev = cast(s, a, 'attack'); const hp0 = es.map((e) => e.hp);
  ok('Wind Cutter: ranged-type damage to ALL enemies + Armor Break', atk(ev).length === 3 && atk(ev).every((e) => e.damageType === 'ranged') && es.every((e) => e.statuses.some((x) => x.type === 'armorBreak')));
  ok('...from his slot (he does not move)', a.x === a.homeX && a.y === a.homeY); }
{ const { s, a, es } = mk(['samurai', ...T]); cast(s, a, 'support');
  const ev = []; const res = s.strike(es[0], a, ev, {});
  ok('Focus Stance: hits against him are parried', res.parried && res.dodged && a.hp === a.maxHp);
  const hit = s.strike(a, es[0], [], { basic: true });
  ok('...and his next basic attack is a guaranteed crit', hit.crit);
  const hit2 = s.strike(a, es[0], [], { basic: true });
  ok('...only the next one', !hit2.crit);
  run(s, 4200); ok('...the parry ends after 4s', !s.has(a, 'parry')); }

// ================= MAGE
{ const { s, a } = mk(['mage', ...T]); a.timer = 0;
  ok('Mage: ranged fire attacker, Elemental Rotation shows Fireball first', a.damageType === 'fire' && s.currentSpell(a, 0).name === 'Fireball'); }
{ const { s, a, es } = mk(['mage', ...T]); const [g, g2] = es; s.setFocus(g.uid); const hp0 = es.map((e) => e.hp);
  const ev = cast(s, a, 'attack');
  ok('Fireball: big fire hit on one enemy, splash on its neighbours, Burn', atk(ev).some((e) => e.target === g && e.damageType === 'fire') && g2.hp < hp0[1] && es[2].hp === hp0[2] && g.statuses.some((x) => x.type === 'burn') && g2.statuses.some((x) => x.type === 'burn'));
  const main = atk(ev).find((e) => e.target === g).result.amount, spl = atk(ev).find((e) => e.target === g2).result.amount;
  ok('...the splash is smaller', spl < main * 0.6, `${main} / ${spl}`);
  ok('...the square now shows the NEXT spell', s.currentSpell(a, 0).name === 'Frost Nova'); }
{ const { s, a, es } = mk(['mage', ...T]); a.skills[0].rotation = 1; const ev = cast(s, a, 'attack');
  ok('Frost Nova: ice burst on ALL enemies, 2 Chill stacks each', atk(ev).length === 3 && atk(ev).every((e) => e.damageType === 'ice') && es.every((e) => s.stacks(e, 'chill') === 2));
  ok('...then Chain Lightning is next', s.currentSpell(a, 0).name === 'Chain Lightning'); }
{ const { s, a, es } = mk(['mage', ...T]); a.skills[0].rotation = 2; s.setFocus(es[0].uid);
  s.applyStatus(es[1], { status: 'burn', durationMs: 9000, damageMultiplier: 0.1 }, a, 'b', []);
  const ev = cast(s, a, 'attack'); const hits = atk(ev);
  ok('Chain Lightning: the bolt jumps through ALL enemies, Shock on each', hits.length === 3 && es.every((e) => e.statuses.some((x) => x.type === 'shock')) && hits.every((e) => e.damageType === 'electric'));
  const clean = hits.find((e) => e.target === es[0]).result.amount, burning = hits.find((e) => e.target === es[1]).result.amount;
  ok('...+50% against a burning enemy', Math.abs(burning / clean - 1.5) < 0.15, `${clean} vs ${burning}`);
  ok('...and the rotation starts over with Fireball', s.currentSpell(a, 0).name === 'Fireball'); }
{ const { s, a, es, h } = mk(['mage', ...T]); const ev = cast(s, a, 'support'); const res0 = h.map((x) => x.baseStats.resist);
  ok('Arcane Ward: the whole squad gets a magic shield (2.5x his attack) and +10 resist', h.every((x, n) => s.shieldAmount(x) === Math.round(a.stats.attack * 2.5) && x.stats.resist === res0[n] + 10));
  run(s, 4200); ok('...both last 4s', h.every((x, n) => s.shieldAmount(x) === 0 && x.stats.resist === res0[n])); }
{ const { s, a, es } = mk(['mage', ...T], ['goblin']); const [g] = es;
  a.procs = [{ proc: 'onAttack', chance: 0.001, label: 'x', itemId: 'fireitem', targets: 'self', silent: true, apply: [{ status: 'buff', durationMs: 1000, mods: [{ stat: 'defense', flat: 5 }] }] }];
  const d0 = a.stats.defense; const fired = []; for (let i = 0; i < 4; i++) { const ev = []; s.landAttack(a, g, ev); fired.push(ev.some((e) => e.type === 'proc' && e.label === 'Spellweave!')); a.procs = a.procs; }
  ok('Spellweaver: the 4th attack is empowered (free fire hit + Burn)', fired.join() === 'false,false,false,true' && g.statuses.some((x) => x.type === 'burn')); }

// ================= CLERIC
{ const { s, a, h } = mk(['cleric', ...T]); const k = h[1]; k.hp = k.maxHp / 2; const hp0 = k.hp;
  run(s, 10000); const gained = k.hp - hp0;
  ok('Cleric aura: every hero regenerates 0.3% of max health per second with no items', Math.abs(gained / k.maxHp - 0.03) < 0.003, `${(gained / k.maxHp * 100).toFixed(2)}%`); }
{ const { s, a, h } = mk(['cleric', ...T]); const k = h[1]; k.specials = { ...k.specials, regen: 1 }; k.hp = 1; const base = 1;
  run(s, 1000); ok('...and regen from items is 25% stronger (1% -> 1.25% + 0.3%)', Math.abs((k.hp - base) / k.maxHp - 0.0155) < 0.002, `${((k.hp - base) / k.maxHp * 100).toFixed(2)}%`); }
{ const { s, a, es } = mk(['cleric', ...T]); s.setFocus(es[0].uid); es[1].statuses = [];
  const clean = atk(cast(s, a, 'attack'))[0].result.amount; a.skills[0].cooldownLeft = 0;
  s.applyStatus(es[0], { status: 'weaken', durationMs: 9000 }, a, 'w', []); const bad = atk(cast(s, a, 'attack'))[0].result.amount;
  ok('Smite: holy damage, +40% against a debuffed enemy', Math.abs(bad / clean - 1.4) < 0.1, `${clean} -> ${bad}`); }
{ const { s, a, es, h } = mk(['cleric', ...T]); h[2].hp = 1000; const ev = cast(s, a, 'attack'); const dealt = atk(ev)[0].result.amount;
  ok('Smite also heals the most hurt ally for 40% of the damage', Math.abs(h[2].hp - 1000 - Math.round(dealt * 0.4 * 1.25)) <= 2, `${h[2].hp - 1000}`); }
{ const { s, a, es, h } = mk(['cleric', ...T]); h[1].hp = h[1].maxHp * 0.3; const ev = cast(s, a, 'support'); const k = h[1]; const hp0 = k.hp;
  ok('Divine Shield: the most hurt ally is invulnerable', s.has(k, 'invulnerable') && s.strike(es[0], k, [], {}).invulnerable);
  const ev2 = run(s, 2200);
  ok('...and heals 20% when it ends', !s.has(k, 'invulnerable') && k.hp >= hp0 + k.maxHp * 0.19 && ev2.some((e) => e.type === 'heal' && e.unit === k)); }
{ const { s, a, es, h } = mk(['cleric', ...T], ['goblin']); h[1].hp = h[1].maxHp * 0.5; const k = h[1]; const hp0 = k.hp;
  for (let i = 0; i < 3; i++) s.landAttack(a, es[0], []);
  const ev = []; s.landAttack(a, es[0], ev);
  ok('Mending: her 4th attack heals the most hurt ally instead of hitting', ev.some((e) => e.type === 'heal' && e.unit === k) && atk(ev).length === 0); }

// ================= NECROMANCER
{ const { s, a } = mk(['necromancer', ...T]); s.startFloor();
  ok('Necromancer: a skeleton rises at the start of the floor (no upkeep)', s.minions.length === 1 && a.stats.attackEfficiency === a.baseStats.attackEfficiency);
  run(s, 10200); ok('...and another every 8-10s', s.minions.length === 2); }
{ const { s, a, es } = mk(['necromancer', ...T]); s.setFocus(es[0].uid); s.startFloor(); const n0 = s.minions.length; es[0].hp = 1;
  const ev = cast(s, a, 'attack');
  ok('Death Coil: dark damage; a KILL raises a skeleton', atk(ev)[0].damageType === 'dark' && !es[0].alive && s.minions.length === n0 + 1); }
{ const { s, a, es } = mk(['necromancer', ...T]); s.setFocus(es[0].uid);
  const clean = atk(cast(s, a, 'attack'))[0].result.amount; a.skills[0].cooldownLeft = 0; s.applyStatus(es[0], { status: 'weaken', durationMs: 9000 }, a, 'c', []);
  const bad = atk(cast(s, a, 'attack'))[0].result.amount;
  ok('...+50% against a debuffed (cursed/poisoned) enemy', Math.abs(bad / clean - 1.5) < 0.12, `${clean} -> ${bad}`); }
{ const { s, a, es, h } = mk(['necromancer', ...T]); s.startFloor(); const sk = s.minions[0]; const ev = cast(s, a, 'support');
  ok('Bone Ward: shield for the squad AND the skeletons', [...h, sk].every((u) => s.shieldAmount(u) === Math.round(a.stats.attack * 2)));
  const hp0 = es.map((e) => e.hp); const d = s.dealDamage(h[1], 1e5); s.breakEffects(h[1], d.broken, []); // a big hit breaks the shield
  ok('...when it breaks, bone shards hit the enemies', es.some((e, n) => e.hp < hp0[n])); }

// ================= BARD
{ const { s, a, h, es } = mk(['bard', ...T]); const [, k] = h; let beats = 0, fired = 0;
  for (const u of [a, k, h[2], a, k, h[2], a, k]) { const ev = []; s.landAttack(u, es[0], ev); const b = ev.find((e) => e.type === 'beat'); if (b) beats++; if (b && b.fired) fired++; }
  ok('Rhythm: a squad beat, the 4th attack of ANY hero is empowered (bonus hit)', beats === 8 && fired === 2); }
{ const { s, a, es } = mk(['bard', ...T]); const hp0 = es.map((e) => e.hp); const ev = cast(s, a, 'attack');
  ok('Crescendo: the cast itself does nothing, then he sings (busy ~3s)', atk(ev).length === 0 && a.casting && a.casting.channel);
  const ev2 = run(s, 3500); const waves = ev2.filter((e) => e.type === 'wave');
  ok('...4 beats on ALL enemies: 30%, 50%, 70%, then a final 180%', waves.length === 4 && atk(ev2).length === 12);
  const byWave = [0, 1, 2, 3].map((w) => atk(ev2).slice(w * 3, w * 3 + 3)[0].result.amount);
  ok('...each beat hits harder, the last one hardest', byWave[0] < byWave[1] && byWave[1] < byWave[2] && byWave[2] < byWave[3], byWave.join('/')); }
{ const { s, a, h } = mk(['bard', ...T]); h.forEach((x) => (x.hp = x.maxHp * 0.5)); cast(s, a, 'support'); const hp0 = h.map((x) => x.hp);
  run(s, 4200); const gain = h.map((x, i) => (x.hp - hp0[i]) / x.maxHp);
  ok('Ballad of Rest: the squad regenerates 5% of max health per second for 4s (about 20%)', gain.every((g) => Math.abs(g - 0.2) < 0.02), gain.map((g) => (g * 100).toFixed(1)).join()); }

// ================= ALCHEMIST
{ const { s, a, es } = mk(['alchemist', ...T], ['goblin']); const [g] = es;
  s.applyStatus(g, { status: 'weaken', durationMs: 5000 }, s.heroes[1], 'w', []);
  ok('Catalyst: debuffs on enemies last 30% longer', g.statuses[0].remaining === 6500);
  s.applyStatus(s.heroes[1], { status: 'weaken', durationMs: 5000 }, g, 'w', []);
  ok('...but not on heroes', s.heroes[1].statuses[0].remaining === 5000);
  s.applyStatus(g, { status: 'poison', durationMs: 5000, damageMultiplier: 1, damageType: 'dark' }, s.heroes[1], 'p', []); const dmg = g.statuses.find((x) => x.type === 'poison').damage;
  ok('...and damage over time hits 30% harder', dmg === Math.round(s.heroes[1].stats.attack * 1.3), `${dmg}`);
  a.alive = false; g.statuses = []; s.applyStatus(g, { status: 'weaken', durationMs: 5000 }, s.heroes[1], 'w2', []);
  ok('...only while he is alive', g.statuses[0].remaining === 5000); }
{ const { s, a, es } = mk(['alchemist', ...T]); const ev = cast(s, a, 'attack'); const flasks = ev.filter((e) => e.type === 'flask');
  ok('Flask Barrage: 3 random flasks at random enemies, each with its debuff', flasks.length === 3 && flasks.every((f) => es.includes(f.target)) && atk(ev).length === 3);
  const types = new Set(); for (let i = 0; i < 40; i++) { a.skills[0].cooldownLeft = 0; for (const f of cast(s, a, 'attack').filter((e) => e.type === 'flask')) types.add(f.flask.name); }
  ok('...fire, ice and poison all happen', types.size === 3); }
{ const { s, a, h } = mk(['alchemist', ...T]); h.forEach((x) => (x.hp = x.maxHp / 2)); const seen = new Set(); let total = 0;
  for (let i = 0; i < 60; i++) { a.skills[1].cooldownLeft = 0; const ev = cast(s, a, 'support'); const fl = ev.filter((e) => e.type === 'flask'); total += fl.length; fl.forEach((f) => { seen.add(f.flask.name); ok_(f); }); }
  function ok_(f) { if (!h.includes(f.target)) throw new Error('flask hit a non-hero'); }
  ok('Mystery Brew: 2 random flasks at living HEROES: heal, speed boost or shield', total === 120 && seen.size === 3); }
{ const { s, a, h } = mk(['alchemist', ...T], ['goblin'], () => 0); // rng 0 picks the first flask and the first hero
  h[0].hp = 1000; const ev = cast(s, a, 'support');
  ok('...the heal flask heals 22% of max health', h[0].hp > 1000 + h[0].maxHp * 0.2); }
