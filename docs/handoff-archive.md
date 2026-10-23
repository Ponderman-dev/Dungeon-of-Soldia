# Handoff ARCHIVE (sessions 2-26, newest first). Old notes only: SEARCH it (grep) for a detail, don't read it whole.
The current handoff is `docs/handoff-phase-h.md`.

## (session 26 start note, 2026-10-23; all of it done in session 26 except kink 3) NEXT was FLOORS 50+ (user: 'floor 1-50 experiences are good now, focus on the rest')
- BRANCH: `main` has EVERYTHING (session 25 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST (user's order): REVERT the heroes' +15% attack (session 25): set combat.json `heroAttack.percent` to 0 (keep the
  rule; tests use `plainRules()`), then go through BOTH lists below with the user: first tell them what was already built for the earlier list
  (7-10, they have not read it), then ASK which to do first (question tool). One step at a time.
- THE USER'S LIST (session 25 end, with screenshots; nothing started):
  1. Two full ROWS of enemies: back-row enemies overlap the front enemy's HP bar (rows too close: combat.json
     `movement.layout.enemyRowGap` 70 / bar height; see `enemySpots()`, `syncBar()`).
  2. Assault Breastplate's debuff icon still shows BEFORE the floor starts (aura 0.5s into the floor was the s24 fix;
     the icon itself still pops early: check `drawChips()` / when the aura status is applied vs drawn).
  3. High floors fill up with HERO MINIONS and enemies can't clear them: ideas from the user = enemies deal more damage
     to minions the deeper you go, enemy AREA skills, more enemy skills that really hurt heroes, and enemy ATTACK SPEED
     scaling with floors (now only health/attack scale: combat.json `floorScaling`). ASK before designing.
  4. Floors 80-100+: enemy stat scaling needs to go up a bit (`floorScaling`; maybe a second band from floor 80).
  5. Proc icon pops (item icon over the hero, e.g. Moonlight Twinblade) form a LONG ROW when many fire at once (pic: 5
     moon icons side by side over the Archer): cap / stack them (one icon + count, or a short queue). `itemFx.js` /
     BattleScene icon pop (effects.md).
  6. ITEM VARIETY (from earlier): rolls ARE random (3 sim runs: 61-67 different items of 92 per 60 floors, a different
     'favourite' each run); it feels samey because half the cards are commons (24 items) and `needs` items are x0.25.
     I listed 13 ideas (anti-repeat, seen-fade, owned fade, fewer commons deep, pity timer, reroll, 4 cards, skip,
     build-aware card, themed screens, more commons...); my pick: anti-repeat + fewer commons deeper in. User to choose.
- THE USER'S EARLIER LIST (session 25, with screenshots). Built in session 25 (tests pass, committed), but the user has
  NOT READ the replies or SEEN it in the game: tell them what was done (simply), show it IN THE GAME when they ask, and
  ask whether it is OK before moving on:
  7. TEXT OVER THE EDGES: the 'Which skill?' box note ('Full: replaces one' ran out of the box) now uses `fitText()`
     (RewardScene); the big banner ('Blessed!\nRegen for the next 3 fights' ran off the screen) now wraps (wordWrap
     GAME_WIDTH - 32 in BattleScene). Check other long texts too (the user said 'such as these').
  8. SOUNDS GO MISSING AT HIGH FLOORS (floor clear and others): busy fights filled all 8 voices (`sounds.json`
     maxVoices). Now only BUSY cues (with their own minGapMs: hits, procs, steps) share the 8; one-off cues (floor clear,
     level up, rewards, boss roar) and `always: true` cues (every skill_* sound) always play (`sfx.js`, sound.md).
  9. ITEMS FEEL THE SAME EVERY RUN: = item 6 above (no fix built yet, only the measuring + 13 ideas).
  10. REMOVE THE SKILL BOOK LIMITS (was 3 stat pages + 2 modifiers per skill): combat.json `books` maxStatPages /
     modifierSlots = null (no limit); the same modifier twice on one skill is still refused (ask the user if that is
     OK); the page marks on the skill square wrap into rows (stat dots rows of 5, modifier diamonds rows of 4,
     `drawPageMarks()`); 'Which skill?' shows '2 stats / 1 mods' without a max. Tests: skill-books.test.mjs.
- DONE session 25 (in the game + preview): bosses.md has the details.
  - Grukk (20): Goblin King look (first-draft art, `scripts/art/grukk/`), separate swinging cleaver; War Drum calls
    1 Goblin + 1 Goblin Archer (ranged, poison every hit) at 50% health; Quake Jump (under 50%: 2x hit + 2s stun on all).
    bosscheck 81% win (was 93%).
  - Brood Mother (40): 15% bigger, attack 8, eggs at her SIDES (45 health, hatch 5s), spiderlings weak poison every hit,
    Sticky Webs (2 heroes `tangled`: -70% attack speed 5s). User: 'challenging enough'. Last bosscheck 39% (before the
    egg 45 health / 5s change). Brood Mother demo page (floor 40 on repeat): https://claude.ai/artifact/3ZPdABV5GtWPAFnMU5bAkz
  - Boss floor reward: always 2 epic + 1 legendary (rewards.json `bossRarities`), then the golden book.
  - KIV (user): OUTLINE style (bosses/new enemies outlined, first-batch enemies + most heroes not; decide later, art.md).
- No new curve run this session (hero buff, boss rewards and bosses changed): run `curve.mjs 3 smart` only if the user asks.
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and sessions 23-25: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad (demo pages: `VITE_DEMO=brood`);
  Playwright (/opt/node22/lib/node_modules/playwright, executablePath /opt/pw-browsers/chromium). Dev build exposes
  `window.__game`: wait for 'Title', stop scenes, `scene.start('Battle')` (registry `squadIds`; `?floor=N`). After a
  screen slide, wait ~2.5s before tapping. Stop vite by PID (`ps aux | grep "[n]ode_modules/.bin/vite"`): a
  `pkill -f` with the pattern in the same shell line can kill the shell itself.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Fresh clone: `npm install` first (node_modules is not there).

## (session 25 start note, 2026-10-23: session 24 work = item optimization round 2 + new items)
- NEXT was BOSSES REWORK (done in session 25: Grukk + Brood Mother reworked, see bosses.md).
- DONE session 24: item review page round 2 (db `notes2`), 19 items changed, NEW Riposte Cloak / Last Stand / Harvest
  Scythe, Killing Mask cut (details: item-decisions.md 'ITEM OPTIMIZATION round 2' + 'NEW ITEMS session 24').
  KIV: early floors a bit harder (alive at 20: 93% -> 88%). Curve 3 smart: median 43, mean 56.2, alive at 100: 5%.

## (session 24 start note, 2026-10-22: session 23 work = ranged minion targeting, tap sound, squad/camp buttons, speech bubbles)
- BRANCH: `main` has EVERYTHING (session 23 merged in). See the Git rule in CLAUDE.md (every handoff updates main).
- NEXT 1, ITEM OPTIMIZATION: the user's words only ('item optimization'); ASK what they mean first (question tool,
  e.g. balance weak/strong items with `review.mjs` / `itemruns.mjs`, clean up item texts/tooltips, fewer or merged
  items, item code speed). Read `docs/systems/items.md` + `docs/item-decisions.md` (numbers truth) + balance-tools.md.
  Recent: charm / Chill Band / Magma Core 'Per stack' now '+X% of attack as <element>' (they ride INSIDE the hit);
  every other perStack line was checked against the effects and matched (session 23).
