// Overseer's Whistle (user, session 59): +1 weak minion allowed, and a chance on the holder's attacks to blow the
// whistle: every living minion heals and gets +attack / +attack speed for a few seconds.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const P = itemDefs.overseers_whistle.effects.find((e) => e.minionRally), R = P.minionRally;
const heroes = r('heroes.json').map((h) => ({ ...h, perk: undefined })); // real kits: the Necromancer's skeletons come from his passive
const mk = (n) => {
  const s = new BattleState({ heroDefs: ['necromancer', 'knight', 'cleric'].map((id) => heroes.find((h) => h.id === id)), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const k = s.heroes[0]; for (let i = 0; i < n; i++) s.giveItem(k.uid, 'overseers_whistle');
  const [g] = s.spawnEnemies(['goblin'], 1); s.placeLines(); s.startFloor([]); return { s, k, g };
};
{ const { s, k } = mk(1); const x = (k.def.passive && k.def.passive.legion && k.def.passive.legion.minionItemMultiplier) || 1;
  ok('+1 weak minion allowed (x' + x + ' on the Necromancer: his Legion doubles minion items)', s.minionBoost().weakCap === x); }
{ const { s, k } = mk(1); const proc = k.procs.find((p) => p.minionRally); ok('chance ' + P.chance + '% per attack (1 whistle)', proc && proc.chance === P.chance);
  const k3 = mk(3).k; ok('...+' + P.chancePerExtra + '% per extra whistle (3 = ' + (P.chance + 2 * P.chancePerExtra) + '%), one roll', k3.procs.filter((p) => p.minionRally).length === 1 && k3.procs.find((p) => p.minionRally).chance === P.chance + 2 * P.chancePerExtra); }
{ const { s, k, g } = mk(1); const ms = s.minions.filter((m) => m.alive); for (const m of ms) m.hp = Math.round(m.maxHp / 2);
  const atk0 = ms[0].stats.attack, spd0 = ms[0].stats.attackEfficiency, hp0 = ms[0].hp;
  const ev = []; s.rollProcs(k, 'onAttack', ev, { target: g, force: true });
  ok('the whistle blows (Whistle!)', ev.some((e) => e.type === 'proc' && e.itemId === 'overseers_whistle'));
  ok('...every minion heals ' + R.healPercent + '%', ms.every((m) => m.hp > hp0) && Math.abs(ms[0].hp - hp0 - ms[0].maxHp * R.healPercent / 100) <= 1, `${hp0} -> ${ms[0].hp}`);
  ok('...and gets +' + R.attackPercent + '% attack and +' + R.speedPercent + '% attack speed', ms[0].stats.attack > atk0 && ms[0].stats.attackEfficiency > spd0, `${atk0}->${ms[0].stats.attack} ${spd0}->${ms[0].stats.attackEfficiency}`);
  for (let t = 0; t < R.durationMs + 200; t += 100) s.tickStatuses(100, []);
  ok('...for ' + R.durationMs / 1000 + 's', !ms[0].statuses.some((x) => x.key === 'buff:whistle')); }
{ const { s, k, g } = mk(1); for (const m of [...s.minions]) s.vanishMinion(m, 'test', []); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: g, force: true });
  ok('no minions: the whistle stays quiet', !ev.some((e) => e.itemId === 'overseers_whistle')); }
