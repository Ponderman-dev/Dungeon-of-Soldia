# Interface look ("Classic RPG Window")

User's pick (session 6, proposal page https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC, look D + font Press Start 2P,
note: "black menu with white strokes like the early Dragon Quest style of UI").

- Rules: every window, card and button is a BLACK window with a WHITE 2px line and stepped (pixel) corners. White text.
  Colour only where it means something: gold (`UI.gold`) = chosen / rarity / stacks / important numbers, red = attack,
  green = support / heals, grey (`UI.dim`) = disabled. The chosen card gets a GOLD line; a ready button gets the
  blinking ▶ cursor. No rounded rectangles, no gradients, no smooth fonts.
- Font: Press Start 2P (OFL, `src/assets/fonts/press-start-2p.woff2` + licence), packed into the code with `?inline` and
  loaded by `loadUiFont()` in BootScene before the first screen (FontFace from bytes, never fetch: the preview frame
  blocks it). Sizes ONLY 8 / 16 / 24 / 32 px (its 8px grid; in-between sizes blur): small text 8, names/titles/buttons
  16, big titles 24. Line spacing ~half the size. The font has plain ASCII only: no ‹ › → · ✕ ♪ ☑ in UI text.
- Code: `src/config.js` `UI` (font, sizes, colours); `src/entities/uiKit.js`: `drawWindow(g, x, y, w, h, {fill, line,
  alpha})`, `drawCursor(g, x, y)`, `uiText()`, `uiStyle()`, `uiButton()` (window + label + cursor + pressed = white).
- Screens done: fight HUD (floor window, skill buttons = windows with red/green letters, cooldown = grey fill draining
  from the top + the seconds), all fight texts (popups 8, big/skill numbers 16 = combat.json skillFx.numberSizePx,
  banners 24), reward sheet + "who gets it" + skill book steps, squad select + hero card, room hint window, puzzle,
  test button. Next: per-screen changes with the user (reward, battle, hero select, puzzle).
- **Defeat screen (screen review, user):** `BattleScene.showDefeat()`: the screen dims to black first, then a big red SQUAD DEFEATED pops in (small shake), then "The squad reached floor N, before <line>" (a random line from `src/data/defeat.json`: `withKiller` lines name the enemy whose hit felled the last hero, `death` events carry `killer`; `noKiller` when nobody did), then a BACK button to the squad screen (the old 3s auto-return, `restartDelayMs`, is gone). Timings and texts in defeat.json.
- **Pop-ups and bars at the edges (2026-10-19):** the same WORD popped over one fighter again within `POP_REPEAT_MS` (600) is skipped (a Samurai's 'Counter! Blocked! Counter!' pile); numbers always show. Health bars (+ Lv label, shields, chips) are clamped inside the screen when a fighter stands at a side wall (`BattleScene.syncBar`). Skill names (`BattleScene.skillName`) never land on another skill name or the 'Floor cleared!' banner: they go above them. Reward sheet: when a step changes the sheet's size, the new step's content waits hidden until the sheet has resized, then fades in (no title over the banner while it moves).
