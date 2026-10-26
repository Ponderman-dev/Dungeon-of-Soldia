// New items batch 4 (session 27): Sweeping Strap (melee swings also hit neighbours), Kinetic Coil (dodges store
// electric charges for the next attack), Sharpest Blade (plain physical attacks may strike the heart: big hit + stun).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin', 'goblin', 'goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const melee = (s) => s.heroes.find((h) => h.damageType === 'melee');
const lost = (e) => 1e7 - e.hp;

// Sweeping Strap: reworked in session 32 (CLEAVE), tested in items-s31.test.mjs.
// Kinetic Coil: reworked in session 31 (v2), tested in items-s31.test.mjs.
// Sharpest Blade (reworked session 29, user): PURE STEEL only (no element); pure attacks +pureSteel%, every Nth is a
// Heart Strike (multiplier + a share of the enemy's max health, less on a boss, stun); a Heart Strike kill = the next too.
{ const hs = val('sharpest_blade', 'heartStrike'), hm = val('sharpest_blade', 'heartStrikeMult'), hp = val('sharpest_blade', 'heartStrikeMaxHp');
  const hb = val('sharpest_blade', 'heartStrikeBossMaxHp'), ps = val('sharpest_blade', 'pureSteel'), N = hs.percent;
  const plain = (() => { const { s, e } = mk(['goblin']); s.landAttack(melee(s), e, []); return lost(e); })();
  const blade = (extra = []) => { const { s, e, es } = mk(['goblin', 'goblin']); const k = melee(s); give(s, k, 'sharpest_blade'); for (const id of extra) give(s, k, id); return { s, e, es, k }; };
  const hearts = (ev) => ev.filter((x) => x.type === 'proc' && x.itemId === 'sharpest_blade').length;
  { const { s, e, k } = blade(); s.landAttack(k, e, []);
    ok('Sharpest Blade: a pure attack deals +' + ps.percent + '%', Math.abs(lost(e) - plain * (1 + ps.percent / 100)) <= 1, `${plain} -> ${lost(e)}`); }
  { const { s, e, k } = blade(); const ev = [];
    for (let i = 0; i < N - 1; i++) s.landAttack(k, e, ev);
    ok('...no Heart Strike in the first ' + (N - 1) + ' attacks, then the glint says the next one is', hearts(ev) === 0 && s.heartStrikeIn(k) === 0);
    const before = lost(e); s.landAttack(k, e, ev); const dealt = lost(e) - before;
    const want = plain * (1 + ps.percent / 100) * (hm.percent / 100) + (e.maxHp * hp.percent) / 100;
    ok('...attack ' + N + ' is a Heart Strike: ' + hm.percent + '% + ' + hp.percent + '% of max health, and a stun', hearts(ev) === 1 && Math.abs(dealt - want) / want < 0.01 && e.statuses.some((st) => st.type === 'stun'), `${dealt} vs ${want}`);
    ok('...then the count starts again', s.heartStrikeIn(k) === N - 1);
    const hb2 = val('sharpest_blade', 'heartStrikeBreak'), br = e.statuses.find((st) => st.type === 'armorBreak');
    ok('...and it breaks the armor: -' + hb2.percent + '% defense for ' + hb2.spec.durationMs / 1000 + 's', br && br.defensePercent === -hb2.percent && Math.abs(br.remaining - hb2.spec.durationMs) < 1, JSON.stringify(br)); }
  { // The broken armor helps the whole squad: a plain hit from ANOTHER hero on an armored enemy does more.
    const hitOn = (broken) => { const { s, e } = mk(['goblin']); e.stats.defense = 200; const other = s.heroes.find((h) => h.damageType === 'melee');
      if (broken) s.applyStatus(e, { status: 'armorBreak', durationMs: 5000, defenseFlat: 0, defensePercent: -50 }, other, 'test', []);
      s.strike(other, e, [], { basic: true }); return lost(e); };
    ok('...a squad mate hits the broken enemy harder', hitOn(true) > hitOn(false) * 1.1, `${hitOn(false)} -> ${hitOn(true)}`); }
  { const { s, e, k } = blade(); e.def = { ...e.def, boss: true }; for (let i = 0; i < N - 1; i++) s.landAttack(k, e, []);
    const before = lost(e); s.landAttack(k, e, []); const dealt = lost(e) - before;
    const want = plain * (1 + ps.percent / 100) * (hm.percent / 100) + (e.maxHp * hb.percent) / 100;
    ok('...on a boss only ' + hb.percent + '% of max health', Math.abs(dealt - want) / want < 0.01, `${dealt} vs ${want}`); }
  { const { s, es, k } = blade(); for (let i = 0; i < N - 1; i++) s.landAttack(k, es[1], []);
    es[0].hp = 1; const ev = []; s.landAttack(k, es[0], ev);
    ok('...a Heart Strike that kills makes the NEXT attack a Heart Strike too', !es[0].alive && s.heartStrikeIn(k) === 0);
    s.landAttack(k, es[1], ev); ok('...(it is)', hearts(ev) === 2); }
  for (const [why, setup] of [['a charm', (k, s) => give(s, k, 'frost_charm')], ['an elemental attack (like the Mage)', (k) => { k.hitType = 'fire'; }]]) {
    const { s, e, k } = blade(); setup(k, s); const ev = []; for (let i = 0; i < N * 2; i++) s.landAttack(k, e, ev);
    ok('...' + why + ' turns it all off (no Heart Strike, no pure bonus)', hearts(ev) === 0 && s.heartStrikeIn(k) === -1); }
  { const { s, k } = mk(); const h = melee(s); give(s, h, 'sharpest_blade', 2);
    ok('...2 copies: +' + (ps.percent + ps.perExtra) + '% pure, ' + (hm.percent + hm.perExtra) + '%, ' + (hp.percent + hp.perExtra) + '% max health, still every ' + N, h.specials.pureSteel === ps.percent + ps.perExtra && h.specials.heartStrikeMult === hm.percent + hm.perExtra && h.specials.heartStrikeMaxHp === hp.percent + hp.perExtra && h.specials.heartStrike === N); } }
