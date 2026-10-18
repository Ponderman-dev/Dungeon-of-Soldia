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
