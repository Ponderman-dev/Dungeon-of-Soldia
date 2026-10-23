// Skill books (skillBooks.json pages on a hero's skill): stat pages, limits, modifiers.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const books = r('skillBooks.json').pages;
const page = (id) => ({ id, ...books[id] });
const heroes = r('heroes.json');
const capped = { ...r('combat.json'), books: { maxStatPages: 3, modifierSlots: 2 } }; // the old caps: limits still work when set
const mk = (ids = ['knight', 'rogue', 'archer'], castMs = null, rules = r('combat.json')) => {
  const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, castMs === null ? v : { ...v, castMs }]));
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroes.find((h) => h.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(r('items.json')), skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin', 'goblin', 'goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; u.stats.defense = 0; }
  return { s, es, h: s.heroes };
};
const dmgOf = (ev) => ev.filter((e) => e.type === 'attack' && e.skill).reduce((a, e) => a + e.result.amount, 0);

ok('every page has a kind, name and text', Object.values(books).every((p) => ['stat', 'modifier'].includes(p.kind) && p.name && p.text));
{ const { s, h } = mk(); const k = h[0];
  let all = true; for (let i = 0; i < 8; i++) if (!s.addPage(k.uid, 0, page(['sharpen', 'swift', 'lasting'][i % 3])).ok) all = false;
  for (const id of ['venomInk', 'siphon', 'rally', 'hasty', 'roar']) if (!s.addPage(k.uid, 0, page(id)).ok) all = false;
  ok('NO page limits in the game (user): 8 stat pages + 5 modifiers on one skill', all && k.skills[0].pages.length === 13);
  ok('...still no duplicate modifier', s.addPage(k.uid, 0, page('rally')).reason === 'duplicate'); }
{ const { s, h } = mk(undefined, null, capped); const k = h[0];
  ok('a stat page goes on a skill', s.addPage(k.uid, 0, page('sharpen')).ok && k.skills[0].pages.length === 1);
  s.addPage(k.uid, 0, page('sharpen')); s.addPage(k.uid, 0, page('swift'));
  ok('...max 3 stat pages per skill', s.addPage(k.uid, 0, page('lasting')).reason === 'full');
  ok('modifier goes on', s.addPage(k.uid, 0, page('venomInk')).ok);
  ok('...the same modifier twice is refused', s.addPage(k.uid, 0, page('venomInk')).reason === 'duplicate');
  s.addPage(k.uid, 0, page('siphon'));
  ok('...max 2 modifiers: a third needs a replace choice', s.addPage(k.uid, 0, page('rally')).reason === 'full');
  const rep = s.addPage(k.uid, 0, page('rally'), 0);
  ok('...and replaces the one picked', rep.ok && rep.replaced.id === 'venomInk' && k.skills[0].pages.some((p) => p.id === 'rally') && !k.skills[0].pages.some((p) => p.id === 'venomInk'));
  k.alive = false; ok('a dead hero cannot read', s.addPage(k.uid, 1, page('swift')).reason === 'noHero'); }
// Power
{ const a = mk(['knight'], 0), b = mk(['knight'], 0);
  b.s.addPage(b.h[0].uid, 0, page('sharpen')); b.s.addPage(b.h[0].uid, 0, page('sharpen'));
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('2x Sharpen: skill damage +16%', Math.abs(d1 / d0 - 1.16) < 0.03, `${d0} -> ${d1}`); }
// Cooldown / windup
{ const { s, h } = mk(['knight']); const k = h[0];
  s.castSkill(k.uid, 0); const cd0 = k.skills[0].cooldownLeft, w0 = k.casting.total;
  const t = mk(['knight']); t.s.addPage(t.h[0].uid, 0, page('swift')); t.s.addPage(t.h[0].uid, 0, page('steady'));
  t.s.castSkill(t.h[0].uid, 0);
  ok('Swift: cooldown 8% shorter', Math.abs(t.h[0].skills[0].cooldownLeft / cd0 - 0.92) < 0.001);
  ok('Steady Hands: wind-up 15% shorter', Math.abs(t.h[0].casting.total / w0 - 0.85) < 0.001);
  const o = mk(['knight']); o.s.addPage(o.h[0].uid, 0, page('overcharge')); o.s.castSkill(o.h[0].uid, 0);
  ok('Overcharge: wind-up twice as long', Math.abs(o.h[0].casting.total / w0 - 2) < 0.001);
  const hs = mk(['knight']); hs.s.addPage(hs.h[0].uid, 0, page('hasty')); hs.s.castSkill(hs.h[0].uid, 0);
  ok('Hasty: cooldown 25% shorter', Math.abs(hs.h[0].skills[0].cooldownLeft / cd0 - 0.75) < 0.001); }
{ const a = mk(['knight'], 0), b = mk(['knight'], 0);
  b.s.addPage(b.h[0].uid, 0, page('hasty'));
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('...and 20% less power', Math.abs(d1 / d0 - 0.8) < 0.03, `${d0} -> ${d1}`); }
// Lasting
{ const a = mk(['knight'], 0); a.s.addPage(a.h[0].uid, 0, page('lasting'));
  a.s.castSkill(a.h[0].uid, 0); const st = a.es.flatMap((e) => e.statuses).find((x) => x.type === 'stun');
  const b = mk(['knight'], 0); b.s.castSkill(b.h[0].uid, 0); const st0 = b.es.flatMap((e) => e.statuses).find((x) => x.type === 'stun');
  ok('Lasting: the stun from Shield Bash lasts 15% longer', st && st0 && Math.abs(st.total / st0.total - 1.15) < 0.01, `${st0 && st0.total} -> ${st && st.total}`); }
