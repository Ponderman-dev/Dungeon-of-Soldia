// War Banner (session 32): a steady squad aura, +attack speed for every living hero while its holder lives (squad item).
import fs from 'fs';
import { noPerks, frozenItems } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const itemDefs = loadItems(frozenItems());
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const pct = itemDefs.war_banner.effects.find((e) => e.stat === 'attackEfficiency').percent;
const mk = () => new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: { ...r('combat.json'), heroAttack: { percent: 0 }, morale: {} }, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
{ const s = mk(); s.spawnEnemies(['goblin'], 1); const k = s.heroes[0]; s.heroes[3].alive = false; s.refreshStats();
  const before = s.heroes.map((h) => s.interval(h)); s.giveItem(k.uid, 'war_banner');
  const after = s.heroes.map((h) => s.interval(h));
  ok('+' + pct + '% attack speed for every living hero', [0, 1, 2].every((i) => Math.abs(after[i] - before[i] / (1 + pct / 100)) < 1), `${before[0].toFixed(0)} -> ${after[0].toFixed(0)}`);
  ok('no attack bonus, no proc', k.stats.attack === 20 && !k.procs.some((p) => p.itemId === 'war_banner'), `${k.stats.attack}`);
  s.giveItem(k.uid, 'war_banner'); ok('2 banners: +' + 2 * pct + '%', Math.abs(s.interval(s.heroes[1]) - before[1] / (1 + (2 * pct) / 100)) < 1);
  k.alive = false; s.refreshStats(); ok('gone when the holder dies', Math.abs(s.interval(s.heroes[1]) - before[1]) < 1); }
