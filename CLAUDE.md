# Dungeon of Soldia

Mobile auto-battler roguelike. Phaser + Vite + plain JavaScript (ES modules, no TypeScript).
Will be wrapped for Android later (Solana Seeker dApp Store).
Full design: `docs/game-design-recap.md`. Read it before designing features.
HANDOFF (latest session): read the START HERE section of `docs/handoff-phase-h.md` first.
Update the handoff ONLY when the user asks for a handoff (commits + `docs/systems/*.md` are the running record).
Keep it SHORT (current state only); old sessions go to `docs/handoff-archive.md` (search it, never read it whole).
Item numbers: `docs/item-decisions.md` is the current truth (overrides `docs/item-list.md` and older notes).

## About the user
Total beginner, fully vibe coding. Explain simply, work in small steps,
and ask before big decisions (new libraries, big refactors, design changes).
Sessions cost money: keep this file short, read a `docs/systems/*.md` file only when working on that system,
and suggest a fresh session per task.

## Rules
- **Screen:** portrait 390x844 (`src/config.js`). Crisp pixel scaling: `pixelArt: true`, `roundPixels: true`,
  Scale.FIT. Never use smoothing/antialiasing on art.
- **Data in JSON:** heroes, items, skills, enemies etc. live in `src/data/*.json`. Never hard-code that data
  in scene code; scenes only read it. All tuning numbers go in JSON/config.
- **Rules vs scene:** game logic lives in `src/systems/` (no Phaser; BattleState and friends), scenes only draw.
- **Art:** characters are pixel-art parts (head, body, weapon...) so each part can be replaced; see `docs/systems/art.md`.
- **Git:** `main` is the one branch with everything. Work on the branch the session names (start it from `main`),
  commit after every working step with a clear message, never commit broken code. When the task is done and the user
  OKs it, bring `main` up to the session branch. Do not open PRs unless asked.
- **Small steps:** one step at a time, then stop and tell the user how to see it.
- **After every change:** run the related test file(s) while working (`node scripts/tests/<name>.test.mjs`), full
  `npm test` before each commit, a full-run check when balance is touched, commit, push.
- **Preview only on request:** `npm run build:page` + republish (below) ONLY when the user says "show me", or once at
  the end of a batch of visible changes. Number/doc/logic-only changes: no rebuild, no republish.
- **One task per session:** suggest a fresh session when the topic changes; batch the user's small tweaks into one round.
- **Screenshots** (scratchpad copy + Playwright) only for art/look changes, never for number changes.
- **Tests vs tuning:** item mechanic tests use a frozen copy (`scripts/tests/fixtures/items-frozen.json`, `frozenItems()`
  in util.mjs), so changing item NUMBERS in items.json needs no test edits. Copy an item into the fixture only when it
  is new or its effect shape changes. New tests: check the mechanic, read numbers from the data, don't retype them.
- **Docs:** when you change a system, update its `docs/systems/*.md` file (not this file). Add a one-line pointer
  below only for a NEW system.

## Core game facts (details in docs/systems)
- Squad of 3 heroes (10 heroes, 7 unlockable); dead heroes stay dead, run ends when all 3 are dead.
- Damage types: physical (melee, ranged) and magical (fire, ice, electric, dark; holy exists). Defense cuts
  physical, resist cuts magical (curve, `armorPercent()`). No mana: skills run on cooldown only.
- Each hero: one attack skill + one support skill, a party perk, a passive. Items are passive only; the player
  only taps skills and enemies (tap = focus, drag a hero onto an enemy = order).
- Every floor: fight (floor director picks enemies) or a special room; boss every 20 floors; reward after a clear.

