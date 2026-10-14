# Proposal pages (art direction, not game code)

Pages Claude built to show the user ideas BEFORE they go into the game. They are published on claude.ai;
the files here are their source so a new session can keep editing them. Nothing in this folder is loaded
by the game.

| Page | Published at | Source |
|---|---|---|
| Sprite proposal (heroes 3 parts + 12 enemies) | https://claude.ai/artifact/2Kez8Co8SnreR9NLVgK3uw | `sprite-proposal.html` (built from `page-template.html` + `sprites-data.js`; already in the game) |
| Item icons (72) | https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef | `item-icons.html` (built from `icons-template.html` + `icons-data.js` + `items-meta.js`; already in the game as `src/data/itemIcons.json`) |
| Minion sprites (8 minions, old block vs new) | https://claude.ai/artifact/2BpJkQAsqqxBjnKcEibJpL | `minion-proposal.html`, built by `node docs/proposals/build-minions.mjs` from `minion-designs.mjs` (designs + `toGame()`) and `minion-template.html` |
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
  tests (one row, rows of 3). Icons live in `src/data/statusIcons.json` (7x7 incl. outline, same format as
  itemIcons.json), made by `make-status-icons.mjs` (5x5 designs + auto outline). Not used by the game yet.
- `fx-stress.js`: stress test, 5 enemies x 5 debuffs: full vs simplified (colour pips) vs tap panel.
- To publish: run the build, copy `hit-effects.html` to the scratchpad and publish it to the SAME url
  with the Artifact tool (read the live page first if the tool asks; it is this same file).
- To check visually: Playwright screenshots of the page, or draw each effect at a few times into a
  contact sheet (every card exposes `cards[i].fx.draw(g, t)`).

## Bosses, hero kits & sounds (proposal, not built)
Page: https://claude.ai/artifact/C7SHzkoUvkxRdV2ryMV8L2 . Source in `bosses-kits-sounds/` (`template.html` + `sprites.js` boss pixel art DSL + `content.js` bosses/sounds + `heroes2.js` kits v2 and skill books; `page.html` = the built page with hero art from heroes.json and CC0 uisfx menu sounds inlined). VERSION 2 (after the user's notes): bosses every 20 floors (20-160), hero kits v2 with item synergies ('Loves' + 'Item hook') and a defensive tool for 9 of 10 heroes, SKILL BOOKS (pick 1 of 2 pages, up to 3 per skill, free book after bosses, FORBIDDEN swap pages), sounds = real libraries (Kenney CC0 base, Sonniss GDC bundle + Freesound CC0 for magic/monsters, uisfx CC0 menus playable on the page; the sites are blocked from the cloud machine: add kenney.nl / freesound.org to the environment's allowed domains or upload the packs). Waiting for the user's decisions.

VERSION 3 (same page): bosses, hero kits v2 and the Organic menu sounds are BUILT. Skill books v3 (not built, waiting for the user): small STAT pages (+8% power, -8% cooldown, -15% wind-up, +15% duration; max 3 per skill) and universal MODIFIER pages any hero can put on any skill (2 slots per skill, a third replaces one): Inks (Poison/Bleed/Burn/Chill x2), Hunter's Ink, Blood Price, Siphon, Cyclone, Ricochet, Aftershock, Titan, Bulwark, Purify, Roar, Gravecall, Rally, Concussive, Overcharge, Reckless, Desperate, Hasty. Blue book = 3 pages (mostly stat), golden book after each boss = 3 modifiers. Hero-specific and FORBIDDEN pages are dropped. Edit script: `bosses-kits-sounds/books-v3-edit.py` (applied to the built `page.html`).
