# Handoff: phase H (tuning). Newest notes first (START HERE), older sessions below.

Read `CLAUDE.md` first, then this file. Every item decision of this phase is in `docs/item-decisions.md`
(it overrides older item numbers in CLAUDE.md and docs/item-list.md).

## START HERE (session 3): enemies and difficulty
Status: steps 1-4 DONE (ELITES and MONSTER HOUSE, see CLAUDE.md). User: keep elites as they are. Next = step 5, the 10 new enemies.

### Branch, preview, tools
- Latest branch: `ccr-a59eab7b-wefaf5` (session 3, elites; all pushed). A new session gets its own branch name from the
  system prompt: start it from `origin/ccr-a59eab7b-wefaf5` (it has everything), never from the old
  `claude/phase-h-tuning` (behind). CLAUDE.md's git line just says "the branch the session names".
- Game preview: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (build:page + republish after each step).
- Monster House demo: https://claude.ai/artifact/4vMvwYLs9sUHr5KcxZ75aH (`npm run build:house-demo`, copy house-demo-page.html to the scratchpad as monster-house-demo.html, republish).
- Enemy proposal page (sprites + picks): https://claude.ai/artifact/AkX6DWTeCsYzU6oXb3QWFS
  (source `docs/proposals/enemy-proposal.src.html`, built by `node docs/proposals/make-enemy-page.mjs <src> <out>`).
- Difficulty check: `node scripts/tests/curve.mjs 3 smart` (~40s, all cores). Last result: median 34, mean 37,
  p90 59; walls at 16-20 (Grukk) and 36-40 (Brood Mother); a few runs still go 100-400.
- Browser checks: run vite from the SCRATCHPAD dir (it writes vite.log; the repo has a tracked vite.log, do not
  dirty it), dev-only `?floor=N` (start on floor N) and `?room=<kind>`; playwright script pattern in the
  scratchpad `crowd.mjs` (Squad > start Battle > wait for mode 'fighting' > screenshot).

### What the user decided (all of it)
- 2-10 enemies per floor, more deeper; FODDER that scale way lower; a random but DELICATE floor mix; difficulty
  must scale properly but endless runs stay possible.
- ELITES from FLOOR 10, rare at first (about 1 fight in 20 at 10, 1 in 3 by 40, ~60% at 60, 80% at 100+;
  a 2nd elite in a fight: 15% from 60, 35% at 100+; never on boss floors or in rooms).
- MONSTER HOUSE after floor 60: 5% chance per floor (about 1 in 20, sometimes 2 close together), never a boss floor
  or the one before; huge banner "IT'S A MONSTER HOUSE!", 11-15 enemies ALL AT ONCE; prize = an epic reward pool
  with a small legendary chance.
- Enemy page picks: ALL 14 new enemies KEEP; all 5 elemental powers KEEP; traits KEEP Vampiric, Shielded, Thorny,
  Splitting, Regenerating, Unstoppable, Explosive; DROP Hasted and Berserk. Elite rule + elite reward had no pick
  = build them as written on the page.

### Done
1. FLOOR DIRECTOR (CLAUDE.md "FLOOR DIRECTOR"): threat budget per floor, tiers fodder 0.4 / normal 1 / strong 2,
   shapes swarm/squad/heavy/mixed, swing, maxCount up to 10, enemy rows (`formation.js`), fodder scaling
   (combat.json `enemyTiers`), `bigFightEase` removed. Tests `director.test.mjs`.
2. NEW FODDER: Imp Swarmling 13+, Mushling 22+, Bone Rat 25+, Shade Wisp 35+ (`scripts/art/add-enemies.mjs <ids>`:
   sprite from `docs/proposals/enemy-designs.mjs`, rules in its RULES table, adds the roster entry).

3. ELITES (built, session 3): user picked normal + strong enemies only. Everything else as written on the page
   (see CLAUDE.md ELITES). Smart player 3/squad: with elites median 29, mean 31.8, p90 50, max 135; same code with
   elites off median 34, mean 37.1, p90 59, max 400. So elites cost ~5 floors and stop the 100-400 snowball runs
   (0% reach 100, was 2%). Brood Mother win rate 78% (was 87%). NOT tuned yet: ask the user if that is the wanted
   feel (knobs: director.elites chance points, combat.json elites multipliers / element chances).

