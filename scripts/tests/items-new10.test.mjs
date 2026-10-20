// The 10 new items of phase H (proposal docs/proposals/item-sheet/new-items-10.html, user: "implement all").
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks, frozenItems, plainRules } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const heroes = r('heroes.json');
const mk = (ids = ['knight', 'rogue', 'archer'], enemyIds = ['goblin'], rng = () => 0.5) => {
  const defs = noPerks(heroes);
  const s = new BattleState({ heroDefs: ids.map((id) => defs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: plainRules(r('combat.json')), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  for (const h of s.heroes) { h.stats.evasion = 0; h.baseStats.evasion = 0; }
  s.placeLines();
  return { s, es, h: s.heroes, k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const near = (v, t, tol = 0.03) => Math.abs(v / t - 1) < tol;
const NEW = ['quiver_of_plenty', 'spotters_lens', 'giantslayers_brand', 'catalyst_vial', 'scholars_bookmark', 'last_stand_banner', 'mirror_buckler', 'soul_lantern', 'phoenix_feather', 'iron_will_talisman'];
ok('all 10 new items exist with an icon', NEW.every((id) => itemDefs[id] && r('itemIcons.json')[id]));

// Quiver of Plenty
{ const { s, es, h } = mk(['archer', 'knight', 'rogue'], ['goblin', 'goblin', 'goblin'], () => 0); const a = h[0]; give(s, a, 'quiver_of_plenty');
  const ev = []; s.landAttack(a, es[0], ev); const others = ev.filter((e) => e.type === 'attack' && e.target !== es[0] && e.damageType === 'ranged');
  ok('Quiver: a ranged attack shoots an extra arrow at a DIFFERENT enemy', others.length === 1 && ev.some((e) => e.type === 'projectile' && e.kind === 'arrow')); }
{ const { s, es, h } = mk(['archer', 'knight', 'rogue'], ['goblin', 'goblin', 'goblin'], () => 0); const a = h[0]; give(s, a, 'quiver_of_plenty', 8);
  const ev = []; s.landAttack(a, es[0], ev); const t = new Set(ev.filter((e) => e.type === 'attack' && e.damageType === 'ranged').map((e) => e.target));
  ok('...8 quivers (120%): a sure extra arrow + a chance for a third (3 enemies hit)', t.size === 3, `${t.size}`); }
{ const { s, es, k } = mk(['knight', 'archer', 'rogue'], ['goblin', 'goblin'], () => 0); give(s, k, 'quiver_of_plenty', 3);
  const ev = []; s.landAttack(k, es[0], ev); ok('...melee heroes get nothing', !ev.some((e) => e.itemId === 'quiver_of_plenty')); }
// Spotter's Lens
{ const { s, es, h } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin']); const base = s.strike(h[1], es[0], [], {}).amount; give(s, h[0], 'spotters_lens', 2);
  const unfocused = s.strike(h[1], es[0], [], {}).amount; s.setFocus(es[0].uid); const focused = s.strike(h[1], es[0], [], {}).amount;
  ok('Spotter\'s Lens: the TAPPED enemy takes +20% per copy from the whole squad (another hero holds it)', near(unfocused, base) && near(focused / base, 1.4), `${base} ${unfocused} ${focused}`); }
{ const { s, es, h } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin']); const base = s.strike(h[1], es[0], [], {}).amount; give(s, h[0], 'spotters_lens');
  s.setOrder(h[2].uid, es[0].uid); const ordered = s.strike(h[1], es[0], [], {}).amount, other = s.strike(h[1], es[1], [], {}).amount;
  ok('...a drag-ordered enemy counts too (+20% from the whole squad, other enemies not)', near(ordered / base, 1.2) && near(other, base), `${base} ${ordered} ${other}`); }
// Giantslayer's Brand
{ const { s, es, k } = mk(); const base = s.strike(k, es[0], [], {}).amount; es[0].def = { ...es[0].def, boss: true }; give(s, k, 'giantslayers_brand', 2); const vsBoss = s.strike(k, es[0], [], {}).amount;
  ok('Giantslayer: +42% per copy vs bosses', near(vsBoss / base, 1.84), `${base} ${vsBoss}`);
  const sp = s.heroes.reduce((n, h) => n + (h.specials.bossWindup || 0), 0); ok('...boss wind-ups 20% longer per copy while the holder lives', sp === 40); }
{ const wind = (n) => { const { s, k } = mk(['knight', 'rogue', 'archer'], ['grukk']); if (n) give(s, k, 'giantslayers_brand', n); const boss = s.enemies.find((e) => e.def.boss);
    const ab = boss.def.abilities.find((a) => a.castMs); s.startAbility(boss, ab, []); return [boss.bossCast.total, ab.castMs]; };
  const [w5, base] = wind(5); ok('...a real boss wind-up (Grukk) is twice as long with 5 brands', w5 === base * 2 && wind(0)[0] === base, `${w5} vs ${base}`); }
// Catalyst Vial
{ const tick = (vials, kinds) => { const { s, es, k } = mk(); if (vials) give(s, k, 'catalyst_vial', vials); const e = es[0];
    const specs = { bleed: { status: 'bleed', durationMs: 60000, damageMultiplier: 1 }, burn: { status: 'burn', durationMs: 60000, damageMultiplier: 1, damageType: 'fire' }, poison: { status: 'poison', durationMs: 60000, damageMultiplier: 1, damageType: 'dark' } };
    for (const kd of kinds) s.applyStatus(e, specs[kd], k, 't', []);
    let dmg = 0; for (let t = 0; t < 1000; t += 50) for (const ev of s.update(50)) if (ev.type === 'dot' && ev.unit === e && ev.status === 'poison') dmg += ev.amount; return dmg; };
  const plain = tick(0, ['poison']), one = tick(1, ['poison']), three = tick(1, ['bleed', 'burn', 'poison']), four = tick(4, ['bleed', 'burn', 'poison']);
  ok('Catalyst Vial: 1 vial + 1 kind = +21%; 3 kinds = +63%; 4 vials with 3 kinds = +252%', near(one / plain, 1.21, 0.06) && near(three / plain, 1.63, 0.06) && near(four / plain, 3.52, 0.06), `${plain} ${one} ${three} ${four}`); }
// Scholar's Bookmark
{ const { s, k } = mk(); give(s, k, 'scholars_bookmark', 3); k.skills[0].pages = [{ kind: 'stat' }, { kind: 'stat' }, { kind: 'modifier' }]; k.skills[1].pages = [{ kind: 'modifier' }];
  ok('Scholar\'s Bookmark: 3 copies x (2 stat + 2 modifier x2 = 6 pages) = +144% skill damage', s.bookmarkBonus(k) === 144, `${s.bookmarkBonus(k)}`); }
// Last Stand Banner (session 18, rally): the first time in a fight a hero drops below `rallyBelow`%, every living hero
// gets a `rallyShield`% shield and +`rallyAttack`% attack for `rallyMs`; per banner.
{ const E = (k) => itemDefs.last_stand_banner.effects.find((e) => e.special === k).percent, below = E('rallyBelow'), shield = E('rallyShield'), atk = E('rallyAttack');
  const { s, h } = mk(); give(s, h[0], 'last_stand_banner', 2); h[2].hp = h[2].maxHp * (below + 10) / 100; const ev0 = []; s.afterDamage(h[2], ev0);
  ok('Last Stand Banner: nothing while every hero is above ' + below + '%', !ev0.some((e) => e.itemId === 'last_stand_banner'));
  h[2].hp = h[2].maxHp * (below - 5) / 100; const ev = []; s.afterDamage(h[2], ev);
  const sh = h[1].statuses.find((x) => x.type === 'shield'), bf = h[1].statuses.find((x) => x.type === 'buff');
  ok('...a hero under ' + below + '%: the squad gets a shield and an attack buff (2 banners = double)', ev.some((e) => e.itemId === 'last_stand_banner') && sh && near(sh.amount, h[1].maxHp * 2 * shield / 100, 0.05) && bf && bf.mods[0].percent === 2 * atk, `${sh && sh.amount} ${bf && bf.mods[0].percent}`);
  const ev2 = []; s.afterDamage(h[1], ev2); h[1].hp = 1; s.afterDamage(h[1], ev2);
  ok('...only once per fight', !ev2.some((e) => e.itemId === 'last_stand_banner')); }
// Mirror Buckler
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['skeletonArcher'], () => 0); give(s, k, 'mirror_buckler'); const e = es[0]; const hp = k.hp, ehp = e.hp;
  const res = s.strike(e, k, [], {}); ok('Mirror Buckler: a ranged hit bounces back, the holder takes nothing', res.reflected && k.hp === hp && e.hp < ehp); }
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['goblin'], () => 0); give(s, k, 'mirror_buckler', 3); const hp = k.hp; s.strike(es[0], k, [], {});
  ok('...melee hits are not bounced', k.hp < hp); }
{ const ch = (n) => { const { s, k } = mk(); give(s, k, 'mirror_buckler', n); return k.specials.mirrorBuckler; }; ok('...12% per copy, the chance stops at 60% (but copies keep counting for power)', ch(1) === 12 && ch(7) === 84); }
// Soul Lantern
{ const { s, es, k } = mk(); give(s, k, 'soul_lantern', 2); const a0 = k.stats.attack;
  for (let i = 0; i < 16; i++) s.soulLanternKill(); ok('Soul Lantern: every 8 kills +1% per lantern (16 kills, 2 lanterns = +4%)', k.lanternGain === 4 && near(k.stats.attack, a0 * 1.04 * 1, 0.02), `${k.lanternGain}`);
  for (let i = 0; i < 1000; i++) s.soulLanternKill(); ok('...no limit any more (1016 kills, 2 lanterns = +254%)', k.lanternGain === 254, `${k.lanternGain}`); }
{ const { rollChoices } = await import('../../src/systems/rewards.js'); const { s } = mk(); const rw = r('rewards.json'); const offered = new Set(); let seen = 0;
  const only = { soul_lantern: itemDefs.soul_lantern, whetstone: itemDefs.whetstone, padded_vest: itemDefs.padded_vest, lucky_coin: itemDefs.lucky_coin };
  for (let i = 0; i < 200; i++) if (rollChoices({ itemDefs: only, rules: { ...rw, rarityOdds: [{ from: 1, odds: { legendary: 1, common: 1 } }] }, floor: 1, count: 2, heroes: s.heroes, offered }).some((x) => x.id === 'soul_lantern')) seen++;
  ok('Soul Lantern is legendary and shows up only ONCE per run', itemDefs.soul_lantern.rarity === 'legendary' && seen === 1, `${seen}`); }

// ---- the user's own items ----
// Flame Spirit
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin'], () => 0); give(s, k, 'flame_spirit'); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: es[0], hit: true, force: true }); s.rng = () => 0.99; // no more procs
  const all = [...ev]; for (let t = 0; t < 2500; t += 50) all.push(...s.update(50));
  const balls = all.filter((e) => e.type === 'projectile' && e.kind === 'spiritfire').length, hits = all.filter((e) => e.type === 'attack' && e.damageType === 'dark' && e.attacker === k).length;
  ok('Flame Spirit: 3-5 dark fireballs fly one after another and each hits (300% dark)', balls >= 3 && balls <= 5 && hits === balls && all.filter((e) => e.itemId === 'flame_spirit').length === 1, `${balls} ${hits}`); }
