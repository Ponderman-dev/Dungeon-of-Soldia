# Interface look ("Classic RPG Window")

User's pick (session 6, proposal page https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC, look D + font Press Start 2P,
note: "black menu with white strokes like the early Dragon Quest style of UI").

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
  the normal 0.9s; the bubble is removed `goneAfterRewardMs` (0.2s) after the reward screen pops up, never seen after it. Lines + timings in `src/data/dialogue.json` (per hero; a missing kind uses `clear`); `systems/dialogue.js`
  picks a living hero (not the last speaker) and goes through all its lines before repeating. Test: `dialogue.test.mjs`.