- NEXT 2, BOSSES REWORK (its own session): the user's words only; ASK what to change. Read `docs/systems/bosses.md`
  (8 bosses, `bosses.js`, `bosscheck.mjs` win rates). Enemy random picks now go through `pickWeighted()` (below).
- DONE session 23 (details in the docs/systems files):
  - Enemies hit RANGED minions (Wisp, Imp, Phoenix) half as often (`minions.rangedTargetWeight` 0.5, `pickWeighted()`;
    melee enemies never walk to one, but hit it at random if it is in reach; boss random picks too). Curve 3 smart
    mean 56.9 -> 52.9, median 42 -> 40 (minions.md).
  - Tap sound = one take (PIXABAY Button, `picked/tap.mp3`) (sound.md).
  - Squad screen: '< CAMP' + RANDOM in the bottom row, roomier buttons; camp: real up-arrows on TO EXPEDITION, 24px
    side margins; menu buttons slide/fade OUT before a screen slide and IN after (`uiKit.uiShift`, BEGIN DESCENT too)
    (title-base.md, saving-squad.md).
  - Speech bubbles: every line rewritten to 2-5 words, bubble max width 140 (ui.md).
  - The Skill Effects review page (NySVH2UUozwNNSYuky9xBN) currently holds the 3 tap sounds (done; reuse it freely).
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and all of session 23: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad; Playwright
  (/opt/node22/lib/node_modules/playwright, executablePath /opt/pw-browsers/chromium). Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Base')` or 'Battle' (registry `squadIds`); `scene.getScene('Battle')
  .sayLine('clear')` shows a bubble. Copy edited files into the worktree to preview before applying. After a screen
  slide, wait ~2.5s before tapping (taps are blocked while the buttons shift). Remove the worktree after
  (`git worktree remove --force`), stop vite with `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Sound board picks: page 1 = db `picks` (apply-picks.py), page 2 = db `assign` (WINS; applied by hand so far).

## (session 23 start note, 2026-10-21: session 22 work = camp hub rework, skill cuts swing, sounds round 9)
- BRANCH: `main` has EVERYTHING (session 22 work merged in). See the Git rule in CLAUDE.md (every handoff updates main).
- CAMP HUB REWORK (session 22, user's sketch 'more of a mobile game menu'; details docs/systems/title-base.md
  section 4): `BaseScene` = campfire in the middle with 3 random unlocked heroes idly wandering (`camp.json hero`),
  Settings gear top left, profile (name box 'Adventurer' + round portrait, `uiKit.pixelDisc`) top right, big
  TO EXPEDITION window (slides up into the squad screen), bottom row of 4 square buttons with 12x12 pixel icons
  (`ui.menu`: Glossary, Heroes, Leaders, Shop) = all 'Coming soon'. No walk-in from the bottom, no NPCs drawn
  (`npcs` data kept for later screens). Likely next asks: the screens behind the buttons, the profile name/portrait,
  settings (sound on/off lives on the squad screen today), polish. In the dev/preview build the yellow TEST buttons
  sit over the profile (not in the itch build).
- Also DONE session 22: clear pause 1.2s (bubble shows first); a skill cuts the attack swing/step short
  (`Character.stopAttack`, `stopStep`); neater 'Who gets it?' hero rows; sound board round 9 (Menus rows, `add-menus.py`)
  + picks applied (tap = 3 random takes, cardOpen page turn, cardClose card place, scroll, descend = appear magic,
  Flask Barrage glass); element charms / Chill Band / Magma Core ride INSIDE the attack (one number, `riders` in
  combat.js, not boosted by +element %: grows evenly; items.md 'ONE HIT'); charm texts simpler.
- itch.io: the zip given to the user predates the hub / charms / page-2 sounds: `npm run build:itch` again before an
  upload, and add those to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version still 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <copy> --port 5177` run FROM the scratchpad (a git worktree in
  the scratchpad + a node_modules symlink; run `npm install` first if node_modules is missing). Dev build exposes
  `window.__game`: wait for 'Title', stop scenes, `scene.start('Base')` or 'Battle' (registry `squadIds`). Remove the
  worktree after (`git worktree remove --force`). Stop vite with `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Sound board picks: page 1 = db `picks` (apply-picks.py), page 2 = db `assign` (WINS; several files = random takes;
  applied by hand so far). Compare with the db copies to spot what is new.

## (session 22 start note, 2026-10-21: session 21 work = title, camp, sounds, bubbles, small font)
- BRANCH: `main` has EVERYTHING (session 21 work merged in). See the Git rule in CLAUDE.md.
- DONE session 21 (details: docs/systems/title-base.md, ui.md, sound.md):
  - TITLE SCREEN (`TitleScene`, `systems/titleArt.js`, `title.json`; Boot starts 'Title'): user's pick F after many
    rejected designs (wants a THICK forest seen FROM ABOVE, round tree tops, a far tower, logo mid-screen, Slay the
    Spire feel). Logo = stand-in text (the user may draw one in the Studio). Settings gear = 'Coming soon'.
  - CAMP / BASE (`BaseScene`, `systems/campArt.js`, `camp.json`): campfire on the dungeon flagstones (no wall: the
    open top is the exit), a random unlocked hero walks in from the bottom, 4 NPCs with names OVER their heads
    (Glossary, Heroes, Leaderboard, Shop) + Profile = 'Coming soon' windows (`uiKit.comingSoonWindow`), big TO DUNGEON
    window at the top: the hero walks round the fire and out, the screen slides up into the squad screen. After a run
    you still go back to the squad screen. User: 'we'll get back to this later' (NPC screens, polish).
  - Sounds: tap on TAP TO START / TO DUNGEON, footsteps on the camp walks, card open/close on the windows.
  - Speech bubbles never hold the game: the first fight starts at once, clear pause back to 0.9s; the bubble is
    removed 0.2s after the reward screen opens (`dialogue.json rules.goneAfterRewardMs`, done on the Reward scene's
    clock because Battle is paused under it).
  - SMALL TEXT FONT: text asked for at 8px or less is Press Start 2P at 8px (`UI.smallFont`; uiKit draws it letter by
    letter on whole pixels and snaps edges); bigger text stays Ironslab. Pixelify Sans and Tiny5 were tried and dropped.
  - itch.io: dev notes `docs/itch-publish.md` (build:itch, rename to index.html, zip, embed 390x844 portrait) and a
    devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (everything since the first itch build, 2026-10-20). The
    zip given to the user predates the bubble/sound/font changes: rebuild before they upload.
- OPEN: NPC screens (Glossary, Heroes, Leaderboard, Shop, Profile, Settings) are placeholders; the user's own logo;
  older item ideas: Electric payoff epic (Shock), Eclipse Idol ~0 in itemruns (bot), more dark legendaries (Doom Crown,
  Soul Reaper, Shade Lantern), defense ideas (Stoneheart hit cap 20%, Aegis of Dawn, Spellward Robe).
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
  It is noisy at 6/squad: use 16/squad and compare old vs new on the same dice (git worktree of HEAD) before judging.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` run FROM the scratchpad (a git worktree in
  the scratchpad + a node_modules symlink = a quick look copy). The game opens on 'Title' now: wait for it, then stop
  scenes and start 'Battle' (registry `squadIds`) or 'Base'; Battle modes: entering / fighting / won / lost.
  NPCs and TO DUNGEON ignore taps while the hero walks in (~3.5s after the title tap). Stop vite with
  `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).