// Spirit Axe
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin'], () => 0); give(s, k, 'spirit_axe'); es.forEach((e, i) => { e.x = k.x + 40 * (i ? 1 : -1); e.y = k.y; }); s.onHeroHit(k, []);
  ok('Spirit Axe: being hit can start the spin (3s)', k.axeLeft === 3000);
  let hits = 0; for (let t = 0; t < 3000; t += 50) { const ev = []; s.tickSpiritAxe(k, 50, ev); hits += ev.filter((e) => e.type === 'attack').length; }
  ok('...it hits every nearby enemy every 0.5s (2 enemies x 6 pulses)', hits === 12, `${hits}`); }
// Heart of the Beast
{ const { s, k } = mk(); give(s, k, 'heart_of_the_beast'); k.hp = 1; const got = s.healUnit(k, 50, [], { aura: false }); ok('Heart of the Beast: healing received +30%', got === 65, `${got}`);
  s.enemies.forEach((e) => (e.timer = -1e9)); k.hp = 10; const before = k.hp; for (let t = 0; t < 1000; t += 50) s.update(50);
  ok('...and about 2.6% max health per second regen (2% x 1.3)', Math.abs((k.hp - before) / k.maxHp - 0.026) < 0.005, `${((k.hp - before) / k.maxHp).toFixed(3)}`); }
