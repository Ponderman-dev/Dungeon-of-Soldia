// New items batch 5 (session 27): Euclid of Elements (2+ element hits may cast 3 more times) and Frozen Demon Head
// (+ice damage, ice damage fills Ice Spikes on the strongest enemy, the holder deals no fire / electric / dark).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems());
const val = (id, key) => itemDefs[id].effects.find((x) => x.special === key);
const mk = (ids = ['goblin', 'goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(ids, 1);
  for (const e of es) { e.hp = e.maxHp = 1e7; e.stats.defense = 0; e.stats.resist = 0; e.stats.evasion = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 100; u.baseStats.crit = 0; }
  s.refreshStats();
  return { s, es, e: es[0], k: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); s.refreshStats(); };
const lost = (e) => 1e7 - e.hp;
const flush = (s, ev = []) => { for (let i = 0; i < 20; i++) s.tickDelays(100, ev); return ev; };

// Euclid of Elements: reworked in session 31 (prism burst), tested in items-s31.test.mjs.
// Frozen Demon Head
{ const dh = val('frozen_demon_head', 'demonHead'), fill = val('frozen_demon_head', 'demonHeadFill').percent;
  const ice = itemDefs.frozen_demon_head.effects.find((x) => x.damageBonus === 'ice');
  const { s, k } = mk(); give(s, k, 'frozen_demon_head', 2);
  ok('Frozen Demon Head: 2 copies +' + (ice.percent + ice.perExtra) + '% ice damage', Math.abs(k.damageBonus.ice - ice.percent - ice.perExtra) < 1e-9, `${k.damageBonus.ice}`);
  const hit = (type, item = false) => { const { s: t, e, k: h } = mk(); give(t, h, 'frozen_demon_head'); const ev = []; const res = t.strike(h, e, ev, { damageType: type, multiplier: 1, item }); return { res, lost: lost(e), ev }; };
  for (const type of ['fire', 'electric', 'dark']) {
    const own = hit(type); // its own attack / skill (session 29): turned to ice
    ok('...its own ' + type + ' hit lands as ice', own.lost > 0 && own.ev.some((x) => x.type === 'attack' && x.damageType === 'ice'), JSON.stringify(own.ev.filter((x) => x.type === 'attack').map((x) => x.damageType)));
  }
  ok('...melee and ice hits still land', hit('melee').lost > 0 && hit('ice').lost > 0);
  { const { s: t, e, k: h } = mk(); give(t, h, 'frozen_demon_head'); give(t, h, 'kindling'); give(t, h, 'frost_charm'); const res = t.strike(h, e, [], { basic: true, riders: true });
    ok('...charm riders: fire is dropped, ice stays', (res.riders || []).every((rd) => rd.damageType !== 'fire') && (res.riders || []).some((rd) => rd.damageType === 'ice')); }
  // Fill: ice damage of 8x the attack sets off the spikes on the strongest enemy, with a freeze.
  const { s: t, es, k: h } = mk(['goblin', 'goblin']); give(t, h, 'frozen_demon_head', 2);
  es[1].maxHp = 2e7; es[1].hp = 1e7; // the strongest (most max health)
  const ev = [];
  let n = 0; while (!ev.some((x) => x.type === 'iceSpikes') && n++ < 50) t.strike(h, es[0], ev, { damageType: 'ice', multiplier: 1 });
  const spikes = ev.find((x) => x.type === 'iceSpikes');
  ok('...ice damage fills the Head (about ' + fill / 100 + 'x attack): Ice Spikes', !!spikes, `${n} ice hits`);
  ok('...on the strongest enemy, and it is frozen', spikes && spikes.target === es[1] && es[1].statuses.some((st) => st.type === 'freeze'));
  const spikeHit = ev.find((x) => x.type === 'attack' && x.target === es[1]);
  const plainIce = ev.find((x) => x.type === 'attack' && x.target === es[0]).result.amount;
  ok('...2 copies: ' + (dh.percent + dh.perExtra) + '% of attack', spikeHit && Math.abs(spikeHit.result.amount / plainIce - (dh.percent + dh.perExtra) / 100) < 0.05, `${plainIce} -> ${spikeHit && spikeHit.result.amount}`);
  ok('...and the store starts again', (h.iceStore || 0) === 0); }
