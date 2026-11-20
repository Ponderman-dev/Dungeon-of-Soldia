# Skill books

Pages that upgrade skills.
Moved out of CLAUDE.md (2026-10-17). Keep this file up to date when the system changes.

- **SKILL BOOKS (BUILT, steps 1-5; proposal v3 https://claude.ai/artifact/C7SHzkoUvkxRdV2ryMV8L2):** data `src/data/skillBooks.json` (pages, `cards` blue/golden, `contents`, `bookChancePerScreen`), limits combat.json `books`; rules in BattleState (`addPage`, `pageTotals`, `scaleSkill`, `bookCast`, `bookOnHit`, `bookAfterCast`, `tickBookTimers`; pages live on `hero.skills[i].pages`); `src/systems/books.js` (`rollBookPages`, `pageFit`, `maybeAddBook`); RewardScene book steps (pages > 'Which skill?' > 'Replace which page?'), `BattleScene.openRewardSheet()` (a boss floor opens a second sheet with the golden book, banner 'BOSS DEFEATED'), `applyPage()`, `drawPageMarks()` (white dots = stat pages along the bottom of the skill square, purple diamonds = modifiers in its top corners), `showBookEvent()` (Titan grows the hero, Roar, Ricochet/Aftershock rings). Icons `skill_book` / `golden_book` in itemIcons.json. Tests `skill-books.test.mjs`. The design: a new reward card. Pick the book, pick the hero, then pick 1 of 3 pages and the skill it goes on. STAT pages (small, max 3 per skill, any mix): Sharpen +8% skill power, Swift -8% cooldown, Steady Hands -15% wind-up, Lasting +15% duration of what the skill gives. MODIFIER pages (any hero, any skill, ALL 18 kept): Inks (Poison/Bleed/Burn/Chill x2 stacks on every enemy hit), Hunter's Ink (Mark 4s), Blood Price (heal 2 most hurt allies 12%, costs the caster 6% health, never kills), Siphon (15% of skill damage heals the caster), Cyclone (weak Excalibur tornado 4s, +30% cooldown), Ricochet (+1 target at 50%), Aftershock (second pulse 35% after 1s), Titan (caster 30% bigger 3s: +20% max health and damage, -10 evasion), Bulwark (shield 8% max health 4s), Purify (cleanse 1), Roar (taunt nearby 2s + 10 defense), Gravecall (1 weak skeleton, max 2 per hero), Rally (squad +10% attack speed 3s), Concussive (20% stun 0.6s per hit, +15% cooldown), Overcharge (+40% power, 2x wind-up), Reckless (+35% damage, caster takes +15% for 4s), Desperate (+50% power under 40% health), Hasty (-25% cooldown, -20% power); a support skill uses the 'support' variant where the page says so. 2 MODIFIER SLOTS per skill (a third replaces one the player picks). RARITY (user: rarer): a book replaces a reward card on about 1 in 15 reward screens (blue book: mostly stat pages + 1 modifier); after EVERY BOSS a free GOLDEN book (3 modifier pages) on top of the normal reward. Dead heroes can't read; their pages stop working. Shown as small marks under the skill square.
- **PAGE TIERS (BUILT, session 45; user: 'hero-only pages very rare, legendary too: OP pages after every boss =
  snowballing'):** every modifier page has `tier` (skillBooks.json): COMMON = the 4 Inks, Siphon, Bulwark, Purify, Rally,
  Hasty; RARE = Hunter's Ink, Blood Price, Ricochet, Aftershock, Roar, Gravecall, Concussive, Overcharge, Reckless,
  Desperate; LEGENDARY = Cyclone, Titan; HERO = hero-only pages (`hero`: that hero's id; none yet). Stat pages have no
  tier. `tierOdds[book]`: blue + dealer modifier pages 80% common / 20% rare, golden 100% rare. `specials.golden`:
  20% of golden books upgrade one page to a LEGENDARY, 5% (rolled separately, both can happen) one page to a HERO page
  for a hero alive in the squad (no such hero = a normal page). Legendary / hero pages ONLY from the golden book. An
  empty tier falls back to the next lower one. Rules: `books.js rollBookPages(data, book, rng, heroIds)`; RewardScene
  `squadIds()`, page cards wear their tier's frame (`rarities.json`; hero = `heroFrame` crimson + shine; stat pages
  common), label 'RARE - DEBUFF' / 'HERO PAGE - KNIGHT ONLY'. Smart curve: median 40 (unchanged). Tests:
  `skill-books.test.mjs` (last block, made-up pages, odds read from the data).
- **PAGE ICONS (BUILT, session 45; user picked 'F' out of 6 mock-ups: A book + cover symbol, B loose page, C open book,
  D rune seal, E scroll, F coloured spell tome):** every page is its own 16x16 SPELL TOME: book and spine in the
  page's own colour (cover = darker shade), a 7x7 symbol on the cover (NO clasp gem: removed session 46, user 'the lock feels weird'), inside the
  tier's frame. Data `src/data/pageIcons.json` (`color`, `light`, `symbol`; `_default` for a page without one), builder
  `src/systems/pageIcon.js pageIconArt()`, texture `skillIconTexture.js bookPageIconKey(scene, page, R)`. Replaces the
  old recoloured book (`pageColors`, removed). A NEW PAGE NEEDS AN ENTRY in pageIcons.json (test: every page has one,
  no two look the same). First-draft symbols, not yet tuned by the user (Razor Ink's slashes read weakest).
- **NEW PAGES BATCH 1, the 8 COMMONS (BUILT, session 46):** Keen (`critBonus`), Heavy (power +12, cooldown -6: no new
  code), Quick Draw (`fightStartCharge` 50: at `startFloor` the cooldown left drops by half the full cooldown;
  `bookFightStart`), Piercing (`armorPierce` 15: combat.js `armourCut` ignores that % of defense / resist above 0),
  Second Wind (`selfHealPercent`, in `bookCast`), Momentum (`momentum {attacks, damagePercent}`: `hero.momentum`, spent
  in `landAttack` via `spendMomentum`; 'Momentum!' proc), Finisher (`vsLow`), Giant Slayer (`vsBig`: elite or boss).
  Per-hit bonuses: `bookHitMods(hero, target)` in skillHit (only during the hero's own cast, `castPages`). Icons in
  pageIcons.json (first drafts). Smart curve median 40 (unchanged).
- **NEW PAGES BATCH 2, the 8 RARES (BUILT, session 46):** Shock Ink and Sunder (plain `ink` specs; Sunder = armorBreak
  `defensePercent` -20), Detonate (`detonate`: in `bookOnHit` the target's poison / bleed / burn stacks are removed and
  one `strike` of perStack x attack per stack hits, proc 'Detonate xN!'), Chain Spark (`chainSpark`: in `bookAfterCast`
  jumps to the nearest unhit enemies, electric, lightning look via `chain: true`), Guardian (`allyShield` on the most hurt
  living hero, caster included), War Cry (squadApply attack +12%), Tempo (`otherCooldownMs` off the caster's other
  skills), Glass Cannon (power +45, selfApply health -15% with `untilFightEnd`: statuses.js marks it `fightOnly`,
  `spawnEnemies` drops those and refreshes stats). NOTE: power pages do not grow Defense Bash's defense part (old
  behaviour). Smart curve median 40 (unchanged).
- **NEXT: the other 15 NEW PAGES (user picked, session 45; build in batches, numbers in JSON, a test per mechanic):**
  LEGENDARY (5): Echo (fires again at 60%); Time Warp (resets the other skill); Executioner (kills normal enemies under
  15%, kill = 30% cooldown back); Phoenix Page (once per floor a deadly hit fires this skill for free, caster left at
  20%); Elemental Storm (damage = the element the target is weakest to).
  HERO (10, one per hero): Shockwave (Knight: Defense Bash stun also hits enemies next to the target), Earthshaker
  (Berserker: Savage Leap stuns everyone around 0.8s), Flurry (Rogue: Multistrike +2 hits), Downpour (Archer: Arrow Rain
  +2 waves), Twin Crescent (Samurai: Wind Cutter also slashes the row behind), Convergence (Mage: every 3rd Elemental
  Rotation casts all three spells), Radiance (Cleric: Holy Nova heals the 2 most hurt), Bone Harvest (Necromancer: a
  Death Coil kill raises 2 skeletons), Mass Charm (Bard: Discord charms 1s longer), Big Batch (Alchemist: Flask
  Barrage throws 7 flasks).
