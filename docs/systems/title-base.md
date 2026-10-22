# Title page + Base (camp hub) — BUILT (session 21)

User's sketch + picks (2026-10-21). Flow: Title -> walk into the dungeon -> one hero walks in -> Base -> 'To dungeon' -> Squad.

## 1. Title page (TitleScene; Boot starts 'Title') — BUILT
- User's pick F (after rejecting a far 'pointy pines + castle' view and 3 other designs: user wants a THICK forest seen
  FROM ABOVE, round tree tops, not uniform/pointy; the tower far away; logo not at the top; Slay the Spire feel).
- Code: `scenes/TitleScene.js`, `systems/titleArt.js` (skyLayer, twinkleSpots, moonLayers, cloudLayer, canopyLayer),
  `data/title.json`, test `title-art.test.mjs`. Canopy = rows of domed tree tops (round shading, drop shadows, hazier
  far away), mountains + mist on the horizon, a lone tower on the left. Logo = stand-in text in the middle.
- Tap anywhere: UI fades, camera pans + zooms to the tower, fades out, starts 'Base' with { walkIn: true }.
- Settings (gear, top left) and the camp's NPCs/profile use `comingSoonWindow()` (entities/uiKit.js).
- Old plan notes for the title (kept for history):
- Night scene, far view from outside: night sky, full moon, clouds drifting slowly, stars twinkling softly,
  forest all around, the dungeon entrance small in the middle. Pixel art made in code (layers), user tweaks.
- Logo up in the sky near the moon. Stand-in = Ironslab text; the user will draw the real logo in the Studio later.
- Blinking 'Tap to start' (sketch: a 'Press start' button near the bottom), best floor reached (progress.js),
  settings button (empty, sound on hold), tiny version number.

## 2. Transition into the dungeon
- Tap -> move toward the dungeon entrance and fade into the camp (calm, no flash). BUILT (zoom to the tower).
- A RANDOM UNLOCKED hero walks up from the bottom to the middle of the camp (existing Character parts + walk). BUILT
  (camp.json `hero`: from, waitMs, fadeMs; NPCs and TO DUNGEON wait until it arrives).

## 3. Base = campfire camp (BaseScene) — LOOK BUILT (step 1)
- User: same look as the dungeon (a cave was 'too different'), NO wall/gate (the open top is the exit), no log seats.
- Built: `scenes/BaseScene.js`, `systems/campArt.js`, `data/camp.json`, test `camp-art.test.mjs`. The battle floors'
  flagstones with the wall cut off (`openFloor`: drawn with a wall, wall rows removed); a dark layer with solid rings of
  firelight (`darkLayer`, light.ambient); campfire (stone ring + logs, procedural flame frames, pulsing glow, sparks);
  props as pixel rows (tents, crates, barrels, sack, bedroll, woodpile), tinted by the light; `exit.path` = the walk
  round the RIGHT of the fire, between the tents, off the top (`walkOut()`). Placeholder: knight by the fire, tap
  anywhere = walk out (until step 2/3). Not wired into Boot yet.
- STEP 2 BUILT: 4 NPCs (camp.json `npcs`, Character parts: Old Scholar = Glossary, Captain = Heroes, Herald =
  Leaderboard, Merchant = Shop), names in small black windows OVER their heads (ui.tagUp), placed slightly
  staggered and away from the hero (user: 'not natural' as a grid). Tap = 'Coming soon' window (tap to close).
  Profile button top right (same window). TO DUNGEON = big black window at the top, the most visible thing (user),
  arrows bobbing both sides; tap = walkOut(), then both cameras slide (Squad comes from above, ui.slideMs).
  Floor tidier than battle floors (room.floor overrides: no dirt patches, less grass). Props: tents + one small
  stack each side. User: 'we'll get back to this later' (more polish possible).
- Campfire in the middle (the hero stands by it), tents and crates, the open top with an arrow
  and 'To dungeon'. Tap it: the hero walks up and out through the top tunnel, then the screen SLIDES UP
  into the Squad (hero selection) screen.
- 4 NPCs (2 left, 2 right), tap = window 'Coming soon': Glossary, Heroes, Leaderboard, Shop (merchant).
- Top right: player profile button (achievements, records, stats, items later) -> 'Coming soon'.
- After a run ends: back to the SQUAD screen as today (not the Base).
- All numbers (positions, colours, speeds) in a JSON file; scenes only draw.

## Build order (show screenshots before each goes into the game)
1. Camp (Base) visual DONE  2. Base NPCs + 'coming soon' windows + profile + 'To dungeon' DONE  3. Hero walk-in DONE
4. Title night scene DONE  5. Title -> camp transition + Boot wiring DONE.
Next ideas: the user's drawn logo (Studio), real screens behind the NPCs, settings.

## 4. HUB REWORK (2026-10-21, user's sketch: 'more of a mobile game menu') — BUILT
- No more walk-in from the bottom: from the title the camp just fades in (`hero.fadeMs`; Title starts Base with `fromTitle`).
- Middle: the campfire (fire.y 372, light moved with it) with 3 random unlocked heroes (`hero.spots`) that idly wander
  (`wander()`: a random spot within `radiusPx` of home, `speed` px/s, then face the fire, pause `pauseMs`).
- Top left: Settings gear (`uiKit.drawGear`, shared with the title). Top right: profile = name box ('Adventurer') + round
  portrait (`uiKit.pixelDisc`), tap = 'Coming soon'.
- TO EXPEDITION (`ui.expedition`, big window, bobbing arrows): the screen slides up into the squad screen (no walk-out).
- Bottom row: 4 square buttons (`ui.menu.buttons`: Glossary, Heroes, Leaders, Shop) with 12x12 pixel icons
  (book, helmet, trophy, coin bag), each 'Coming soon'. The NPCs are no longer drawn (`npcs` kept for later screens);
  `exit` removed. Props moved clear of the buttons.
- TO EXPEDITION text is 'normal' size (`camp.json ui.expedition.size`, was 'big'; user 2026-10-22: room between box and text). '< CAMP' on the squad screen slides back down to the hub.
- 2026-10-22 (user): TO EXPEDITION arrows are real arrows (`ui.expedition.arrow` {head, stemW, stemH} in `cell` px; the old 3-row one read as '+'), inset 36. Everything keeps 24px from the screen sides (user: 'buttons hug the sides'): expedition w 342, menu `side` 24 / `gap` 6 / h 100, settings x 24, profile right 24.
- MENU IN/OUT (user 2026-10-22): TO EXPEDITION, BEGIN DESCENT (all squad-screen buttons leave together) and '< CAMP' first move the screen's buttons out (top ones up, bottom ones down, fading; `uiKit.uiShift`, `camp.json ui.uiShiftMs` 160), then slide (slideMs), then the new screen's buttons come in. Base `uiParts` / Squad `uiParts` = what drawUi adds (split top/bottom by draw order; Send back buttons only fade). Scene data `fromCamp` / `fromSquad` = start hidden, no taps (`leaving`; Squad `shifting` keeps BEGIN / Send back drawn while they fade).
