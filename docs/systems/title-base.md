# Title page + Base (camp hub) — PLAN + progress (session 21)

User's sketch + picks (2026-10-21). Flow: Title -> walk into the dungeon -> one hero walks in -> Base -> 'To dungeon' -> Squad.

## 1. Title page (new TitleScene, Boot starts it instead of 'Squad')
- Night scene, far view from outside: night sky, full moon, clouds drifting slowly, stars twinkling softly,
  forest all around, the dungeon entrance small in the middle. Pixel art made in code (layers), user tweaks.
- Logo up in the sky near the moon. Stand-in = Ironslab text; the user will draw the real logo in the Studio later.
- Blinking 'Tap to start' (sketch: a 'Press start' button near the bottom), best floor reached (progress.js),
  settings button (empty, sound on hold), tiny version number.

## 2. Transition into the dungeon
- Tap -> move toward the dungeon entrance and fade into the camp (calm, no flash).
- A RANDOM UNLOCKED hero walks up from the bottom to the middle of the camp (existing Character parts + walk).

## 3. Base = campfire camp (BaseScene) — LOOK BUILT (step 1)
- User: same look as the dungeon (a cave was 'too different'), NO wall/gate (the open top is the exit), no log seats.
- Built: `scenes/BaseScene.js`, `systems/campArt.js`, `data/camp.json`, test `camp-art.test.mjs`. The battle floors'
  flagstones with the wall cut off (`openFloor`: drawn with a wall, wall rows removed); a dark layer with solid rings of
  firelight (`darkLayer`, light.ambient); campfire (stone ring + logs, procedural flame frames, pulsing glow, sparks);
  props as pixel rows (tents, crates, barrels, sack, bedroll, woodpile), tinted by the light; `exit.path` = the walk
  round the RIGHT of the fire, between the tents, off the top (`walkOut()`). Placeholder: knight by the fire, tap
  anywhere = walk out (until step 2/3). Not wired into Boot yet.
- Campfire in the middle (the hero stands by it), tents and crates, the open top with an arrow
  and 'To dungeon'. Tap it: the hero walks up and out through the top tunnel, then the screen SLIDES UP
  into the Squad (hero selection) screen.
- 4 NPCs (2 left, 2 right), tap = window 'Coming soon': Glossary, Heroes, Leaderboard, Shop (merchant).
- Top right: player profile button (achievements, records, stats, items later) -> 'Coming soon'.
- After a run ends: back to the SQUAD screen as today (not the Base).
- All numbers (positions, colours, speeds) in a JSON file; scenes only draw.

## Build order (show screenshots before each goes into the game)
1. Camp (Base) visual  2. Base NPCs + 'coming soon' windows + profile + 'To dungeon'  3. Hero walk-in
4. Title night scene  5. Title -> camp transition + Boot wiring.
