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
  ok('2x Sharpen: skill damage 2x its power', Math.abs(d1 / d0 - (1 + 2 * books.sharpen.power / 100)) < 0.05, `${d0} -> ${d1}`); }
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
  ok('Blood Price: the 2 hurt allies heal', h[1].hp >= 20000 + 1000 * books.bloodPrice.allyHeal.percentMaxHp && h[2].hp >= 30000 + 1000 * books.bloodPrice.allyHeal.percentMaxHp, `${h[1].hp} ${h[2].hp}`);
  ok('...and the caster pays 6% of its health', h[0].hp <= k0 - 5900, `${k0} -> ${h[0].hp}`); }
{ const { s, h } = withPage('cyclone'); s.castSkill(h[0].uid, 0);
  ok('Cyclone: a tornado spins up', s.tornados.length === 1);
  ok('...and the cooldown is longer', Math.abs(h[0].skills[0].cooldownLeft / s.skillDefs[h[0].skills[0].id].cooldownMs - (1 - books.cyclone.cooldown / 100)) < 0.01); }
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
  ok('Reckless: more power and the caster is marked', Math.abs(d1 / d0 - (1 + books.reckless.power / 100)) < 0.05 && b.h[0].statuses.some((x) => x.type === 'mark'), `${d0}->${d1}`); }
{ const a = withPage('desperate', 0, ['knight']), b = withPage('desperate', 0, ['knight']); b.h[0].hp = b.h[0].maxHp * 0.3;
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('Desperate: more power under 40% health only', Math.abs(d1 / d0 - (1 + books.desperate.desperate.power / 100)) < 0.06, `${d0}->${d1}`); }
// Every page on every hero's skills: a whole fight runs without errors
{ let crash = null;
  for (const hid of heroes.map((x) => x.id)) for (const id of Object.keys(books)) for (const idx of [0, 1]) {
    const m = mk([hid, 'knight', 'archer'], 0); m.s.placeLines(); m.s.addPage(m.h[0].uid, idx, page(id));
    try { for (let t = 0; t < 4000; t += 50) { m.s.update(50); m.s.castSkill(m.h[0].uid, idx); } } catch (err) { crash = `${hid} ${id} ${idx}: ${err.stack.split('\n').slice(0, 2).join(' ')}`; break; }
  }
  ok('every page on every hero skill runs a fight without errors', !crash, crash); }
// PAGE TIERS (session 45): tier odds per book, golden-book specials (legendary / hero-only), hero pages only for the
// squad, empty tiers fall back. A made-up page list; the odds are read from the real data.
{ const real = r('skillBooks.json');
  const pg = (tier, extra = {}) => ({ kind: 'modifier', tier, name: tier, ...extra });
  const pages = { s1: { kind: 'stat' }, s2: { kind: 'stat' }, s3: { kind: 'stat' } };
  for (let i = 0; i < 6; i++) { pages['c' + i] = pg('common'); pages['r' + i] = pg('rare'); pages['l' + i] = pg('legendary'); }
  pages.hk = pg('hero', { hero: 'knight' }); pages.hm = pg('hero', { hero: 'mage' });
  const data = { ...real, pages };
  let x = 7; const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const N = 20000, count = (book, ids) => { const c = { books: { legendary: 0, hero: 0, both: 0 } }; for (let i = 0; i < N; i++) { const ps = rollBookPages(data, book, rng, ids); for (const p of ps) c[p.kind === 'stat' ? 'stat' : p.tier] = (c[p.kind === 'stat' ? 'stat' : p.tier] || 0) + 1; const L = ps.some((p) => p.tier === 'legendary'), H = ps.some((p) => p.tier === 'hero'); if (L) c.books.legendary++; if (H) c.books.hero++; if (L && H) c.books.both++; } return c; };
  const near = (got, want, tol) => Math.abs(got - want) <= tol;
  const blue = count('blue', ['knight']), bo = real.tierOdds.blue, bt = Object.values(bo).reduce((a, b) => a + b, 0);
  ok('blue book: modifier tiers follow tierOdds', near(blue.common / N, bo.common / bt, 0.02) && near(blue.rare / N, bo.rare / bt, 0.02), `${(blue.common / N * 100).toFixed(1)}% common`);
  ok('...and never a legendary or hero page', !blue.legendary && !blue.hero);
  const gold = count('golden', ['knight']), sp = real.specials.golden;
  ok('golden book: a legendary in about specials.legendary of the books', near(gold.books.legendary / N, sp.legendary, 0.015), (gold.books.legendary / N * 100).toFixed(1) + '%');
  ok('...a hero page in about specials.hero of the books', near(gold.books.hero / N, sp.hero, 0.01), (gold.books.hero / N * 100).toFixed(1) + '%');
  ok('...both in one book can happen', gold.books.both > 0, gold.books.both);
  ok('...the other pages are rares, never commons', !gold.common && gold.rare > 0);
  let wrongHero = 0; for (let i = 0; i < 5000; i++) if (rollBookPages(data, 'golden', rng, ['knight', 'rogue']).some((p) => p.hero && p.hero !== 'knight')) wrongHero++;
  ok('hero pages only for heroes in the squad', wrongHero === 0);
  const noHero = count('golden', ['rogue', 'archer']);
  ok('...no hero page for this squad = a normal page instead (still 3 pages)', !noHero.hero && noHero.rare + noHero.legendary === 3 * N);
  const thin = { ...real, pages: { s1: { kind: 'stat' }, s2: { kind: 'stat' }, c0: pg('common'), c1: pg('common'), c2: pg('common') } };
  const ps = rollBookPages(thin, 'golden', rng, ['knight']);
  ok('an empty tier falls back to a lower one (no rares: commons)', ps.length === 3 && ps.every((p) => p.tier === 'common'));
  const realTiers = Object.values(real.pages).filter((p) => p.kind === 'modifier');
  ok('every real modifier page has a tier', realTiers.every((p) => ['common', 'rare', 'legendary', 'hero'].includes(p.tier)));
  ok('...and every hero page names a real hero', realTiers.filter((p) => p.tier === 'hero').every((p) => r('heroes.json').some((h) => h.id === p.hero))); }