// Inks
{ const { s, es, h } = mk(['knight'], 0); s.addPage(h[0].uid, 0, page('venomInk'));
  s.castSkill(h[0].uid, 0);
  ok('Venom Ink: the enemy hit gets 2 poison stacks', es.some((e) => s.stacks(e, 'poison') === 2)); }
{ const { s, es, h } = mk(['knight'], 0); s.addPage(h[0].uid, 1, page('frostInk'));
  s.castSkill(h[0].uid, 1);
  ok('...on a support skill: the nearest enemy gets them', es.some((e) => s.stacks(e, 'chill') === 2)); }
// Siphon
{ const { s, h } = mk(['knight'], 0); const k = h[0]; s.addPage(k.uid, 0, page('siphon'));
  k.hp = 50000; const ev = s.castSkill(k.uid, 0); const dealt = dmgOf(ev);
  ok('Siphon: 15% of the skill damage heals the caster', Math.abs((k.hp - 50000) - Math.round(dealt * 0.15)) <= 1, `${dealt} -> +${k.hp - 50000}`); }
// Bulwark / Rally
{ const { s, h } = mk(['knight', 'rogue', 'archer'], 0); s.addPage(h[0].uid, 0, page('bulwark')); s.addPage(h[0].uid, 0, page('rally'));
  s.castSkill(h[0].uid, 0);
  ok('Bulwark: the caster gets a shield', h[0].statuses.some((x) => x.type === 'shield'));
  ok('Rally: the whole squad gets the speed buff', h.every((u) => u.statuses.some((x) => x.type === 'buff' && x.source === 'book_rally' || (x.mods || []).some((m) => m.stat === 'attackEfficiency'))));
  ok('...pages on one hero do not touch another hero\'s skill', !h[1].skills[0].pages); }
// Channels and echoes keep working
{ const { s, es, h } = mk(['archer'], 0); const a = h[0];
  const wasRain = a.skills[0].id;
  s.addPage(a.uid, 0, page('razorInk'));
  let crash = null; try { s.castSkill(a.uid, 0); for (let i = 0; i < 60; i++) s.update(50); } catch (err) { crash = err; }
  ok(`a ${wasRain} cast with an Ink runs without errors`, !crash, crash && crash.message); }
// The reward side (systems/books.js)
import { rollBookPages, pageFit, maybeAddBook, pageOf } from '../../src/systems/books.js';
{ const data = r('skillBooks.json');
  const blue = rollBookPages(data, 'blue'), gold = rollBookPages(data, 'golden');
  ok('a blue book shows 2 stat pages + 1 modifier', blue.length === 3 && blue.filter((p) => p.kind === 'stat').length === 2 && new Set(blue.map((p) => p.id)).size === 3);
  ok('a golden book shows 3 different modifiers', gold.length === 3 && gold.every((p) => p.kind === 'modifier') && new Set(gold.map((p) => p.id)).size === 3);
  const { s, h } = mk(undefined, null, capped); const lim = capped.books;
  ok('pageFit: ok on an empty skill', pageFit(h[0], 0, pageOf(data, 'rally'), lim) === 'ok');
  s.addPage(h[0].uid, 0, pageOf(data, 'rally')); s.addPage(h[0].uid, 0, pageOf(data, 'siphon'));
  ok('...duplicate / replace on a full skill', pageFit(h[0], 0, pageOf(data, 'rally'), lim) === 'duplicate' && pageFit(h[0], 0, pageOf(data, 'hasty'), lim) === 'replace');
  h[1].alive = false; ok('...dead heroes cannot read', pageFit(h[1], 0, pageOf(data, 'swift'), lim) === 'dead');
  let seen = 0; for (let i = 0; i < 3000; i++) if (maybeAddBook([1, 2, 3], data, h, data.bookChancePerScreen).some((c) => c.kind === 'book')) seen++;
  ok('a book card shows up about 1 in 15 reward screens', seen > 140 && seen < 270, seen); }
