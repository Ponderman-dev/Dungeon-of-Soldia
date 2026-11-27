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
- **NEW PAGES BATCH 3, the 5 LEGENDARIES (BUILT, session 46):** Echo (`echo {power}`: releaseSkill always echoes once,
  like Echo Rune; not channels / one-by-one flasks), Time Warp (`resetOther`: the other skills' cooldowns to 0, in
  bookCast), Executioner (`executioner`: in bookOnHit a non-elite non-boss under belowPercent takes a `fixedAmount`
  strike of its health + shields; the cast's first kill gives back cooldownBackPercent; channels refund per wave),
  Phoenix Page (`phoenix {hpPercent}`: `phoenixPage()` called from dealDamage after the Phoenix Feather; once per floor
  via `hero.floor.phoenixPage`, health to 20%, the skill is released for free, castPages saved around it; the game's own
  deathSave comes first), Elemental Storm (`elementalStorm {elements}`: bookHitMods returns a damageType picker, combat.js
  exports `weakResistMultiplier`; own type kept on a tie). Smart curve median 40 (unchanged).
- **NEW PAGES BATCH 4, the 10 HERO PAGES (BUILT, session 46):** each has `hero` + `skill` (that hero's named skill)
  and a `patch`. `books.js heroPageFits()`: pageFit returns 'wrongSkill' / addPage refuses (reason 'wrongSkill') on any
  other hero or skill; the reward screen says 'Not this skill'. `heroPagePatch(skill, mods)` (skillBooks.js) changes the
  skill in releaseSkill (before power scaling): Shockwave (Knight, `neighbourApply`: Defense Bash's stun on the
  target's neighbours), Earthshaker (Berserker, `landApply`: stun 0.8s on the leap target + landSplash), Flurry (Rogue,
  `addWaves` 2), Downpour (Archer, `addWaves` 2), Twin Crescent (Samurai, `secondBand {offset}`: `secondBandHit` slashes
  the band 2 half-heights behind, a 'wave' event flashes it), Convergence (Mage, `convergeEvery` 3: `slot.converge`
  counter, the other rotation spells fire as echoes at full power), Radiance (Cleric, `extraHeals` 1 in holyNova),
  Bone Harvest (Necromancer, `raiseCount` 2 = onKill.count), Mass Charm (Bard, `applyDurationAdd {charm: 1000}`),
  Big Batch (Alchemist, `randomCount` 7). Smart curve median 40. ALL 31 PAGES FROM SESSION 45's LIST ARE BUILT.
- **PAGE TUNING ROUND 1 (session 46, `pageruns.mjs 16`, user: 'go with your suggestions'):** the first ranking showed
  survival pages winning (Titan +10.8, Blood Price +7.0, Siphon +6.4 floors) and almost every damage page at ~0
  (skills are a small share of squad damage). Changes: Siphon 15% -> 8% (support 5 -> 3), Blood Price ally heal 12 -> 8;
  Cyclone 4s / 0.4 -> 6s / 1.0, cooldown +30% -> +15%; Executioner under 15% -> 25%, cooldown back 30 -> 50; Elemental
  Storm +30% when it finds a weakness (`weakBonus`); Sharpen 8 -> 12, Heavy 12/-6 -> 20/-8, Keen 10 -> 20, Piercing
  15 -> 30, Finisher 20 -> 40, Giant Slayer 15 -> 30, Detonate 0.15 -> 0.3 per stack, Glass Cannon 45 -> 60,
  Overcharge 40 -> 60, Reckless 35 -> 45, Desperate 50 -> 75; Flurry +4 hits, Big Batch 9 flasks, Bone Harvest 3
  skeletons, Earthshaker stun 1.5s. Smart curve median 40 (unchanged).
  Round 1b (user: 'do point 2'): Executioner also heals the caster 5% max health per execute (`healPercent`);
  Elemental Storm Weakens an enemy hit with its weakness (`weakApply`: weaken -15% attack 3s). pageruns 24: Executioner
  +1.1, Elemental Storm -0.3 (still ~0: Executioner skips bosses, where runs end; Storm needs a weakness).
  After round 1 (pageruns 24): Cyclone +4.8, Blood Price +3.2, Siphon +2.3, Big Batch +1.7; damage pages still ~0:
  skills deal only 15-40% of a hero's damage on floors 11-45 (`dmgshare.mjs`), so +20% skill power = +3-8% total.
- **DEALER + BOSS PRIZE REWORK (session 46, user picked 'what it offers' / 'what it gives'):** the Skill Dealer shows
  3 pages (contents.dealer 1 stat + 2 modifier, was 2 + 3; user: 'fewer picks, so good choices are harder to get').
  THE BOSS PRIZE GROWS: `specialsByBoss.golden` = one entry per boss (the last one repeats): 1st boss rares only, 2nd a
  legendary for sure + 5% hero page, 3rd legendary + 15% hero, 4th+ legendary + 25% hero. The golden book card
  carries `bossNo` (results.js `bossNumber(dungeon, floor)` from books.js); `rollBookPages(..., { bossNo })`; without
  bossNo the old `specials.golden` is used (older bots: review, rankitems, pageruns). smartbot passes bossNo.
  Smart curve median 39 (was 40, noise). Tests: skill-books.test.mjs last block, rooms.test.mjs dealer count.
- **WARDEN HERO PAGES (the Warden replaced the Bard; Mass Charm -> Heavy Chains):** Heavy Chains (Chain Hook stun +1s,
  `applyDurationAdd`), Long Reach (Chain Hook `pullCount` 2: the next farthest enemy is hooked too, pulled 30px further
  back; `releaseSkill`), Iron Circle (Lockdown `areaRadiusPercent` 50: `area.radius` x1.5; the look's ring reads the
  cast's real zone), Cold Iron (Chain Hook `addApply` 3 Chill 4s: a generic patch, adds statuses to every hit). He is
  the only hero with 4 hero pages. Tests: skill-books.test.mjs (last block).
- **SESSION 56: ELEMENT RUNES, MEND, ONE INK PER SKILL, TUNING ROUND 2 (user: 'go with your suggestions, include holy'):**
  GROUPS: a page with `group` ('ink' = the 6 '... Ink' pages; 'element' = the 5 runes + Elemental Storm) is one per skill:
  `books.js groupMate()`, pageFit returns 'swap' and addPage puts the new page in the old one's place (reward screen note
  'Swaps <name>', no 'Replace which page?' step). Sunder is NOT an ink. `onlyKind` ('attack' / 'support'): heroPageFits
  refuses other skills ('wrongSkill'). ELEMENT RUNES (rare, attack only): Fire / Ice / Storm (electric) / Shadow (dark) /
  Holy Rune, `element` (bookHitMods turns every skill hit into it) + power 75. MEND (common, support only): `allyHeal`
  1 hero 15% with `includeSelf`, cooldown +25%; GREATER MEND (rare): 2 heroes 20%, cooldown +40% (without the cooldown
  cost they ranked +8.6 / +10.5, Titan level). Tuning (pageruns 16, before -> after): Guardian 10 -> 5% (+6.3 -> +3.8),
  Frost Ink 5s -> 3s (+4.2 -> +2.3), Quick Draw 50 -> 35 (+4.2 -> +1.8); buffs: Detonate 0.3 -> 0.5, Sunder -30% 6s,
  Glass Cannon -10% health, Bone Harvest 4, Big Batch 11, Concussive 30%, Elemental Storm `baseBonus` 25 (always),
  Steady 25, Sharpen 15, Heavy 30, Overcharge 80, Piercing 40. Runes ranked +1.2 (Shadow) to +3.7 (Holy). Still weak
  after this round: Big Batch, Bone Harvest, Convergence, Cold Iron (Warden), Giant Slayer. pageruns now puts a
  support-only page (and a support hero page like Iron Circle) on the SUPPORT skill. Smart curve median 39 (unchanged).
- **SESSION 59 (user):** MEND now heals the CASTER 15% (`selfHealPercent`, no ally heal; still -25% cooldown, support only);
  GREATER MEND cooldown cost 40% -> 25%. pageruns 12 (attack skill of all 3, support pages on support): before
  Blood Price +6.1, Mend +4.3, Greater Mend +3.4, Second Wind +1.4; after Greater Mend +7.6, Blood Price +5.8,
  Second Wind +1.1, Mend +0.9 (a self-heal on a support caster rarely matters: Mend is weak now).
  Then (user: options 1 + 2): MEND has NO cooldown cost and works on ANY skill (attack too): pageruns 12 Mend +6.2,
  Greater Mend +7.7, Second Wind +1.1 (Second Wind = a smaller Mend now: open question for the user).
  SECOND WIND PAGE REMOVED (user, session 59: 'ditch it'; it was a smaller Mend). Page + icon deleted; the Second Wind FLASK item is a different thing and stays.