// PAGE ICONS (session 45, user's pick 'F'): every page has its own spell tome icon (pageIcons.json, systems/pageIcon.js).
import { pageIconArt } from '../../src/systems/pageIcon.js';
{ const icons = r('pageIcons.json'), data = r('skillBooks.json'), frame = { edge: '0x123456', hi: '0x654321' };
  const ids = Object.keys(data.pages);
  ok('every page has its own icon entry', ids.every((id) => icons[id]), ids.filter((id) => !icons[id]).join(' '));
  ok('...each symbol is 7x7', Object.entries(icons).filter(([k]) => k[0] !== '_' || k === '_default').every(([, v]) => v.symbol.length === 7 && v.symbol.every((row) => row.length === 7 && /^[.12]+$/.test(row))));
  const arts = ids.map((id) => pageIconArt(icons, id, frame));
  ok('...the art is 16x16 and uses only its palette', arts.every((a) => a.rows.length === 16 && a.rows.every((row) => row.length === 16 && [...row].every((c) => c === '.' || Number(c) < a.palette.length))));
  ok('...no two pages look the same', new Set(arts.map((a) => a.rows.join('') + a.palette.join())).size === ids.length);
  ok('...no clasp on the book (user: the lock felt weird): its right side is a plain outline', arts.every((a) => a.rows.every((row, y) => y < 1 || y > 14 || row[13] === '0')));
  ok('a page without an entry gets the default tome', pageIconArt(icons, 'noSuchPage', frame).rows.length === 16); }
