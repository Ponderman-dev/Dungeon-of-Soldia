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

## 5. MENU SCREENS (session 35, mock-ups only, nothing built) — `docs/proposals/menu/*.png`
- GLOSSARY = a book: chapters Basics, Statuses, Enemies, Bosses, Items, Heroes (no small grey lines, user), gold found
  counts; entries fill in as you meet them (??? / dark shadow until then). Enemies = sprite grid + tap for a stat card.
  Heroes chapter = hero list + a page (stats, attack/support skill, perk, passive). Not picked yet in detail.
- HEROES button (user: lore, unlock progress, hero records, skins). First try (tabs Lore/Stats/Looks) replaced by the
  user's sketch: PICKED VARIATION C (`hero-page-variations.png`, right): one big card = the user's own pixel art on top
  (Studio), the hero big on a real dungeon floor (`floorArtPixels`) with name + role over it, swipe / arrows = looks
  (skins), look name window + dots; a small HP/ATK/DEF/RES strip; LORE and STATS buttons. Locked heroes: shadow +
  their real unlock goal and a progress bar (unlocks.json). Skins, lore and per-hero records are NEW systems.
- LEADERS button: PICKED A = PODIUM (`leaderboard-variations.png`, left): WEEK / ALL TIME tabs; top 3 stand on a stone
  podium (gold / silver / bronze numbers) on the dungeon floor, each shown by their first hero; then rows (rank, name,
  3-hero squad, best floor); your own row pinned at the bottom in gold. ALL player names the same small 8px (user).
  Tap a player (D) = their run: squad on the floor, floor reached, bosses / kills / time / ended by, item icons.
  Needs an online server (later); look only for now.
- SPACING (user, 2026-10-29: 'better border margin and white space', applied to every menu mock): back button 96x44 at
  (24,16), title at y 76, 12-16px gaps between boxes, 16px inside every box. Leaders: timer bar under the WEEK/ALL TIME
  tabs (hourglass + 'ENDS IN 3D 14:22:05', week resets Monday); ALL TIME shows a crown + 'HALL OF FAME' there
  (`leaderboard-week-alltime.png`). Glossary + Heroes redone the same way (`glossary-heroes-spaced.png`).
- SHOP button (user: sells LOOKS only, daily deals + timer, premium currency = real money / crypto; NO gold from runs):
  PICKED A (`shop-picked-A.png`): gem balance + '+' top right on every tab; tabs DEALS / LOOKS / GEMS. DEALS = the camp
  merchant (camp.json npcs 'shop') on the dungeon floor with a white speech bubble, timer bar 'NEW DEALS IN 08:14:33'
  (daily), 3 deal rows (look on a floor tile, name, hero, price with the old price struck out, red -33% tag). LOOKS =
  3-column grid (look, name, hero, price). Tap a look = try-on page (big on the floor, arrows, 'Looks only. No stat
  change.', BUY + price). GEMS = 4 packs, prices in USD ('$' is missing from the pixel font), card / SOL = placeholder.
  'Gems' is a stand-in name. Other layouts tried: `shop-variations.png`.
- SETTINGS (gear button) PICKED D (`settings-picked-D.png`; others tried: `settings-variations.png` = A paired
  buttons, B switches, C classic RPG '< value >' list). User found a lone ON button unclear ('how do I interact'), so
  every choice is shown as big buttons, the chosen one FILLED gold. Tabs SOUND / GAME / MORE; each setting is a card
  (gold name, 8px hint line, buttons under it). SOUND: MUSIC / EFFECTS = '-' bar of 10 '+' with the number top right.
  GAME: BATTLE SPEED 1X/2X (new, user asked), SCREEN SHAKE, DAMAGE NUMBERS, VIBRATION (ON/OFF). MORE: WALLET
  (CONNECT), SAVE (kept on this phone, BACK UP), CREDITS + HELP, red DELETE SAVE; version at the bottom.
- PROFILE (camp profile box) PICKED D (`profile-picked-D.png`; others tried: `profile-variations.png`). User: set ONE
  hero for your profile, a custom art BANNER, then stats and achievements. Top card = banner (EDIT top right) with the
  profile hero standing on the black name strip, NO frame or floor tile behind him (user), head over the banner art;
  CHANGE under him; name + 'Knight main' to his right. Tabs STATS / ACHIEVE.: STATS = 2-column boxes (runs, best floor,
  bosses, kills, play time, items found, top hero, deaths); ACHIEVE. = '12 / 40 EARNED' gold bar + 4-column medal grid
  (item-icon style medals, gold line = earned, dark shadow + '???' = not yet). CHANGE = PROFILE HERO page (pick big on
  the floor, 10-hero grid, locked = shadow, SET AS PROFILE). EDIT = BANNER page (YOUR ART from the Studio + '+' new,
  UNLOCKED banners from bosses / achievements, DRAW NEW IN STUDIO, SET AS BANNER). Mock banners = title forest crops.
  Mock helper (scratchpad, gone next session): node script dumps hero sprites (parts composited), floor patch, title
  layers and item icons into assets.js; HTML draws them on canvases (image-rendering: pixelated).
- GAME OVER (replaces today's `BattleScene.showDefeat()`) PICKED B (`gameover-picked-B.png`; others tried:
  `gameover-variations.png`; a first all-on-one-page try was 'not neat'). User wants EVERYTHING, split by taps: red
  SQUAD DEFEATED; run card = FLOOR / TIME / KILLS in 3 columns + gold 'NEW BEST!' tag + old best; the 3 heroes on the
  dungeon floor: TAP A HERO = that hero gets a gold 1-art-pixel OUTLINE around the sprite and pops up BIGGER (4x vs 3x;
  user: no yellow box); below, the picked hero's card: fell on floor N, damage / healing / kills / damage taken, their
  items, and the killer enemy sprite + name in red. BOSSES N and ITEMS N buttons open pages (BOSSES = each beaten
  boss big, floor, time to beat, 'next boss: floor 60'; ITEMS = icon grid, tap one = name, who held it, what it does).
  Bottom: CAMP + gold TRY AGAIN. Needs NEW run stats tracking (per-hero damage/heal/taken/kills, boss times).