4. MONSTER HOUSE (built, session 3; user after the demo: legendary 10% -> 4%, fodder weights 2/1.4/0.25 -> 1/1.6/0.4; with that only 38% of 74 real squads at floor 61 survive one (was ~90%), user to judge in the demo): as written in the user's plan (see CLAUDE.md MONSTER HOUSE). The 5% rolls
   on fight floors only (rooms are decided first). Smart player 3/squad: median 29, mean 31.7 (same as elites only);
   the Monster House killed 7 of the ~18 runs that got past floor 60 (3rd top killer). Not tuned.

### Step 3 ELITES spec (as approved, built)
- Which enemies can be elite is NOT decided: suggest normal + strong only (never bosses, boss helpers, objects;
  fodder probably not). Ask the user.
- Stats x2 health, x1.35 attack, +10 defense and resist; drawn 1 pixel size bigger (drawScale +1), a glow in its
  element colour, a small gold crown over its health bar; name like "Burning Vampiric Bandit"; x3 XP; after a
  fight with an elite ONE of the 3 reward cards goes up a rarity.
- ELEMENT (one): Burning = hits Burn, resists fire, weak ice; Frozen = Chill, resists ice, weak fire; Storm =
  Shock + every 4th hit jumps to a 2nd hero, resists electric, weak ice; Cursed = Curse + heals 10% of damage,
  resists dark, weak holy; Toxic = Poison + poison cloud on death, resists dark, weak fire. Its basic attack takes
  the element's damage type (poison = dark).
- TRAIT (one): Vampiric (heals 20% of damage dealt), Shielded (shield 30% max health, regrows after 6s unhit),
  Thorny (reflects 20% melee), Splitting (dies into 2 small non-elite copies at 25% health), Regenerating (2%/s),
  Unstoppable (control statuses half as long), Explosive (death burst of its element on nearby heroes).
- Suggested build: odds + picks in dungeons.json `director.elites`; the director marks ids (e.g. returns
  `{id, elite:{element, trait}}` or a parallel `ids.elites` list) so `spawnEnemies` can apply `makeElite()`;
  reuse existing pieces: onHit status specs, onDeath bursts (Puffshroom), shields (`shield` status), thorns,
  lifesteal, `statusDurationScale`, regen. Tests + smartbot (it must handle split spawns) + curve check.
- Then step 4 MONSTER HOUSE, step 5 the 10 new enemies (rules on the proposal page; some need new code:
  Shaman heal, Shieldbearer ally shield, Worm burrow, Acolyte raise, Golem enrage, Blink Imp teleport, Hound
  howl, Banshee silence wind-up, Sentinel adaptive resist; Sapper bomb on death).
- Later (agreed order): hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds, bosses
  rework. Sound is ON HOLD (see below).

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
- Enemy proposal page (10 new enemies + elites): https://claude.ai/artifact/AkX6DWTeCsYzU6oXb3QWFS (picks in START HERE).
- USER'S PLAN (after the page): 2-10 enemies per floor (more deeper), FODDER enemies that scale way lower, a
  random floor mix (true roguelike, but delicate), elites from floor 10 (rare at first), MONSTER HOUSE after
  floor 60 (5% per floor = about 1 in 20; "IT'S A MONSTER HOUSE!", 11-15 enemies ALL AT ONCE, prize = epic pool +
  small legendary chance). Fodder: Slime/Bat/Rat become fodder AND new fodder enemies.
- Build order: 1 floor director (DONE: budget, tiers, shapes, rows; see CLAUDE.md FLOOR DIRECTOR),
  2 new fodder enemies (DONE: Imp Swarmling, Mushling, Bone Rat, Shade Wisp), 3 elites (element + 1 random trait), 4 Monster House, 5 the 10 new enemies (after picks).
- User's picks on the enemy page: ALL 14 enemies KEEP (4 fodder + 10), all 5 elemental powers KEEP, traits KEEP
  Vampiric, Shielded, Thorny, Splitting, Regenerating, Unstoppable, Explosive; DROP Hasted and Berserk. Odds table
  kept, but elites start at FLOOR 10 (user's earlier answer). Elite rule/reward: no pick = build as written.