// NEW PAGES batch 1 (session 46, the 8 commons): numbers read from the data.
{ const a = mk(['knight'], 0), b = withPage('keen', 0, ['knight']); a.s.rng = b.s.rng = () => 0.05; // crit roll 5: only Keen's bonus crits
  const ca = a.s.castSkill(a.h[0].uid, 0).some((e) => e.type === 'attack' && e.skill && e.result.crit), cb = b.s.castSkill(b.h[0].uid, 0).some((e) => e.type === 'attack' && e.skill && e.result.crit);
  ok(`Keen: +${books.keen.critBonus}% crit chance on skill hits`, !ca && cb); }
{ const a = mk(['knight'], 0), b = withPage('heavy', 0, ['knight']);
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('Heavy: more power and a longer cooldown', Math.abs(d1 / d0 - (1 + books.heavy.power / 100)) < 0.03 && Math.abs(b.h[0].skills[0].cooldownLeft / a.h[0].skills[0].cooldownLeft - (1 - books.heavy.cooldown / 100)) < 0.001, `${d0}->${d1}`); }
{ const { s, h } = withPage('quickDraw', 0, ['knight']); const full = s.skillDefs[h[0].skills[0].id].cooldownMs;
  h[0].skills[0].cooldownLeft = full; h[0].skills[1].cooldownLeft = full; s.startFloor();
  ok('Quick Draw: a new fight starts with the skill half charged (only that skill)', Math.abs(h[0].skills[0].cooldownLeft - full * (1 - books.quickDraw.fightStartCharge / 100)) < 1 && h[0].skills[1].cooldownLeft === full); }
{ const a = mk(['knight'], 0), b = withPage('piercing', 0, ['knight']); for (const m of [a, b]) for (const e of m.es) e.stats.defense = e.stats.resist = 60;
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  const c = mk(['knight'], 0); for (const e of c.es) e.stats.defense = e.stats.resist = 60 * (1 - books.piercing.armorPierce / 100); const d2 = dmgOf(c.s.castSkill(c.h[0].uid, 0));
  ok('Piercing: hits as if the enemy had 15% less defense', d1 > d0 && Math.abs(d1 - d2) <= 2, `${d0} -> ${d1} (want ${d2})`); }
{ const { s, h } = withPage('secondWind', 0, ['knight']); h[0].hp = 50000; s.castSkill(h[0].uid, 0);
  ok('Second Wind: casting heals the caster 4% of max health', Math.abs(h[0].hp - 50000 - h[0].maxHp * books.secondWind.selfHealPercent / 100) <= 1, h[0].hp); }
{ const { s, h } = withPage('momentum', 0, ['knight']); s.castSkill(h[0].uid, 0);
  const got = []; for (let i = 0; i < books.momentum.momentum.attacks + 1; i++) got.push(s.spendMomentum(h[0]));
  ok('Momentum: the next 3 basic attacks get +20%, then none', got.slice(0, -1).every((x) => x === books.momentum.momentum.damagePercent) && got[got.length - 1] === 0, got.join(' '));
  const t = withPage('momentum', 0, ['knight']); t.s.placeLines(); t.s.castSkill(t.h[0].uid, 0);
  let crash = null; try { for (let i = 0; i < 200; i++) t.s.update(50); } catch (err) { crash = err.message; }
  ok('...a fight with Momentum uses the charges up', !crash && t.h[0].momentum.left < books.momentum.momentum.attacks, crash || t.h[0].momentum.left); }
{ const a = withPage('finisher', 0, ['knight']), b = withPage('finisher', 0, ['knight']);
  for (const e of b.es) e.hp = e.maxHp * (books.finisher.vsLow.belowPercent - 5) / 100;
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok(`Finisher: +${books.finisher.vsLow.power}% power only vs enemies under 30% health`, Math.abs(d1 / d0 - (1 + books.finisher.vsLow.power / 100)) < 0.03, `${d0}->${d1}`); }
{ const a = withPage('giantSlayer', 0, ['knight']), b = withPage('giantSlayer', 0, ['knight']);
  for (const e of b.es) e.elite = { traits: [] };
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok(`Giant Slayer: +${books.giantSlayer.vsBig.power}% power only vs elites / bosses`, Math.abs(d1 / d0 - (1 + books.giantSlayer.vsBig.power / 100)) < 0.03, `${d0}->${d1}`); }
// NEW PAGES batch 2 (session 46, the 8 rares): numbers read from the data.
{ const { s, es, h } = withPage('shockInk', 0, ['knight']); s.castSkill(h[0].uid, 0);
  ok('Shock Ink: the enemy hit is Shocked', es.some((e) => s.has(e, 'shock'))); }
{ const { s, es, h } = withPage('sunder', 0, ['knight']); s.castSkill(h[0].uid, 0);
  const st = es.flatMap((e) => e.statuses).find((x) => x.type === 'armorBreak' && x.key.includes('book_sunder'));
  ok('Sunder: the enemy hit loses 20% defense', st && st.defensePercent === books.sunder.ink[0].defensePercent && st.defenseFlat === 0); }
{ const a = mk(['knight'], 0), b = withPage('detonate', 0, ['knight']);
  for (const m of [a, b]) for (const e of m.es) m.s.applyStatus(e, { status: 'poison', stacks: 4, durationMs: 9000, damageMultiplier: 0.01 }, m.h[0], 'x', []);
  const ev = b.s.castSkill(b.h[0].uid, 0); a.s.castSkill(a.h[0].uid, 0);
  const hitEnemy = b.es.find((e, i) => e.hp < a.es[i].hp);
  ok('Detonate: the stacks go off for bonus damage and are used up', hitEnemy && b.s.stacks(hitEnemy, 'poison') === 0 && ev.some((e) => e.type === 'proc' && /Detonate x4/.test(e.label))); }
{ const { s, es, h } = withPage('chainSpark', 0, ['knight']); s.placeLines(); const before = es.map((e) => e.hp); s.castSkill(h[0].uid, 0);
  ok('Chain Spark: 2 more enemies are hit', es.filter((e, i) => e.hp < before[i]).length === 1 + books.chainSpark.chainSpark.jumps); }
{ const { s, h } = withPage('guardian', 0); h[2].hp = 10000; s.castSkill(h[0].uid, 0);
  const sh = h[2].statuses.find((x) => x.type === 'shield');
  ok('Guardian: the most hurt ally gets a 10% shield', sh && Math.abs(sh.amount - h[2].maxHp * books.guardian.allyShield.percentMaxHp / 100) <= 1 && !h[1].statuses.some((x) => x.type === 'shield')); }
{ const { s, h } = withPage('warCry', 0); s.castSkill(h[0].uid, 0);
  ok('War Cry: the whole squad gets the attack buff', h.every((u) => u.statuses.some((x) => x.type === 'buff' && x.key.includes('book_warCry')))); }
{ const { s, h } = withPage('tempo', 0, ['knight']); h[0].skills[1].cooldownLeft = 5000; s.castSkill(h[0].uid, 0);
  ok('Tempo: the other skill comes back 1.5s sooner', h[0].skills[1].cooldownLeft === 5000 - books.tempo.otherCooldownMs); }
{ const a = mk(['samurai'], 0), b = withPage('glassCannon', 0, ['samurai']); a.s.refreshStats(); b.s.refreshStats(); const mh = b.h[0].maxHp;
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0));
  ok('Glass Cannon: +45% power', Math.abs(d1 / d0 - (1 + books.glassCannon.power / 100)) < 0.04, `${d0}->${d1}`);
  ok('...and 15% less max health', Math.abs(b.h[0].maxHp / mh - 0.85) < 0.01, `${mh}->${b.h[0].maxHp}`);
  for (let i = 0; i < 100; i++) b.s.update(50);
  ok('...still after 5s (lasts the whole fight)', b.h[0].maxHp < mh);
  b.s.spawnEnemies(['goblin'], 2);
  ok('...back to full max health on the next floor', Math.abs(b.h[0].maxHp - mh) <= 1, b.h[0].maxHp); }
