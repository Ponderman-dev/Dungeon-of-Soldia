// Dark items (session 17): Eclipse Idol stores the holder's dark damage, then Dooms 2-3 enemies.
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.health = 1e6; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, k: s.heroes[0], h: s.heroes };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const dmg = (s, a, t, opts = {}) => s.strike(a, t, [], opts).amount;
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;

const fx = Object.fromEntries(itemDefs.eclipse_idol.effects.map((e) => [e.special, e.percent]));
const doomed = (es) => es.filter((e) => e.statuses.some((x) => x.type === 'doom'));
// Charging: dark hits fill it, other hits do not; it is cast at eclipseCharge% of attack
{ const { s, es, k } = mk(['goblin', 'goblin', 'goblin', 'goblin']); give(s, k, 'eclipse_idol');
  s.strike(k, es[0], [], { damageType: 'fire', multiplier: 5 }); ok('Eclipse Idol: a fire hit stores nothing', !k.voidStore);
  s.strike(k, es[0], [], { damageType: 'dark', multiplier: 1 }); ok('...a dark hit is stored', near(k.voidStore, k.stats.attack, 0.05), `${k.voidStore}`);
  const ev = []; s.strike(k, es[0], ev, { damageType: 'dark', multiplier: fx.eclipseCharge / 100 });
  ok('...when full it is cast (proc) and the store empties', ev.some((e) => e.type === 'proc' && e.itemId === 'eclipse_idol') && k.voidStore === 0);
  ok('...nothing is Doomed before the orb arrives', doomed(es).length === 0);
  s.tickDelays(1000, []); const d = doomed(es);
  ok('...then 2-3 random enemies are Doomed', d.length >= 2 && d.length <= 3, `${d.length}`);
  const st = d[0].statuses.find((x) => x.type === 'doom');
  ok(`...Doom: ${fx.eclipse}% of attack per tick, ${fx.eclipseMs}ms, ${fx.eclipseSlow}% slower attacks`, near(st.damage, k.stats.attack * fx.eclipse / 100, 0.05) && st.total === fx.eclipseMs && st.attackSpeedPercent === -fx.eclipseSlow, JSON.stringify({ d: st.damage, t: st.total, a: st.attackSpeedPercent }));
  const plain = s.interval(es.find((e) => !d.includes(e)) || es[0]), slow = s.interval(d[0]);
  ok('...a Doomed enemy attacks at half speed', near(slow / plain, 1 / (1 - fx.eclipseSlow / 100), 0.05), `${plain} ${slow}`);
  const hp = d[0].hp; s.tickDots(d[0], 1000, []);
  ok('...it ticks dark damage every second', d[0].hp < hp);
  ok('...and Doom never refills the idol', !k.voidStore); }
// Poison (dark) ticks fill it too
{ const { s, es, k } = mk(['goblin']); give(s, k, 'eclipse_idol');
  s.applyStatus(es[0], { status: 'poison', durationMs: 5000, damageMultiplier: 0.5 }, k, 'p', []); s.tickDots(es[0], 1000, []);
  ok('...Poison ticks from the holder are stored', k.voidStore > 0, `${k.voidStore}`); }
// Without the idol nothing is stored
{ const { s, es, k } = mk(['goblin']); s.strike(k, es[0], [], { damageType: 'dark', multiplier: 50 }); ok('...no idol: nothing happens', !k.voidStore && doomed(es).length === 0); }
