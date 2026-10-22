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
const NEW = ['quiver_of_plenty', 'spotters_lens', 'giantslayers_brand', 'catalyst_vial', 'scholars_bookmark', 'mirror_buckler', 'soul_lantern', 'phoenix_feather', 'iron_will_talisman'];
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
// Catalyst Vial (session 18): the holder's DoT ticks can crit (crit chance); a crit = critMultiplier + `dotCrit`% per vial
{ const extra = itemDefs.catalyst_vial.effects[0].percent, cm = r('combat.json').critMultiplier;
  const tick = (vials, crit) => { const { s, es, k } = mk(); k.baseStats.crit = crit; s.refreshStats(); if (vials) give(s, k, 'catalyst_vial', vials); s.rng = () => 0.5; const e = es[0]; e.hp = e.maxHp = 1e9;
    s.applyStatus(e, { status: 'poison', durationMs: 60000, damageMultiplier: 1, damageType: 'dark' }, k, 't', []);
    const ev = []; for (let t = 0; t < 1000; t += 50) ev.push(...s.update(50)); return ev.find((x) => x.type === 'dot' && x.unit === e); };
  const plain = tick(0, 100), one = tick(1, 100), two = tick(2, 100), never = tick(1, 0);
  ok('Catalyst Vial: with full crit chance a tick crits for x' + (cm + extra / 100), one.crit && near(one.amount / plain.amount, cm + extra / 100, 0.05), `${plain.amount} -> ${one.amount}`);
  ok('...2 vials: +' + 2 * extra + '% on the crit', near(two.amount / plain.amount, cm + (2 * extra) / 100, 0.05));
  ok('...no crit chance = no crit; without a vial ticks never crit', !never.crit && !plain.crit); }
// Scholar's Bookmark
{ const { s, k } = mk(); give(s, k, 'scholars_bookmark', 3); k.skills[0].pages = [{ kind: 'stat' }, { kind: 'stat' }, { kind: 'modifier' }]; k.skills[1].pages = [{ kind: 'modifier' }];
  ok('Scholar\'s Bookmark: 3 copies x (2 stat + 2 modifier x2 = 6 pages) = +144% skill damage', s.bookmarkBonus(k) === 144, `${s.bookmarkBonus(k)}`); }
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
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['goblin', 'goblin'], () => 0); give(s, k, 'spirit_axe'); es.forEach((e, i) => { e.x = k.x + 40 * (i ? 1 : -1); e.y = k.y; });
  const ev = []; s.onHeroHit(k, ev); const hits = ev.filter((e) => e.type === 'attack' && e.attacker === k);
  ok('Spirit Axe: being hit can spin it ONCE: one hit on every nearby enemy (item numbers)', hits.length === 2 && ev.filter((e) => e.itemId === 'spirit_axe').length === 1, `${hits.length}`);
  ok('...for spiritAxeDamage% of attack', hits.every((e) => Math.abs(e.result.amount - k.stats.attack * k.specials.spiritAxeDamage / 100 * (e.result.crit ? s.rules.critMultiplier : 1)) < 3), hits.map((e) => e.result.amount).join(' '));
  es[1].x = k.x + k.specials.spiritAxeRadius + 30; const ev2 = []; s.onHeroHit(k, ev2);
  ok('...an enemy past spiritAxeRadius is not hit', ev2.filter((e) => e.type === 'attack' && e.attacker === k).length === 1); }
// Heart of the Beast: +max health and regen (no healing boost any more)
{ const ef = itemDefs.heart_of_the_beast.effects, hp = ef.find((e) => e.stat === 'health').flat, rg = ef.find((e) => e.special === 'regen').percent;
  const { s, k } = mk(); const hp0 = k.maxHp; give(s, k, 'heart_of_the_beast');
  ok('Heart of the Beast: +' + hp + ' max health', k.maxHp === hp0 + hp, `${hp0} -> ${k.maxHp}`);
  k.hp = 1; ok('...healing is not boosted', s.healUnit(k, 50, [], { aura: false }) === 50);
  s.enemies.forEach((e) => (e.timer = -1e9)); k.hp = 10; const before = k.hp; for (let t = 0; t < 1000; t += 50) s.update(50);
  ok('...and about ' + rg + '% max health per second regen', Math.abs((k.hp - before) / k.maxHp - rg / 100) < 0.003, `${((k.hp - before) / k.maxHp).toFixed(4)}`); }
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
