# Proposal pages (art direction, not game code)

Pages Claude built to show the user ideas BEFORE they go into the game. They are published on claude.ai;
the files here are their source so a new session can keep editing them. Nothing in this folder is loaded
by the game.

| Page | Published at | Source |
|---|---|---|
| Sprite proposal (heroes 3 parts + 12 enemies) | https://claude.ai/artifact/2Kez8Co8SnreR9NLVgK3uw | `sprite-proposal.html` (built from `page-template.html` + `sprites-data.js`; already in the game) |
| Item icons (72) | https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef | `item-icons.html` (built from `icons-template.html` + `icons-data.js` + `items-meta.js`; already in the game as `src/data/itemIcons.json`) |
| Hit effects (animated) | https://claude.ai/artifact/6N97in7zepDMZcMgbJJrYF | `hit-effects.html`, rebuilt by `node docs/proposals/build-effects.mjs` |

## Hit effects page
- `fx-engine.js`: tiny pixel engine (stage 120x64 drawn at 3x, `makeG()` drawing helpers: px, rect, disc,
  ring, line, bolt, text (3x5 font), pop (floating number), burst, rays, slash, fly, sprite, shadow).
  `prepSprite(pal, rows, flip, isCore)` + `U(sprite, x, y)` = ANCHORS: every sprite is placed by its BODY
  centre (weapon pixels ignored) and effects aim at `u.x / u.mid / u.top / u.y` and `front(u)`. Never
  nudge effects by hand-picked pixels (that was the "slightly to the side" bug).
- `fx-effects.js`: the FULL set (72): hits, statuses, item procs, hero skills. Freeze = `iceRecolor()`
  (the sprite itself turns to ice from the feet up, outline = ice rim) + `crystals()` growing out of the
  outline. Deaths use `dying()` + `deathPuff()`. Rings/discs that fade with `1 - q` are guarded so they
  never show before their moment.
- `fx-simple.js`: the SIMPLIFIED suggestion (section "Simplified"): kit of 8 pieces, one hit recipe in 5
  colours, item procs = the item's icon pops over the holder (`iconPop()`, icons from itemIcons.json),
  minor debuffs share one look + a tag, only the top status loops, one DoT number per second.
- `fx-icons.js`: STATUS ICONS section (Risk of Rain style): gallery + one enemy / heroes demos + two icon stress
  tests (one row, rows of 3). Icons live in `src/data/statusIcons.json` (9x9 incl. outline, same format as
  itemIcons.json), made by `make-status-icons.mjs` (7x7 designs + auto outline). Not used by the game yet.
- `fx-stress.js`: stress test, 5 enemies x 5 debuffs: full vs simplified (colour pips) vs tap panel.
- To publish: run the build, copy `hit-effects.html` to the scratchpad and publish it to the SAME url
  with the Artifact tool (read the live page first if the tool asks; it is this same file).
- To check visually: Playwright screenshots of the page, or draw each effect at a few times into a
  contact sheet (every card exposes `cards[i].fx.draw(g, t)`).
