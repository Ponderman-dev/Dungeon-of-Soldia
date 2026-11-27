// Skill books (no Phaser): which pages a book offers and where a page may go. Rules for using a page on a
// skill live in BattleState (addPage / pageTotals). Data: src/data/skillBooks.json, limits in combat.json `books`.

// A page def with its id (what BattleState.addPage takes).
export const pageOf = (data, id) => ({ id, ...data.pages[id] });

// The pages a book shows: `contents[book]` says how many stat and modifier pages (blue: 2 stat + 1 modifier,
// golden: 3 modifiers, dealer: 1 + 3). No page twice in one book. Each modifier page rolls its TIER from
// `tierOdds[book]`; then `specials[book]` may upgrade one modifier page to a legendary and (rolled separately) another
// to a hero-only page. Hero pages only for `heroIds` (the living squad). An empty tier falls back to the next lower one.
const TIER_ORDER = ['common', 'rare', 'legendary', 'hero'];
// opts.bossNo: the golden book of the Nth boss (1 = the first) uses `specialsByBoss[book][N-1]` (the last entry for later
// bosses) instead of `specials[book]` (user, session 46: the boss prize grows with every boss).
export function rollBookPages(data, book, rng = Math.random, heroIds = null, opts = {}) {
  const want = data.contents[book];
  const out = [];
  const taken = new Set();
  const poolOf = (kind, tier) => Object.keys(data.pages).filter((id) => {
    const p = data.pages[id];
    if (p.kind !== kind || taken.has(id)) return false;
    if (tier && (p.tier || 'common') !== tier) return false;
    return !p.hero || !heroIds || heroIds.includes(p.hero);
  });
  const take = (kind, tier) => {
    // the wanted tier, else the next lower one with pages left, else any page of that kind
    let pool = [];
    for (let t = tier ? TIER_ORDER.indexOf(tier) : -1; t >= 0 && !pool.length; t--) pool = poolOf(kind, TIER_ORDER[t]);
    if (!pool.length) pool = poolOf(kind, null).filter((id) => !data.pages[id].hero || (heroIds && heroIds.includes(data.pages[id].hero)));
    if (!pool.length) return null;
    const id = pool[Math.floor(rng() * pool.length)];
    taken.add(id);
    return pageOf(data, id);
  };
  const odds = (data.tierOdds || {})[book];
  const rollTier = () => {
    if (!odds) return null;
    const total = Object.values(odds).reduce((a, b) => a + b, 0);
    let x = rng() * total;
    for (const [tier, w] of Object.entries(odds)) if ((x -= w) < 0) return tier;
    return null;
  };
  for (let i = 0; i < (want.stat || 0); i++) { const p = take('stat', null); if (p) out.push(p); }
  const tiers = Array.from({ length: want.modifier || 0 }, rollTier);
  const byBoss = opts.bossNo && (data.specialsByBoss || {})[book];
  const specials = byBoss ? byBoss[Math.min(opts.bossNo, byBoss.length) - 1] : (data.specials || {})[book] || {};
  let slot = tiers.length - 1; // specials replace the LAST modifier pages (the order is shuffled below)
  for (const tier of ['hero', 'legendary']) if (slot >= 0 && specials[tier] && rng() < specials[tier]) tiers[slot--] = tier;
  // a hero page needs a hero in the squad who has one: else that page stays a normal roll
  for (const tier of tiers) { const p = take('modifier', tier === 'hero' && !poolOf('modifier', 'hero').length ? 'rare' : tier); if (p) out.push(p); }
  const mods = out.filter((p) => p.kind === 'modifier');
  for (let i = mods.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [mods[i], mods[j]] = [mods[j], mods[i]]; }
  return [...out.filter((p) => p.kind === 'stat'), ...mods];
}

// A hero-only page (`hero`, `skill`) fits only that hero's named skill; a page with `onlyKind` ('attack' / 'support')
// fits only that kind of skill (element pages: attack skills, Mend: support skills).
export const heroPageFits = (hero, index, page) => {
  const slot = hero.skills && hero.skills[index];
  if (page.onlyKind && (!slot || slot.kind !== page.onlyKind)) return false;
  return !page.hero || (hero.def && hero.def.id === page.hero && (!page.skill || (slot && slot.id === page.skill)));
};

// GROUPS (user, session 56: 'Inks are unstackable'): a skill holds at most ONE page of each `group` ('ink', 'element').
// The page of the same group already on the skill (or undefined).
export const groupMate = (pages, page) => (page.group ? (pages || []).find((p) => p.kind === 'modifier' && p.group === page.group && p.id !== page.id) : undefined);

// Can `page` go on skill `index` of `hero`? 'ok', 'replace' (a modifier on a full skill: the player picks which
// one it replaces), 'swap' (it takes the place of the page of its `group` on that skill), 'full' (no more stat pages), 'duplicate' (the skill has this modifier), 'wrongSkill' (a hero page
// on another hero or skill) or 'dead'.
export function pageFit(hero, index, page, limits = {}) {
  if (!hero.alive) return 'dead';
  if (!heroPageFits(hero, index, page)) return 'wrongSkill';
  const pages = (hero.skills[index] && hero.skills[index].pages) || [];
  if (page.kind === 'stat') return pages.filter((p) => p.kind === 'stat').length >= (limits.maxStatPages ?? Infinity) ? 'full' : 'ok';
  const mods = pages.filter((p) => p.kind === 'modifier');
  if (mods.some((p) => p.id === page.id)) return 'duplicate';
  if (groupMate(pages, page)) return 'swap'; // takes the place of its group mate (one Ink / one element per skill)
  return mods.length >= (limits.modifierSlots ?? Infinity) ? 'replace' : 'ok'; // null = no limit
}

// The reward screen: with chance `chance` one of the item cards becomes a skill book card (only while a living
// hero could still use a page). Returns the (possibly changed) list.
export function maybeAddBook(choices, data, heroes, chance, rng = Math.random) {
  if (!choices.length || !heroes.some((h) => h.alive) || rng() >= chance) return choices;
  const out = [...choices];
  const items = out.map((c, i) => i).filter((i) => out[i].kind !== 'potion'); // never on the potion's spot
  if (!items.length) return choices;
  out[items[Math.floor(rng() * items.length)]] = data.cards.blue;
  return out;
}

// Which boss this is: 1 for the dungeon's first boss floor, 2 for the second... (0 = not a boss floor).
export function bossNumber(dungeon, floor) {
  const floors = Object.keys((dungeon && dungeon.bosses) || {}).map(Number).sort((a, b) => a - b);
  return floors.includes(floor) ? floors.indexOf(floor) + 1 : 0;
}
