// Skill books (skillBooks.json pages on a hero's skill): stat pages, limits, modifiers.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const books = r('skillBooks.json').pages;
const page = (id) => ({ id, ...books[id] });
const heroes = r('heroes.json');
const mk = (ids = ['knight', 'rogue', 'archer'], castMs = null) => {
  const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, castMs === null ? v : { ...v, castMs }]));
  const s = new BattleState({ heroDefs: ids.map((id) => ({ ...heroes.find((h) => h.id === id), perk: undefined })), enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(r('items.json')), skillDefs: skills, statusDefs: r('statuses.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
  const es = s.spawnEnemies(['goblin', 'goblin', 'goblin'], 1);
  for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 100000; u.stats.evasion = 0; u.stats.crit = 0; u.stats.defense = 0; }
  return { s, es, h: s.heroes };
};
const dmgOf = (ev) => ev.filter((e) => e.type === 'attack' && e.skill).reduce((a, e) => a + e.result.amount, 0);

ok('every page has a kind, name and text', Object.values(books).every((p) => ['stat', 'modifier'].includes(p.kind) && p.name && p.text));
{ const { s, h } = mk(); const k = h[0];
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