## (session 21 start note, 2026-10-21: NEXT = opening title page)
- BRANCH: `main` has EVERYTHING (session 20 work merged in). See the Git rule in CLAUDE.md.
- NEXT TASK: an opening TITLE PAGE before the squad screen. Today BootScene starts 'Squad' directly (src/main.js scene
  list: Boot, Squad, Battle, Reward, Puzzle, Debug). Nothing designed yet: ask the user first (game name 'Dungeon of
  Soldia' look, what's on it: tap to start / continue, background art, music is ON HOLD). Follow docs/systems/ui.md
  (black windows, white lines, Ironslab font) and the ART rule below (show it in the game first, screenshots).
- DONE session 20: SPEECH BUBBLES (user idea, purely for show): a hero says a line in a WHITE bubble (black line + text)
  at the run's start and after every cleared floor; boss / fallen-friend / close call (<=25% hp) / hurt (<=50%) lines;
  10 heroes x 6 kinds in `src/data/dialogue.json`, logic `systems/dialogue.js`, test `dialogue.test.mjs`. The clear pause
  is ~2.4s now (bubble time). 'Floor N cleared!' moved up to the centre (combat.json `transition.clearBannerY` 422).
  Details: ui.md 'Speech bubbles'. The user may still want to edit lines.
- OPEN (older ideas): Electric has no payoff epic (Shock); Eclipse Idol ~0 in itemruns (bot); more dark legendaries
  (Doom Crown, Soul Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap 20%), Aegis of Dawn,
  Spellward Robe.
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
  It is noisy at 6/squad: use 16/squad and compare old vs new on the same dice (git worktree of HEAD) before judging.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` from the scratchpad (npm install first);
  set registry `squadIds`, stop all scenes, start 'Battle' (retry until a fight); `window.__game`
  .scene.getScene('Battle').state = BattleState; kill units with state.killUnit + scene.showEvents to reach the
  reward / defeat screens; `?floor=11&room=<kind>` for rooms. Stop vite with `pkill -f "[v]ite.*--port 5177"` (the
  brackets stop pkill from killing its own shell).
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then publish again.

## (session 20 start note, 2026-10-21: no task picked)
- BRANCH: `main` has EVERYTHING (made in session 20; the old branches were deleted). See the Git rule in CLAUDE.md.
- DONE session 19:
  - Fire Arrows REMOVED (user). Ember Charm burn 6% -> 12% (+10% per extra charm). Spirit Axe v2: spins ONCE when the
    holder is hit, 14% per copy, 400% to every enemy within 110px (itemruns 3 copies +9.0: watch it). docs/item-decisions.md.
  - BUG FIX: the game froze when a Kobold Sapper's late bomb hit something (scene lunged a faded attacker; BattleScene
    'attack' event now skips a missing attacker view).
  - NEW FONT: IRONSLAB, the user's OWN pixel font (`src/assets/fonts/ironslab.ttf`, 10px grid). Scenes still ask for
    8/16/24px; uiKit maps them to 10/20/30 (`UI.fontGrid`). Missing chars: `$ ; @ \ ^ _ { | } ~`. If the user sends a new
    .ttf: check grid + characters (session 19 used small node scripts), swap the file, screenshot. ui.md has it all.
    Jacquard 24 and ~20 Google pixel fonts were tried and turned DOWN.
  - Death Coil: user says it's fine; its 'change' note on the skill-fx page (db notes/look:death_coil3) is now 'ok'.
- OPEN: Electric has no payoff epic (Shock); Eclipse Idol ~0 in itemruns (bot); more dark legendaries (Doom Crown, Soul
  Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap 20%), Aegis of Dawn, Spellward Robe.
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
  It is noisy at 6/squad: use 16/squad and compare old vs new on the same dice (git worktree of HEAD) before judging.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` from the scratchpad (npm install first);
  set registry `squadIds`, stop all scenes, start 'Battle' (retry until a fight); `window.__game`
  .scene.getScene('Battle').state = BattleState; kill units with state.killUnit + scene.showEvents to reach the
  reward / defeat screens; `?floor=11&room=<kind>` for rooms. Stop vite with `pkill -f "[v]ite.*--port 5177"` (the
  brackets stop pkill from killing its own shell).
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then publish again.

## (session 19 start note, 2026-10-20: NEXT = Ember Charm + Fire Arrows)
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING. Before building/publishing: `git fetch` and check newer session
  branches are merged (`git merge-base --is-ancestor`); another session pushed to this SAME branch once (pull first).
- DONE session 18 (numbers + itemruns: docs/item-decisions.md 'Session 18'):
  - Small fixes: shield numbers whole (shields soak whole points), no stacked 'Sacrifice!', Mystery Brew own sound (rising
    bubbly pop), fountain back to the potion sound.
  - Element charms: 10% hit + 10% element boost per charm; Chill Band 20% ice hit; same-element sure hits MERGE across
    items. Magma Core v2 (35% fire hit, Burns +40%). NEW legendary THUNDERSTRUCK (circle 1.5s under the strongest enemy,
    then a 700% bolt; triggers on-hit items; once per run).
  - Defense: NEW epic GUARDIAN'S BANNER (squad +15 def/+15 res), NEW epic ASSAULT BREASTPLATE (+35 def, every enemy -8
    def per copy, ARMOR DOWN icon on enemies). Drop odds lowered: epic/legendary 4.5/0.5, 8.5/1.5, 12/3 (rewards.md).
  - Enemy health growth stays +50% per 3 floors (42% was tried: too easy). Smart curve median ~41-44.
  - Item reworks (user picked via the question tool): Sucker Punch = +50% on ANY hit vs enemies above 90% health;
    Bandage Roll = cure 1 DoT + heal 3%; Martyr's Shield = Bodyguard (takes all hits on an ally under 30% for 3s);
    Spiked Aegis = shielded melee thorns 40%; Catalyst Vial = DoT ticks can crit (+25%); item `needs` can be a list.
    LAST STAND BANNER REMOVED (overlapped Phoenix Feather / Aid Kit / Second Wind / Martyr). Quiver: user said keep.
