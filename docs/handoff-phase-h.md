# Handoff: phase H (tuning), items finished, heroes next

Read `CLAUDE.md` first, then this file. Every item decision of this phase is in `docs/item-decisions.md`
(it overrides older item numbers in CLAUDE.md and docs/item-list.md).

## Branch and git (important)
- Work branch: `claude/phase-h-tuning` (everything committed and pushed). CLAUDE.md's "Git workflow" line still names the
  old scaffold branch: ignore it, use `claude/phase-h-tuning`.
- In the last session the clone was shallow and its local branch was stale, so work happened on a local branch
  `phase-h-remote` tracking `origin/claude/phase-h-tuning`, pushed with `git push origin HEAD:claude/phase-h-tuning`.
  A fresh session should just check out `claude/phase-h-tuning`.
- The user previews the game at https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (republished after every step).

## How we work with this user (phase H)
- Item by item, 4 ideas each via the question tool; the user picks, often writes their own twist. Ask before design changes.
- User rule for stacking: every extra copy adds a real chunk, no ceiling that wastes copies.
- The user said "write code after we sorted all items": decide first, then build in one go, then test.
- After every change: `npm test`, a full-run check, commit, push, `npm run build:page`, republish.

## Done in the last session
- ALL 72 old items reviewed one by one and rebuilt (stacking rework). Shared engine pieces: `perExtra`, `chancePerExtra`
  (one roll whose chance grows), `falloffRatio` used to creep towards a limit, `stackEach` debuffs, `damagePerExtraPercent`,
  `jumpsPerExtra`, upkeep once per minion item. Round 2 fixed the weak defensive items (Shield Totem no recharge, Aid Kit =
  Triage, Martyr's Shield, Bandage Roll = bandage toss, Second Wind 80% below 20%), Siege Cannon +80% skill damage.
- 10 proposal items built (items 73-82) and 5 of the USER'S OWN items (Flame Spirit, Spirit Axe, Heart of the Beast,
  Moonlight Twinblade, Ghastly Fire). Phoenix Feather: 1s invulnerable + heal to 70%. Soul Lantern: legendary, once per
  run (`oncePerRun`, rewards `offered` Set), no limit. Now 87 items: 23 common, 26 rare, 23 epic, 15 legendary.
- New check tools:
  - `node scripts/tests/itemruns.mjs [runsPerSquad] [ids] [copies]`: full runs with the SAME dice, the front hero holds
    0/1/3/8 copies of an item; mean floor reached. Use it for any item change (defensive items too). Caveat: the front
    hero is always melee in its 4 squads and the bot only taps boss objects.
  - `node scripts/tests/nominions.mjs [runsPerSquad] [squads]`: every squad, runs with vs without summoning items.
    Result: summoning items add ~+1.6 floors, matter most for the Necromancer and the Brood Mother (86% vs 53% wins).
- `scripts/art/new-item-icons.mjs` draws the new item icons (rough; the user may polish them in the Studio).

## Open right now
1. Moonlight Twinblade is weak for a legendary (+1.5 / +2.0 floors). Proposed: 3 hits of 150% each. Waiting for the user.
2. Watch list: Aid Kit (Triage) is very strong for a common (+15 floors at 8 kits); Soul Lantern and Heart of the Beast
   are strong. A normal run in the bot reaches about floor 27-30.
3. docs/item-list.md is the OLD master list (72 items, old numbers); item-decisions.md is the current truth.

## Next (agreed order)
1. Hero balance: run `node scripts/tests/review.mjs 4 all` (~10 min), show strongest/weakest heroes and squads, then fix
   weak heroes with 4 ideas each.
2. Enemy growth / difficulty curve (how deep a normal run should go).
3. Drop odds (rarities, skill books, potion) with 87 items.
4. Bosses rework (user: "later"); Morthul can stall weak squads forever (enrage timer suggested, not decided).

## Session 2 (hero balance, round 1)
- Moonlight Twinblade 18% per copy (user: higher chance). Same-dice runs x12: 1 copy +0, 3 copies +8.5 floors.
- Review before (4 runs/squad): cleric 34.2, berserker 28.4, knight 27.5, rogue 27.2, samurai 24.9, mage 23.0,
  bard 22.7, necromancer 22.2, archer 21.8, alchemist 20.1 (mean floor 25.2).
