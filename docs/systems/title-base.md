# Title page + Base (camp hub) — PLAN (session 21, nothing built yet)

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

## 3. Base = campfire camp in the first cave (BaseScene)
- Campfire in the middle (the hero stands by it), tents and crates, cave tunnel at the TOP with an arrow
  and 'To dungeon' -> opens the Squad screen.
- 4 NPCs (2 left, 2 right), tap = window 'Coming soon': Glossary, Heroes, Leaderboard, Shop (merchant).
- Top right: player profile button (achievements, records, stats, items later) -> 'Coming soon'.
- After a run ends: back to the SQUAD screen as today (not the Base).
- All numbers (positions, colours, speeds) in a JSON file; scenes only draw.

## Build order (show screenshots before each goes into the game)
1. Camp (Base) visual  2. Base NPCs + 'coming soon' windows + profile + 'To dungeon'  3. Hero walk-in
4. Title night scene  5. Title -> camp transition + Boot wiring.
