// Skill books (no Phaser): which pages a book offers and where a page may go. Rules for using a page on a
// skill live in BattleState (addPage / pageTotals). Data: src/data/skillBooks.json, limits in combat.json `books`.

// A page def with its id (what BattleState.addPage takes).
export const pageOf = (data, id) => ({ id, ...data.pages[id] });

// The 3 pages a book shows: `contents[book]` says how many stat and modifier pages (blue: 2 stat + 1 modifier,
// golden: 3 modifiers). No page twice in one book.
export function rollBookPages(data, book, rng = Math.random) {
  const want = data.contents[book];
  const out = [];
  for (const kind of ['stat', 'modifier']) {
    const pool = Object.keys(data.pages).filter((id) => data.pages[id].kind === kind);
    for (let i = 0; i < (want[kind] || 0) && pool.length; i++) out.push(pageOf(data, pool.splice(Math.floor(rng() * pool.length), 1)[0]));
  }
  return out;
}

// Can `page` go on skill `index` of `hero`? 'ok', 'replace' (a modifier on a full skill: the player picks which
// one it replaces), 'full' (no more stat pages), 'duplicate' (the skill has this modifier) or 'dead'.
export function pageFit(hero, index, page, limits = {}) {
  if (!hero.alive) return 'dead';
  const pages = (hero.skills[index] && hero.skills[index].pages) || [];
  if (page.kind === 'stat') return pages.filter((p) => p.kind === 'stat').length >= (limits.maxStatPages ?? Infinity) ? 'full' : 'ok';
  const mods = pages.filter((p) => p.kind === 'modifier');
  if (mods.some((p) => p.id === page.id)) return 'duplicate';
  return mods.length >= (limits.modifierSlots ?? Infinity) ? 'replace' : 'ok'; // null = no limit
}

// The reward screen: with chance `chance` one of the item cards becomes a skill book card (only while a living
// hero could still use a page). Returns the (possibly changed) list.
export function maybeAddBook(choices, data, heroes, chance, rng = Math.random) {
  if (!choices.length || !heroes.some((h) => h.alive) || rng() >= chance) return choices;
  const out = [...choices];
  out[Math.floor(rng() * out.length)] = data.cards.blue;
  return out;
}
