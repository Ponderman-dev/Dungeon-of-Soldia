# Hand-off notes (read after CLAUDE.md)

Start of a new session: read `CLAUDE.md` (all decided rules), then this file, then `docs/big-update-plan.md` (the plan and the BUILD ORDER) and `docs/item-list.md` (72 items). `docs/game-design-recap.md` is the original design. Art-direction proposals (not game code) live in `docs/proposals/` (see its README).

## The user
Total beginner, fully vibe coding. Explain simply, small steps, ask before big decisions (CLAUDE.md "About the user").
Wants: **the preview page republished after EVERY change** (for now), short replies, one step at a time.
They review by LOOKING at pages, so always check things in the browser (Playwright screenshots) before publishing, and tell them what to look for.
For ART / EFFECTS ideas they want a PROPOSAL PAGE first ("show me before I commit anything"), then they decide, then it goes into the game.

## Pages
- Game preview: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (publish `dist-page.html` copied to the scratchpad as `dungeon-of-soldia.html`, SAME url).
- Character Studio: https://claude.ai/artifact/1azV1LBUimRkeavNpQBgc7 (publish `studio-page.html` as `soldia-studio.html`, SAME url, keeps the `db` capability).
- Proposal pages (sprites, item icons, hit effects): see `docs/proposals/README.md`.
- Publishing gotcha: if the Artifact tool refuses ("you hadn't viewed the live version"), the live page is usually just an older build of the same thing. Check it (build the previous commit in a `git worktree`, compare line hashes; only the skeleton's first/last line should differ), Read a few lines of the saved copy, then publish again unchanged.

## Branch
Work branch: `claude/phase-h-tuning`. PR https://github.com/Ponderman-dev/Dungeon-of-Soldia/pull/1 (big update) and PR #2 (this branch's first commit) were MERGED into `claude/dungeon-soldia-scaffold-4utyba`; this branch was restarted from there and holds everything since. Commit + push after every step (`git push -u origin claude/phase-h-tuning`; never force push). Do not open PRs unless asked. Commit messages end with the attribution lines the session gives you.

## WHERE WE ARE
Big update (phases A-G) is done; Phase H: H1 balance bot done, H2 tuning PAUSED on purpose (do not tune numbers until the user play-tests or asks).
Done this session (all in CLAUDE.md too):
1. HERO SPRITES: all 10 heroes are pixel art, exactly 3 parts (head, body, weapon), 23-24 px tall.
2. ENEMIES: 12 new enemies (15 total), simple pixel sprites, random roster unlocked by floor depth from floor 4, enemy `onHit` statuses and `onDeath` bursts (Puffshroom poison cloud). Runs got a bit harder (bot medians ~15-25), not tuned.
3. ITEM ICONS: 16x16 icon per item (`src/data/itemIcons.json`) in a rarity frame on the reward card.
4. STUDIO: sections Units / Items / Effects; item icons editable; unsaved drafts no longer hide new game sprites (old drafts set aside under `soldia-studio-designs-draft-old` in the user's browser; they may hold unsaved Knight edits, offer to restore if asked).
5. HIT EFFECTS PROPOSAL (not in the game yet): https://claude.ai/artifact/6N97in7zepDMZcMgbJJrYF . Sections: Hits, Statuses, Item procs, Hero skills (the FULL set, 72, all re-aligned on body anchors, new Freeze = the sprite turns to ice + crystals), "Simplified (suggestion)" and "Stress test" (5 enemies x 5 debuffs: full vs simplified pips vs tap panel). The user has NOT chosen full vs simplified yet.

## EFFECTS DECISIONS (made by the user, next session)
- Status icons: 5x5 (+outline), rows of 3 over the health bar, stack number beside the icon. DONE in the game.
- EVERY debuff plays its own looping effect on the unit at the same time (not only the most important one).
- Hits: FULL version (each damage type its own hand-made hit). Item procs: FULL hand-made effect AND the item's icon pops over the holder. Hero skills: full.
- So the simplified ideas are NOT used (no shared minor-debuff look, no "top status only").
- DONE: status loops in the game (every status its own effect, systems/statusFx.js).
- DONE: hits per damage type + crit (systems/hitFx.js). Also DONE: miss side-step, block flash, shield soak ripple, shield break shards, heal motes, death squash + puff. DONE: item procs (icon pop + own effects, systems/itemFx.js, data/itemFx.json). The 4 leftovers (Sucker Punch, Executioner, Dice, Mimic) are DONE too. DONE: hero skill effects (systems/skillFx.js, data/skillFx.json). ALL effects from the proposal page are now in the game. MINION SPRITES: proposal page https://claude.ai/artifact/2BpJkQAsqqxBjnKcEibJpL (docs/proposals/minion-designs.mjs, build-minions.mjs); APPLIED (user said put it in): in minions.json and in the Studio. Possible next: make the effect recipes editable in the Studio's Effects section, or the options offered earlier (bosses, skill books, enemy skills, real reward screen, minion sprites).
- NEXT build steps (one at a time): then item procs + icon pop, then skill effects. Effects should become data-driven recipes the Studio's Effects section can edit (ask the user before that refactor).

## NEXT (what the user asked right before this hand-off)
The user showed Risk of Rain 2's debuff display as the reference: **every debuff has its OWN small icon in a row above the health bar, with a small stack number next to it** ("x8", "x1"). So:
1. Make a proposal: a tiny pixel ICON per status (about 7x7 or 8x8, readable at game size, in the status colour: stun star, freeze crystal, chill snowflake, shock bolt, fear face, taunt "!", silence lock, bleed drop, burn flame, poison drop/skull, weaken broken sword, armor break cracked shield, curse skull, blind closed eye, mark target, buff up-arrow, shield, regen plus...) shown in a row over the health bar with a stack count ("x3") where it stacks. Add it to the effects proposal page (new section, and redo the stress test with icons instead of colour pips) so the user can compare. Keep the icons as data (like itemIcons.json, probably `statusIcons.json`) and editable in the Studio later.
2. Then the user picks full / simplified / mix for the effects, and only then build the effects into the game (BattleScene draws events; effects should become data-driven recipes so the Studio's Effects section can edit them).
Other options offered earlier: bosses, skill books, enemy skills, real reward screen (remove TEST auto-reward), minion sprites (still blocks).

## How the fight works (so you do not break it)
- BattleState (no Phaser) is the rules; BattleScene draws events. Positions live in BattleState (`place()`, `move()`); the scene only draws (`followPositions()`). Do not fake movement in the scene.
- Statuses in `statuses.json` (+ `statusDefs`). Enemy traits `onHit` / `onDeath` in enemies.json. Floors: `enemiesForFloor()` / roster in dungeons.json (`validateDungeon` accepts numeric floor entries).
- A hero's stats come from `refreshStats()`; call it after anything that changes them.

## Tests and checks
- `npm test` runs every `scripts/tests/*.test.mjs` (40 files, all must pass before every commit).
- `node scripts/tests/balance.mjs 20 all` = whole-run bot (slow, run in the background).
- Browser: to reach the game from Playwright, build with a temporary `window.__game = new Phaser.Game(...)` in src/main.js (sed, build, `git checkout src/main.js`; never commit it). Never call `scene.events.off('preupdate')` in a test page (it kills the scene clock). `npm run build`, `npx vite preview --port 4173 &` (never pkill it in the same command), Playwright from a scratch folder with `npm i playwright-core` (Chromium at /opt/pw-browsers/chromium-1194/chrome-linux/chrome). The game opens on the squad screen: START is at (202, 740) (390x844 viewport), the TEST auto-reward toggle at (300, 20), "Unlock every hero" at (195, 806). The Studio Line-up mode (`button[data-mode="lineup"]`, canvas `#lineup`) shows every character/icon at once.

## Gotchas learned
- Never pass the `apply` function in items.js straight to `forEach` (index becomes the multiplier).
- Python replace scripts: assert the old text exists and re-run tests after every edit; avoid nested quotes in one-line Python (write a .py file).
- Effects/art: aim at anchors computed from the sprite (body without weapon), never hand-picked offsets.
- Studio: saved designs (db `designs`) override the game look; the db was empty at hand-off.
