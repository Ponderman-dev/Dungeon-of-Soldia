// Hero kits v3 (real heroes.json, docs/hero-kits-v3.md): each hero's new gimmick. Numbers are read from the data.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const hero = (id) => heroes.find((h) => h.id === id);
const itemDefs = loadItems(frozenItems());
// A squad (first = the hero under test) against `enemyIds`, standing in lines; nobody dodges or crits.
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...hero(id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const hits = (ev, attacker) => ev.filter((e) => e.type === 'attack' && e.attacker === attacker && !e.result.dodged);

// ================= ALCHEMIST: MAD BOMBER
{ const L = hero('alchemist').passive.lobbed;
  const { s, es, a } = mk(['alchemist']); const [g, near, far] = es;
  near.x = g.x + L.splashRadius - 10; near.y = g.y; far.x = g.x + L.splashRadius + 60; far.y = g.y;
  const ev = []; s.landAttack(a, g, ev);
  const main = hits(ev, a).find((e) => e.target === g), splash = hits(ev, a).find((e) => e.target === near);
  ok('Lobbed Shots: a basic attack splashes an enemy next to the target', !!splash && !hits(ev, a).some((e) => e.target === far));
  ok('...for the splash share of the damage', main && splash && Math.abs(splash.result.amount / main.result.amount - L.splashMultiplier) < 0.08, main && splash && `${main.result.amount} / ${splash.result.amount}`);
  ok('...and poisons the target and the splashed enemy (not the far one)', g.statuses.some((x) => x.type === 'poison') && near.statuses.some((x) => x.type === 'poison') && !far.statuses.some((x) => x.type === 'poison'));
  ok('...poison only (no other debuffs)', [g, near].every((e) => e.statuses.every((x) => x.type === 'poison')));
  const base = hero('alchemist').stats.attackEfficiency;
  ok('...in exchange he attacks slower', Math.abs(a.stats.attackEfficiency - base * (1 + L.attackSpeedPercent / 100)) < 1, `${a.stats.attackEfficiency} vs ${base}`); }
{ const { s, es, a } = mk(['alchemist']); const n = skills[hero('alchemist').skills.attack].random.count;
  const gap = skills[hero('alchemist').skills.attack].random.intervalMs;
  const first = cast(s, a, 'attack').filter((e) => e.type === 'flask');
  const later = []; let busy = true; for (let t = 0; t < gap * n + 100; t += 10) { later.push(...s.update(10).filter((e) => e.type === 'flask' && e.unit === a).map(() => t)); if (busy === true && !a.casting) busy = t; }
  const fl = [...first, ...later];
  ok('...one at a time: the first flies at once, the next every ' + gap + 'ms', first.length === 1 && later.length === n - 1 && later.every((t, i) => i === 0 || t - later[i - 1] >= gap - 20), later.join());
  ok(`Big Barrage: Flask Barrage throws ${n} flasks at enemies`, n === 5 && fl.length === n);
  ok('...he is busy throwing until the last flask is out', typeof busy === 'number' && busy >= gap * (n - 1) - 20 && busy <= gap * (n - 1) + 30, busy);
  ok('...poison flasks only: enemies end up poisoned, no other debuff', es.some((e) => e.statuses.some((x) => x.type === 'poison')) && es.every((e) => e.statuses.every((x) => x.type === 'poison'))); }
{ const sk = skills[hero('alchemist').skills.support]; const { s, a, h } = mk(['alchemist', 'knight', 'rogue'], ['goblin'], () => 0); // rng 0: heal flasks
  h.forEach((x) => (x.hp = x.maxHp / 2)); const ev = cast(s, a, 'support'); for (let t = 0; t < 2000; t += 10) ev.push(...s.update(10)); const fl = ev.filter((e) => e.type === 'flask');
  ok(`Better Brew: Mystery Brew throws ${sk.random.count} flasks, cooldown ${sk.cooldownMs / 1000}s`, sk.random.count === 4 && sk.cooldownMs === 9000 && fl.length === 4 && fl.every((f) => h.includes(f.target)));
  const heals = ev.filter((e) => e.type === 'heal').slice(0, 3).map((e) => e.amount / e.unit.maxHp);
  ok(`...healing flasks heal ${sk.random.pool[0].heal.percentMaxHp}%`, heals.length === 3 && heals.every((x) => Math.abs(x - sk.random.pool[0].heal.percentMaxHp / 100) < 0.01), heals.map((x) => x.toFixed(2)).join()); }

// ================= BARD: BATTLE HYMN
const P = hero('bard').passive;
const run = (s, ms) => { const ev = []; for (let t = 0; t < ms; t += 20) ev.push(...s.update(20)); return ev; };
{ const { s, h } = mk(['bard', 'knight']); const [b, k] = h; const base = mk(['knight']).a.stats.attackEfficiency;
  ok('Bard: no song plays at the start', !b.song && Math.round(k.stats.attackEfficiency) === Math.round(base));
  cast(s, b, 'support');
  ok(`Change Song: first plays MARCH, squad +${P.songs.march.attackSpeedPercent}% attack speed (plus its burst)`, b.song === 'march' && k.stats.attackEfficiency >= base * (1 + P.songs.march.attackSpeedPercent / 100) - 0.5, `${base} -> ${k.stats.attackEfficiency}`);
  ok(`...March: item procs ${P.songs.march.procChancePercent}% likelier`, Math.abs(s.marchProcs() - (1 + P.songs.march.procChancePercent / 100)) < 1e-9);
  for (const u of [b, k]) u.statuses = u.statuses.filter((x) => x.type !== 'buff'); // clear the burst
  run(s, P.songs.durationMs + 100);
  ok(`...the song stops after ${P.songs.durationMs / 1000}s`, !b.song && s.marchProcs() === 1);
  b.skills[1].cooldownLeft = 0; k.hp = k.maxHp * 0.5; cast(s, b, 'support');
  ok('...the next cast plays BALLAD, its burst heals the squad', b.song === 'ballad' && k.hp > k.maxHp * 0.5);
  ok(`...Ballad: item heals ${P.songs.ballad.healPercent}% stronger`, Math.abs(s.regenAura().factor - (1 + P.songs.ballad.healPercent / 100)) < 1e-9);
  const hp = k.hp; s.update(1000); ok('...and the squad regenerates', k.hp > hp);
  run(s, P.songs.durationMs); b.skills[1].cooldownLeft = 0; cast(s, b, 'support'); ok('...then MARCH again', b.song === 'march'); }
{ const { s, h } = mk(['bard', 'knight']); const [b, k] = h; // March really makes item procs go off more often
  const rate = () => { let n = 0; k.procs = [{ proc: 'onAttack', chance: 40, label: 'x', itemId: 'war_banner', targets: 'self', apply: [{ status: 'shield', amount: 1, durationMs: 1 }] }]; // (a buff would refresh the stats and drop this test proc)
    const ev = []; for (let i = 0; i < 3000; i++) { const before = ev.length; s.rollProcs(k, 'onAttack', ev, {}); if (ev.length > before) n++; } return n / 3000; };
  const off = rate(); cast(s, b, 'support'); const on = rate();
  ok('...(a 40% item proc goes off about 50% of the time in March)', Math.abs(off - 0.4) < 0.04 && Math.abs(on - 0.4 * (1 + P.songs.march.procChancePercent / 100)) < 0.04, `${off.toFixed(2)} -> ${on.toFixed(2)}`); }
{ const M = P.hymn.squadItemMultiplier;
  const withBard = mk(['bard', 'knight']), alone = mk(['rogue', 'knight']);
  for (const x of [withBard, alone]) { x.s.giveItem(x.h[1].uid, 'war_banner'); x.s.giveItem(x.h[1].uid, 'spotters_lens'); x.s.giveItem(x.h[1].uid, 'heart_charm'); }
  const wb = (x) => x.h[1].procs.find((p) => p.itemId === 'war_banner').chance;
  ok(`Battle Hymn: squad items x${M} (War Banner proc chance)`, Math.abs(wb(withBard) / wb(alone) - M) < 1e-6, `${wb(alone)} -> ${wb(withBard)}`);
  ok("...(Spotter's Lens bonus)", Math.abs(withBard.h[0].specials.spotter / alone.h[0].specials.spotter - M) < 1e-6);
  ok('...but NOT other items (Heart Charm)', withBard.h[1].stats.health === alone.h[1].stats.health || withBard.h[1].maxHp - alone.h[1].maxHp < 1, `${alone.h[1].stats.health} / ${withBard.h[1].stats.health}`);
  withBard.h[0].alive = false; withBard.s.refreshStats();
  ok('...only while the Bard lives', Math.abs(wb(withBard) - wb(alone)) < 1e-6); }
{ const { s, h } = mk(['bard', 'knight', 'rogue']); const L = P.lute;
  const ev = run(s, L.everyMs + 100); const lute = ev.filter((e) => e.type === 'lute');
  ok(`Lute: every ${L.everyMs / 1000}s of a fight a random boost for the squad`, lute.length === 1 && h.every((x) => x.statuses.some((st) => st.key === 'buff:lute' || st.key === 'regenBoost:lute')), lute.map((e) => e.boost).join());
  const seen = new Set(); for (let i = 0; i < 40; i++) { h[0].floor.lute = L.everyMs; const e2 = []; s.tickLute(h[0], 0, e2); e2.filter((e) => e.type === 'lute').forEach((e) => seen.add(e.boost)); }
  ok(`...all ${L.boosts.length} boosts happen (attack / speed / defense / regen)`, seen.size === L.boosts.length, [...seen].join());
  s.spawnEnemies(['goblin'], 2); ok('...the clock starts over every floor', !h[0].floor.lute); }
{ const { s, es, h } = mk(['bard']); const b = h[0]; es.forEach((e, n) => { e.x = 165 + n * 30; e.y = es[0].y; }); s.castSkill(b.uid, b.skills.findIndex((x) => x.kind === 'attack'));
  ok(`Discord: ${skills.discord.cooldownMs / 1000}s cooldown, enemies are Charmed`, skills.discord.cooldownMs === 8000 && es.every((e) => e.statuses.some((x) => x.type === 'charm')));
  ok('...a charmed enemy attacks another ENEMY', s.pickTarget(es[0]).side === 'enemy'); }

// ================= ARCHER: VOLLEY GUNNER
const V = hero('archer').passive.volley;
{ const { s, es, a } = mk(['archer'], ['goblin', 'goblin', 'goblin', 'goblin']);
  const shots = []; for (let i = 0; i < V.every; i++) { const ev = []; s.landAttack(a, es[0], ev); shots.push(new Set(hits(ev, a).map((e) => e.target)).size); }
  ok(`Volley: shots 1-${V.every - 1} hit one enemy, shot ${V.every} hits ${V.arrows}`, shots.slice(0, -1).every((n) => n === 1) && shots[V.every - 1] === V.arrows, shots.join());
  const ev = []; s.landAttack(a, es[0], ev); ok('...then the count starts over', new Set(hits(ev, a).map((e) => e.target)).size === 1); }
{ const { s, es, a } = mk(['archer'], ['goblin', 'goblin', 'goblin', 'goblin', 'goblin']); s.giveItem(a.uid, 'quiver_of_plenty'); s.giveItem(a.uid, 'quiver_of_plenty');
  a.specials.extraArrow = 0; a.volleyCount = V.every - 1; const ev = []; s.landAttack(a, es[0], ev);
  ok(`...each Quiver of Plenty adds ${V.perQuiver} arrow to the volley`, new Set(hits(ev, a).map((e) => e.target)).size === V.arrows + 2 * V.perQuiver); }
{ const { s, es, a } = mk(['archer'], ['goblin', 'goblin', 'goblin'], () => 0); s.giveItem(a.uid, 'fire_bombs');
  a.volleyCount = V.every - 1; const ev = []; s.landAttack(a, es[0], ev);
  ok('...every volley arrow rolls her on-hit items', ev.filter((e) => e.type === 'proc' && e.itemId === 'fire_bombs').length === V.arrows); }
{ const R = skills[hero('archer').skills.attack]; const { s, es, a } = mk(['archer']); es.forEach((e, n) => { e.x = 165 + n * 30; e.y = es[0].y; });
  const ev = [...cast(s, a, 'attack')]; for (let t = 0; t < 2500; t += 20) ev.push(...s.update(20));
  const waves = ev.filter((e) => e.type === 'wave' && e.unit === a);
  const per = es.map((e) => ev.filter((x) => x.type === 'attack' && x.attacker === a && x.skill && x.target === e).length);
  ok(`Arrow Rain: ${R.channel.waves.length} waves of ${R.channel.waves[0] * 100}% on every enemy in the area`, waves.length === R.channel.waves.length && per.every((n) => n === R.channel.waves.length), per.join()); }
{ const { s, es, a } = mk(['archer'], ['goblin', 'goblin'], () => 0); es.forEach((e, n) => { e.x = 165 + n * 30; e.y = es[0].y; }); s.giveItem(a.uid, 'fire_bombs');
  const ev = [...cast(s, a, 'attack')]; for (let t = 0; t < 2500; t += 20) ev.push(...s.update(20));
  const procs = ev.filter((e) => e.type === 'proc' && e.itemId === 'fire_bombs' && e.unit === a).length;
  ok('...every wave rolls her on-hit items on each enemy hit', procs >= skills.arrow_rain.channel.waves.length * 2, procs); }

// ================= MAGE: ELEMENTALIST
const CYC = hero('mage').passive.elementCycle;
{ const { s, es, a } = mk(['mage']); const types = [];
  for (let i = 0; i < 6; i++) { const ev = []; s.landAttack(a, es[0], ev); types.push(hits(ev, a).find((e) => e.target === es[0] && e.basic).damageType); }
  ok(`Element Cycle: her basic attacks go ${CYC.join(' > ')} in turn`, types.join() === [...CYC, ...CYC].join(), types.join());
  const { s: s2, es: es2, a: a2 } = mk(['mage']); let reacts = 0;
  for (let i = 0; i < 6; i++) { const ev = []; s2.landAttack(a2, es2[0], ev); reacts += ev.filter((e) => e.type === 'reaction').length; }
  ok('...so her own attacks set off a reaction every 2nd attack (each one uses up the mark)', reacts === 3, reacts); }
const ROT = skills[hero('mage').skills.attack].rotation;
const spellAt = (s, a, i) => { a.skills[0].rotation = i; return s.currentSpell(a, 0); };
{ const { s, a } = mk(['mage']); const plain = [0, 1, 2].map((i) => spellAt(s, a, i));
  s.giveItem(a.uid, 'kindling'); s.giveItem(a.uid, 'frost_charm'); s.giveItem(a.uid, 'storm_charm'); s.giveItem(a.uid, 'storm_charm');
  const [fb, nova, chain] = [0, 1, 2].map((i) => spellAt(s, a, i));
  ok(`Charms: Kindling = Fireball +${ROT[0].charm.damagePercent}% (and its splash)`, Math.abs(fb.damageMultiplier / plain[0].damageMultiplier - (1 + ROT[0].charm.damagePercent / 100)) < 1e-9 && fb.splash.damageMultiplier > plain[0].splash.damageMultiplier);
  ok(`...Frost Charm = Nova +${ROT[1].charm.damagePercent}% damage, +${ROT[1].charm.radiusPercent}% size`, nova.damageMultiplier > plain[1].damageMultiplier && Math.abs(nova.area.radius / plain[1].area.radius - (1 + ROT[1].charm.radiusPercent / 100)) < 1e-9);
  ok(`...Storm Charm = +${ROT[2].charm.jumps} Chain jumps each`, chain.chainJumps === plain[2].chainJumps + 2 * ROT[2].charm.jumps, `${plain[2].chainJumps} -> ${chain.chainJumps}`);
  ok('...charms held by OTHER heroes do not grow her spells', (() => { const x = mk(['mage', 'knight']); x.s.giveItem(x.h[1].uid, 'kindling'); return spellAt(x.s, x.a, 0).damageMultiplier === plain[0].damageMultiplier; })()); }
{ const { s, es, a } = mk(['mage'], Array(8).fill('goblin')); es.forEach((e, n) => { e.x = 60 + n * 35; e.y = es[0].y; }); a.skills[0].rotation = 2;
  const chainHits = () => { const ev = [...cast(s, a, 'attack')]; for (let t = 0; t < 1500; t += 20) ev.push(...s.update(20)); return ev.filter((e) => e.type === 'attack' && e.attacker === a && e.skill).length; };
  a.timer = -1e12; const n0 = chainHits();
  s.giveItem(a.uid, 'storm_charm'); a.skills[0].rotation = 2; a.skills[0].cooldownLeft = 0;
  const n1 = chainHits();
  ok(`...Chain Lightning really hits 1 + ${ROT[2].chainJumps} enemies, +${ROT[2].charm.jumps} with a Storm Charm`, n0 === 1 + ROT[2].chainJumps && n1 === n0 + ROT[2].charm.jumps, `${n0} -> ${n1}`); }
{ const W = skills[hero('mage').skills.support]; const { s, es, h } = mk(['mage', 'knight']); const [m, k] = h;
  const plainHit = () => { es[0].statuses = es[0].statuses.filter((x) => x.type !== 'element'); s.strike(k, es[0], [], {}); return es[0].statuses.find((x) => x.type === 'element'); };
  ok('Team Elements: a Knight (melee) hit leaves no element normally', !plainHit());
  cast(s, m, 'support');
  ok('Arcane Ward: shield + resist on the squad', h.every((x) => x.statuses.some((st) => st.type === 'shield')));
  const el = plainHit(); ok(`...and for ${W.teamElements.durationMs / 1000}s every squad hit leaves a random element`, el && CYC.includes(el.element), el && el.element);
  run(s, W.teamElements.durationMs + 100); ok('...then it stops', !plainHit()); }

// ================= KNIGHT: IRON WALL
const G = hero('knight').passive.grudge, DB = skills[hero('knight').skills.attack];
{ const { s, es, a } = mk(['knight'], ['goblin']); a.stats.attack = 20; a.stats.defense = 30; s.focusUid = es[0].uid;
  const dmg = hits(cast(s, a, 'attack'), a).find((e) => e.skill).result.amount;
  ok(`Defense Bash: ${DB.damageMultiplier * 100}% attack + ${DB.defenseMultiplier * 100}% defense`, Math.abs(dmg - (20 * DB.damageMultiplier + 30 * DB.defenseMultiplier)) <= 2, `${dmg} vs ${20 + 90}`);
  ok('...and stuns', es[0].statuses.some((x) => x.type === 'stun')); }
{ const { s, es, a } = mk(['knight'], ['goblin']); a.stats.attack = 20; a.stats.defense = 0; a.specials.thorns = 50; s.focusUid = es[0].uid;
  for (let i = 0; i < 3; i++) s.strike(es[0], a, [], {});
  ok('Grudge: every reflected hit adds a charge', a.grudge === 3, a.grudge);
  const dmg = hits(cast(s, a, 'attack'), a).find((e) => e.skill).result.amount;
  ok(`...his next Bash is +${G.perReflectPercent}% per charge`, Math.abs(dmg - 20 * (1 + 3 * G.perReflectPercent / 100)) <= 2, dmg);
  ok('...and the charge is used up', a.grudge === 0);
  for (let i = 0; i < G.maxStacks + 5; i++) s.strike(es[0], a, [], {});
  ok(`...up to ${G.maxStacks} charges`, a.grudge === G.maxStacks); }
{ const { s, es, a } = mk(['knight'], ['goblin']); s.strike(es[0], a, [], {}); ok('...no reflect items = no charge', !a.grudge); }
{ const { s, es, h } = mk(['knight', 'rogue', 'archer']); const k = h[0];
  for (const e of es) { e.x = k.x + 40; e.y = k.y - 60; } es[2].x = k.x + 330; es[2].y = 200;
  const d0 = k.stats.defense; cast(s, k, 'support');
  ok('Challenge (unchanged): the enemies AROUND him are taunted', s.tauntedBy(es[0]) === k && s.tauntedBy(es[1]) === k && !s.tauntedBy(es[2]));
  ok('...and he gets +30 defense', k.stats.defense === d0 + 30); }

// ================= BERSERKER: BRAWLER
const BT = hero('berserker').passive.bloodthirst;
{ const { s, a } = mk(['berserker']); s.refreshStats(); a.hp = a.maxHp; const atk0 = a.stats.attack; // his real health (refreshStats undoes the test's 100000)
  a.hp = a.maxHp * (BT.belowPercent / 100) - 10; const ev = run(s, 100);
  ok(`Bloodthirst: below ${BT.belowPercent}% health, +${BT.attackPercent}% attack`, a.thirst && Math.abs(a.stats.attack / atk0 - (1 + BT.attackPercent / 100)) < 0.02 && ev.some((e) => e.type === 'proc' && e.label === 'Bloodthirst!'), `${atk0} -> ${a.stats.attack}`);
  a.specials.lifesteal = 10; a.hp = a.maxHp * 0.3; const hp0 = a.hp; s.afterHit(a, s.enemies[0], 100, []);
  ok(`...and x${BT.lifestealMultiplier} lifesteal`, Math.round(a.hp - hp0) === Math.round(100 * 0.1 * BT.lifestealMultiplier), a.hp - hp0);
  a.hp = a.maxHp; run(s, BT.lingerMs - 300); ok(`...it LINGERS ${BT.lingerMs / 1000}s after he heals above half`, a.thirst);
  run(s, 600); ok('...then it ends', !a.thirst && Math.abs(a.stats.attack - atk0) < 0.01); }
{ const L = skills[hero('berserker').skills.attack]; const { s, es, a } = mk(['berserker'], ['goblin', 'goblin', 'goblin']);
  es[0].x = 150; es[1].x = 150 + L.landSplash.radius - 20; es[2].x = 150 + L.landSplash.radius + 150; for (const e of es) e.y = 340; s.focusUid = es[0].uid;
  a.stats.crit = 0; const ev = cast(s, a, 'attack'); const dm = (e) => (hits(ev, a).find((x) => x.target === e) || { result: { amount: 0 } }).result.amount;
  ok(`Savage Leap: ${L.damageMultiplier * 100}% to its target AND the enemies where he lands`, Math.abs(dm(es[0]) - a.stats.attack * L.damageMultiplier) <= 2 && Math.abs(dm(es[1]) - dm(es[0])) <= 2 && dm(es[2]) === 0, `${dm(es[0])} ${dm(es[1])} ${dm(es[2])}`); }
{ const L = skills[hero('berserker').skills.attack]; const { s, es, a } = mk(['berserker'], ['goblin', 'goblin']); es[0].x = 150; es[1].x = 170; for (const e of es) e.y = 340; s.focusUid = es[0].uid;
  let n = 0; const tries = 1500; for (let i = 0; i < tries; i++) { a.procs = [{ proc: 'onAttack', chance: 20, label: 'x', itemId: 'war_banner', targets: 'self', apply: [{ status: 'shield', amount: 1, durationMs: 1 }] }]; a.skills[0].cooldownLeft = 0; for (const e of es) { e.hp = e.maxHp; e.alive = true; } n += cast(s, a, 'attack').filter((e) => e.type === 'proc' && e.itemId === 'war_banner').length; }
  ok(`...every enemy hit rolls his on-hit items at x${L.procBoost} chance (20% -> about 40%, on 2 enemies)`, Math.abs(n / tries / 2 - 0.2 * L.procBoost) < 0.04, (n / tries / 2).toFixed(2)); }
{ const F = skills[hero('berserker').skills.support]; const { s, a } = mk(['berserker', 'rogue']); const ls0 = a.specials.lifesteal || 0; cast(s, a, 'support');
  ok(`Blood Feast: +${F.apply[0].mods[0].percent}% lifesteal for himself (not the squad)`, a.specials.lifesteal === ls0 + F.apply[0].mods[0].percent && !(s.heroes[1].specials.lifesteal > 0));
  run(s, F.apply[0].durationMs + 100); ok(`...for ${F.apply[0].durationMs / 1000}s`, (a.specials.lifesteal || 0) === ls0); }

// ================= ROGUE: COMBO STRIKER
const DF = hero('rogue').passive, MS = skills[hero('rogue').skills.attack];
{ const bleedRate = (() => { let n = 0; const N = 2000; const { s, es, a } = mk(['rogue'], ['goblin']); for (let i = 0; i < N; i++) { es[0].statuses = []; s.landAttack(a, es[0], []); if (es[0].statuses.some((x) => x.type === 'bleed')) n++; } return n / N; })();
  ok(`Dirty Fighting: ${DF.procs[0].chance}% of his hits make the enemy Bleed`, Math.abs(bleedRate - DF.procs[0].chance / 100) < 0.03, bleedRate.toFixed(3)); }
{ const missRate = (debuffed) => { const { s, es, h } = mk(['rogue', 'knight'], ['goblin']); const [ro, k] = h; const g = es[0];
    if (debuffed) s.applyStatus(g, { status: 'weaken', durationMs: 1 }, ro, 'test', []);
    let m = 0, mk2 = 0; const N = 3000; for (let i = 0; i < N; i++) { if (s.strike(g, ro, [], {}).missed) m++; if (s.strike(g, k, [], {}).missed) mk2++; } return [m / N, mk2 / N]; };
  const [plain] = missRate(false), [onHim, onOther] = missRate(true);
  ok(`...an enemy he has debuffed misses ${DF.dirtyFighting.missPercent}% of its attacks on HIM`, plain === 0 && Math.abs(onHim - DF.dirtyFighting.missPercent / 100) < 0.03, onHim.toFixed(3));
  ok('...but not on other heroes', onOther === 0); }
{ const { s, es, a } = mk(['rogue'], ['goblin', 'goblin']); a.procs = []; s.focusUid = es[1].uid;
  const ev = [...cast(s, a, 'attack')]; for (let t = 0; t < 1200; t += 20) ev.push(...s.update(20));
  const sk = ev.filter((e) => e.type === 'attack' && e.attacker === a && e.skill);
  ok(`Multistrike: ${MS.channel.waves.length} quick hits of ${MS.channel.waves[0] * 100}% on ONE enemy`, sk.length === MS.channel.waves.length && sk.every((e) => e.target === es[1]) && Math.abs(sk[0].result.amount - a.stats.attack * MS.channel.waves[0]) <= 1, sk.map((e) => e.result.amount).join());
  ok('...every hit makes it Bleed (a stack each)', s.stacks(es[1], 'bleed') >= MS.channel.waves.length, s.stacks(es[1], 'bleed'));
  ok(`...cooldown ${MS.cooldownMs / 1000}s`, MS.cooldownMs === 7000); }
{ const { s, es, a } = mk(['rogue'], ['goblin'], () => 0); s.giveItem(a.uid, 'fire_bombs');
  const ev = [...cast(s, a, 'attack')]; for (let t = 0; t < 700; t += 20) ev.push(...s.update(20));
  ok('...and rolls his on-hit items every hit', ev.filter((e) => e.type === 'proc' && e.itemId === 'fire_bombs').length >= MS.channel.waves.length); }

// ================= SAMURAI: ONE-STRIKE MASTER (user kept the wide Wind Cutter slash)
const IA = hero('samurai').passive.iaido, WC = skills[hero('samurai').skills.attack];
{ const { s, es, a } = mk(['samurai'], ['goblin'], () => 0.5); es[0].x = a.x; es[0].y = a.y - 30; a.stats.crit = 0;
  for (let i = 0; i < IA.every - 1; i++) s.strike(es[0], a, [], { basic: true });
  const ev = []; s.strike(es[0], a, ev, { basic: true }); const cut = hits(ev, a).find((e) => e.target === es[0]);
  ok(`Iaido: the ${IA.every}rd hit is parried and countered with a SURE crit (even with 0 crit)`, cut && cut.result.crit, cut && cut.result.amount); }
{ const { s, a } = mk(['samurai']); s.refreshStats(); const base = hero('samurai').stats.evasion;
  ok(`...+${IA.evasionFlat} evasion built in`, a.stats.evasion === base + IA.evasionFlat, a.stats.evasion); }
{ const { s, es, a } = mk(['samurai'], ['goblin', 'goblin', 'goblin']); es.forEach((e, n) => { e.x = 120 + n * 60; e.y = es[0].y; }); es[2].y += 200; a.stats.crit = 0; s.focusUid = es[0].uid;
  const ev = cast(s, a, 'attack'); const sk = hits(ev, a).filter((e) => e.skill);
  ok(`Wind Cutter: ${WC.damageMultiplier * 100}% to every enemy in the row (not the far one)`, sk.length === 2 && !sk.some((e) => e.target === es[2]), sk.length);
  ok('...and it ALWAYS crits', sk.every((e) => e.result.crit)); }
{ const { s, es, a } = mk(['samurai'], ['goblin', 'goblin']); es.forEach((e, n) => { e.x = 120 + n * 60; e.y = es[0].y; }); s.focusUid = es[0].uid;
  cast(s, a, 'attack'); const plain = a.skills[0].cooldownLeft;
  const k = mk(['samurai'], ['goblin', 'goblin']); k.es.forEach((e, n) => { e.x = 120 + n * 60; e.y = k.es[0].y; e.hp = 1; }); k.s.focusUid = k.es[0].uid;
  const ev = cast(k.s, k.a, 'attack');
  ok(`...a kill cuts its cooldown by ${WC.killCooldownCutPercent}%`, Math.abs(k.a.skills[0].cooldownLeft - plain * (1 - WC.killCooldownCutPercent / 100)) < 1 && ev.some((e) => e.label === 'Perfect Cut!'), `${plain} -> ${k.a.skills[0].cooldownLeft}`); }
{ const { s, es, a } = mk(['samurai'], ['skeletonArcher']); const e = es[0]; e.x = a.x; e.y = a.y - 400; a.stats.crit = 0; cast(s, a, 'support');
  const ev = []; const res = s.strike(e, a, ev, { basic: true }); const back = hits(ev, a).find((x) => x.target === e);
  ok('Counter Stance: hits on him are parried and THROWN BACK, even from far away, as a sure crit', res.parried && back && back.result.crit); }