## Systems index (read the file before working on that system)
- `docs/systems/combat.md`: damage maths, weak/resist, attack timing, perks, morale, levelling, tap focus, drag orders.
- `docs/systems/movement.md`: positions, walking, reach, pushing, facing (`BattleState.move()`).
- `docs/systems/skills.md`: skills, wind-up, skill look/animation, area skills.
- `docs/systems/skill-books.md`: skill book pages (stat + modifier pages).
- `docs/systems/statuses.md`: every status, DoTs, status icons, status body effects, shields/invulnerable, taunt.
- `docs/systems/effects.md`: hit, item and skill visual effects (`hitFx.js`, `itemFx.js`, `skillFx.js`).
- `docs/systems/heroes.md`: counters, passives, HERO KITS v2 (current hero kits).
- `docs/systems/minions.md`: weak/greater minions, upkeep.
- `docs/systems/items.md`: item rules, icons, procs, stacking, all item batches (G1-G8, phase H rework).
- `docs/systems/rewards.md`: reward screen, drop roll, potion, who-gets-it.
- `docs/systems/floors-rooms.md`: door walk between floors, special rooms, dungeons.
- `docs/systems/enemies.md`: roster, enemy traits, floor director, elites, Monster House, new enemy batches.
- `docs/systems/bosses.md`: the 8 bosses (`bosses.js`), boss HUD, `bosscheck.mjs`.
- `docs/systems/balance-tools.md`: difficulty curve, smart player, review/curve/itemruns scripts.
- `docs/systems/saving-squad.md`: saving (`progress.js`), unlocks, squad select screen.
- `docs/systems/sound.md`: `sfx.js`, cues, sound board and applying picks (sound is ON HOLD).
- `docs/systems/art.md`: pixel-art parts, sprites, keyframe animation clips.
- `docs/systems/title-base.md`: title page + Base camp hub (PLAN, build order).
- `docs/systems/ui.md`: interface look (black windows, white lines, Press Start 2P), `entities/uiKit.js`.
- `docs/systems/studio.md`: Character Studio page (draw, animate, effects editor, applying studio designs).
- Older plans: `docs/big-update-plan.md` (phases A-H), `docs/item-list.md` (old 72-item list).

## Commands
- `npm install`  install dependencies
- `npm test`  run all tests (`scripts/tests/run-all.mjs`)
- `npm run dev`  start dev server (http://localhost:5173); dev-only url flags `?floor=N`, `?room=<kind>`, `?elite=1`, `?house=1`
- `npm run build`  production build into `dist/`
- `npm run build:page`  build + pack into ONE file `dist-page.html` (for the claude.ai preview page)
- `npm run build:studio`  build the Character Studio into ONE file `studio-page.html`
- `npm run build:house-demo`  Monster House demo page `house-demo-page.html`
- Balance: `node scripts/tests/curve.mjs 3 smart` (difficulty), `node scripts/tests/review.mjs 4 all` (heroes/items),
  `node scripts/tests/itemruns.mjs` (one item); see `docs/systems/balance-tools.md`.
- Browser checks: run vite from the SCRATCHPAD dir (the repo has a tracked vite.log, don't dirty it).

## Preview pages (republish to the SAME url; ignore the "download link" warning, a false alarm from Phaser)
- NO NEW PAGES: drawing = the Character Studio; any other 'look and pick' review = REUSE the Skill Effects page
  (`docs/proposals/skill-fx`, swap its content per topic, keep it small). New page only if the user asks.
- NEVER read a published page back (the game page is our own 2.5 MB build): publish the file; if it is refused as
  'not viewed', the live copy is saved to a file: don't open it, just publish again.
- Game: `npm run build:page`, copy `dist-page.html` to the scratchpad as `dungeon-of-soldia.html`,
  publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr
- Studio: `npm run build:studio`, copy `studio-page.html` as `soldia-studio.html`,
  publish to https://claude.ai/artifact/1azV1LBUimRkeavNpQBgc7 (has `db`; omit `capabilities` on republish)
- Monster House demo: copy `house-demo-page.html` as `monster-house-demo.html`, https://claude.ai/artifact/4vMvwYLs9sUHr5KcxZ75aH
- Item review page (user notes in db `notes`): https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef
- Old proposal pages (kept, not updated any more): `docs/proposals/README.md`.

## Layout
- `index.html`  page shell
- `src/main.js`  Phaser game config
- `src/config.js`  size/colour constants
- `src/scenes/`  one file per scene (BattleScene, RewardScene, SquadScene, PuzzleScene, roomMethods.js...)
- `src/entities/`  reusable game objects (Character built from parts, Door, textures)
- `src/systems/`  logic with no Phaser (BattleState, combat, items, rewards, bosses, elites, fx recipes...)
- `src/data/`  JSON game data
- `src/audio/`, `src/assets/sounds/`  sound
- `src/studio/`  Character Studio
- `docs/`  design docs (`docs/systems/` = per-system notes)
- `scripts/`  helper scripts (make-page.mjs, apply-designs.mjs, art/, tests/)
