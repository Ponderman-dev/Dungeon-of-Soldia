# Saving, unlocks, squad select

progress.js, unlocks.json, SquadScene.
Moved out of CLAUDE.md (2026-10-17). Keep this file up to date when the system changes.

- **Saving and unlocks (Phase F):** `src/systems/progress.js` (no Phaser) saves to localStorage key `dungeon-of-soldia-save-v1`: stats (`bestFloor`, `totalKills`, `totalFloors` = floors cleared, `runs`), `seenUnlocked` (for the NEW tag), `unlockAll` (toggle), `lastSquad`. Every storage call is wrapped (blocked/damaged storage = fresh start, never a crash; tests inject a fake storage). A run is saved when the squad is defeated (`recordRun`: floor reached, `BattleState.kills`). Hero unlocks live in `src/data/unlocks.json`: Knight, Rogue, Archer start unlocked, every other hero has ITS OWN requirement (type `bestFloor` / `totalKills` / `totalFloors` / `runs`): Berserker reach floor 5, Mage defeat 100 enemies, Cleric reach floor 15, Samurai clear 60 floors in total, Bard play 10 runs, Alchemist reach floor 30, Necromancer defeat 1000 enemies. The toggle "Unlock every hero (test)" on the squad screen unlocks all (saved). SQUAD SELECT (`SquadScene`, scene 'Squad', rebuilt from the user's sketch, then SIMPLIFIED on request: one short top line; slots = a soft floor shadow (empty: a faint pale ring and '+'), hero name BELOW the shadow and a small 'Send back' pill under each filled slot; the bench is just heroes in a row on the floor with soft shadows (no boxes), pager dots and arrows; small RANDOM pill (no screen flash), tiny test toggle; locked heroes are black shapes named '? ? ?'): drawn as the dungeon's entrance room (brick wall, door with torches). All 10 heroes stand on a purple BENCH strip at the bottom (drag left/right or tap the arrows to scroll; locked heroes are dark shapes named 'Locked'). Tap a hero = a big DETAILS CARD (portrait, role + type, summary, team perk, passive, attack/support skill with cooldowns, TIPS; heroes.json `role`, `summary`, `tips`) with CHOOSE THIS HERO (walks up to the first empty orange SLOT), SEND BACK TO BENCH (for a hero in a slot; tap a slot hero to open its card), LOCKED (shows the requirement + progress) or, when the squad is full, CHOOSE anyway: the hero in the LAST slot walks back to the bench and the new one takes its place (user's choice; a line says who goes back). Slots: `src/systems/squadSlots.js` (slot order = battle order left/middle/right; test `squad-slots.test.mjs`). The game opens on it and returns to it after every defeat (last run line + NEW heroes); the last squad starts in the slots. RANDOM SQUAD swaps in 3 random unlocked heroes (they walk). When all 3 slots are filled a pulsing BEGIN DESCENT button appears over the door: the squad walks into the glowing door one by one, the screen fades and the run starts (registry `squadIds`, read by BattleScene). The old TEST squad button is gone; instead DebugScene has a yellow "TEST: restart run" button (under the auto-reward button, always on top) that gives up the current run (nothing saved) and goes back to the squad screen (`scene.run('Squad')`, not `start`, so the debug scene stays alive). Tests: `progress.test.mjs`.
- **Squad screen layout (screen review, after the big entrance gate):** top to bottom: the gate on the wall, the 3 squad slots just in front of it (`SLOTS` y 342 / 392), the hero bench (`BENCH` top 476, feet 620), then BEGIN DESCENT (`BEGIN_Y` 712, only when 3 are picked) right above RANDOM (774) and the test toggle (818). The big buttons sit at the bottom (thumb reach) and nothing covers the gate. Bench heroes FADE near the screen edges while scrolling (`BENCH.fadeFrom` / `fadePx`; user: they popped away at the corners).
- **Entering the dungeon (user):** BEGIN DESCENT opens the big gate (a deep THUMP, cue `gateSlam`), the squad waits 1s, walks in one by one, then a slower fade to black (combat.json `transition.squadEnter`: waitMs, staggerMs, fadeMs).
- **PLAYTEST BUILD (itch.io, 2026-10-20; how to publish: `docs/itch-publish.md`):** `npm run build:itch` (VITE_TESTER=1) makes `itch-page.html` = the game in one file WITHOUT the test things (DebugScene buttons not launched in BootScene, no 'test: unlock every hero' toggle in SquadScene). Upload that file on itch.io as an HTML game (viewport 390x844, mobile friendly, portrait). The 'Choose 3 heroes' box at the top of the squad screen is gone (user); 'Last run: floor N' still shows after a run. The sound on/off button is now a pixel SPEAKER ICON top right (waves = on, grey with a cross = off; drawn with Graphics in SquadScene.drawUi, under the TEST buttons in the normal build).
- BOTTOM ROW + ROOMIER BUTTONS (user, 2026-10-22): '< CAMP' (left) and RANDOM (right) share the bottom row (150x46 each, y 744); '< CAMP' = `SquadScene.toCamp()`, the screen slides DOWN back into the camp hub (reverse of `BaseScene.toExpedition`, `camp.json ui.slideMs`). More space between box and text (user): BEGIN DESCENT 300x56 at y 700, Send back 104x30.
- Session 37: the save also keeps `settings` (Settings screen, systems/settings.js), `profile` (name, hero, banner),
  `achievements` (ids) and more lifetime stats (playMs, bossesBeaten, bossIds, itemsFound, heroRuns, deaths; recordRun).
  `deleteProgress()` wipes it (Settings DELETE SAVE).
- **SQUAD SCREEN REDO, 3 LAYOUTS ON TRIAL (session 47, user: 'full new layout', then 'do all three'):** the scrolling
  bench is GONE. `SquadScene` keeps the rules (slots, walk, choose / sendBack, details card, descend, camp slide);
  `src/scenes/squad/squadLayouts.js` (mixed into the prototype) draws the middle per layout, `LAYOUTS` = slot spots,
  hero scale, where a hero comes from / goes back to. A small 'LAYOUT A/B/C' button bottom left (not in the itch /
  demo builds) flips them (registry `squadLayout`, scene restart). A ROSTER: squad in front of the gate, an INFO PANEL
  for the tapped hero (name, role, team perk or unlock line, passive / attack / support rows with icons, ADD / REMOVE
  + DETAILS = the old card), all heroes as a 5x2 TILE GRID (gold frame = shown, gold number = its slot, faint =
  standing in the squad, grey frame + dark = locked, green NEW tag). B SHOWCASE: one hero BIG in front of the gate
  (swipe or < > arrows, 'n / 10'), the same info panel under it (ADD / REMOVE + DETAILS at its bottom), YOUR SQUAD = 3
  boxes the picked heroes stand in (a pick walks from the stage into its box; going back fades out). C SCENE + GRID:
  the squad bigger (x4) with names + Send back buttons, the tile grid under them, a tap opens the details card. A
  picked hero walks out of its tile growing to full size (and back in shrinking), drawn over the panels while it
  walks. When the user picks one: delete the other two and the LAYOUT button.
- **SAME LOOK AS THE CAMP + FIGHT (session 47, user: 'follow the main screen and battle screen designs'):** every squad
  button is the camp's FLAT button (`drawFlatButton` moved from BaseScene into uiKit, sizes `UI.flat`; pressed = darker
  face + shadow band, label sinks). BEGIN DESCENT = banded like EXPEDITION (side gap 24, 'big' text, always there:
  dim 'PICK n MORE' until the squad is full). CAMP / RANDOM sit in a DOCK (gold line + dark band, like the camp's tab
  bar) with the LAYOUT button + test toggle at its foot. Top left: a title window like the fight's floor counter
  ('Squad n/3', 'Last run: floor N' under it); the sound button sits where the fight's pause button is (pause.json).
- **LAYOUT C PICKED + NEATER (session 47, user: 'C is the best but make it neater; the walk to the boxes is weird; a
  new player has lots of empty boxes'):** A and B are GONE (`squad/squadLayouts.js` -> `squad/squadGrid.js`,
  `SQUAD_VIEW` = every spot and size). A picked hero WALKS IN FROM THE SIDE of the screen to its slot (left slot from
  the left, right slot from the right, middle from the left); Send back = walks off the side (middle: to the right).
  Under the squad: NAME PLATES (framed, all 96 wide) and Send back buttons in two even rows. TILES: no slot numbers; a
  picked tile = gold frame + a gold CHECK MARK; locked heroes = GREY shapes (`lockedWash`). LOCKED TILES ON TRIAL
  (user: 'show all types in the demo'), registry `lockedStyle`, the 'TILES: ...' button in the dock (dev + squad demo):
  `goals` = all 10, a locked one shows a padlock + its goal in two lines (unlocks.json `short`, `shortGoal()`);
  `teaser` = only open heroes + ONE '?' tile = `nextUnlock()` (the locked hero closest to its goal) + 'n more heroes
  to find'; `folded` = open heroes big, locked ones in a small row 'LOCKED: n'. The squad demo page now starts like a
  NEW PLAYER (3 heroes) with the 'unlock every hero' test switch. Tests: `progress.test.mjs` (shortGoal, nextUnlock).
  When the user picks a style: delete the other two + the TILES button.
- **TEASER PICKED + ADAPTIVE GRID (session 47, user):** goals / folded and the TILES button are GONE. The grid shows
  every open hero + ONE '?' tile (`nextUnlock`: grey shape, gold '?', its goal in two lines). It ADAPTS to the count
  (`gridShape(n)` in squadGrid.js): up to 4 tiles = one row, more = two balanced rows (5 = 3 + 2 ... 10 = 5 + 5),
  tiles as wide as fits (max 80, h 100, heroes x3), the block centred between the Send back row and BEGIN DESCENT;
  'n more heroes to find' only when there is one row. Squad NAMES have no box: big cream text (`goldTheme.title`,
  normal size) with a dark outline, one row (`SQUAD_VIEW.nameY`), Send back buttons in the row under them.
- **NAMES TRIAL (session 47, user: long names overlapped + crowded, 'I need to see it'):** outer slots moved to
  x 68 / 322. The labels under the squad (`buildLabels` / `drawLabel` in squadGrid.js, `NAME_STYLES`, registry
  `nameStyle`, the 'NAMES: ...' button in the dock): `slope` (default) = big names, the middle one a row higher, outer
  ones kept on the screen, a small X button beside each (= send back), no Send back row; `small` = big names that fit,
  long ones in the small font, Send back row under them; `button` = one flat button per hero with its name (small
  font) + an X (tap = send back). The grid's top follows the style (`gridTop`). Send back taps are now per-label
  pressable zones (the scene-wide tap code is gone). When the user picks: delete the others + the NAMES button.
- **SLOPE PICKED + CALMER (session 47, user):** small / button name styles and the NAMES button are GONE (`NAMES` in
  squadGrid.js: big names, middle one higher, X button beside each = send back). Outer heroes nearer the middle
  (x 90 / 300). QUIET TILES (user: the grid 'looks busy and crowded'): plain dark tile, thin dark edge, a soft shadow
  under the hero, no gold frame / studs; only a picked tile gets the gold edge + check (`SQUAD_VIEW.tile` colours),
  gaps 12. The Necromancer is shown as NECROMAGE (heroes.json name; the id stays `necromancer`).
- **ONE SCROLLING ROW (session 47, user: 'just make the hero grid scrollable'):** the two-row grid is gone. Big tiles
  (84 x 124, heroes x4) in ONE row inside a masked container (`gridBox`); if they fit (a new player: 3 + '?') the row
  is centred and still, else SWIPE it sideways (`gridDown/Move/Up`, called from SquadScene.setupInput; a drag past
  `dragPx` cancels the tile press under the finger: uiKit `zone.cancelPress()`), a small gold scroll bar under it.
  'n more heroes to find' under the bar. Sizes in `SQUAD_VIEW.grid`.