// Moonlight Twinblade
{ const { s, es, h } = mk(['archer', 'knight', 'rogue'], ['goblin'], () => 0); const a = h[0]; give(s, a, 'moonlight_twinblade', 2); const ev = []; s.rollProcs(a, 'onAttack', ev, { target: es[0], hit: true, force: true });
  const all = [...ev]; for (let t = 0; t < 1000; t += 50) all.push(...s.update(50)); const cres = all.filter((e) => e.type === 'attack' && e.attacker === a && e.result && e.result.amount > 0 && e.target === es[0] && !e.basic);
  ok('Moonlight Twinblade: a crescent hits its target 3 times', all.some((e) => e.kind === 'moon') && cres.length >= 3, `${cres.length}`);
  const { s: s2, es: e2, k: kn } = mk(['knight', 'archer', 'rogue'], ['goblin'], () => 0); give(s2, kn, 'moonlight_twinblade'); const ev2 = []; s2.rollProcs(kn, 'onAttack', ev2, { target: e2[0], hit: true, force: true });
  ok('...melee attacks trigger it too, and the crescent deals RANGED damage', ev2.some((e) => e.kind === 'moon') && (() => { const all = [...ev2]; for (let t = 0; t < 1000; t += 50) all.push(...s2.update(50)); return all.some((e) => e.type === 'attack' && e.attacker === kn && !e.basic && e.damageType === 'ranged'); })()); }
