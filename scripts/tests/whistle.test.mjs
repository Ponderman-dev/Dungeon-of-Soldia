// Overseer's Whistle (user, session 59): once per floor, at the start, one extra minion of the holder's own weak kind,
// stronger (whistleSummon %, + perExtra per extra whistle).
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const W = itemDefs.overseers_whistle.effects.find((e) => e.special === 'whistleSummon');
const heroes = r('heroes.json').map((h) => ({ ...h, perk: undefined })); // real kits: the Necromancer's skeletons come from his passive
const mk = (n, hero = 'necromancer') => {
  const s = new BattleState({ heroDefs: [heroes.find((h) => h.id === hero), heroes.find((h) => h.id === 'knight'), heroes.find((h) => h.id === 'cleric')], enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const k = s.heroes[0]; for (let i = 0; i < n; i++) s.giveItem(k.uid, 'overseers_whistle');
  s.spawnEnemies(['goblin'], 1); s.placeLines(); s.startFloor([]); return { s, k };
};
const mine = (s, k) => s.minions.filter((m) => m.holderUid === k.uid);
{ const a = mk(0), b = mk(1);
  ok('floor start: 1 extra minion with a whistle', mine(b.s, b.k).length === mine(a.s, a.k).length + 1, `${mine(a.s, a.k).length} -> ${mine(b.s, b.k).length}`);
  const plain = mine(a.s, a.k)[0], w = mine(b.s, b.k).find((m) => m.whistleBoost);
  ok('...of the holder\'s own kind', w && w.def.id === plain.def.id, w && w.def.id);
  ok('...' + W.percent + '% stronger (health)', w && Math.abs(w.maxHp / plain.maxHp - (1 + W.percent / 100)) < 0.03, w && `${plain.maxHp} -> ${w.maxHp}`); }
{ const b = mk(3); const w = mine(b.s, b.k).find((m) => m.whistleBoost); ok('3 whistles: ' + (W.percent + 2 * W.perExtra) + '% stronger, still ONE extra minion', w && w.whistleBoost === W.percent + 2 * W.perExtra && mine(b.s, b.k).filter((m) => m.whistleBoost).length === 1); }
{ const b = mk(1); const n = mine(b.s, b.k).filter((m) => m.whistleBoost).length; for (let t = 0; t < 20000; t += 100) b.s.update(100);
  ok('only once per floor (no more whistle minions mid-fight)', b.s.minions.filter((m) => m.whistleBoost).length <= n); }