// NEW PAGES batch 3 (session 46, the 5 legendaries): numbers read from the data.
{ const a = mk(['samurai'], 0), b = withPage('echo', 0, ['samurai']);
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), ev = b.s.castSkill(b.h[0].uid, 0), d1 = dmgOf(ev);
  ok('Echo: the skill fires again at 60%', ev.some((e) => e.type === 'proc' && e.label === 'Echo!') && Math.abs(d1 / d0 - (1 + books.echo.echo.power)) < 0.06, `${d0}->${d1}`); }
{ const { s, h } = withPage('timeWarp', 0, ['knight']); h[0].skills[1].cooldownLeft = 9000; s.castSkill(h[0].uid, 0);
  ok('Time Warp: the other skill is ready at once', h[0].skills[1].cooldownLeft === 0 && h[0].skills[0].cooldownLeft > 0); }
{ const { s, es, h } = withPage('executioner', 0, ['knight']); s.placeLines();
  for (const e of es) e.hp = Math.floor(e.maxHp * books.executioner.executioner.belowPercent / 100) + 5; // the hit takes it under 15%
  const t = s.pickTarget(h[0]); const ev = s.castSkill(h[0].uid, 0); const full = s.skillDefs[h[0].skills[0].id].cooldownMs;
  ok('Executioner: a normal enemy left under 15% dies', !t.alive && ev.some((e) => e.type === 'proc' && e.label === 'Executed!'));
  ok('...and the kill gives 30% of the cooldown back', Math.abs(h[0].skills[0].cooldownLeft - full * (1 - books.executioner.executioner.cooldownBackPercent / 100)) < 1); }
{ const { s, es, h } = withPage('executioner', 0, ['knight']); s.placeLines();
  for (const e of es) { e.hp = Math.floor(e.maxHp * books.executioner.executioner.belowPercent / 100) + 5; e.elite = { traits: [] }; }
  const t = s.pickTarget(h[0]); s.castSkill(h[0].uid, 0);
  ok('...but never an elite or boss', t.alive); }
{ const { s, es, h } = withPage('phoenixPage', 0, ['knight']); s.placeLines(); const k = h[0]; k.deathSaveUsed = true; // the game's own one-time death save would soften the hit first
  let ev = []; s.dealDamage(k, k.hp + 10, ev);
  ok('Phoenix Page: a deadly hit leaves the caster at 20% health', k.alive && Math.abs(k.hp - k.maxHp * books.phoenixPage.phoenix.hpPercent / 100) <= 1, k.hp);
  ok('...and fires the skill for free', ev.some((e) => e.type === 'cast' && e.unit === k) && k.skills[0].cooldownLeft === 0);
  ev = []; s.dealDamage(k, k.hp + 10, ev);
  ok('...only once per floor', !k.alive || k.hp <= 0); }
{ const { s, h } = withPage('phoenixPage', 0, ['knight']); h[0].deathSaveUsed = true; s.dealDamage(h[0], h[0].hp + 10, []); s.spawnEnemies(['goblin'], 2); s.dealDamage(h[0], h[0].hp + 10, []);
  ok('...and works again on the next floor', h[0].hp > 0); }
{ const a = mk(['samurai'], 0), b = withPage('elementalStorm', 0, ['samurai']);
  for (const m of [a, b]) for (const e of m.es) e.weak = ['ice'];
  a.s.castSkill(a.h[0].uid, 0); const ev = b.s.castSkill(b.h[0].uid, 0);
  ok('Elemental Storm: the hit becomes the element the enemy is weak to', ev.some((e) => e.type === 'attack' && e.skill && e.damageType === 'ice')); }
