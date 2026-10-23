// Session 24 new items: Riposte Cloak (strike back after a dodge), Last Stand (low health: more damage and speed),
// Harvest Scythe (crits heal). (Killing Mask was cut: lifesteal stacking ran away.)
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => { const e = itemDefs[id].effects.find((x) => x.special === key || x.stat === key); return e; };
const mk = (rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(['goblin'], 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };

// Riposte Cloak
{ const ev = val('riposte_cloak', 'evasion').flat, rip = val('riposte_cloak', 'riposte');
  const { s, k } = mk(); const e0 = k.stats.evasion; give(s, k, 'riposte_cloak', 2);
  ok('Riposte Cloak: +' + ev + ' evasion per copy', Math.abs(k.stats.evasion - e0 - 2 * ev) < 0.01, `${e0} -> ${k.stats.evasion}`);
  ok('...strike back ' + rip.percent + '%, +' + rip.perExtra + '% per extra copy', k.specials.riposte === rip.percent + rip.perExtra, `${k.specials.riposte}`); }
{ const dodge = (withCloak, blockInstead = false) => { const { s, e, k } = mk(() => 0); if (withCloak) give(s, k, 'riposte_cloak');
    k.stats.evasion = blockInstead ? 0 : 50; if (blockInstead) k.specials.block = 100;
    const ev = []; const res = s.strike(e, k, ev, {});
    return { res, back: ev.filter((x) => x.type === 'attack' && x.attacker === k && x.target === e), hp: e.hp }; };
  const a = dodge(true), b = dodge(false), c = dodge(true, true);
  ok('...a dodged hit is answered with a hit on the attacker', a.res.dodged && a.back.length === 1 && a.hp < 1e7, `${a.back.length}`);
  ok('...nothing without the cloak', b.res.dodged && b.back.length === 0);
  ok('...a BLOCKED hit is not answered (dodges only)', c.res.blocked && c.back.length === 0); }
// Last Stand
{ const ls = val('last_stand', 'lastStand'), sp = val('last_stand', 'lastStandSpeed');
  const hit = (hpPct, n) => { const { s, e, k } = mk(); give(s, k, 'last_stand', n); k.hp = (k.maxHp * hpPct) / 100; return { dmg: s.strike(k, e, [], { basic: true }).amount, gap: s.interval(k) }; };
  const plain = hit(20, 0), low = hit(20, 1), high = hit(50, 1), two = hit(20, 2);
  ok('Last Stand: below ' + ls.below + '% health +' + ls.percent + '% damage', Math.abs(low.dmg / plain.dmg - (1 + ls.percent / 100)) < 0.03, `${plain.dmg} ${low.dmg}`);
  ok('...and +' + sp.percent + '% attack speed', Math.abs(plain.gap / low.gap - (1 + sp.percent / 100)) < 0.01, `${plain.gap} ${low.gap}`);
  ok('...nothing above ' + ls.below + '%', high.dmg === hit(50, 0).dmg && high.gap === hit(50, 0).gap);
  ok('...2 copies: +' + (ls.percent + ls.perExtra) + '% damage', Math.abs(two.dmg / plain.dmg - (1 + (ls.percent + ls.perExtra) / 100)) < 0.03, `${two.dmg}`); }
// Harvest Scythe
{ const pct = val('harvest_scythe', 'critHeal').percent;
  const swing = (crit, n = 1) => { const { s, e, k } = mk(() => 0); give(s, k, 'harvest_scythe', n); k.stats.crit = crit ? 100 : 0; k.maxHp = 1e6; k.hp = 1; const res = s.strike(k, e, [], {}); return { got: k.hp - 1, amount: res.amount, crit: res.crit }; };
  const c = swing(true), n = swing(false), c2 = swing(true, 2);
  ok('Harvest Scythe: a crit heals ' + pct + '% of its damage', c.crit && Math.abs(c.got - (c.amount * pct) / 100) <= 1, `${c.amount} -> ${c.got}`);
  ok('...a normal hit heals nothing', !n.crit && n.got === 0);
  ok('...2 scythes: ' + 2 * pct + '%', Math.abs(c2.got - (c2.amount * 2 * pct) / 100) <= 1, `${c2.got}`);
  const cap = val('harvest_scythe', 'critHealCap').percent;
  const { s, e, k } = mk(() => 0); give(s, k, 'harvest_scythe', 5); k.baseStats.attack = 1e5; s.refreshStats(); k.stats.crit = 100; k.hp = 1; s.strike(k, e, [], {});
  ok('...one crit heals at most ' + cap + '% of max health', Math.abs(k.hp - 1 - (k.maxHp * cap) / 100) <= 1, `${k.hp - 1} of ${k.maxHp}`); }
