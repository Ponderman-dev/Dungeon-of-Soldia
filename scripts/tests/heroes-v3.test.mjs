// Hero kits v3 (real heroes.json, docs/hero-kits-v3.md): each hero's new gimmick. Numbers are read from the data.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const hero = (id) => heroes.find((h) => h.id === id);
// A squad (first = the hero under test) against `enemyIds`, standing in lines; nobody dodges or crits.
const mk = (ids, enemyIds = ['goblin', 'goblin', 'goblin'], rng = Math.random) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...hero(id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; }
  for (const e of es) { e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; }
  s.placeLines();
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const hits = (ev, attacker) => ev.filter((e) => e.type === 'attack' && e.attacker === attacker && !e.result.dodged);

// ================= ALCHEMIST: MAD BOMBER
{ const L = hero('alchemist').passive.lobbed;
  const { s, es, a } = mk(['alchemist']); const [g, near, far] = es;
  near.x = g.x + L.splashRadius - 10; near.y = g.y; far.x = g.x + L.splashRadius + 60; far.y = g.y;
  const ev = []; s.landAttack(a, g, ev);
  const main = hits(ev, a).find((e) => e.target === g), splash = hits(ev, a).find((e) => e.target === near);
  ok('Lobbed Shots: a basic attack splashes an enemy next to the target', !!splash && !hits(ev, a).some((e) => e.target === far));
  ok('...for the splash share of the damage', main && splash && Math.abs(splash.result.amount / main.result.amount - L.splashMultiplier) < 0.08, main && splash && `${main.result.amount} / ${splash.result.amount}`);
  ok('...and poisons the target and the splashed enemy (not the far one)', g.statuses.some((x) => x.type === 'poison') && near.statuses.some((x) => x.type === 'poison') && !far.statuses.some((x) => x.type === 'poison'));
  ok('...poison only (no other debuffs)', [g, near].every((e) => e.statuses.every((x) => x.type === 'poison')));
  const base = hero('alchemist').stats.attackEfficiency;
  ok('...in exchange he attacks slower', Math.abs(a.stats.attackEfficiency - base * (1 + L.attackSpeedPercent / 100)) < 1, `${a.stats.attackEfficiency} vs ${base}`); }
{ const { s, es, a } = mk(['alchemist']); const n = skills[hero('alchemist').skills.attack].random.count;
  const ev = cast(s, a, 'attack'); const fl = ev.filter((e) => e.type === 'flask');
  ok(`Big Barrage: Flask Barrage throws ${n} flasks at enemies`, n === 5 && fl.length === n && fl.every((f) => es.includes(f.target)));
  ok('...poison flasks only: enemies end up poisoned, no other debuff', es.some((e) => e.statuses.some((x) => x.type === 'poison')) && es.every((e) => e.statuses.every((x) => x.type === 'poison'))); }
{ const sk = skills[hero('alchemist').skills.support]; const { s, a, h } = mk(['alchemist', 'knight', 'rogue'], ['goblin'], () => 0); // rng 0: heal flasks
  h.forEach((x) => (x.hp = x.maxHp / 2)); const ev = cast(s, a, 'support'); const fl = ev.filter((e) => e.type === 'flask');
  ok(`Better Brew: Mystery Brew throws ${sk.random.count} flasks, cooldown ${sk.cooldownMs / 1000}s`, sk.random.count === 4 && sk.cooldownMs === 9000 && fl.length === 4 && fl.every((f) => h.includes(f.target)));
  ok(`...healing flasks heal ${sk.random.pool[0].heal.percentMaxHp}%`, h.every((x) => x.hp >= x.maxHp * (0.5 + sk.random.pool[0].heal.percentMaxHp / 100) - 2), h.map((x) => (x.hp / x.maxHp).toFixed(2)).join()); }