// NEW PAGES batch 4 (session 46, the 10 HERO pages): only their hero's named skill, then one test per patch.
{ const data = r('skillBooks.json'); const { s, h } = mk(['knight', 'rogue', 'archer']);
  ok('a hero page fits its own hero\'s named skill', pageFit(h[0], 0, pageOf(data, 'shockwave')) === 'ok' && s.addPage(h[0].uid, 0, page('shockwave')).ok);
  ok('...not the same hero\'s other skill', pageFit(h[0], 1, pageOf(data, 'shockwave')) === 'wrongSkill' && s.addPage(h[0].uid, 1, page('shockwave')).reason === 'wrongSkill');
  ok('...and not another hero', pageFit(h[1], 0, pageOf(data, 'shockwave')) === 'wrongSkill' && s.addPage(h[1].uid, 0, page('shockwave')).reason === 'wrongSkill');
  const heroPages = Object.entries(books).filter(([, p]) => p.tier === 'hero');
  ok('every hero page names a hero and that hero\'s real skill', heroPages.length === 10 && heroPages.every(([, p]) => Object.values(heroes.find((x) => x.id === p.hero).skills).includes(p.skill)));
  ok('...one page per hero', new Set(heroPages.map(([, p]) => p.hero)).size === heroes.length); }
const heroWith = (id) => withPage(id, 0, [books[id].hero]);
{ const { s, es, h } = heroWith('shockwave'); s.placeLines(); s.castSkill(h[0].uid, 0);
  ok('Shockwave: Defense Bash stuns the target and its neighbours', es.filter((e) => s.has(e, 'stun')).length >= 2, es.filter((e) => s.has(e, 'stun')).length); }
{ const { s, es, h } = heroWith('earthshaker'); s.placeLines(); for (const e of es) { e.x = es[0].x + 10; e.y = es[0].y; } s.castSkill(h[0].uid, 0);
  ok('Earthshaker: Savage Leap stuns everyone it hits', es.every((e) => e.statuses.some((x) => x.type === 'stun' && x.total === books.earthshaker.patch.landApply[0].durationMs))); }
{ const a = mk(['rogue'], 0), b = heroWith('flurry'); let na = 0, nb = 0;
  a.s.castSkill(a.h[0].uid, 0); b.s.castSkill(b.h[0].uid, 0);
  for (let t = 0; t < 2000; t += 20) { na += a.s.update(20).filter((e) => e.type === 'wave').length; nb += b.s.update(20).filter((e) => e.type === 'wave').length; }
  ok('Flurry: Multistrike strikes 2 more times', nb === na + books.flurry.patch.addWaves, `${na} -> ${nb}`); }
{ const a = mk(['archer'], 0), b = heroWith('downpour'); let na = 0, nb = 0;
  a.s.castSkill(a.h[0].uid, 0); b.s.castSkill(b.h[0].uid, 0);
  for (let t = 0; t < 4000; t += 20) { na += a.s.update(20).filter((e) => e.type === 'wave').length; nb += b.s.update(20).filter((e) => e.type === 'wave').length; }
  ok('Downpour: Arrow Rain falls 2 more waves', nb === na + books.downpour.patch.addWaves, `${na} -> ${nb}`); }
{ const { s, es, h } = heroWith('twinCrescent'); s.placeLines(); const hh = s.skillDefs.wind_cutter3.area.halfHeight;
  s.focusUid = es[0].uid; es[1].x = es[0].x; es[1].y = es[0].y - hh * 2; es[2].y = es[0].y - hh * 6; // es[1] one row behind, es[2] far away
  const before = es.map((e) => e.hp); s.castSkill(h[0].uid, 0);
  ok('Twin Crescent: Wind Cutter also slashes the row behind (not further)', es[0].hp < before[0] && es[1].hp < before[1] && es[2].hp === before[2]); }
{ const { s, h } = heroWith('convergence'); let ev = [];
  for (let i = 0; i < 3; i++) { h[0].skills[0].cooldownLeft = 0; ev = s.castSkill(h[0].uid, 0); for (let t = 0; t < 1000; t += 20) ev = ev.concat(s.update(20)); }
  const casts = ev.filter((e) => e.type === 'cast').map((e) => e.skill.name);
  ok('Convergence: the 3rd cast fires all three spells', ev.some((e) => e.type === 'proc' && e.label === 'Convergence!') && new Set(casts).size === 3, casts.join(', ')); }
{ const m = mk(['cleric', 'knight', 'rogue'], 0); m.s.refreshStats(); m.s.addPage(m.h[0].uid, 0, page('radiance'));
  const n = mk(['cleric', 'knight', 'rogue'], 0); n.s.refreshStats();
  for (const x of [m, n]) { x.h[1].hp = Math.round(x.h[1].maxHp * 0.2); x.h[2].hp = Math.round(x.h[2].maxHp * 0.3); }
  const b1 = m.h[1].hp, b2 = m.h[2].hp; m.s.castSkill(m.h[0].uid, 0); n.s.castSkill(n.h[0].uid, 0);
  ok('Radiance: Holy Nova heals the 2 most hurt allies (without it: only 1)', m.h[1].hp > b1 && m.h[2].hp > b2 && n.h[2].hp === b2, `${b1}->${m.h[1].hp} ${b2}->${m.h[2].hp}`); }
{ const { s, es, h } = heroWith('boneHarvest'); for (const e of es) e.hp = 1; s.castSkill(h[0].uid, 0);
  ok('Bone Harvest: a Death Coil kill raises 2 skeletons', s.minions.filter((x) => x.holderUid === h[0].uid).length === books.boneHarvest.patch.raiseCount); }
{ const a = mk(['bard'], 0), b = heroWith('heavyChains'); a.s.castSkill(a.h[0].uid, 0); b.s.castSkill(b.h[0].uid, 0); // the Warden's Chain Hook
  const ca = a.es.flatMap((e) => e.statuses).find((x) => x.type === 'stun'), cb = b.es.flatMap((e) => e.statuses).find((x) => x.type === 'stun');
  ok('Heavy Chains: Chain Hook stuns 1s longer', ca && cb && Math.abs(cb.total - ca.total - books.heavyChains.patch.applyDurationAdd.stun) < 1, `${ca && ca.total} -> ${cb && cb.total}`); }
{ const { s, h } = heroWith('bigBatch'); let n = 0; n += s.castSkill(h[0].uid, 0).filter((e) => e.type === 'flask').length;
  for (let t = 0; t < 4000; t += 20) n += s.update(20).filter((e) => e.type === 'flask').length;
  ok('Big Batch: Flask Barrage throws 7 flasks', n === books.bigBatch.patch.randomCount, n); }
{ const a = withPage('elementalStorm', 0, ['samurai']), b = withPage('elementalStorm', 0, ['samurai']); for (const e of b.es) e.weak = ['ice'];
  const d0 = dmgOf(a.s.castSkill(a.h[0].uid, 0)), d1 = dmgOf(b.s.castSkill(b.h[0].uid, 0)), rules0 = r('combat.json');
  ok('Elemental Storm: a found weakness hits harder (weak multiplier x weakBonus)', Math.abs(d1 / d0 - rules0.weakMultiplier * (1 + books.elementalStorm.elementalStorm.weakBonus / 100)) < 0.08, `${d0}->${d1}`); }
{ const { s, es, h } = withPage('executioner', 0, ['knight']); s.placeLines(); s.refreshStats(); const hp0 = (h[0].hp = Math.round(h[0].maxHp / 2));
  for (const e of es) { e.hp = Math.floor(e.maxHp * books.executioner.executioner.belowPercent / 100) + 5; e.stats.defense = 0; }
  const ev = s.castSkill(h[0].uid, 0);
  ok('Executioner: an execute heals the caster', ev.some((e) => e.type === 'proc' && e.label === 'Executed!') && h[0].hp >= hp0 + Math.floor(h[0].maxHp * books.executioner.executioner.healPercent / 100) - 1, `${hp0} -> ${h[0].hp}`); }