- NEXT: Ember Charm (6% Burn, ~+7% dmg, itemruns ~0) and Fire Arrows (50% x 35% fire hit, ranged only = a weaker
  Magma Core/Kindling; BUG: `provides` says burn but it never burns). Options offered: Ember = sure small burn / bigger
  chance / burn on crit; Fire Arrows = arrows burn / explosive splash / fire volley. User has not picked.
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
- OPEN: Electric has no payoff epic (Shock); Death Coil demo note says 'change'; Eclipse Idol ~0 in itemruns (bot);
  more dark legendaries (Doom Crown, Soul Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap
  20%), Aegis of Dawn, Spellward Robe.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` from the scratchpad (npm install first);
  set registry `squadIds`, stop 'Squad', start 'Battle' (retry until a fight, rooms are random); `window.__game`
  .scene.getScene('Battle').state = BattleState. The game runs faster than wall time: poll state, then shoot a burst.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then publish again.

## (session 18 start note, 2026-10-20: NEXT = more ITEM COMBOS / DARK ITEMS)
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING. Before building/publishing: `git fetch` and check newer session
  branches are merged (`git merge-base --is-ancestor`); old branches = history, ignore.
- DONE session 17 (item adjustments; numbers + itemruns in docs/item-decisions.md 'Session 17'):
  - Element charms ADD their element: every basic attack + a 15% fire/ice/electric/dark hit, +15% boost kept, no `needs`.
    Copies MERGE into one bigger hit (`mergeCopies`, also Chill Band). Shadow Charm no longer boosts Poison (`typeBonus`).
  - Debuff procs (Ember, Venom Fang, Thousand Cuts): ONE roll per attack, each copy = more chance AND +10% status damage.
  - Minions: Imp/Wisp/Phoenix/Ice Spirit Knight get half the hero's +% for their element (`holderElementShare`);
    Spirit Knight hits ICE (`hitType`, look kept: 'blue enough'); Phoenix burns + 2%/s self regen (no squad heal);
    Gargoyle defense 14; Mimic = BAIT (never attacks, taunts nearby, 14 hp, explodes). minions.md.
  - Frozen Thunderbolt v2: electric hits add a 30% ice hit + 1 Chill; 3 Chill / Frozen = shatter 150% ice on it + neighbours.
  - Flame Spirit renamed DARK SPIRIT. NEW legendary ECLIPSE IDOL (stores dark damage, at 10x attack Dooms 2-3 enemies:
    350% dark/s + 50% slow, 4s; new DOOM status). Screenshots shown; look = Dark Spirit orb + Curse swirl (offered a
    unique Doom look, not asked yet).
  - Sapper bomb: nobody avoids/walks out of its circle any more (it blocked walking).
  - Curve median ~41-42 throughout (40 at session start).
- OPEN / offered: more dark legendaries (user: 'we need more legendary dark items'; ideas offered: Doom Crown, Soul Reaper,
  Shade Lantern); Electric has no own legendary, Ice only Thunderbolt; Shadow Charm and Mimic Chest score ~0; Eclipse Idol
  ~0 in itemruns (smartbot gives it to non-dark heroes). Older OPEN: Bone Sacrifice popups, Mystery Brew sound, Death Coil note.
- Session lessons (user asked 'why failures every prompt'): update the old tests IN THE SAME STEP as a rule change (no
  visible FAIL round), check a test file's helpers (`near`, `mk`) before using them, never `pkill -f` a pattern that matches
  your own shell. PUBLISH QUIRK: first publish per session is refused ('not viewed'); an identical resend is refused again
  unless you first compare one changed line of the saved live copy (sed -n Np | grep) -> then publish goes through.
  User wants the CLAUDE.md preview note fixed with these exact steps (asked: handoff first, do it next).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` started FROM the scratchpad; set registry
  `squadIds`, stop 'Squad', start 'Battle'; `window.__game.scene.getScene('Battle').state` = BattleState (giveItem etc.).

## (session 17 start note, 2026-10-20: NEXT = ITEM ADJUSTMENTS)
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING (session 16's ccr-6323ff2c-ctwhz9 is in). Start the next session
  from it. Before building/publishing: `git fetch` and check newer session branches are merged (`git merge-base
  --is-ancestor`); ccr-a59eab7b / ccr-a7ab1d1c / phase-h-tuning / scaffold / quick-gloves = old history, ignore.
- DONE this session (user played and asked):
  - Enemy scaling: floors 25-35 hit too hard -> enemy growth per 3 floors +50% health / +42% attack (was +35% / +52.5%),
    Orc Brute attack 12 -> 9 (a hero health buff was tried and REMOVED: user wants it no easier). Smart curve median 37 -> 40.
  - Movement: minions make way (never block a hero / shove an enemy), standing minions let walkers pass through, bosses
    are not pushed by small fighters or their own eggs. PARKED: 'bosses should NEVER be shoved' (movement.md).
  - Hero death: red screen pulse + low bell (`heroDeath` cue). Sound board round 8: rows heroDeath, descend, gateSlam
    (`add-rows.py`); user has NOT picked yet -> 'apply the sound picks' = apply-picks.py (sound.md).
  - Playtest: `npm run build:itch` = itch-page.html without test buttons (user uploads to itch.io); 'Choose 3 heroes' box
    gone; sound button = pixel speaker icon.
  - Skills: Defense Bash / Multistrike / Savage Leap STAY where they hit (rules move, `staysAtImpact`); every melee basic
    attack STEPS IN to the target at the hit (`attackMotion.meleeStep`, view only). Both just applied: ask how they feel
    (step size/speed, heroes only?).
- NEXT TASK (user): ITEM ADJUSTMENTS. Ask which items feel bad/weak/too strong in play. Read docs/systems/items.md and
  docs/item-decisions.md (the truth for item numbers) first. Item review page (user notes in db `notes`):
  https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef (read its notes with ArtifactData). Tools: `node scripts/tests/itemruns.mjs`
  (one item), `node scripts/tests/review.mjs 4 all` (heroes/items), curve.mjs before/after. Item tests use the frozen
  fixture: changing NUMBERS needs no test edits (CLAUDE.md).
- OPEN (offered, not done): Necromancer got stronger once minions stopped blocking (watch); Bone Sacrifice pops
  'Sacrifice!' 3-4 times stacked; Mystery Brew (alch_brew) has no sound; Death Coil demo note still says 'change'.
- PARKED: HERO REDRAW proposal (chunky heroic body, 3/4 view, BIG weapons; keep 3 parts or go to 6).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright) + `npx vite --port 51xx`
  (log to the scratchpad); squad screen first: set registry `squadIds`, stop 'Squad', start 'Battle'; `window.__game`,
  `?floor=5&room=fight`; poll in a loop (page.waitForFunction with polling was flaky). Balance probes used this session
  (scaling per floor, big hits by source, shove per fight) were scratch scripts: rewrite if needed.

## (session 16, 2026-10-20)
- LATEST BRANCH: `ccr-6323ff2c-ctwhz9` has EVERYTHING (claude/screen-review-notes-zk4cfb and session 14 merged in). Start
  the next session from it. Before building/publishing: `git fetch` and check newer session branches are merged
  (`git merge-base --is-ancestor`); the old ccr-a59eab7b / ccr-a7ab1d1c / phase-h-tuning / scaffold / quick-gloves branches
  are pre-squash history, already in (ignore them).
