// B5a front line: melee fighters keep their opponent, walk over once (meleeHitMs) and then only swing
// (swingMs); enemies go for the nearest melee hero, sometimes a ranged one; knockback/walking away
// breaks the engagement.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json'), T = rules.attackTiming;
const all = noPerks(r('heroes.json'));
const mk = (heroIds = ['knight', 'rogue', 'archer'], enemyIds = ['goblin', 'goblin', 'goblin']) => {
  const s = new BattleState({ heroDefs: heroIds.map((id) => all.find((h) => h.id === id)), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; u.timer = -1e12; }
  return { s, es, h: s.heroes };
};
const attackOnce = (s, u) => { u.timer = s.interval(u) - 1; const ev = []; for (let t = 0; t < 2000 && !ev.some((e) => e.type === 'attack' && e.attacker === u); t += 10) ev.push(...s.update(10)); return ev; };
const startOf = (ev, u) => ev.find((e) => e.type === 'attackStart' && e.attacker === u);

{ const { s, es, h } = mk(); const knight = h[0];
  const first = startOf(attackOnce(s, knight), knight);
  ok('first melee attack walks over (meleeHitMs)', first.approach && first.hitInMs === T.hero.meleeHitMs);
  ok('after landing it stands next to its target', knight.engagedUid === first.target.uid);
  const second = startOf(attackOnce(s, knight), knight);
  ok('next attack on the same target is just a swing (swingMs)', !second.approach && second.target === first.target && second.hitInMs === T.hero.swingMs);
  ok('knight (left slot) takes the nearest enemy (left)', first.target === es[0]); }

{ const { s, es, h } = mk(); const rogue = h[1];
  ok('rogue (middle slot) takes the middle enemy', s.pickTarget(rogue) === es[1]); }

{ const { s, es, h } = mk(); const knight = h[0];
  attackOnce(s, knight); const foe = es[0]; const ev = []; s.killUnit(foe, ev);
  ok('opponent dies: the knight forgets it and must walk to a new one', knight.foe !== foe.uid && knight.engagedUid === null);
  const next = startOf(attackOnce(s, knight), knight);
  ok('...and walks over again', next.approach && next.target !== foe); }

{ const { s, es, h } = mk(); const knight = h[0];
  attackOnce(s, knight); s.setFocus(es[2].uid);
  const st = startOf(attackOnce(s, knight), knight);
  ok('tap focus: the melee hero walks to the tapped enemy', st.approach && st.target === es[2]); }

{ const { s, es, h } = mk(); const knight = h[0];
  attackOnce(s, knight);
  s.applyStatus(knight, { status: 'knockback', durationMs: 0 }, es[0], 'x', []);
  ok('knockback breaks the engagement', knight.engagedUid === null);
  ok('...so the next attack walks in again', startOf(attackOnce(s, knight), knight).approach); }

{ const { s, es, h } = mk(['knight', 'archer'], ['goblin', 'goblin']); const knight = h[0], g = es[0];
  attackOnce(s, knight); g.foe = knight.uid; const gs = startOf(attackOnce(s, g), g);
  ok('goblin hitting the knight who stands at it: just a swing', !gs.approach && gs.hitInMs === T.enemy.swingMs);
  ok('goblin fighting the knight: both stand together', s.standingTogether(knight, g) && g.engagedUid === knight.uid);
  // The goblin's target dies; it walks away to someone else: the knight must walk after it.
  g.foe = h[1].uid; const st = startOf(attackOnce(s, g), g);
  ok('enemy walks off to the archer', st.approach && st.target === h[1]);
  ok('the knight it left is no longer standing next to it', knight.engagedUid === null); }

// Enemies prefer the front line (melee heroes); some go for the back line.
{ let back = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const { s, es } = mk(); const t = s.pickTarget(es[1]); if (t.damageType !== 'melee') back++; }
  ok(`enemies pick a ranged hero about ${T.backlineTargetChance}% of the time`, Math.abs((100 * back) / N - T.backlineTargetChance) < 3, `${((100 * back) / N).toFixed(1)}%`); }
{ const { s, es } = mk(); const t = s.pickTarget(es[0]);
  let same = true; for (let i = 0; i < 50; i++) if (s.pickTarget(es[0]) !== t) same = false;
  ok('an enemy keeps its opponent', same); }
{ const { s, es, h } = mk(); h[0].alive = false; h[1].alive = false;
  ok('no melee heroes left: enemies go for the back line', s.pickTarget(es[0]) === h[2]); }

// Over a long fight melee now attacks MORE often (swings are short), never less.
{ const count = (swing) => { const rr = { ...rules, attackTiming: { ...T, hero: { ...T.hero, swingMs: swing } } };
    const s = new BattleState({ heroDefs: [all[0]], enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules: rr, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
    const [g] = s.spawnEnemies(['goblin'], 1); g.hp = g.maxHp = 1e9; g.timer = -1e12; s.heroes[0].timer = 0;
    let n = 0; for (let t = 0; t < 10000; t += 50) n += s.update(50).filter((e) => e.type === 'attack').length; return n; };
  ok('attack speed still sets how often a melee hero attacks', Math.abs(count(220) - count(600)) <= 1); }