// Ghastly Fire
{ const { s, es, k } = mk(); give(s, k, 'ghastly_fire'); const ev = []; s.strike(k, es[0], ev, { damageType: 'fire' });
  const fire = ev.find((e) => e.type === 'attack' && e.damageType === 'fire'), dark = ev.find((e) => e.type === 'attack' && e.damageType === 'dark');
  ok('Ghastly Fire: a fire hit also deals 28% of it as dark', fire && dark && Math.abs(dark.result.amount - fire.result.amount * 0.28) <= 1, `${fire && fire.result.amount} ${dark && dark.result.amount}`);
  for (let i = 0; i < 4; i++) s.applyStatus(es[0], { status: 'burn', durationMs: 60000, damageMultiplier: 0.5, damageType: 'fire' }, k, 'b' + i, []);
  ok('...4 burn stacks = the enemy attacks 20% slower', s.ghastlySlow(es[0]) === 20);
  let dark2 = 0; for (let t = 0; t < 1000; t += 50) for (const e of s.update(50)) if (e.type === 'dot' && e.damageType === 'dark' && e.unit === es[0]) dark2++;
  ok('...burn ticks also hit as dark', dark2 > 0);
  const { s: s3, k: k3 } = mk(); give(s3, k3, 'ghastly_fire', 3); ok('...3 copies: 84% dark, 9% slow per stack', k3.specials.ghastly === 84 && k3.specials.ghastlySlow === 9); }
// Phoenix Feather
{ const { s, k } = mk(); give(s, k, 'phoenix_feather', 2); const ev = []; s.dealDamage(k, k.hp + 50, ev);
  const rb = k.statuses.find((x) => x.type === 'regenBoost');
  ok('Phoenix Feather: a killing blow leaves the holder at 1 health, one feather is used up', k.hp === 1 && k.alive && k.items.filter((i) => i === 'phoenix_feather').length === 1 && ev.some((e) => e.type === 'itemUsed'));
  ok('...it is invulnerable for 1s', k.statuses.some((x) => x.type === 'invulnerable' && x.total === 1000) && s.dealDamage(k, 9999, []).immune);
  ok('...and climbs back to 70% over 3s', rb && rb.total === 3000);
  for (let t = 0; t < 3100; t += 50) s.update(50); ok('...the heal arrives over the 3s (about 70%)', Math.abs(k.hp / k.maxHp - 0.7) < 0.03, `${(k.hp / k.maxHp).toFixed(2)}`); }
// Iron Will Talisman
{ const dur = (n) => { const { s, es, k } = mk(); if (n) give(s, k, 'iron_will_talisman', n); s.applyStatus(k, { status: 'stun', durationMs: 1000 }, es[0], 't', []); return k.statuses.find((x) => x.type === 'stun').total; };
  ok('Iron Will: stuns 25% shorter, 2 copies 44%, 5 copies 76%', Math.abs(dur(1) - 750) < 1 && Math.abs(dur(2) - 562.5) < 1 && Math.abs(dur(5) - 237.3) < 1, `${dur(1)} ${dur(2)} ${dur(5)}`);
  const { s, k } = mk(); const r0 = k.stats.resist; give(s, k, 'iron_will_talisman', 2); ok('...+6 resist per copy', k.stats.resist === r0 + 12); }
