// Hero rework v2 (real heroes.json): each hero's signature mechanic and new skills.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const itemDefs = loadItems(r('items.json'));
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random, positions = false) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroes.find((h) => h.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; }
  if (positions) s.placeLines();
  return { s, es, h: s.heroes };
};
const skillOf = (u, kind) => u.skills.findIndex((x) => x.kind === kind);

// ---- Samurai
{ const { s, es, h } = mk(['samurai'], ['goblin'], () => 0.99); const sa = h[0]; const e = es[0];
  const res = []; for (let i = 0; i < 6; i++) res.push(s.strike(e, sa, [], { basic: true }));
  ok('Samurai: every 3rd hit on him is parried', res.filter((x) => x.parried).length === 2 && res[2].parried && res[5].parried);
  const e0 = e.hp; const ev = []; for (let i = 0; i < 3; i++) s.strike(e, sa, ev, { basic: true });
  ok('...and answered with a counter-cut', e.hp < e0 && ev.some((x) => x.type === 'proc' && x.label === 'Counter!')); }
{ const { s, es, h } = mk(['samurai']); const sa = h[0]; s.castSkill(sa.uid, skillOf(sa, 'support')); const e0 = es[0].hp;
  const ev = []; s.strike(es[0], sa, ev, { basic: true });
  ok('...Focus Stance parries AND counters every hit', es[0].hp < e0); }

// ---- Mage
{ const { s, es, h } = mk(['mage', 'knight']); const m = h[0]; const e = es[0];
  s.strike(m, e, [], { damageType: 'fire' }); ok('Mage: a fire hit leaves its element on the enemy', e.statuses.some((x) => x.type === 'element' && x.element === 'fire'));
  const ev = []; s.strike(m, e, ev, { damageType: 'ice' });
  ok('...fire + ice = Steam (Blind), the mark is used up', ev.some((x) => x.type === 'reaction' && x.kind === 'steam') && e.statuses.some((x) => x.type === 'blind') && !e.statuses.some((x) => x.type === 'element')); }
{ const { s, es, h } = mk(['mage'], ['goblin'], () => 0.5); const m = h[0]; const e = es[0];
  const plain = s.strike(m, e, [], { damageType: 'electric' }).amount; e.statuses = [];
  s.strike(m, e, [], { damageType: 'ice' }); const sh = s.strike(m, e, [], { damageType: 'electric' }).amount;
  ok('...ice + electric = Shatter (+50% on that hit)', sh >= plain * 1.4, `${plain} -> ${sh}`); }
{ const { s, es, h } = mk(['mage']); const m = h[0]; const hp1 = es[1].hp;
  s.strike(m, es[0], [], { damageType: 'fire' }); const ev = []; s.strike(m, es[0], ev, { damageType: 'electric' });
  ok('...fire + electric = Overload (a burst on the others)', ev.some((x) => x.type === 'reaction' && x.kind === 'overload') && es[1].hp < hp1); }
{ const { s, es, h } = mk(['knight']); const k = h[0]; s.strike(k, es[0], [], { damageType: 'fire' });
  ok('...no Mage, no elements', !es[0].statuses.some((x) => x.type === 'element')); }
{ const { s, es, h } = mk(['mage', 'archer'], ['goblin'], () => 0); const a = h[1]; s.giveItem(a.uid, 'frost_charm');
  s.strike(h[0], es[0], [], { damageType: 'fire' }); const ev = []; s.landAttack(a, es[0], ev);
  ok('...ITEM hits of other heroes react too (Frost Charm ice on fire)', ev.some((x) => x.type === 'reaction')); }


