// Phase G6: skill items (real items.json): Conductor's Baton, Echo Rune, Metronome.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { kitsV1 } from './util.mjs';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(r('items.json')), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroDefs = kitsV1(r('heroes.json')), skills = r('skills.json');
const noCast = Object.fromEntries(Object.entries(skills).map(([id, d]) => [id, { ...d, castMs: 0, ...(d.rotation ? { rotation: d.rotation.map((x) => ({ ...x, castMs: 0 })) } : {}) }]));
const mk = (ids, enemyIds = ['goblin'], rng = () => 0.99) => {
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroDefs.find((x) => x.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs, statusDefs: r('statuses.json'), skillDefs: noCast, rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
  const es = s.spawnEnemies(enemyIds, 1);
  for (const e of es) { e.hp = e.maxHp = 1e9; e.stats.defense = 0; e.stats.resist = 0; e.weak = []; e.resists = []; e.flying = false; e.def = { ...e.def, statusDurationScale: 1 }; }
  s.placeLines();
  for (const u of s.heroes) { u.baseStats.attack = 1000; u.baseStats.crit = 0; u.baseStats.evasion = 0; u.baseStats.health = 10000; }
  s.refreshStats();
  for (const u of s.heroes) u.hp = u.maxHp;
  return { s, es, h: s.heroes, a: s.heroes[0] };
};
const give = (s, u, id, n = 1) => { for (let i = 0; i < n; i++) s.giveItem(u.uid, id); };
const cast = (s, u, kind) => s.castSkill(u.uid, u.skills.findIndex((x) => x.kind === kind));
const near = (v, t, tol = 0.04) => Math.abs(v / t - 1) < tol;
const buff = (u) => u.statuses.find((x) => x.type === 'buff');

ok('all 3 G6 items exist', ['conductors_baton', 'echo_rune', 'metronome'].every((id) => itemDefs[id] && itemDefs[id].description));

// Conductor's Baton
{ const { s, a, h } = mk(['knight', 'rogue', 'archer']); cast(s, a, 'support'); const base = buff(a); const bd = base.remaining, bm = base.mods[0].flat;
  const { s: s2, a: a2 } = mk(['knight', 'rogue', 'archer']); give(s2, a2, 'conductors_baton'); cast(s2, a2, 'support'); const b2 = buff(a2);
  ok('Conductor\'s Baton: support skills 25% stronger (Rally Cry +15 -> +18.75 defense)', near(b2.mods[0].flat / bm, 1.25), `${bm} -> ${b2.mods[0].flat}`);
  ok('...and 25% longer (6s -> 7.5s)', near(b2.remaining / bd, 1.25), `${bd} -> ${b2.remaining}`); }
{ const val = (n) => { const { s, a } = mk(['knight', 'rogue', 'archer']); give(s, a, 'conductors_baton', n); cast(s, a, 'support'); return buff(a).mods[0].flat; };
  const one = val(1) / val(0), two = val(2) / val(0);
  ok('...a second copy adds less (+25%, then +21.25%)', near(one, 1.25) && near(two, 1.4625), `${one} ${two}`); }
{ const { s, a, h } = mk(['mage', 'knight', 'rogue']); give(s, a, 'conductors_baton'); cast(s, a, 'support');
  ok('...Arcane Ward: the shield is 25% bigger (and it lasts longer)', near(s.shieldAmount(a), a.stats.attack * 2.5 * 1.25, 0.03), `${s.shieldAmount(a)}`); }
{ const { s, a, h } = mk(['bard', 'knight', 'rogue']); give(s, a, 'conductors_baton'); h.forEach((x) => (x.hp = x.maxHp / 2)); cast(s, a, 'support');
  const st = h[1].statuses.find((x) => x.type === 'regenBoost'); ok('...Ballad of Rest: 25% stronger and longer', near(st.percentMaxHpPerSec, 6.25) && near(st.remaining, 5000)); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer']); give(s, a, 'conductors_baton'); cast(s, a, 'support');
  ok('...also what a support skill puts on ENEMIES (Smoke Bomb\'s blind lasts longer)', near(es[0].statuses.find((x) => x.type === 'blind').remaining, 5000)); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer']); give(s, a, 'conductors_baton'); const hp0 = es[0].hp; cast(s, a, 'attack');
  const dmg = hp0 - es[0].hp; const { s: s2, a: a2, es: e2 } = mk(['rogue', 'knight', 'archer']); const hp1 = e2[0].hp; cast(s2, a2, 'attack');
  ok('...ATTACK skills are not changed', near(dmg / (hp1 - e2[0].hp), 1)); }

// Echo Rune
{ const { s, a, es } = mk(['rogue', 'knight', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const hp0 = es[0].hp;
  const ev = cast(s, a, 'attack'); const hits = ev.filter((e) => e.type === 'attack');
  ok('Echo Rune: a skill can cast twice (the echo hits again)', hits.length === 2 && ev.some((e) => e.type === 'proc' && e.label === 'Echo!'));
  ok('...the echo deals 60% of the original', near(hits[1].result.amount / hits[0].result.amount, 0.6, 0.05), `${hits[0].result.amount} / ${hits[1].result.amount}`);
  ok('...an echo cannot echo again', ev.filter((e) => e.type === 'proc' && e.label === 'Echo!').length === 1); }
{ const { s, a, es } = mk(['rogue', 'knight', 'archer'], ['goblin']); give(s, a, 'echo_rune'); s.rng = Math.random; let n = 0; const N = 6000;
  for (let i = 0; i < N; i++) { a.skills[0].cooldownLeft = 0; if (cast(s, a, 'attack').some((e) => e.label === 'Echo!')) n++; }
  ok('...15% chance', Math.abs(n / N - 0.15) < 0.02, `${n / N}`); }
{ const ch = (n) => { const { s, a } = mk(['rogue', 'knight', 'archer']); give(s, a, 'echo_rune', n); return a.specials.echo; };
  ok('...+15% per copy, capped at 60%', ch(1) === 15 && ch(3) === 45 && ch(6) === 60); }
{ const power = (n) => { const { s, a } = mk(['rogue', 'knight', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune', n); const h = cast(s, a, 'attack').filter((e) => e.type === 'attack'); return h[1].result.amount / h[0].result.amount; };
  ok('...more copies make the echo stronger, toward 100% (1: 60%, 3: 80%, 5+: 100%)', near(power(1), 0.6, 0.05) && near(power(3), 0.8, 0.05) && near(power(8), 1, 0.05), `${power(1)} ${power(3)} ${power(8)}`); }
{ const { s, a } = mk(['mage', 'knight', 'rogue'], ['goblin', 'goblin'], () => 0); give(s, a, 'echo_rune');
  const before = s.currentSpell(a, 0).name; const ev = cast(s, a, 'attack'); const after = s.currentSpell(a, 0).name;
  ok('the Mage\'s rotation moves forward only ONCE per cast, and the echo repeats the SAME spell', before === 'Fireball' && after === 'Frost Nova' && ev.filter((e) => e.type === 'cast').every((e) => e.skill.name === 'Fireball') && ev.filter((e) => e.type === 'cast').length === 2); }
{ const { s, a, h, es } = mk(['knight', 'rogue', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const d0 = a.stats.defense; cast(s, a, 'support');
  ok('support skills can echo too (Rally Cry twice, the buff refreshes)', buff(a) && a.stats.defense === d0 + 15); }
{ const { s, a } = mk(['archer', 'knight', 'rogue'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const ev = cast(s, a, 'attack');
  ok('channels (Rain of Arrows) do not echo', !ev.some((e) => e.label === 'Echo!')); }

// Metronome
{ const { s, a, es, h } = mk(['bard', 'knight', 'rogue']); give(s, a, 'metronome');
  const beat = (u) => { const ev = []; for (let i = 0; i < 4; i++) { ev.length = 0; s.landAttack(u, es[0], ev); } return ev.filter((e) => e.type === 'attack' && !e.basic)[0]; };
  const { s: s0, a: a0, es: e0 } = mk(['bard', 'knight', 'rogue']); const plain = (() => { const ev = []; for (let i = 0; i < 4; i++) { ev.length = 0; s0.landAttack(a0, e0[0], ev); } return ev.filter((e) => e.type === 'attack' && !e.basic)[0]; })();
  const boosted = beat(a);
  ok('Metronome: the empowered beat hits +50% harder', boosted && plain && near(boosted.result.amount / plain.result.amount, 1.5, 0.05), `${plain && plain.result.amount} -> ${boosted && boosted.result.amount}`); }
{ const { s, a, es, h } = mk(['bard', 'knight', 'rogue']); give(s, a, 'metronome'); const beatBy = (u) => { const ev = []; for (let i = 0; i < 4; i++) { ev.length = 0; s.landAttack(i % 3 === 0 && false ? a : u, es[0], ev); } return ev; };
  const k = h[1]; const attacks = [a, k, h[2], k]; let last = []; for (const u of attacks) { last = []; s.landAttack(u, es[0], last); }
  const extra = last.find((e) => e.type === 'attack' && !e.basic);
  const { s: s0, a: a0, es: e0, h: h0 } = mk(['bard', 'knight', 'rogue']); let l0 = []; for (const u of [a0, h0[1], h0[2], h0[1]]) { l0 = []; s0.landAttack(u, e0[0], l0); }
  const plain = l0.find((e) => e.type === 'attack' && !e.basic); void beatBy;
  ok('...on the Bard EVERY squad Rhythm beat counts, whoever lands it (here the Knight)', extra && near(extra.result.amount / plain.result.amount, 1.5, 0.05)); }
{ const { s, a, es, h } = mk(['bard', 'knight', 'rogue']); give(s, h[1], 'metronome'); let last = []; for (const u of [a, h[1], h[2], h[1]]) { last = []; s.landAttack(u, es[0], last); }
  const extra = last.find((e) => e.type === 'attack' && !e.basic);
  const { s: s0, a: a0, es: e0, h: h0 } = mk(['bard', 'knight', 'rogue']); let l0 = []; for (const u of [a0, h0[1], h0[2], h0[1]]) { l0 = []; s0.landAttack(u, e0[0], l0); }
  const plain = l0.find((e) => e.type === 'attack' && !e.basic);
  ok('...held by someone else, it does not boost the Bard\'s beat', near(extra.result.amount / plain.result.amount, 1, 0.05)); }
{ const m = (n) => { const { s, a } = mk(['mage', 'knight', 'rogue']); give(s, a, 'metronome', n); return a.specials.metronome; };
  ok('...+50% per copy', m(1) === 50 && m(3) === 150); }
{ const { s, a, es } = mk(['mage', 'knight', 'rogue']); give(s, a, 'metronome'); const ev = []; for (let i = 0; i < 4; i++) { ev.length = 0; s.landAttack(a, es[0], ev); }
  const { s: s0, a: a0, es: e0 } = mk(['mage', 'knight', 'rogue']); const e2 = []; for (let i = 0; i < 4; i++) { e2.length = 0; s0.landAttack(a0, e0[0], e2); }
  const x = ev.find((e) => e.type === 'attack' && !e.basic), y = e2.find((e) => e.type === 'attack' && !e.basic);
  ok('works for the Mage\'s Spellweaver too (self counter)', near(x.result.amount / y.result.amount, 1.5, 0.05)); }
