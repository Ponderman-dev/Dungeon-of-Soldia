// Phase G6: skill items (real items.json): Conductor's Baton, Echo Rune, Metronome.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { kitsV1, frozenItems } from './util.mjs';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const itemDefs = loadItems(frozenItems()), rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
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
  ok('...a second copy adds +15% (+25%, then +40%)', near(one, 1.25) && near(two, 1.4), `${one} ${two}`); }
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
  ok('...more copies: closer and closer to 90%, no hard stop (1: 15%, 3: about 38%, 20: about 87%)', ch(1) === 15 && Math.abs(ch(3) - 37.9) < 0.5 && ch(20) > 85 && ch(20) < 90, `${ch(3)} ${ch(20)}`); }
{ const power = (n) => { const { s, a } = mk(['rogue', 'knight', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune', n); const h = cast(s, a, 'attack').filter((e) => e.type === 'attack'); return h[1].result.amount / h[0].result.amount; };
  ok('...more copies make the echo stronger, +10% each with no limit (1: 60%, 3: 80%, 8: 130%)', near(power(1), 0.6, 0.05) && near(power(3), 0.8, 0.05) && near(power(8), 1.3, 0.05), `${power(1)} ${power(3)} ${power(8)}`); }
{ const { s, a } = mk(['mage', 'knight', 'rogue'], ['goblin', 'goblin'], () => 0); give(s, a, 'echo_rune');
  const before = s.currentSpell(a, 0).name; const ev = cast(s, a, 'attack'); const after = s.currentSpell(a, 0).name;
  ok('the Mage\'s rotation moves forward only ONCE per cast, and the echo repeats the SAME spell', before === 'Fireball' && after === 'Frost Nova' && ev.filter((e) => e.type === 'cast').every((e) => e.skill.name === 'Fireball') && ev.filter((e) => e.type === 'cast').length === 2); }
{ const { s, a, h, es } = mk(['knight', 'rogue', 'archer'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const d0 = a.stats.defense; cast(s, a, 'support');
  ok('support skills can echo too (Rally Cry twice, the buff refreshes)', buff(a) && a.stats.defense === d0 + 15); }
{ const { s, a } = mk(['archer', 'knight', 'rogue'], ['goblin'], () => 0); give(s, a, 'echo_rune'); const ev = cast(s, a, 'attack');
  ok('channels (Rain of Arrows) do not echo', !ev.some((e) => e.label === 'Echo!')); }

// Metronome (reworked): its OWN counter, every 4th basic attack of the holder deals +50% per copy.
{ const basics = (n) => { const { s, a, es } = mk(['knight', 'rogue', 'archer']); give(s, a, 'metronome', n); const out = [];
    for (let i = 0; i < 8; i++) { const ev = []; s.landAttack(a, es[0], ev); out.push({ hit: ev.find((e) => e.type === 'attack' && e.basic), pop: ev.some((e) => e.type === 'proc' && e.itemId === 'metronome') }); }
    return out; };
  const one = basics(1), three = basics(3);
  ok('Metronome: attacks 1-3 are normal, the 4th hits +50% and pops the icon', near(one[3].hit.result.amount / one[0].hit.result.amount, 1.5, 0.05) && one[3].pop && !one[0].pop && !one[2].pop, `${one[0].hit.result.amount} -> ${one[3].hit.result.amount}`);
  ok('...and again on the 8th', one[7].pop && near(one[7].hit.result.amount / one[4].hit.result.amount, 1.5, 0.05));
  ok('...+50% per copy (3 copies = +150%)', near(three[3].hit.result.amount / three[0].hit.result.amount, 2.5, 0.05));
  const { s, a, es } = mk(['knight', 'rogue', 'archer']); const ev = []; for (let i = 0; i < 4; i++) s.landAttack(a, es[0], ev);
  ok('...without it nothing happens', !ev.some((e) => e.itemId === 'metronome')); }
