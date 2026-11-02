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
- Code: `src/config.js` `UI` (font, sizes, colours); `src/entities/uiKit.js`: `drawWindow(g, x, y, w, h, {fill, line,
  alpha})`, `drawCursor(g, x, y)`, `uiText()`, `uiStyle()`, `uiButton()` (window + label + cursor + pressed = white).
- Screens done: fight HUD (floor window, skill buttons = windows with red/green letters, cooldown = grey fill draining
  from the top + the seconds), all fight texts (popups 8, big/skill numbers 16 = combat.json skillFx.numberSizePx,
  banners 24), reward sheet + "who gets it" + skill book steps, squad select + hero card, room hint window, puzzle,
  test button. Next: per-screen changes with the user (reward, battle, hero select, puzzle).
- **Defeat screen (screen review, user):** `BattleScene.showDefeat()`: the screen dims to black first, then a big red SQUAD DEFEATED pops in (small shake), then "The squad reached floor N, before <line>" (a random line from `src/data/defeat.json`: `withKiller` lines name the enemy whose hit felled the last hero, `death` events carry `killer`; `noKiller` when nobody did), then a BACK button to the squad screen (the old 3s auto-return, `restartDelayMs`, is gone). Timings and texts in defeat.json.
- **Pop-ups and bars at the edges (2026-10-19):** the same WORD popped over one fighter again within `POP_REPEAT_MS` (600) is skipped (a Samurai's 'Counter! Blocked! Counter!' pile); numbers always show. Health bars (+ Lv label, shields, chips) are clamped inside the screen when a fighter stands at a side wall (`BattleScene.syncBar`). Skill names (`BattleScene.skillName`) never land on another skill name or the 'Floor cleared!' banner: they go above them. Reward sheet: when a step changes the sheet's size, the new step's content waits hidden until the sheet has resized, then fades in (no title over the banner while it moves).
- **Speech bubbles (session 20, user idea, purely for show):** a hero says a short line in a small WHITE window (black line, black text: unlike the black UI windows, user) with
  a stepped tail over its head (`BattleScene.sayLine` / `placeSpeech`, the bubble follows the hero). When: the run's
  first floor after the walk-in (`start`, the fight starts at once), and every cleared floor (`clear`; `boss` after a
  boss, `fallen` when a squad mate fell that floor, `close` / `hurt` when a hero ended the floor at or below 25% / 50%
  health: that hero says it; order boss > fallen > close > hurt > clear, `dialogue.clearSpeech`, health read before the
  win heal). 'Floor N cleared!' sits higher (combat.json `transition.clearBannerY`, 422) so it misses the bubbles. Nothing waits for a bubble (user, session 21: the wait broke the pace): the clear pause is
  1.2s (`clearPauseMs`, user 2026-10-21: the bubble needs 1.2s before the reward screen); the bubble is removed `goneAfterRewardMs` (0.2s) after the reward screen pops up, never seen after it. SHORT lines (user 2026-10-22: 'too long': every line rewritten to 2-5 words, bubble `maxWidthPx` 140, `padPx` 6; 8px is the smallest crisp text). Lines + timings in `src/data/dialogue.json` (per hero; a missing kind uses `clear`); `systems/dialogue.js`
  picks a living hero (not the last speaker) and goes through all its lines before repeating. Test: `dialogue.test.mjs`.
- **SESSION 40 TRIALS (user: 'give me variations', camp + menus, black and white):** dev url flags (dev server only):
  `?frame=single|double|shadow|rivets` = window frame style for EVERY window (`UI.frame` in config.js, drawn by
  uiKit `drawWindow`; 'single' = today), `?bar=1` / `?list=1` = Glossary title bar / cursor-list chapters (trial code
  in GlossaryScene `TRIAL`). Review page (real screenshots, `docs/proposals/skill-fx/make-ui-review.py <shots dir>
  <out>` + `ui-review.html`) published over the Skill Effects page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN;
  picks in its db collection `ui` (docs `frame`, `layout`, `general`). After the pick: set UI.frame, roll the layout
  out to every menu, remove the unused trial code.
- **GOLD THEME TRIAL (session 40, user's reference pictures: 'way more clear navigation'):** dev flag `?theme=gold`
  (`UI.theme`, colours in `UI.goldTheme`): uiKit `drawWindow` -> `goldWindow` (dark outline, gold frame, dark gold
  inner edge, slate fill, pale corner studs; a gold line = chosen -> pale gold, dim -> grey), `drawButton` (SOLID gold
  button, light top edge, darker bottom half, dark text via `buttonTextColor()`; uiButton uses it), `drawStrip` (a
  title strip inside a panel), `isGoldTheme()`. Wired so far: Base camp TO EXPEDITION (solid button, dark arrows),
  Glossary (gold back button; chapters = one panel with a GLOSSARY strip, recessed row slots, gold cursor). Every other
  window gets the gold frame automatically; Squad screen buttons and the white profile disc are not converted yet.
  On the review page as section 'NEW' (A = today, B = slate and gold).
  PALETTES (session 40, user: 'more variations, other palettes'): dev flag `?pal=silver|copper|jade|crimson` (with
  `?theme=gold`) swaps `UI.goldTheme` keys for `UI.palettes[pal]`; on the review page as theme options C-F.
- **CHOSEN: F = CRIMSON AND GOLD (session 40).** `UI.theme` 'gold' (the framed theme) + `UI.palette` 'crimson'
  (`UI.palettes.crimson` is merged into `UI.goldTheme` by uiKit `themeName()` at load). 'mono' + no palette = the old
  black and white (still works; every new piece falls back to it). Dev trials still work: `?theme=mono|gold`,
  `?pal=gold|silver|copper|jade|crimson`. ACTION BUTTONS are SOLID (`drawButton` + `buttonTextColor()`): every back
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
