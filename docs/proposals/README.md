# Proposal pages (art direction, not game code)

Pages Claude built to show the user ideas BEFORE they go into the game. They are published on claude.ai;
the files here are their source so a new session can keep editing them. Nothing in this folder is loaded
by the game.

| Page | Published at | Source |
|---|---|---|
| Sprite proposal (heroes 3 parts + 12 enemies) | https://claude.ai/artifact/2Kez8Co8SnreR9NLVgK3uw | `sprite-proposal.html` (built from `page-template.html` + `sprites-data.js`; already in the game) |
| ITEM REVIEW (all 86 items + notes; replaced the old 72-icon page at the same url) | https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef | built from the game's live data by `node docs/proposals/item-review/make-item-review.mjs <out.html>` (`item-review/template.html`; real framed icons via `framedIconPixels`, NEW = not on the old page). Declares `db`: ROUND 3 (new items' looks, session 28) notes in `notes3`; ROUND 2 (item optimization, session 24) notes are in collection `notes2` (doc = item id, `{note, name, updatedAt}`; doc `_general` = the big general box at the top): read them with ArtifactData `list`. Round 1 notes (all applied) stay in `notes`. Republish to the same url, omit `capabilities`. The old 72-icon page source (`item-icons.html`, `icons-template.html`...) stays here for history. |
| Minion sprites (8 minions, old block vs new) | https://claude.ai/artifact/2BpJkQAsqqxBjnKcEibJpL | `minion-proposal.html`, built by `node docs/proposals/build-minions.mjs` from `minion-designs.mjs` (designs + `toGame()`) and `minion-template.html` |
| SCREEN REVIEW (layout stills + recorded animations + sounds of hero select, reward, dungeon; OK/CHANGE + note each) | https://claude.ai/artifact/UR98Jn7UBts1xrvEZw97qP | `screen-review/`: dev server on :5173 (run vite from the scratchpad), `node record.mjs <dir> [clipIds]` (playwright-core, records each moment and trims it with ffmpeg into clips/*.mp4 + *.webm, stills/*.png), then `node make.mjs <dir>` (copies the cue sounds, writes <dir>/soldia-screen-review.html). Publish with `root` = <dir> and files clips/*, stills/*, sounds/* (the clips are NOT in git: re-record them). Declares `db`: collection `notes`, doc id `clip:<id>` / `still:<id>` / `sound:<cue>` = `{verdict: 'ok'|'change', text}`. |
| PUZZLE ROOMS (6 playable puzzle ideas, user: 'fck that number puzzle') | https://claude.ai/artifact/HdFydkPMrAzb2W2um8mWrn | `puzzles/`: `node docs/proposals/puzzles/make.mjs <out.html>` (template.html + sprites.js from game data). Declares `db`: collection `picks`, doc per puzzle id (mimic, runes, braziers, beam, ice, picture) `{keep}`, doc `note` {text}. Republish to the same url, omit `capabilities`. |
| UI STYLE (one look for every screen: 3 looks, 5 pixel fonts, note) | https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC | `ui-style/`: `node docs/proposals/ui-style/make.mjs <out.html>` (template.html + sprites.js drawn from game data + shots.js = screenshots of today). Declares `db`: picks in collection `picks` (docs `look` {pick: stone/parch/arcane}, `font` {pick}, `note` {text}). Republish to the same url, omit `capabilities`. |
| SKILL EFFECTS DEMO (Knight: today vs new CALM 3-beat look, v3 no abstract shapes, CHARGE/RELEASE/IMPACT; user picked name style B floating name) | https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN | `skill-fx/`: `node docs/proposals/skill-fx/make.mjs <out.html>` (demo.js = the scene + recipes in character pixels, reads game data/effect code; bundled by vite.config.js; Press Start 2P inlined). Declares `db`: collection `notes`, docs `name` {pick 'A'/'B', text}, `look:defense_bash` / `look:challenge` {verdict 'ok'/'change', text}, `general` {text}; Rogue added (`look:multistrike`, `look:smoke_bomb`, plays the game's own rogue recipes). Republish to the same url, omit `capabilities`. |
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

## New item effects (13 items x 2 options)
Page: https://claude.ai/artifact/FHrVb3J4nFuJjm1oYqyyqU (now shows a clip-only draft of round 3; this source is the old page). Built by `node docs/proposals/new-item-fx/make-page.mjs <out.html>` (`recipes.js` = the 26 proposed recipes in the SAME format as src/systems/itemFx.js, `template.html`, bundle `vite.fx.config.js` / `fx-entry.js` with the game's effect stage src/studio/fxStage.js). Picks + notes in db collection `picks` (doc = item id, `{pick: 'now'|'A'|'B', note}`): read with ArtifactData `list`, then move the picked recipe into itemFx.js (+ ITEM_MS, an event in BattleState/BattleScene where the item fires) and hook it like the other item effects.

## Item review round 3 (session 28: the 21 new items' looks)
The ITEM REVIEW page (row above, same url) now opens on 'New items' with a real-fight clip on each new item that shows
something. Clips: run vite from the scratchpad (e.g. port 5177), `node docs/proposals/item-fx-review/record.mjs <dir> 5177
[clipId...]` (each clip = a floor-6 fight, items given with chance pushed up, cropped to the fight area x2). Item -> clip
map + caption: CLIPS in `item-review/make-item-review.mjs`. Build `node docs/proposals/item-review/make-item-review.mjs
<dir>/item-review.html`, publish with `root` = <dir> and files clips/* (clips NOT in git). Notes: db collection `notes3`.
(The old 'New item effects' url above briefly held a first clip-only version of this review; not used.)
