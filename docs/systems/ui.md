# Interface look ("Classic RPG Window")

User's pick (session 6, proposal page https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC, look D + font Press Start 2P,
note: "black menu with white strokes like the early Dragon Quest style of UI").

- **STONE LOOK REVERTED (session 38):** session 37's stone windows (gothic shape + Torchlit Stone colours, commit 5627e48,
  `git show 5627e48` to get it back) looked fine in trials but the user did not like them IN ACTION on the phone; back to
  the black windows with white lines below. Lesson: check a new UI look in the real running game before choosing.
- Rules: every window, card and button is a BLACK window with a WHITE 2px line and stepped (pixel) corners. White text.
  Colour only where it means something: gold (`UI.gold`) = chosen / rarity / stacks / important numbers, red = attack,
  green = support / heals, grey (`UI.dim`) = disabled. The chosen card gets a GOLD line; a ready button gets the
  blinking ▶ cursor. No rounded rectangles, no gradients, no smooth fonts.
- Font: IRONSLAB (user's own pixel font, session 19, `src/assets/fonts/ironslab.ttf`; was Press Start 2P, whose file is
  kept for the skill-fx proposal page). Packed into the code with `?inline` and loaded by `loadUiFont()` in BootScene
  before the first screen (FontFace from bytes, never fetch: the preview frame blocks it). Its grid is 10px (capitals
  8px tall), so it is only crisp at 10 / 20 / 30 / 40px. Scenes still ask for 8 / 16 / 24 / 32px; `uiKit.js` patches
  Phaser's TextStyle once (`gridPx()`, `UI.fontGrid` {px 10, scale 1.25}) so any UI.font size becomes x1.25 rounded to
  the grid (8 -> 10, 16 -> 20, 24 -> 30): same letter height as before, no scene changes. Line spacing ~half the size.
  Characters: letters, digits, space ! " # % & ' ( ) * + , - . / : < = > ? [ ] (v2 added " # & * < = > [ ]);
  `$ ; @ \ ^ _ ` { | } ~` are MISSING (they fall back to a smooth monospace: avoid them in UI text or ask the user). Jacquard 24 and ~20
  Google pixel fonts were tried first and turned down.
- SMALL TEXT = PRESS START 2P (session 21, user: Ironslab is hard to read small; Pixelify Sans (11px grid, slanted
  corners, rough) and Tiny5 (at 16px) were tried first). Any UI.font text asked for at 8px or less
  (`UI.smallFont.maxPx`) is drawn in Press Start 2P (`src/assets/fonts/press-start-2p.woff2`, OFL) at 8px
  (`UI.smallFont.px`; its grid is 8px: crisp at 8 / 16 / 24). uiKit patches TextStyle (family + size swap) and
  Text.updateText for the small font: letters drawn one by one (letterSpacing 0.01) on whole pixels (measureText
  widths rounded up, fillText x/y rounded), then every pixel snapped to full/empty and to its fill or stroke colour
  (`snapCanvas`). Bigger sizes stay Ironslab.
- SMALL FONT = SOLDIA SMALL (session 48, user pick 'B narrow' after a demo of 4 takes): Press Start 2P's own pixels made
  PROPORTIONAL (each glyph trimmed to its ink + 1px gap, space 4px; ~30% more text per line). Renamed because the OFL
  reserves the name 'Press Start 2P'. File `src/assets/fonts/soldia-small.woff2`, made by `scripts/art/make-small-font.py`
  (fonttools; hinting removed) from `press-start-2p.woff2` (kept). Family 'SoldiaSmall' (`UI.smallFont`); same 8px grid.
- Code: `src/config.js` `UI` (font, sizes, colours); `src/entities/uiKit.js`: `drawWindow(g, x, y, w, h, {fill, line,
  alpha})`, `drawCursor(g, x, y)`, `uiText()`, `uiStyle()`, `uiButton()` (window + label + cursor + pressed = white).
- Screens done: fight HUD (floor window, skill buttons = windows with red/green letters, cooldown = grey fill draining
  from the top + the seconds), all fight texts (popups 8, big/skill numbers 16 = combat.json skillFx.numberSizePx,
  banners 24), reward sheet + "who gets it" + skill book steps, squad select + hero card, room hint window, puzzle,
  test button. Next: per-screen changes with the user (reward, battle, hero select, puzzle).
- **Defeat screen (screen review, user):** `BattleScene.showDefeat()`: the screen dims to black first, then a big red SQUAD DEFEATED pops in (small shake), then "The squad reached floor N, before <line>" (a random line from `src/data/defeat.json`: `withKiller` lines name the enemy whose hit felled the last hero, `death` events carry `killer`; `noKiller` when nobody did), then a BACK button to the squad screen (the old 3s auto-return, `restartDelayMs`, is gone). Timings and texts in defeat.json.
- **Pop-ups and bars at the edges (2026-10-19):** the same WORD popped over one fighter again within `POP_REPEAT_MS` (600) is skipped (a Samurai's 'Counter! Blocked! Counter!' pile); numbers always show. Health bars (+ Lv label, shields, chips) are clamped inside the screen when a fighter stands at a side wall (`BattleScene.syncBar`). Skill names (`BattleScene.skillName`) never land on another skill name or the 'Floor cleared!' banner: they go above them. Reward sheet: when a step changes the sheet's size, the new step's content waits hidden until the sheet has resized, then fades in (no title over the banner while it moves).
- **Speech bubbles (session 20, user idea, purely for show):** a hero says a short line in a small OFF-WHITE window (dark line + dark text, `drawWindow(..., { plain: true })` so the theme never repaints it; session 41 user: the themed dark box was unreadable) with
  a stepped tail over its head (`BattleScene.sayLine` / `placeSpeech`, the bubble follows the hero). When: the run's
  first floor after the walk-in (`start`, the fight starts at once), and every cleared floor (`clear`; `boss` after a
  boss, `fallen` when a squad mate fell that floor, `close` / `hurt` when a hero ended the floor at or below 25% / 50%
  health: that hero says it; order boss > fallen > close > hurt > clear, `dialogue.clearSpeech`, health read before the
  win heal). 'Floor N cleared!' sits higher (combat.json `transition.clearBannerY`, 422) so it misses the bubbles. Nothing waits for a bubble (user, session 21: the wait broke the pace): the clear pause is
  1.2s (`clearPauseMs`, user 2026-10-21: the bubble needs 1.2s before the reward screen); the bubble is removed `goneAfterRewardMs` (0.2s) after the reward screen pops up, never seen after it. SHORT lines (user 2026-10-22: 'too long': every line rewritten to 2-5 words, bubble `maxWidthPx` 140, `padPx` 6; 8px is the smallest crisp text). Lines + timings in `src/data/dialogue.json` (per hero; a missing kind uses `clear`); `systems/dialogue.js`
  picks a living hero (not the last speaker) and goes through all its lines before repeating. Test: `dialogue.test.mjs`.
- **THE THEME: CRIMSON AND GOLD (user's pick F, session 40; REPLACED by THE DUSK LOOK, session 49, see the end).** Colours in
  `UI.goldTheme` (config.js). uiKit: `drawWindow` -> `themedWindow` (dark outline, gold frame, dark inner edge, ember
  brown fill, pale corner studs; a gold line = chosen -> pale gold, dim -> grey; `plain: true` skips the theme),
  `drawButton` (SOLID button, light top edge, darker bottom half; text colour via `buttonTextColor()`), `drawStrip`
  (a title strip inside a panel). The old black and white ('mono') theme, the other palettes and the dev trial flags
  (`?theme=`, `?pal=`, `?frame=`, Glossary `?bar=` / `?list=`) were REMOVED. ACTION BUTTONS are SOLID (`drawButton` + `buttonTextColor()`): every back
  button ('< CAMP' / '< BACK': Glossary, Heroes, Shop, Profile, Leaders, Settings), TO EXPEDITION, TAP TO START, BEGIN
  DESCENT, CAMP / RANDOM, Send back, Profile EDIT / CHANGE / SET AS ..., Settings - / + and its row buttons, Shop gem
  price buttons, Glossary pager arrows, every uiButton (Puzzle, defeat BACK). Tabs, cards and info panels stay FRAMED
  (chosen = pale gold frame, locked = grey frame). Scene helpers take look 'solid' (Heroes, Profile, Settings,
  Glossary) or a `solid` flag (Shop, Leaders). Camp profile disc = gold ring on a panel disc. The fight HUD and reward
  sheet only got the new frames (not redesigned). Glossary chapters = one panel with a title strip (gold theme).
- Fixes (session 40, user on the phone): the TEST buttons (DebugScene) are ONE small 'TEST' tab at the top middle that
  opens 'restart run' / 'tools' under it (they covered the camp profile). TITLE: no button box any more (a tap
  anywhere starts), 'TAP TO START' in the normal size with a black outline, blinking; 'Best floor: N' in the normal
  size, gold with a black outline on a dark strip (title.json `start.size`, `best.size`, `best.stripAlpha`; the strip
  sits one depth under the text).
- BUTTON LEVELS + PAGE TRANSITIONS (session 40, user): `drawButton(..., { primary })`: PRIMARY = the bright crimson
  button: 'BEGIN DESCENT' and 'TO EXPEDITION' (user); every other solid button is SECONDARY = dark wine
  with cream text (`goldTheme.second*`, `buttonTextColor(enabled, pressed, primary)`). MENU
  PAGES (Glossary, Heroes, Leaders, Shop, Settings, Profile): `pageEnter(scene)` in create() = rises `UI.page.slidePx`
  (64) from below + fades in (220ms); `close()` -> `pageLeave(scene, done)` = drops back + fades out (170ms), taps off,
  then resumes the camp and stops the page (a second close while leaving is ignored; pageEnter resets it because
  Phaser reuses the scene object).
- MOTION (session 41, `docs/transition-plan.md`): user picked QUICK, tab content slides SIDEWAYS, pop-ups DROP from
  above, sounds later. Tokens `UI.motion` (config.js): fast 140 / normal 220 / slow 450 / story 1100 + eases.
  `systems/motion.js` (no Phaser, test `motion.test.mjs`) = the plans; uiKit helpers: `popIn/popOut(scene, parts,
  shades, onDone)` (window drops popDropPx from above with a small settle, a tap while it drops finishes it; the shade
  only fades), `slideSwap(scene, outParts, inParts, dir)` (+1 next = content moves left, -1 back), `sceneFade(scene,
  key, data)` / `sceneFadeIn(scene)`. `comingSoonWindow` uses popIn/popOut. Retimed to tokens: title fly (story) +
  fade (slow), camp fade-in (slow), camp <-> squad slide (slow) + button shift (fast), menu pages (normal in / fast
  out), Game Over fades (normal).
- MENU PAGES IN THREE BEATS (session 41, user: 'like main screen -> expedition, for each main page'): opening a page
  from the camp (BaseScene.openOver) = the camp's buttons leave (uiShift) -> the page SLIDES IN over the camp from ITS OWN SIDE
  (user: 'slides from the side', then 'variationize'; `UI.page.from`: the side of its camp button: Glossary left, Shop
  right, Heroes + Leaders bottom, Settings + Profile top; over another page = `overPage` right; motion.normal, no fade)
  with its TOP BAR hidden -> the top bar slides down in. Closing = the top bar slides up away -> the page slides back
  out the same side -> the camp resumes and its
  buttons come back in (taps off until home). Top bar = objects a page marks with `markBar(list)` when it draws its
  back row (every page's '< CAMP'; the Shop's whole header with the gems box); `pageBar(scene)` finds them (tap zones
  stay put). Pages opened over another page (Glossary -> Heroes) only get the page's own beats. camp.json `slideMs/uiShiftMs/hero.fadeMs` and title.json `zoom.ms/fadeMs` are gone.
- PANEL COLOUR (session 41, user picked C of 4 trial palettes: 'the dark red is a bit too bright'): the 'crimson' palette's
  panels are now EMBER BROWN (fill 0x1a1412, strip 0x2a201c, frameDark 0x4a2e22...; gold frames and the red primary
  buttons unchanged).
- SKILL SQUARES (battle HUD, session 41, user picked A of 3): no gold theme frame (too distracting): a thin 2px line in
  the skill colour (red / green, grey while cooling, Mage = next element) round a dark tile (`BattleScene.drawSkillFrame`).

## BATTLE PAUSE + SPEED BUTTONS (session 42, user: 'top left needs a play speed button and a pause button to go back to
## the menu or settings')
- Top RIGHT, on the floor counter's row (user moved them from under the counter; data `pause.json` buttons): a PAUSE square (two bars) and a SPEED button that cycles the
  BATTLE SPEED choices of settings.json (1X / 2X, user's pick; saved like the Settings page; 2X shows in gold).
- Pause = Battle pauses, `PauseScene` opens over it: PAUSED window with RESUME (main button), SETTINGS (the Settings page
  over the pause window, '< BACK' returns; DELETE SAVE there also stops the fight), GIVE UP (red; asks 'GIVE UP? The run
  ends here. Your best floor is kept.' FIGHT ON / GIVE UP) -> `BattleScene.giveUp()` = `onLoss()` (defeat screen, game
  over summary, run saved). Given up during the floor walk-in: `startFighting` / `startRoom` see mode 'lost' and never start (session 55 fix). A run can't be saved halfway yet. Back in the fight the settings are read again.

## FIGHT HUD: hero slots (session 44, user picked 'L' from the minimal mock-ups)
- Per hero, bottom of the screen (`drawHeroSlots`, `drawDock` in `scenes/battle/hud.js`; numbers in `shared.js`
  `SKILL_Y/W/H` + `SLOT_HUD`): two skill squares 54x50 (finger size; were 40x44), under them a thin health line as wide
  as both squares (green, orange under 50%, red under 25%), then a label row (passive icon, NAME cut to 7 letters,
  health number), then ONE row of item icons (past 5 kinds they move closer together, over 10 kinds = '+N').
- No band behind it, nothing new on the field. User REJECTED an info box at the tapped enemy ('clutter when lots of
  enemies') and the dark bottom dock (M). Mock-ups: `docs/proposals/ui-concepts/mock4.html` (L-O), `mock3.html` (G-K).
- **PHONE SPEED (session 45, user on Android Chrome via itch.io: 'steady choppy' in the hero pick menu, on screen
  changes, in fights with many enemies):** measured on a 4x slowed CPU the game's own work per frame is small (fight
  4-5ms, title 1ms), so the suspects were in TEXT drawing. Two fixes: (1) `src/entities/fastCanvas.js` (first import
  in main.js): Phaser makes every Text canvas with `willReadFrequently: false`, and our small-font sharpening
  (`snapCanvas`) reads its pixels back on EVERY text change = a slow read-back from the graphics card on Android; small
  2D canvases are now kept in normal memory (the game canvas is untouched). (2) uiKit `TextStyle.setColor` does nothing
  when the colour is already set (SquadScene `placeBench()` set name colours every frame = 10 texts redrawn + uploaded
  60 times a second: 20 uploads a frame -> 0, frame 7.7ms -> 2.7ms). CONFIRMED by the user: the lag on their Android
  phone is gone.
  SPEED READOUT: TEST tab > 'TEST: speed (fps)' (`toggleFps` in testPanel.js): fps (+ lowest), slowest gap between
  frames, the game's own slowest frame, and the device line. Measuring scripts were scratch only (count gl draw /
  texImage2D calls per frame; time `game.step` under CDP `Emulation.setCPUThrottlingRate`).
- **PUSHABLE BUTTONS (session 47; `drawFlatButton` (the camp look, now in uiKit) has the same pressed look, user: 'look like it's being pushed, not just one tap design'):** `drawButton(...,
  { pressed: true })` = the face SINKS: rim stays, a near-black band on top (the rim's shadow), the face in its dark
  colour, no shine. uiKit `pressable(scene, zone, { redraw(pressed), sink: [label, cursor...], onTap, enabled })`:
  finger down = pressed look + the sink parts drop `UI.press.sinkPx` (2); finger slides off = cancelled; finger up on it
  = pops back and onTap runs, after the press showed at least `UI.press.holdMs` (90). `pressDown(look)` = the look alone
  (returns release) for taps a scene finds itself. Framed buttons press with `fill: UI.pressed`. Done on: SQUAD screen
  (BEGIN DESCENT, < CAMP, RANDOM, sound, Send back, hero card CHOOSE / SEND BACK and X) and every `uiButton` (Puzzle,
  defeat BACK). Actions now run on RELEASE (were on finger down). Next: the other screens (camp, menu pages, reward).

## TEXT STYLE for skill / passive / item descriptions (session 48, user: 'too long and bloaty')
- 1 to 3 short lines (skills/passives about 50-120 letters, items 50-110). Numbers stay; no 'he/she does...' sentences.
- KEYWORDS in CAPITALS (STUN, BLEED, BURN, POISON, CHILL, FREEZE, BLIND, CHARM, TAUNT, SILENCE, DOOM, MARK, SHIELD,
  INVULNERABLE, PARRIED, REFLECTS, CRIT, ON-HIT, CHANNEL, REACTION, MIXING, SOUL): the glossary explains each once
  (statuses chapter, or a BASICS page: ON-HIT ITEMS, CHANNEL, REACTIONS, MIXING ELEMENTS). Rule reminders never go in
  a description. Don't repeat in a skill what the hero's passive says (Grudge, Bloodthirst).
- Session 48 rewrote the 20 kit skills, 10 passives and the 20 longest items to this style.

## THE DUSK LOOK (session 49, CURRENT THEME; replaces crimson + gold above)
- User's pick 'Dusk + Soldia font + Salmon' from a live trial of 4 looks x 3 fonts x 6 main colours, inspired by
  docs/references/ui-vibe-pick-a-class.png ('the borders are sharp, no corner borders; buttons only one colour, no bevels,
  bands or gold'). Colours in `UI.goldTheme` (name kept) + `UI.text/dim/gold/fightGold/pageBg/dither` (config.js). The
  crimson + gold values: `git show 4fc5724:src/config.js`. Trial code (other looks, thin font `make-thin-font.py`, live
  switch) was deleted; it is in the session 49 commits.
- SQUARE windows (`square: true`): one 2px lavender line on a flat dark fill, no studs, no stepped corners
  (`squareWindow`). The old framed drawing (`themedWindow`, bevelled `drawButton`, banded `drawFlatButton` /
  BEGIN DESCENT) stays in uiKit for `square: false`.
- FLAT BUTTONS (`squareButton`): one colour. Main action (EXPEDITION, BEGIN DESCENT) = SALMON, every other = MAROON;
  pressed = 45% darker + label drops. Titles salmon; picked hero tiles + chosen outlines light salmon.
- HEADERS: `drawWindow(..., { quiet: true })` = drawn like the squad name plates (black outline, tileEdge, tileFill):
  squad SQUAD n/3 + sound box, camp profile bar, fight Floor box + 1X + pause.
- `UI.fightGold` = crits, Lv labels, LEVEL UP, passive words (soft peach; was yellow). `UI.gold` stays YELLOW (user: keep
  yellow for the other text); the TITLE page keeps yellow SOLDIA + white texts (user: salmon looked weird there).
- PRESS SOUND: `onPress` plays 'tap' on finger DOWN with the push; the action (on release) runs inside
  `sfx.hushDuring('tap', ...)` so its own 'tap' is not a second, late click (user: sounds late / early to the animation).
- Menu pages: `pageBackdrop(scene, bg)` = UI.pageBg + a 4px dithered checker.
- PRESS ON EVERY BUTTON (user: 'every button responsive on the clicks'): `zone.onPress(fn, { instant })` (uiKit, on every
  Phaser Zone): finger down = a dark cover (`UI.press.shade` / `shadeAlpha`) over the zone + its texts / icons drop
  `sinkPx`; slide off = cancel; release = action after `holdMs`. Used by the camp, every menu page, pause, game over,
  reward buttons, fight HUD (skills `instant`), squad test toggle. NOT the title gear (its tap must stop 'tap anywhere'
  at once) or reward cards (they light up themselves).
- Still yellow (left on purpose): item icons + tier frames (art), the check marks on picked tiles, rage/grudge bars.
- CAMP <-> SQUAD SLIDE STUTTER (session 49, user: 'looks stuck, like low FPS'; a faster 300ms slide was tried and
  REVERTED: 'way weird and bad'): building the next screen froze the game ~0.26s (4x slowed CPU) at the start of the
  slide, then the slide jumped. uiKit `prepareScreen` builds it while the finger holds the button (onPress / pressable
  `onDown`; `dropScreen` on slide-off), `whenScreenReady` waits for its first draw before the buttons leave,
  `slideToScreen` slides (motion.slow, easeMove as before), stops the old screen, then the new one's `arrive()` brings
  its buttons in 60ms later (after the teardown). Worst frame gap while anything moves: 260ms -> ~35ms (4x slowed).
- `uiShift` FADE-only parts (kind 'fade', no offset) now only change alpha, never y: uiHome was taken before the squad
  names were placed, so the fade-in moved them to y 0 ('above their heads') for a split second, then refresh() snapped them.
- Session 50 (user: rarities hard to tell apart, skill squares still rounded): fight skill squares are SQUARE
  (hud.js drawSkillFrame). Reward item cards: a SOLID rarity TAG (colour block + dark rarity word only, e.g. 'RARE'; user dropped 'ITEM') instead of
  thin coloured words; rarities.json `frame.line` = border px (common/rare 2, epic/legendary 4) and clearer fills
  (common neutral grey-black, rare blue, epic purple, legendary brown-gold). Legendary keeps its shine.
- Session 50 STUTTER pass (user: fights + reward screen stutter; measured under 4x CPU slowdown): (1) uiKit's small-
  font measureText remembers each letter's width per font (it measured every letter of every text again); (2) fight
  pop numbers (effects.js popText) are POOLED per size + colour (`this.popPool`): a finished one hides and is reused,
  no new canvas + texture per hit; (3) RewardScene cards make their texts ONCE (drawCard measures its own height,
  `CARD_H` remembers it for cardHeight) and every reward tween waits (tweens.timeScale 0) until the sheet has drawn
  twice, so the slide never jumps after the build frame. Found: only 4 WebGL shaders, all built at fight start (not a cause).
- Door sound (user: plays early): Door.open() plays 'doorOpen' itself, `floorArt.json door.anim.soundDelayMs` (480)
  after the door starts, on the scene clock, so the sound's loud hit (~200ms into the file) lands on the slam.
- SCENE EVENTS (session 51): a scene's own `this.events` listeners survive scene.stop / restart in Phaser. Any `this.events.on(Phaser.Scenes.Events.X, fn)` added in create() must be removed on SHUTDOWN (`this.events.once(SHUTDOWN, () => this.events.off(X, fn))`), or it piles up per visit (Base, Pause, fight HUD RESUME did). Test `scene-listeners.test.mjs`.
- HEROES PAGES (session 57; user: 'two different pages'; picked on the review page from 5 + 6 styles). Code:
  `scenes/heroes/heroPages.js` (HeroesScene calls it), data heroPage.json. From the camp = HERO PAGE (pick 4 'banner
  backdrop'): the hero in front of their BANNER (`entities/heroBanner.js`, src/assets/banners/<id>.png 113x59 at 3x,
  packed ?inline; drawn by docs/proposals/hero-banners/make-banners.py), name + role with a clear gap, the player's
  RECORDS with this hero (runs / best floor / kills / deaths / damage / healing; user: 'not the hero stats, the
  playtime stats'), LOOKS row (tap = try on, this visit only; wearing in fights TODO), HERO DETAILS = the card.
  From the Glossary = the CARD (pick F): hero, name, role + type, summary, STORY (lore, 4-5 sentences since session
  57), STATS, then the FULL kit with icons, PASSIVE FIRST (user), then attack, support, perk. The card SCROLLS (drag /
  wheel; `scrollable()` in heroPages.js: body container + a thin bar; NO mask since session 58: the body scrolls under
  `backdropStrip()` (uiKit: the page background's top strip) with the top bar moved over it. A Phaser 4 mask is a filter
  that redraws the content every frame and stalls the first time = the card stuttered; infoWindow.js and the squad
  grid still use masks). Neater pass (user):
  no text over the banner art; name + role under the card; YOUR RECORDS and LOOKS are SECTIONS (window + DUSK title
  strip, salmon title) with cells divided by thin lines. showArmoury (bigger try-on page) is unused for now.

## Page open smoothness (session 58)
- `pageEnter` starts the slide only after the page has been DRAWN TWICE (like RewardScene): building a page = one long
  frame on a phone; before, the slide jumped (Heroes: 794 of 844 px in one frame). Now 5-7 even steps (4x slow CPU).
- Slow first-time pictures are made behind the LOADING bar (`entities/warmUp.js`, title-base.md section 0); Profile
  banners: `entities/profileBanner.js` (the forest crop was ~80 ms each time a new banner was made).
- Measured worst frame on open (4x slow CPU, before -> after): Profile 800 -> 133, Leaders 450 -> 217, Shop 433 -> 183,
  Glossary / Settings / Heroes 250 -> 133. What is left is mostly making the page's text.
