// B4: an attack on its way when the target dies goes for someone else (or is cancelled if nobody
// is left); knockback stops an attack on its way; stun/freeze/fear mid-attack cancel it.
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = r('combat.json');
const mk = (ids = ['goblin', 'goblin']) => {
  const s = new BattleState({ heroDefs: noPerks(r('heroes.json')), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const es = s.spawnEnemies(ids, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e9; u.stats.evasion = 0; u.timer = -1e12; }
  return { s, es, knight: s.heroes[0] };
};
const start = (s, u) => { u.timer = s.interval(u) - 1; return s.update(1).find((e) => e.type === 'attackStart' && e.attacker === u); };

{ const { s, es, knight } = mk(); const st = start(s, knight); const first = st.target, other = es.find((e) => e !== first);
  s.update(100); const ev = []; s.killUnit(first, ev);
  const re = ev.find((e) => e.type === 'attackRetarget' && e.attacker === knight);
  ok('target dies mid-run: the attack is redirected at once', re && re.target === other && knight.pending.target === other);
  ok('it gets at least retargetMinMs to get there', re.hitInMs >= rules.attackTiming.retargetMinMs, `${re.hitInMs}`);
  const hit = []; for (let t = 0; t < 600; t += 50) hit.push(...s.update(50).filter((e) => e.type === 'attack' && e.attacker === knight));
  ok('and lands on the new target', hit.length === 1 && hit[0].target === other); }

{ const { s, es, knight } = mk(['goblin']); start(s, knight);
  const ev = []; s.killUnit(es[0], ev);
  ok('target dies and nobody is left: the attack is cancelled', ev.some((e) => e.type === 'attackCancel' && e.unit === knight) && !knight.pending); }

{ const { s, es } = mk(); const g = es[0]; start(s, g);
  const ev = []; s.applyStatus(g, { status: 'knockback', durationMs: 0 }, s.heroes[0], 'x', ev);
  ok('knockback mid-run stops the attack', !g.pending && ev.some((e) => e.type === 'attackCancel' && e.unit === g)); }

{ const { s, es } = mk(); const g = es[0]; start(s, g);
  s.applyStatus(g, { status: 'fear', durationMs: 1000 }, s.heroes[0], 'x', []);
  const ev = s.update(50);
  ok('fear mid-run cancels the attack (it goes back)', !g.pending && ev.some((e) => e.type === 'attackCancel' && e.unit === g)); }

{ const { s, es, knight } = mk(); const g = es[0]; const st = start(s, g); const victim = st.target;
  const ev = []; s.killUnit(victim, ev);
  const re = ev.find((e) => e.type === 'attackRetarget' && e.attacker === g);
  ok('an enemy whose hero dies mid-run goes for another hero', re && re.target !== victim && re.target.side === 'hero' && re.target.alive); }

{ const { s, es, knight } = mk(['bat']); const bat = es[0]; bat.flying = true;
  const st = start(s, knight);
  ok('melee heroes still go for flying enemies', st && st.target === bat); }