- User picks: Alchemist = better Mystery Brew (3 flasks, heals go to the most hurt); Archer = easier Steady Aim
  (1.5s, pierce on every shot); Necromancer = faster raising only (5-6s, cap 5, 2 at start); Cleric left alone.
- Review after: cleric 36.2, rogue 32.2, berserker 31.0, knight 30.9, samurai 26.5, necromancer 25.3, mage 25.2,
  bard 24.3, archer 24.2, alchemist 23.0 (mean 27.9). The weak three rose but stay at the bottom.

## Session 2: special rooms (user's idea, built)
- From floor 4 about 1 floor in 4 is a room instead of a fight: Treasure (1-2 chests), Mimic (own room, fight, rare/epic
  prize), Rest Fountain (heal 50% + regen for the next 3 fights), Skill Dealer (1 of 5 pages), Puzzle (3x3 slide puzzle,
  no fail, Give up = nothing). Details in CLAUDE.md "SPECIAL ROOMS". User picked: random and counts as a floor; Mimic as
  its own room; puzzle 3x3 no fail; dealer free.
- Open: the balance bots don't play rooms yet (runs in the game are now a bit easier than the bot says: ~1 floor in 4
  has no fight and gives a reward). Room weights / chance not tuned. Prop art is rough (Studio can't edit props yet).

## Session 2 (later): UI, items, sounds
- Reward "Who gets it?" = hero rows (stat items show 'DEF 12 → 24', nothing else); all 87 item texts rewritten
  short + 'Per stack' line. Rooms: chests smaller and vanish, dealer steps aside, fountain at the side, puzzle easy.
- Fire Arrows = a real burning arrow; noPop (no icon pop / proc sound) for Fire Arrows, Quiver, Metronome and the
  8 debuff procs.
- SOUND = ON HOLD (user: KIV). Board round 5 has ~180 CC0 sounds from GitHub (add-packs.py). Pending: the user must
  re-pick Melee hit (its saved pick 'T' came from the letter bug), then 'apply the sound picks'. Item pop sound is
  still the Fast magic spell (same as Holy hit).
- Next (agreed order): hero balance round 2 (Alchemist/Archer/Bard/Mage still bottom), enemy difficulty curve,
  drop odds, bosses. The balance bots still don't play special rooms.

## Session 2: difficulty curve (smart player)
- New tools: scripts/tests/smartbot.mjs (smart drafting player) + curve.mjs (all cores). Runs go to floor 400.
- Today (smart, 5/squad): median floor 31, mean 36; almost no deaths before 15, wall at 16-20 (Grukk), steady
  losses 21-40, squads past ~50 snowball.
- Tested: enemies +30% hp / +45% atk per 3 floors (instead of +35 / +52.5) = median 38 (user's target ~40), BUT
  strong squads never die (fights at floor 300 last 3.6s). User: DON'T change growth yet; instead add NEW ENEMIES
  and maybe ELITE enemies to keep deep floors interesting. Endless runs should stay possible.
- Enemy proposal page (10 new enemies + elites): https://claude.ai/artifact/AkX6DWTeCsYzU6oXb3QWFS (user has not
  sent keep/drop picks yet).
- USER'S PLAN (after the page): 2-10 enemies per floor (more deeper), FODDER enemies that scale way lower, a
  random floor mix (true roguelike, but delicate), elites from floor 10 (rare at first), MONSTER HOUSE after
  floor 60 (5% per floor = about 1 in 20; "IT'S A MONSTER HOUSE!", 11-15 enemies ALL AT ONCE, prize = epic pool +
  small legendary chance). Fodder: Slime/Bat/Rat become fodder AND new fodder enemies.
- Build order: 1 floor director (DONE: budget, tiers, shapes, rows; see CLAUDE.md FLOOR DIRECTOR),
  2 new fodder enemies (DONE: Imp Swarmling, Mushling, Bone Rat, Shade Wisp), 3 elites (element + 1 random trait), 4 Monster House, 5 the 10 new enemies (after picks).
- User's picks on the enemy page: ALL 14 enemies KEEP (4 fodder + 10), all 5 elemental powers KEEP, traits KEEP
  Vampiric, Shielded, Thorny, Splitting, Regenerating, Unstoppable, Explosive; DROP Hasted and Berserk. Odds table
  kept, but elites start at FLOOR 10 (user's earlier answer). Elite rule/reward: no pick = build as written.