const s0has = (e) => e.statuses.some((x) => x.type === 'weaken');
{ const a = withPage('elementalStorm', 0, ['samurai']), b = withPage('elementalStorm', 0, ['samurai']); for (const e of b.es) e.weak = ['ice'];
  a.s.castSkill(a.h[0].uid, 0); b.s.castSkill(b.h[0].uid, 0);
  ok('Elemental Storm: an enemy hit with its weakness is Weakened (and only then)', b.es.some((e) => e.statuses.some((x) => x.type === 'weaken' && x.attackPercent === books.elementalStorm.elementalStorm.weakApply[0].attackPercent)) && !a.es.some((e) => s0has(e))); }
// THE BOSS PRIZE GROWS (session 46): the golden book of the Nth boss uses specialsByBoss.golden[N-1] (the last for later).
import { bossNumber } from '../../src/systems/books.js';
{ const real = r('skillBooks.json'), table = real.specialsByBoss.golden, dung = r('dungeons.json').A;
  const bossFloors = Object.keys(dung.bosses).map(Number).sort((a, b) => a - b);
  ok('bossNumber: 1 for the first boss floor, 2 for the second, 0 for a normal floor', bossNumber(dung, bossFloors[0]) === 1 && bossNumber(dung, bossFloors[1]) === 2 && bossNumber(dung, bossFloors[0] + 1) === 0);
  let x = 11; const rng = () => { x |= 0; x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const squad = ['knight', 'mage', 'cleric'], N = 4000;
  const rate = (bossNo) => { let L = 0, H = 0; for (let i = 0; i < N; i++) { const ps = rollBookPages(real, 'golden', rng, squad, { bossNo }); if (ps.some((p) => p.tier === 'legendary')) L++; if (ps.some((p) => p.tier === 'hero')) H++; } return { L: L / N, H: H / N }; };
  const rates = [1, 2, 3, 4, 7].map(rate);
  ok('1st boss: no legendary, no hero page', rates[0].L === table[0].legendary && rates[0].H === table[0].hero);
  ok('2nd boss: a legendary for sure', rates[1].L === 1 && Math.abs(rates[1].H - table[1].hero) < 0.015, JSON.stringify(rates[1]));
  ok('...3rd and 4th: hero page chance grows', Math.abs(rates[2].H - table[2].hero) < 0.02 && Math.abs(rates[3].H - table[3].hero) < 0.02, `${rates[2].H} ${rates[3].H}`);
  ok('...later bosses keep the last entry', Math.abs(rates[4].H - table[table.length - 1].hero) < 0.02 && rates[4].L === 1);
  ok('a golden book without bossNo still uses specials.golden', Math.abs(rate(undefined).L - real.specials.golden.legendary) < 0.02); }