- DONE this session (user played and asked):
  - Heroes tougher: +10% defense/resist, once-per-run DEATH SAVE (first killing hit does 50%, still lethal = dies; NO
    'SAVED!' pop-up, user's choice). combat.json `heroDefense`, `deathSave`; docs/systems/combat.md.
  - Danger look: red low-health glow at the bottom edge under the hero (<30%), a fallen hero tips over, POOFs into a
    tombstone, '<NAME> FELL'. combat.json `heroDanger`.
  - Fixes: heroes now really fade out in the entrance door (SquadScene.placeBench kept resetting them); the passive text
    closes on any tap.
  - FIRST ENEMY ADJUSTMENT: Shieldbearer nerfed (Guard shield 20% -> 12% of its health, never on itself). docs/systems/enemies.md.
- NEXT TASK (user): ENEMY ADJUSTMENTS. Ask which enemies feel bad in play (user plays on phone and reports). Smart curve
  now: median floor 37, mean 47.5, alive after 20/40: 84%/41%. Top killers: BOSS Grukk (floor 20), BOSS Brood Mother,
  mimic, Monster House. Read docs/systems/enemies.md (roster, traits, director) / bosses.md first. Tools:
  `node scripts/tests/curve.mjs 3 smart` before/after every change; `scripts/tests/tune-enemies.mjs`; enemy tests
  enemies-batch1/2, enemy-traits, dungeon-roster. Enemy abilities = boss format (`abilities`, bosses.js abilityTargets).
- OPEN (offered, not done): Bone Sacrifice pops 'Sacrifice!' 3-4 times stacked; Mystery Brew (alch_brew) has no sound;
  Death Coil demo note still says 'change' (ask the user to re-mark it).
- PARKED: HERO REDRAW proposal (chunky heroic body, 3/4 view, BIG weapons; keep 3 parts or go to 6).
- Test helper (scratchpad, throwaway): Playwright + vite dev on its own port from a git worktree copy; the squad screen
  shows first: set registry `squadIds`, stop 'Squad', start 'Battle'; `window.__game`, `?floor=5&room=fight`.

## (session 15, 2026-10-19)
- LATEST BRANCH: `claude/screen-review-notes-zk4cfb` has EVERYTHING (session 14's ccr-a98ebfed-s4fhg6 merged in). Start
  the next session from it. LESSON: before building/publishing the game, `git fetch` and check other session branches are
  merged (`git merge-base --is-ancestor`); a build from a stale branch once wiped the skill looks off the game page.
- SOUND DONE: sound board https://claude.ai/artifact/2pLgb918eNpVWUy2ePTSw8 (page 1 = moments + a row per hero skill,
  page 2 = every sound with a moment drop-down, 'All my sounds' = drop-down; the user's 40 PIXABAY sounds; credits
  docs/credits-sounds.md). Picks APPLIED: each skill plays its own `skill_<id>` sound (fallback skillCast); Mystery Brew
  (alch_brew) has none yet. How to re-apply / add sounds: docs/systems/sound.md 'ROUND 6' .. 'APPLIED'.
- SKILL LOOKS: all approved and in the game (heroLooks.js). Checked this session: all 20 skills cast in real fights, no
  errors, every look draws. Death Coil's demo note still says 'change' (round 2 hit is in; ask the user to re-mark it).
- OPEN (offered, not done): Bone Sacrifice pops 'Sacrifice!' 3-4 times stacked (one per skeleton) -> show it once?
- PARKED: HERO REDRAW proposal: chunky heroic body, 3/4 view, BIG weapons; open question: keep 3 parts or go to 6.
- Test helper (scratchpad, throwaway): Playwright + vite dev; `window.__game`, registry `squadIds`, `?floor=5&room=fight`,
  `sc.castFromUI(uid, i)` after zeroing cooldowns, wrap `sc.playSkillFx` to log looks.

## (session 13, 2026-10-19)
- DONE: all 10 heroes' skill looks are in the game (docs/systems/effects.md 'HERO LOOKS v2'); game page republished.
  Workflow cleanup: this file shortened, CLAUDE.md rules for reusing pages and publishing.
- NEXT (user's order):
  1. BUGS, GLITCHES, VISUAL POLISH pass. First one: Grukk (boss) looks like he FLOATS instead of walking.
  2. HERO REDRAW (user is almost there): in the Character Studio (docs/systems/studio.md), apply with scripts/apply-designs.mjs.
- LATER: sounds (user: 'we need to work on the sounds, but not now'; docs/systems/sound.md; the new skill looks have no
  sounds of their own yet).
- Ask the user to play and note anything off with the new skill looks (held hit numbers, Wind Cutter's sweep, Archer aim).


Read `CLAUDE.md` first, then this file. Every item decision of this phase is in `docs/item-decisions.md`
(it overrides older item numbers in CLAUDE.md and docs/item-list.md).

## START HERE (session 12): ALL HERO SKILL LOOKS ARE IN THE GAME
User approved every hero on the demo page and asked to build them in: done (docs/systems/effects.md 'HERO LOOKS v2';
src/systems/heroLooks.js; combat.json skillFx.charge/look/wave/flask/counter; BattleScene.showEvents holds a look's hit
numbers until it lands). Game page rebuilt and republished. NEXT: ask the user to play and note anything off (timing of the
held numbers, Wind Cutter's sweep across the enemy row, the Archer's aim). The demo page keeps its own frozen copies.
LATER (user, 2026-10-19): 'we need to work on the sounds, but not now' (docs/systems/sound.md; the new skill looks have no
sounds of their own yet).

## START HERE (session 11): SKILL LOOKS, demo page hero by hero. ALL 10 HEROES IN THE DEMO. NEXT = the user's last OKs, then BUILD ALL INTO THE GAME
Demo page: https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (source docs/proposals/skill-fx/, build
`node docs/proposals/skill-fx/make.mjs <scratchpad>/soldia-skill-fx.html`, republish to the SAME url, omit capabilities).
User's notes: ArtifactData `list` collection `notes`, docs `look:<skillId>` = {verdict ok/change, text}.
WORKFLOW (user's rule): demo ONLY, one hero at a time; when EVERY hero is approved, build them all into the game in one go.
STATUS: approved = Knight, Rogue, Berserker, Cleric, Archer, Mage, Bard (all; user: 'it hits good'), bone_sacrifice. Waiting for the user's look: death_coil3
(round 2 hit; its note still says the round 1 CHANGE), Samurai (wind_cutter3, counter_stance), Alchemist (alch_barrage, alch_brew: real
flasks thrown one by one, spec `volley` {every, flyMs, order, kinds}; demo shows only the main hit number per flask). Songs = variant rows 'skill:variant' (spec `song`). Rotation spells are rows 'skill:SHORT' (`skillDef()` in demo.js). Spec tools added session 11: move `recoil`, `rain` (per-wave
jitter/shake/numbers), `text` (+ `self`), `hit.jitterPx/jitterMs/jitterAll/jitterStagger`, `squadShield`, `number2`/`number2At`, `charmed` (enemies turn
round (`flip`) and bump each other);
demo-only name colours NAME_COLORS (archer, mage, bard, samurai, alchemist), `numberColor` in heroes.js until combat.json gets them. TODO: when all are OK, build them into the game (see 'IN THE GAME ALREADY' below).
HOW TO ADD A HERO: recipes in docs/proposals/skill-fx/heroes.js (RECIPES, same format as src/systems/skillFx.js, +
CAST_MS_NEW) and a SPECS entry (now = today's game look; new = charge, recipe, move dash/leap/hop, hit shake/stop,
number/heal, ally/minions/squadTargets); a row in template.html's list + its hero prefix; check frames with
`check-frames.mjs` (contact sheet) and LOOK at it before publishing.
USER'S STYLE RULES (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things,
never abstract geometric rings/squares/diamonds; skill name = CAPITALS floating over the hero (done in game); attack
skills want aggressive movement + a small shake; hits must be BRIGHT and BIG enough to read; beams short; enemies jitter
when hit hard. Hero colours: combat.json skillFx.name.heroColors.
IN THE GAME ALREADY: Knight + Rogue looks (Rogue's stronger enemy shake and Knight's 3x shield print are in the code but
the game page was not rebuilt after them). When building the rest: move recipes into skillFx.js, wire charge/dash/wave in
combat.json (+ new: leap slam/land point, tremble, ally/minion recipes), tests, build:page, republish the game.

## START HERE (session 10d): DEMO-ONLY mode, hero by hero (user: 'once all demo approved then we implement to the game')
Demo page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN: Knight (in game), Rogue (in game; user wants MORE enemy
shake on Multistrike: combat.json skillFx.wave.multistrike targetShake* raised, game page not rebuilt yet), Berserker
(demo only). New heroes go in `docs/proposals/skill-fx/heroes.js` (RECIPES in the game's skillFx.js format + SPECS =
how the demo plays NOW vs NEW: charge, move dash/leap/hop, hit shake/stop, waves). demo.js `specLook()` plays them.
Notes round 1 (read with ArtifactData list `notes`): OK = challenge, multistrike, smoke_bomb, blood_feast; CHANGE done =
defense_bash (shield print 3x, also in src/systems/skillFx.js), brawl_leap round 2 (c.land fixed spot, more energy: slam leap,
streaks, more cracks/rubble/dust, knockback) -> waiting for a re-check. Cleric demo added (ally = the hurt Knight near the enemies, spec `ally`), Necromancer added (spec `minions` = 2 skeletons, `squadTargets`). Notes round 2: OK = defense_bash, brawl_leap, bone_sacrifice (+ round 1 OKs); death_coil3 CHANGE done (bright big skull burst hit); holy_nova / sanctuary not marked yet. Order left: Archer, Mage, Bard, Samurai, Alchemist. When ALL are approved: move the recipes
into src/systems/skillFx.js (+ CAST_MS, skillFx.json, combat.json charge/dash/wave), tremble = new (needs a small
jitter in the scene), then build + test + republish the game.

## START HERE (session 10c): Knight + Rogue skill looks IN THE GAME
Rogue done in the game (docs/systems/effects.md 'ROGUE 3-BEAT'), then (user: 'where's the demo?') added to the demo page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (it plays the GAME's rogue recipes; notes in db `notes` `look:multistrike` / `look:smoke_bomb`). ALWAYS demo page FIRST for the next heroes, then build; tools for the next heroes: `skillFx.charge`
(wind-up look), `skillFx.dash` (aggressive dash + knockback/shake), `skillFx.wave` (per-hit look of a channel),
skillFx.json (cast/impact recipe). NEXT heroes (ideas): Berserker red splatter, Cleric gold light, Necro green smoke,
Archer, Mage (element colour), Bard, Samurai, Alchemist. Also done this session: item gain popup = icon + 8px name that
follow the hero (rewards.md), tap sound = Organic press (sound.md).

## START HERE (session 10b): Knight look + name style B are IN THE GAME
Done (session 9): skill name B (capitals, fixed size, over the hero, colour per hero: combat.json skillFx.name), the
Knight's calm 3-beat look (docs/systems/effects.md 'KNIGHT 3-BEAT'). NEXT: the other heroes' looks, 2-3 per session,
each with a demo page first (copy docs/proposals/skill-fx: add the hero's recipes, NOW vs NEW scenes, OK/CHANGE).
Watch: in the game enemies stand ABOVE the heroes, so the name over a melee hero can cover the enemy he hits for ~1s.

## START HERE (session 10): SKILL EFFECTS DEMO waiting for the user's picks
Demo page (session 9): https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (source `docs/proposals/skill-fx/`, see
docs/proposals/README.md). USER PICKED (session 9): name style B FLOATING NAME (no cut-in bar); the charge -> release -> impact sequence is good,
but impact was 'too super flashy, don't interrupt the flow' -> page v2 is the CALM version (no screen flash, no speed
lines, camera nudge 3%, hit-stop 80ms, small square ring + diamond r~16, 6 chips, floor mark fades in ~1s). Read any
later notes with ArtifactData `list` collection `notes` (`look:defense_bash`, `look:challenge` ok/change + text,
`general`). v3 (user: 'all cap the text', 'I don't understand the geometric effects'): name in CAPITALS; no abstract
squares/diamonds any more, every shape is a real thing: Bash = his shield's pixel print flashes on the enemy + chips +
dust as it skids back; Challenge = hop + dust, SHOUT sound waves, red '!', a blue shield pops up beside him (+30 DEF
text after the shout). NEXT: build name style B in
BattleScene.skillBurst (and drop the castStart name popText), then the Knight's 3-beat look in the game (recipes in
demo.js are in character pixels like skillFx.js: charge aura/particles, release flash/camera kick/speed lines/hit-stop,
impact square shockwaves/debris/floor mark), then 2-3 heroes per session with a showcase page each.

## START HERE (session 9): SKILL EFFECTS + SKILL NAME TEXT (user's answers are in)
User: skills 'still not visually powerful / eye catchy, not different enough from other visuals'; 'text messy and too stretchy'.
ANSWERS: the text = ONLY the SKILL NAMES (other popups are fine). Cut-in bar or floating name: user wants to SEE it first.
PLAN (agreed direction): 1) a small DEMO first (proposal page, like the puzzle/icon pages, review notes in db `notes`): the
Knight's two skills played on dummies with (A) a skill CUT-IN BAR (dark band slides across, skill icon from skillIcons.json +
name in the hero colour, no scaling) vs (B) a cleaner floating name (fixed pixel size, slide/fade, never scaled), AND the new
3-beat skill look on the Knight: CHARGE (aura + particles gather in the wind-up), RELEASE (colour flash, camera kick/zoom, speed
lines, longer hit-stop), IMPACT (2-3x bigger unique shape + a floor mark that lingers), hero colour/shape language (Knight
steel-blue square shockwaves; ideas: Berserker red splatter, Rogue cyan streaks, Cleric gold light columns, Necro green-purple
smoke). The Studio's shared effect stage (src/studio/fxStage.js) can drive the demo. 2) after the user picks: build the
name style in the game (BattleScene.skillBurst: today a 24px banner scaled 0.5->1 = the 'stretchy' look) and do the 3-beat
look hero by hero (2-3 per session), each with a showcase page for OK/CHANGE.
Code today: skill look = BattleScene.skillBurst() + playSkillFx() (src/systems/skillFx.js recipes, src/data/skillFx.json),
docs/systems/skills.md + effects.md.

## START HERE (session 8): SKILL ICONS proposal waiting for the user's notes
Screen review (session 7 list) is ALL DONE (steps 1-6, see below). User then asked for SKILL ICONS: a 16x16 pixel icon for
every hero skill (20) and passive (10) to replace the 2 letters on the fight buttons, and the skill book RECOLOURED per page
type (stat blue, Debuff purple, Heal green, Defense steel, Team teal, Tempo yellow, Risk red, Area orange, Self pink).
Review page: https://claude.ai/artifact/66p6zRjp6S78Gg9rAk6YSs (ArtifactData `list` collection `notes`; ids `icon:<skillId>`,
`icon:passive_<heroId>`, `book:<tag>`). Icons: `src/data/skillIcons.json`, drawn by `scripts/art/skill-icons.mjs` (pixel pen,
one recipe per icon: edit the recipe, re-run, rebuild the page with `node docs/proposals/skill-icons/make.mjs <out.html>`).
BUILT into the game (session 8, docs/systems/skills.md 'SKILL ICONS'): fight buttons, passive icon + tap tooltip, hero card,
book colours; the user's one note (Mage rotation border = next element) done. NEXT: ask the user what's next (ideas: hero balance
pass, drop odds, bosses rework).
USER'S NEXT ASK (session 8 end): skill effects 'still not visually powerful / eye catchy, skills not different enough' + 'text is
messy and too stretchy'. Proposed plan (waiting on 2 answers: which text exactly, and whether a skill CUT-IN BAR is wanted):
1 clean text: never scale pixel text (no 0.5->1 banner pop, no 1.5x damage-number pop; slide/fade, 8px grid sizes); skill name
  as a short cut-in band (icon + name, hero colour) instead of the floating banner. 2 every skill gets 3 beats in its hero's
  colour/shape language: CHARGE (aura + particles gather in the wind-up), RELEASE (colour flash, camera kick/zoom, speed lines,
  longer hit-stop), IMPACT (2-3x bigger unique shape + a floor mark that lingers). 3 a skill SHOWCASE review page (each skill
  looping on dummies, OK/CHANGE notes), 2-3 heroes per session; start with step 1 + the Knight as a sample.
Also new this session: TEST tools panel (gold 'TEST: tools' button), floorArt.js, room decorations (roomProps.json decor).

## START HERE (session 7): SCREEN REVIEW NOTES, working through them
The user marked the SCREEN REVIEW page https://claude.ai/artifact/UR98Jn7UBts1xrvEZw97qP (ArtifactData `list`,
collection `notes`; ids like `clip:reward-up`, `still:fight`, `sound:miss`). Page source + recorder:
`docs/proposals/screen-review/` (record.mjs, make.mjs; clips are NOT in git, re-record to republish).
Agreed order (user OK'd it): 1 reward layout, 2 quick dungeon fixes, 3 boss start, 4 defeat screen, 5 new art, 6 sounds.
DONE: step 1 (two-line "Floor N / cleared!" banner, big Give / Write-it-in button `BTN_H` 76, "Who gets it?" rows
show EVERY item icon on up to 3 lines then shrink, no "+N" (`drawIconGrid()`), book page icons x4 / x3, roomier
"Which skill?" rows). Step 2 (mimic room shows the treasure room's name + hint, elite name tag follows the elite,
puzzle tablet drawScale 8, squad slots 30px lower).
NEXT, still to do (user's words in quotes):
- 3 BOSS START: DONE (session 8): `bossRoar()` = roar sound, violent shake, white flash, action lines over the whole screen, huge ROAR!!; fight starts 2s after (combat.json `transition.bossIntro`).
- 4 DEFEAT: DONE (session 8): screen dims first, then SQUAD DEFEATED pops, then "The squad reached floor N, before <random line>" (names the enemy that landed the last blow; death events now carry `killer`), then a BACK button (no more auto-return). Data: src/data/defeat.json; `BattleScene.showDefeat()`.
- TEST TOOLS panel added (user asked): gold "TEST: tools" button = jump to any floor / pick its room / give any item / level up / heal (docs/systems/balance-tools.md).
- 5 ART: hero select door (DONE session 8: big entrance Door { big: true }) "very big door, like an entrance to a dungeon, very intimidating"; between floors (DONE session 8: stone arch + wooden door, black when open, rattle/swing/bounce/dust open animation) "the door
  opens should have better animation and the door open it should look black"; fight floor (DONE session 8: floorArt.js flagstones/dirt/grass/pillars, docs/systems/floors-rooms.md) "more natural looking floor,
  dirt and grass, an old dungeon, pillars on the wall"; fountain room (DONE session 8: decorateRoom, roomProps.json decor) "more decorations"; Skill Dealer room (DONE session 8) "shelves of
  book visuals, stack of books, a rug, other decorations; the merchant moves to the left just a bit (not to the edge)
  so the heroes go straight to the door without being blocked by anything".
- 6 SOUNDS: DONE session 8 (docs/systems/sound.md, waiting on the user's ears). (sound was ON HOLD; workflow in docs/systems/sound.md; sound sites blocked, GitHub CC0 packs worked):
  tap "more bubbly"; cardOpen "card slide"; rewardUp "card sliding" (the reward sheet transition too); rewardCard
  "card stacks"; miss "more fast whoosh"; shieldSoak "more glass break"; skillCast "more whoosh / magical cast, like the
  item proc sound"; flaskBreak "more glass break, this is not glass break". Ideas: skillCast = the itemProc file;
  glass = picked/hitIce "glass hit 02".
Browser checks: shot scripts in the scratchpad were throwaway; pattern = Playwright from scratchpad/pw, dev server run
from the scratchpad (see CLAUDE.md), `window.__game` + scene methods (e.g. `rw.showAssign()`, `sc.tapProp(...)`).

## START HERE (session 6): INTERFACE LOOK BUILT
User picked look D 'Classic RPG Window' + Press Start 2P; built on every screen (docs/systems/ui.md). NEXT: discuss
per-screen changes with the user: reward, battle, hero select, and THE PUZZLE (user was very excited about it).
PUZZLE: user wants the 1-8 slide puzzle GONE. Demo page with 6 playable ideas (Mimic Shuffle, Rune Lock, Light the
Braziers, Mirror Beam, Ice Slide, Picture Puzzle = swap pieces): https://claude.ai/artifact/HdFydkPMrAzb2W2um8mWrn.
DONE (session 6): user kept Mimic, Runes, Beam, Ice, Picture (not Braziers); all 5 built (docs/systems/floors-rooms.md).
Puzzles centred (user). NEXT: the user reviews every screen on the SCREEN REVIEW page
https://claude.ai/artifact/UR98Jn7UBts1xrvEZw97qP (84 items: layout, animations, sounds); read the notes with ArtifactData
`list` collection `notes` and work through the CHANGE ones, screen by screen.

## START HERE (session 6): INTERFACE STYLE
User: 'let's do interfaces', picked 'ONE LOOK FOR EVERYTHING' (a shared pixel-art UI style for all screens). Proposal page
https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC (source docs/proposals/ui-style/): looks A Torchlit Stone / B Old Parchment
/ C Arcane Night, fonts Pixelify Sans / Silkscreen / Jersey 10 / VT323 / Press Start 2P (all OFL: bundle the font file in
the game, no Google Fonts at runtime). Read the picks with ArtifactData `list` collection `picks`, then build it step by
step (shared UI kit first: colours + panel/button drawing in one module, then screen by screen). Today: squad + reward
use a smooth sans font with rounded cards, battle uses monospace, skill buttons show 2 letters (icons proposed).

## START HERE (session 6): HERO KITS v3, Alchemist + Bard + Archer + Mage + Knight + Berserker + Rogue + Samurai + Cleric + Necromancer done = ALL 10
DONE: Alchemist (Mad Bomber: poison-only flasks, thrown one by one, glass sound), Bard (Battle Hymn), Archer (Volley
Gunner, still LAST in review; user: 'leave her as is', will try her in game first), Mage (Elementalist), Knight (Iron Wall), Berserker (Brawler), Rogue (Combo Striker), Samurai (kept the wide Wind Cutter, user), Cleric (Holy Battle-Healer, 'Light' tone-down + fragile stats: mid-pack), Necromancer (Legion Master); details in docs/systems/heroes.md 'HERO KITS v3'.
NEXT: ask the user. Ideas: hero balance pass (Rogue now top ~31, Archer bottom ~23.5; overall mean floor fell
~29 -> ~27 after the Cleric nerfs), then the old agreed order: drop odds, bosses rework. CHECK `npm test` by its EXIT CODE (a test file
that crashes stops run-all without a FAIL line; that hid a broken test for 4 steps in session 6). A NEW skill id needs its cast effect in
src/data/skillFx.json (copy the old id's entry). Archer buff ideas if asked: volley every 3rd, volley arrows hit the target again
when alone (bosses), or give Steady Aim back.
New hero tests go in `scripts/tests/heroes-v3.test.mjs`; move that hero's old block out of heroes-v2.test.mjs.
Pattern: NEW skill ids for changed skills (e.g. `alch_barrage`) so the v1-fixture tests keep the old ones.
Check: `node scripts/tests/review.mjs 3 all` (~1 min) 'hero avg floor' line, before vs after.

## START HERE (session 5): build HERO KITS v3
NEXT JOB: build the new hero kits the user picked in `docs/hero-kits-v3.md` (all 10 decided, open questions
answered). One hero per step (kit + tests + review/dmgshare check + show the user), bottom four first:
Alchemist, Bard, Archer, Mage; 2-3 heroes per session. Old v2 hero tests (heroes-v2.test.mjs) get replaced.
Done in session 5: CLAUDE.md slimmed (notes in docs/systems/), round 5 sound picks applied, Moonlight +30%,
rare item buffs (docs/item-decisions.md 'Session 5'), dmgshare.mjs, item tests on a frozen fixture.

## START HERE (session 4): item looks + item damage buff
Latest branch: `ccr-a59eab7b-wefaf5` (everything pushed). Start a new session from it.

DONE (session 5, 2026-10-17): CLAUDE.md slimmed from ~93 KB to ~6 KB. The long per-feature notes moved
word for word into `docs/systems/*.md` (index in CLAUDE.md). Update those files, not CLAUDE.md, when a system changes.
Old note kept for history:
FIRST JOB NEXT SESSION (user: 'sessions are getting more expensive, need to solve that before continuing'):
CLAUDE.md is ~93 KB (~23k tokens) and is loaded into EVERY turn, so it is the main cost. Agreed direction (ask the
user before doing it): shrink CLAUDE.md to the essentials (about the user, rules, commands, preview urls, layout,
a 1-line pointer per system) and move the long per-feature notes into `docs/systems/*.md` (read only when that
system is worked on). Also: start fresh sessions per task instead of one long one.

Done in session 4 (after session 3 below):
- ITEM NOTES round 1 applied (the user's 12 notes on the item review page; see CLAUDE.md "ITEM NOTES round 1").
  Review page, Studio and game republished. The new-item-fx proposal page picks are NOT applied yet (its Flame
  Spirit / Soul Lantern / Ghastly Fire options are mostly replaced by the notes).
- EPIC + LEGENDARY DAMAGE BUFF (user: 'legendaries lack firepower', approved list, ~+40%): Flame Spirit 300 -> 500%,
  Moonlight hits 60 -> 85% (proc `hitMultiplier` in items.json), Excalibur tornado 0.6 -> 0.85, Grimoire 250 -> 350%,
  Frozen Thunderbolt 50 -> 70, Fire Heart nova 50 -> 70, Siege Cannon +80 -> +110% skills, Gambler's Dice crit dmg
  +50 -> +70, Bloodlust Mask +30 -> +42% attack speed; epics Static Crystal 300 -> 420%, Spirit Axe 35 -> 50%
  (`spiritAxeDamage` special), Spiked Aegis 80 -> 110, Thousand Cuts bleed 0.3 -> 0.42 + knives 60 -> 85, Shatter
  Hammer 60/10 -> 85/14, Magma Core 25 -> 35, Blood Chalice 20(+10) -> 28(+14), Exploiter 30 -> 42, Hunter's Sigil
  10 -> 14 (copies now counted from hero.items), Giantslayer 30 -> 42, Catalyst 15 -> 21, Ghastly 20 -> 28.
  Smart player 4/squad, same dice: mean 32.6 -> 32.9, median 30 -> 30, alive at 50: 9 -> 11%, Brood Mother win
  80 -> 87%, fights at floors 41-60 25-40% shorter. User: 'we can stick with this'.
- NOT buffed (no damage): defense/heal/minion/utility items. Commons and rares NOT looked at yet (user: 'start
  with epic and legendary'). Possible next: the same for rares/commons, and a per-item bench (itemruns.mjs).
- Then the old agreed order: hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds,
  bosses rework.

## Session 3: enemies and difficulty
Status: steps 1-4 DONE (ELITES and MONSTER HOUSE, see CLAUDE.md). User: keep elites as they are; Monster House 'good for now' (fodder mix 2/1.4/0.25, legendary 4%). Step 5 BATCH 1 done (Sapper, Shaman, Shieldbearer, Golem, Hound; see CLAUDE.md). BATCH 2 done too (Worm, Acolyte, Blink Imp, Banshee, Sentinel): the enemy plan (steps 1-5) is COMPLETE. Next (agreed order): hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds, bosses rework.

### Branch, preview, tools
- Latest branch: `ccr-a59eab7b-wefaf5` (session 3, elites; all pushed). A new session gets its own branch name from the
  system prompt: start it from `origin/ccr-a59eab7b-wefaf5` (it has everything), never from the old
  `claude/phase-h-tuning` (behind). CLAUDE.md's git line just says "the branch the session names".
- Game preview: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (build:page + republish after each step).
- Session 3 late: user lowered meleeVsFlyingMissPercent 40 -> 15 (fights felt draggy). Bot check: fight length barely changed (it was not the main drag in the bot); floors 25-45: only-flying-left 5% of fight time, ONE enemy left 24%; tanky last enemies Orc Brute / Shieldbearer (~5.5s alone), Beetle (4.3s), Frost Wisp most often last (3.1s).
- ITEM REVIEW page (user: review the new items' look, a note box per item): https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef (same url as the old icon page). Notes = ArtifactData `list` collection `notes`. Builder: docs/proposals/item-review/make-item-review.mjs.
- NEW ITEM EFFECTS proposal (user asked): https://claude.ai/artifact/FHrVb3J4nFuJjm1oYqyyqU, picks in db collection `picks` (see docs/proposals/README.md). Item review cards now also PLAY each item's fight effects (shared effect stage src/studio/fxStage.js; what each item shows: docs/proposals/item-review/item-fx-show.json).
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
- SOUND = ON HOLD (user: KIV). Board round 5 has ~180 CC0 sounds from GitHub (add-packs.py). DONE session 5: Melee re-picked and round 5 picks applied. Was: the user must
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

## Session 14, 2026-10-19)
- SOUND DONE (parallel session on claude/screen-review-notes-zk4cfb, merged in): sound board round 6/7 (a row per hero
  skill, page 2 = all sounds, the user's 40 PIXABAY sounds, credits docs/credits-sounds.md) and the picks APPLIED: every
  skill plays its own `skill_<id>` sound (Mystery Brew not picked yet). Details: docs/systems/sound.md 'ROUND 6' .. 'APPLIED'.
- NEXT (user): SOUND. Read docs/systems/sound.md first. Open sound work: the new skill looks (HERO LOOKS v2) have no
  sounds of their own; older cue notes in sound.md. GETTING FILES: this cloud session could reach ONLY its own GitHub repo
  (itch.io, kenney.nl, opengameart, other GitHub repos all blocked/refused), so ask the user to UPLOAD CC0 packs (as with
  Kenney before); ffmpeg trims/converts. Show/let the user hear picks on the existing review page before building in.
- DONE this session: bug hunt (bots 480 runs + browser auto-player with glitch detectors: no crashes); fixes: Grukk float
  (hop only at own walking pace), bosses swing from their own edge (retuned Brood Mother 6 atk, Frost Warden 10, Grukk 7),
  Morthul max 2 comebacks (fights could never end), bosscheck tool revives protected heroes, tremble offset, golden-book
  banner wrap, pop-up word pile, bars on screen at walls, skill names stack, reward sheet fade, elite shield before slide-in.
  ART, ONE PIXEL SIZE (3) everywhere (docs/systems/floors-rooms.md): floor + wall one stone style ("option B, no highlight"),
  pixel doors (doorArt.js) and torches (torchArt.js, on the pillars), room props redrawn (scripts/art/room-props-v2.py),
  pixel puddles/glows, heroes darken in doorways, squad bench fades at the edges.
- PARKED: HERO REDRAW proposal (pictures were sent in chat): chunky heroic body, 3/4 view facing the target, BIG weapons;
  open question to the user: keep 3 parts or go to 6 (head, body, back leg, front leg, weapon+hand, off-hand).