// The other 12 modifiers
const withPage = (id, idx = 0, heroIds = ['knight', 'rogue', 'archer']) => { const m = mk(heroIds, 0); m.s.addPage(m.h[0].uid, idx, page(id)); return m; };
{ const { s, es, h } = withPage('huntersInk'); s.castSkill(h[0].uid, 0);
  ok("Hunter's Ink: the enemy hit is Marked", es.some((e) => e.statuses.some((x) => x.type === 'mark' && x.source === 'book_huntersInk' || x.type === 'mark'))); }
{ const { s, h } = withPage('bloodPrice'); h[1].hp = 20000; h[2].hp = 30000; const k0 = h[0].hp;
  s.castSkill(h[0].uid, 0);
  ok('Blood Price: the 2 hurt allies heal 12%', h[1].hp >= 32000 && h[2].hp >= 42000, `${h[1].hp} ${h[2].hp}`);
  ok('...and the caster pays 6% of its health', h[0].hp <= k0 - 5900, `${k0} -> ${h[0].hp}`); }
{ const { s, h } = withPage('cyclone'); s.castSkill(h[0].uid, 0);
  ok('Cyclone: a tornado spins up', s.tornados.length === 1);
  ok('...and the cooldown is 30% longer', Math.abs(h[0].skills[0].cooldownLeft / s.skillDefs[h[0].skills[0].id].cooldownMs - 1.3) < 0.01); }
{ const { s, es, h } = withPage('ricochet'); const before = es.map((e) => e.hp); const ev = s.castSkill(h[0].uid, 0);
  ok('Ricochet: a second enemy is hit too', es.filter((e, i) => e.hp < before[i]).length === 2 && ev.some((e) => e.type === 'ricochet')); }
{ const { s, es, h } = withPage('aftershock'); s.castSkill(h[0].uid, 0); const hp1 = es.map((e) => e.hp);
  let ev = []; for (let i = 0; i < 22; i++) ev = ev.concat(s.update(50));
  ok('Aftershock: 1s later the target is hit again', ev.some((e) => e.type === 'aftershock') && es.some((e, i) => e.hp < hp1[i])); }
{ const { s, h } = withPage('titan'); s.refreshStats(); h[0].hp = h[0].maxHp; const mh = h[0].maxHp, atk = h[0].stats.attack; const ev = s.castSkill(h[0].uid, 0);
  ok('Titan: +20% max health and attack while big', h[0].maxHp > mh * 1.15 && h[0].stats.attack > atk * 1.15 && ev.some((e) => e.type === 'grow'), `${mh}->${h[0].maxHp}`);
  for (let i = 0; i < 80; i++) s.update(50);
  ok('...and back to normal after 3s', Math.abs(h[0].maxHp - mh) <= 1 && h[0].hp <= h[0].maxHp); }
{ const { s, h } = withPage('purify'); s.applyStatus(h[0], { status: 'weaken', durationMs: 9000 }, h[0], 'x', []); s.castSkill(h[0].uid, 0);
  ok('Purify: the caster loses a debuff', !h[0].statuses.some((x) => x.type === 'weaken')); }
{ const { s, es, h } = withPage('roar'); s.placeLines(); for (const e of es) { e.x = h[0].x + 50; e.y = h[0].y - 40; } s.castSkill(h[0].uid, 0);
  ok('Roar: nearby enemies are taunted by the caster', es.every((e) => s.tauntedBy(e) === h[0])); }
{ const { s, h } = withPage('gravecall'); for (let i = 0; i < 3; i++) { h[0].skills[0].cooldownLeft = 0; s.castSkill(h[0].uid, 0); }
  ok('Gravecall: raises skeletons, at most 2 per hero', s.minions.filter((m) => m.alive !== false && m.holderUid === h[0].uid).length === 2); }
{ const m = mk(['knight'], 0); m.s.rng = () => 0; m.s.addPage(m.h[0].uid, 1, page('concussive'));
  const r2 = mk(['rogue'], 0); r2.s.rng = () => 0; r2.s.addPage(r2.h[0].uid, 0, page('concussive')); r2.s.castSkill(r2.h[0].uid, 0); for (let t = 0; t < 800; t += 20) r2.s.update(20); // Multistrike's hits land over time
  ok('Concussive: a hit can stun', r2.es.some((e) => e.statuses.some((x) => x.type === 'stun'))); }
{ const a = mk(['knight'], 0), b = withPage('reckless', 0, ['knight']);
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('Reckless: +35% power and the caster is marked', Math.abs(d1 / d0 - 1.35) < 0.04 && b.h[0].statuses.some((x) => x.type === 'mark'), `${d0}->${d1}`); }
{ const a = withPage('desperate', 0, ['knight']), b = withPage('desperate', 0, ['knight']); b.h[0].hp = b.h[0].maxHp * 0.3;
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('Desperate: +50% power under 40% health only', Math.abs(d1 / d0 - 1.5) < 0.05, `${d0}->${d1}`); }
// Every page on every hero's skills: a whole fight runs without errors
{ let crash = null;
  for (const hid of heroes.map((x) => x.id)) for (const id of Object.keys(books)) for (const idx of [0, 1]) {
    const m = mk([hid, 'knight', 'archer'], 0); m.s.placeLines(); m.s.addPage(m.h[0].uid, idx, page(id));
    try { for (let t = 0; t < 4000; t += 50) { m.s.update(50); m.s.castSkill(m.h[0].uid, idx); } } catch (err) { crash = `${hid} ${id} ${idx}: ${err.stack.split('\n').slice(0, 2).join(' ')}`; break; }
  }
  ok('every page on every hero skill runs a fight without errors', !crash, crash); }
