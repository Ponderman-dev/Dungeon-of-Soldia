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

// ---- Berserker
{ const { s, es, h } = mk(['berserker']); const b = h[0]; const r0 = b.rage;
  const ev = []; s.landAttack(b, es[0], ev);
  ok('Berserker: his hits fill Rage', b.rage > r0, b.rage);
  s.dealDamage(b, 10, ev); ok('...hits he takes fill it too', b.rage > 8);
  b.rage = 99; const sp0 = b.stats.attackEfficiency; const ev2 = []; s.landAttack(b, es[0], ev2);
  ok('...full Rage = FRENZY (+50% attack speed, lifesteal)', s.frenzied(b) && b.stats.attackEfficiency > sp0 * 1.4 && b.specials.lifesteal >= 15, b.stats.attackEfficiency);
  ok('...the bar empties', b.rage === 0); }
{ const { s, es, h } = mk(['berserker', 'rogue']); const b = h[0]; s.refreshStats(); b.hp = b.maxHp; const hp0 = b.hp, max0 = b.maxHp; const ev = s.castSkill(b.uid, skillOf(b, 'support'));
  ok('Blood Pact: costs 15% of his health', ev.some((e) => e.type === 'selfCost' && e.amount === Math.round(max0 * 0.15)));
  ok('...squad gets 12% lifesteal', h.every((x) => x.specials.lifesteal >= 12)); }
{ const { s, es, h } = mk(['berserker'], ['goblin', 'goblin', 'goblin'], Math.random, true); const b = h[0];
  es[0].x = 150; es[1].x = 200; es[2].x = 380; for (const e of es) e.y = 340; s.focusUid = es[0].uid; const hp = es.map((e) => e.hp);
  s.castSkill(b.uid, skillOf(b, 'attack'));
  ok('Savage Leap: a shockwave hits the enemy next to the target', es[1].hp < hp[1] && es[2].hp === hp[2]); }

// ---- Rogue
{ const { s, es, h } = mk(['rogue']); const ro = h[0];
  for (let i = 0; i < 7; i++) s.landAttack(ro, es[0], []);
  ok('Rogue: hits on the same enemy build combo points (max 5)', ro.combo.uid === es[0].uid && ro.combo.points === 5);
  s.landAttack(ro, es[1], []); ok('...another enemy starts over', ro.combo.uid === es[1].uid && ro.combo.points === 1); }
{ const { s: s1, es: a, h: h1 } = mk(['rogue']); const r1 = h1[0];
  const d1 = s1.castSkill(r1.uid, skillOf(r1, 'attack')).find((e) => e.type === 'attack').result.amount;
  const { s: s2, es: b, h: h2 } = mk(['rogue']); const r2 = h2[0]; s2.focusUid = b[0].uid;
  for (let i = 0; i < 5; i++) s2.landAttack(r2, b[0], []);
  const ev = s2.castSkill(r2.uid, skillOf(r2, 'attack')); const hit = ev.find((e) => e.type === 'attack' && e.skill);
  ok('Eviscerate: 5 points hit much harder (60% + 60% per point)', hit.result.amount > d1 * 4, `${d1} -> ${hit.result.amount}`);
  ok('...a full combo always crits and makes it Bleed', hit.result.crit && b[0].statuses.some((x) => x.type === 'bleed'));
  ok('...the points are spent', r2.combo.points === 0); }
{ const { s, es, h } = mk(['rogue'], ['goblin'], () => 0); const ro = h[0]; s.giveItem(ro.uid, 'venom_fang');
  const ev = []; s.landAttack(ro, es[0], ev);
  ok('...a debuff item proc adds an extra combo point', ro.combo.points === 2, ro.combo.points); }

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
{ const { s, es, h } = mk(['mage', 'archer'], ['goblin'], () => 0); const a = h[1]; s.giveItem(a.uid, 'chill_band');
  s.strike(h[0], es[0], [], { damageType: 'fire' }); const ev = []; s.landAttack(a, es[0], ev);
  ok('...ITEM hits of other heroes react too (Chill Band ice on fire)', ev.some((x) => x.type === 'reaction')); }


