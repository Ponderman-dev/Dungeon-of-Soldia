// The 10 new items of phase H (proposal docs/proposals/item-sheet/new-items-10.html, user: "implement all").
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const heroes = r('heroes.json');
const mk = (ids = ['knight', 'rogue', 'archer'], enemyIds = ['goblin'], rng = () => 0.5) => {
  const defs = noPerks(heroes);
  const s = new BattleState({ heroDefs: ids.map((id) => defs.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
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
  ok('Spotter\'s Lens: the TAPPED enemy takes +12% per copy from the whole squad (another hero holds it)', near(unfocused, base) && near(focused / base, 1.24), `${base} ${unfocused} ${focused}`); }
// Giantslayer's Brand
{ const { s, es, k } = mk(); const base = s.strike(k, es[0], [], {}).amount; es[0].def = { ...es[0].def, boss: true }; give(s, k, 'giantslayers_brand', 2); const vsBoss = s.strike(k, es[0], [], {}).amount;
  ok('Giantslayer: +30% per copy vs bosses', near(vsBoss / base, 1.6), `${base} ${vsBoss}`);
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
  ok('Catalyst Vial: 1 vial + 1 kind = +15%; 3 kinds = +45%; 4 vials with 3 kinds = +180%', near(one / plain, 1.15, 0.06) && near(three / plain, 1.45, 0.06) && near(four / plain, 2.8, 0.06), `${plain} ${one} ${three} ${four}`); }
// Scholar's Bookmark
{ const { s, k } = mk(); give(s, k, 'scholars_bookmark', 3); k.skills[0].pages = [{ kind: 'stat' }, { kind: 'stat' }, { kind: 'modifier' }]; k.skills[1].pages = [{ kind: 'modifier' }];
  ok('Scholar\'s Bookmark: 3 copies x (2 stat + 2 modifier x2 = 6 pages) = +72% skill damage', s.bookmarkBonus(k) === 72, `${s.bookmarkBonus(k)}`); }
// Last Stand Banner
{ const { s, h } = mk(); give(s, h[0], 'last_stand_banner', 2); const ev = []; h[2].hp = 0; s.killUnit(h[2], ev);
  const sh = h[1].statuses.find((x) => x.type === 'shield'), bf = h[1].statuses.find((x) => x.type === 'buff');
  ok('Last Stand Banner: a fallen hero = survivors get a 40% max health shield and +60% attack for 8s (2 banners)', sh && near(sh.amount, h[1].maxHp * 0.4, 0.05) && bf && bf.mods[0].percent === 60 && bf.total === 8000 && ev.some((e) => e.itemId === 'last_stand_banner'));
  const { s: s0, h: h0 } = mk(); h0[2].hp = 0; s0.killUnit(h0[2], []); const plain = h0[0].baseStats.attack - h0[0].stats.attack;
  const cut = h[0].baseStats.attack - (h[0].stats.attack - h[0].baseStats.attack * 0.6);
  ok('...the holder feels the morale penalty halved per banner (2 = a quarter)', near(cut, plain / 4, 0.1), `${plain} ${cut}`); }
// Mirror Buckler
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['skeletonArcher'], () => 0); give(s, k, 'mirror_buckler'); const e = es[0]; const hp = k.hp, ehp = e.hp;
  const res = s.strike(e, k, [], {}); ok('Mirror Buckler: a ranged hit bounces back, the holder takes nothing', res.reflected && k.hp === hp && e.hp < ehp); }
{ const { s, es, k } = mk(['knight', 'rogue', 'archer'], ['goblin'], () => 0); give(s, k, 'mirror_buckler', 3); const hp = k.hp; s.strike(es[0], k, [], {});
  ok('...melee hits are not bounced', k.hp < hp); }
{ const ch = (n) => { const { s, k } = mk(); give(s, k, 'mirror_buckler', n); return k.specials.mirrorBuckler; }; ok('...12% per copy, the chance stops at 60% (but copies keep counting for power)', ch(1) === 12 && ch(7) === 84); }
// Soul Lantern
{ const { s, es, k } = mk(); give(s, k, 'soul_lantern', 2); const a0 = k.stats.attack;
  for (let i = 0; i < 16; i++) s.soulLanternKill(); ok('Soul Lantern: every 8 kills +1% per lantern (16 kills, 2 lanterns = +4%)', k.lanternGain === 4 && near(k.stats.attack, a0 * 1.04 * 1, 0.02), `${k.lanternGain}`);
  for (let i = 0; i < 1000; i++) s.soulLanternKill(); ok('...up to +30% per lantern (2 = +60%)', k.lanternGain === 60); }
// Phoenix Feather
{ const { s, k } = mk(); give(s, k, 'phoenix_feather', 2); const ev = []; s.dealDamage(k, k.hp + 50, ev);
  const rb = k.statuses.find((x) => x.type === 'regenBoost');
  ok('Phoenix Feather: a killing blow leaves the holder at 1 health, one feather is used up', k.hp === 1 && k.alive && k.items.filter((i) => i === 'phoenix_feather').length === 1 && ev.some((e) => e.type === 'itemUsed'));
  ok('...it heals 40% +10% per feather left (50%) over 3s', rb && near(rb.percentMaxHpPerSec * 3, 50, 0.01) && rb.total === 3000);
  for (let t = 0; t < 3000; t += 50) s.update(50); ok('...the heal arrives over the 3s', k.hp > k.maxHp * 0.4, `${(k.hp / k.maxHp).toFixed(2)}`); }
// Iron Will Talisman
{ const dur = (n) => { const { s, es, k } = mk(); if (n) give(s, k, 'iron_will_talisman', n); s.applyStatus(k, { status: 'stun', durationMs: 1000 }, es[0], 't', []); return k.statuses.find((x) => x.type === 'stun').total; };
  ok('Iron Will: stuns 25% shorter, 2 copies 44%, 5 copies 76%', Math.abs(dur(1) - 750) < 1 && Math.abs(dur(2) - 562.5) < 1 && Math.abs(dur(5) - 237.3) < 1, `${dur(1)} ${dur(2)} ${dur(5)}`);
  const { s, k } = mk(); const r0 = k.stats.resist; give(s, k, 'iron_will_talisman', 2); ok('...+6 resist per copy', k.stats.resist === r0 + 12); }
