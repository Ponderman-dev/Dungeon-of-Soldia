// D3 "every Nth attack" counters (hero def `counter`): Mage Spellweaver (self, empower), Cleric (self,
// heal the lowest ally instead of hitting), Bard Rhythm (squad beat, empower). Counts basic attacks only.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const mk = (counterFor = {}) => {
  const defs = noPerks(r('heroes.json')).slice(0, 3).map((d, i) => ({ ...d, counter: counterFor[i] }));
  const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e6; u.stats.evasion = 0; u.stats.crit = 0; u.timer = -1e12; }
  es[0].resists = []; es[0].weak = []; es[0].stats.defense = 0; es[0].stats.resist = 0;
  return { s, g: es[0], h: s.heroes };
};
const basic = (s, u, g) => { const ev = []; s.landAttack(u, g, ev); return ev; };
const attacksBy = (ev, u) => ev.filter((e) => e.type === 'attack' && e.attacker === u);
const WEAVE = { id: 'weave', label: 'SPELL', every: 4, scope: 'self', effect: 'empower', firedLabel: 'Spellweave!', strike: { damageMultiplier: 1.5, damageType: 'fire' }, apply: [{ status: 'burn', durationMs: 3000, damageMultiplier: 0.3, damageType: 'fire' }] };
const HEAL = { id: 'mend', label: 'HEAL', every: 4, scope: 'self', effect: 'heal', firedLabel: 'Heal!', heal: { percentMaxHp: 20, attackMultiplier: 0 } };
const BEAT = { id: 'rhythm', label: 'RHYTHM', every: 4, scope: 'squad', effect: 'empower', strike: { damageMultiplier: 0.5, damageType: 'melee' } };

{ const { s, g, h } = mk({ 0: WEAVE }); const mage = h[0];
  const counts = []; const fired = [];
  for (let i = 0; i < 8; i++) { const ev = basic(s, mage, g); const b = ev.find((e) => e.type === 'beat'); counts.push(b.count); fired.push(b.fired); }
  ok('the counter counts 1, 2, 3, then fires on the 4th (and repeats)', counts.join() === '1,2,3,4,1,2,3,4' && fired.join() === 'false,false,false,true,false,false,false,true');
  const ev = basic(s, mage, g); basic(s, mage, g); basic(s, mage, g); const fourth = basic(s, mage, g);
  ok('normal attacks: one hit, the 4th: a free extra hit', attacksBy(ev, mage).length === 1 && attacksBy(fourth, mage).length === 2);
  ok('the free hit has its own damage type and label', fourth.some((e) => e.type === 'proc' && e.label === 'Spellweave!') && attacksBy(fourth, mage)[1].damageType === 'fire');
  ok('...and puts its debuff on the target', g.statuses.some((x) => x.type === 'burn')); }

{ const { s, g, h } = mk({ 0: WEAVE }); const [mage, other] = h;
  for (let i = 0; i < 10; i++) basic(s, other, g);
  ok('a self counter ignores other heroes\' attacks', mage.counterCount === 0);
  for (let i = 0; i < 3; i++) s.castSkill(mage.uid, 0);
  ok('...and skills are not counted', mage.counterCount === 0); }

{ const { s, g, h } = mk({ 2: BEAT }); const [a, b, bard] = h;
  const seq = []; const who = [a, b, bard, a, b, bard, a, a];
  const fired = []; for (const u of who) { const ev = basic(s, u, g); fired.push(ev.some((e) => e.type === 'beat' && e.fired)); }
  ok('a squad beat counts every hero\'s attacks together and fires on the 4th', fired.join() === 'false,false,false,true,false,false,false,true');
  const ev1 = basic(s, a, g); basic(s, b, g); basic(s, bard, g); const ev4 = basic(s, a, g);
  ok('the empowered 4th hit belongs to whoever landed it', attacksBy(ev4, a).length === 2 && attacksBy(ev1, a).length === 1); }

{ const { s, g, h } = mk({ 2: BEAT }); const [a, , bard] = h; bard.alive = false;
  for (let i = 0; i < 8; i++) basic(s, a, g);
  ok('a dead holder counts nothing', bard.counterCount === 0); }

{ const { s, g, h } = mk({ 2: BEAT }); const [a] = h;
  for (let i = 0; i < 3; i++) basic(s, a, g);
  s.spawnEnemies(['goblin'], 2);
  ok('the count is kept between floors', h[2].counterCount === 3); }

{ const { s, g, h } = mk({ 2: HEAL }); const [k, ro, cleric] = h; ro.hp = 500000; g.hp = 1e6;
  const hp0 = g.hp;
  for (let i = 0; i < 3; i++) basic(s, cleric, g);
  ok('Cleric: three normal hits first', g.hp < hp0);
  const hp1 = g.hp; const ev = basic(s, cleric, g);
  ok('...the 4th attack does NOT hit the enemy', g.hp === hp1 && attacksBy(ev, cleric).length === 0);
  ok('...it heals the lowest-health ally instead', ro.hp === 500000 + 200000 && ev.some((e) => e.type === 'heal' && e.unit === ro));
  ok('...and the count starts over', cleric.counterCount === 0); }

{ const { s, g, h } = mk({ 2: HEAL }); const cleric = h[2]; // nobody hurt
  for (let i = 0; i < 4; i++) basic(s, cleric, g);
  const hp = g.hp; const ev = basic(s, cleric, g);
  ok('Cleric with nobody hurt: attacks normally and stays charged', g.hp < hp && cleric.counterCount === 4 && !ev.some((e) => e.type === 'heal'));
  h[0].hp = 100;
  const ev2 = basic(s, cleric, g);
  ok('...and heals on the next attack once somebody is hurt', ev2.some((e) => e.type === 'heal' && e.unit === h[0]) && cleric.counterCount === 0); }

{ const { s, g, h } = mk({ 2: HEAL }); const [k, ro, cleric] = h; k.hp = 700000; ro.hp = 300000;
  for (let i = 0; i < 4; i++) basic(s, cleric, g);
  ok('the MOST hurt ally (lowest %) gets the heal', ro.hp > 300000 && k.hp === 700000); }

{ const { s, g, h } = mk({ 0: { ...WEAVE, forceProcs: true } }); const mage = h[0];
  mage.procs = [{ proc: 'onAttack', chance: 1, label: 'x', itemId: 'it', targets: 'self', silent: true, apply: [{ status: 'buff', durationMs: 1000, mods: [{ stat: 'defense', flat: 5 }] }] }];
  const d0 = mage.stats.defense; for (let i = 0; i < 3; i++) basic(s, mage, g);
  ok('normal attacks roll procs normally (1% here: no)', mage.stats.defense === d0);
  basic(s, mage, g);
  ok('forceProcs: the empowered attack makes every on-hit proc go off', mage.stats.defense === d0 + 5); }

{ const { s, g, h } = mk({ 2: HEAL }); const cleric = h[2];
  cleric.procs = [{ proc: 'onAttack', chance: 100, label: 'x', itemId: 'it', targets: 'self', silent: true, apply: [{ status: 'buff', durationMs: 1000, mods: [{ stat: 'defense', flat: 5 }] }] }];
  h[1].hp = 1; for (let i = 0; i < 3; i++) basic(s, cleric, g);
  s.clearStatuses(); const d0 = cleric.stats.defense; basic(s, cleric, g);
  ok('the Cleric\'s heal attack triggers no on-hit items', cleric.stats.defense === d0); }
