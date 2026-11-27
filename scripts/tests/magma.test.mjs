// Magma Core rework (user, session 59): its OWN Burn chance on attack, stronger Burns, the eruption stays.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { noPerks } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json'));
const M = itemDefs.magma_core.effects, P = M.find((e) => e.proc), B = M.find((e) => e.special === 'magmaBurn');
const mk = (n) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')).slice(0, 3), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const k = s.heroes[0]; for (let i = 0; i < n; i++) s.giveItem(k.uid, 'magma_core');
  const es = s.spawnEnemies(['goblin'], 1); s.placeLines(); for (const e of es) { e.hp = e.maxHp = 1e6; e.resists = []; e.weak = []; } return { s, k, e: es[0] };
};
{ const { k } = mk(1); const p = k.procs.find((x) => x.itemId === 'magma_core'); ok('own Burn: ' + P.chance + '% on attack', p && p.chance === P.chance);
  const p3 = mk(3).k.procs.filter((x) => x.itemId === 'magma_core'); ok('...3 cores: one roll at ' + (P.chance + 2 * P.chancePerExtra) + '%', p3.length === 1 && p3[0].chance === P.chance + 2 * P.chancePerExtra); }
{ const { s, k, e } = mk(1); const ev = []; s.rollProcs(k, 'onAttack', ev, { target: e, hit: true, force: true });
  ok('the proc Burns the target, no other item needed', e.statuses.some((x) => x.type === 'burn')); }
{ const dmg = (n) => { const { s, k, e } = mk(n); s.applyStatus(e, { status: 'burn', durationMs: 3000, damageMultiplier: 1, damageType: 'fire' }, k, 'b', []); return e.statuses.find((x) => x.type === 'burn').damage; };
  ok('Burns +' + B.percent + '% (1 core)', Math.abs(dmg(1) / dmg(0) - (1 + B.percent / 100)) < 0.05, `${dmg(0)} -> ${dmg(1)}`);
  ok('...+' + B.perExtra + '% per extra core', Math.abs(dmg(2) / dmg(0) - (1 + (B.percent + B.perExtra) / 100)) < 0.05, `${dmg(2)}`); }
