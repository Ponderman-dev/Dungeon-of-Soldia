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

## DONE IN THE EFFECTS SESSION (all in CLAUDE.md with file names)
- Status ICONS (5x5 + outline, rows of 3 over the health bar, stack number beside the icon) and EVERY status playing its own looping effect on the body (systems/statusFx.js).
- HITS: own shot + impact per damage type, crit layer, miss side-step, block, shield soak / break, heal motes, enemy death squash + smoke (systems/hitFx.js).
- ITEM EFFECTS: the item's icon pops over the holder (instead of the text label) + its own effect for the special items, Excalibur tornado (fixed: it spawned in the screen corner; now on its enemy, bigger) (systems/itemFx.js, data/itemFx.json).
- SKILL EFFECTS: every hero skill its own cast effect + pixel projectiles (systems/skillFx.js, data/skillFx.json).
- HERO HUD: no name/perk text under the skills; "Lv3" left of the health bar; items as small framed icons UNDER the skill squares.
- MINION SPRITES: all 8 minions are pixel sprites (proposal https://claude.ai/artifact/2BpJkQAsqqxBjnKcEibJpL, source docs/proposals/minion-designs.mjs), also in the Studio.
- STUDIO EFFECTS TAB: live preview of all 76 effects with the game's own code, per effect speed + colour swaps, saved to db `effects`, applied into src/data/effects.json by scripts/apply-designs.mjs, read by the game through systems/fxTune.js.
- RECHECK: all 70 givable items ran in a real fight with procs forced, no errors.
- Proposal pages: effects https://claude.ai/artifact/6N97in7zepDMZcMgbJJrYF (now has the status icon section), minions above, see docs/proposals/README.md.

## DONE IN THE UI SESSION (after the effects session)
- Reward screen LIVE (no auto-pick; the DebugScene only has 'TEST: restart run'), then restyled: a sheet that slides up, big centered cards that fit their text, Back button, owned item icons on hero cards.
- Squad select rebuilt from the user's sketch (entrance room, bench of heroes, details card, slots, Begin Descent), then simplified twice on request (see CLAUDE.md).
- Doors: plain purple door that swings open with a soft lavender glow; heroes fade out in the doorway (`Door.js`).
- Crowd pushing gentler (`crowd.test.mjs`). Bugs fixed: last Second Wind Flask made health NaN (heroes became unkillable, this inflated old balance numbers: bot medians are now ~15-30), reward preview lost state bonuses (fake red loss), less popup text, item icon pops clamped on screen.
- PROPOSAL page (bosses, hero kits, sounds): https://claude.ai/artifact/C7SHzkoUvkxRdV2ryMV8L2 , waiting for the user's choices.

## NEXT (options offered to the user; ask which one, one step at a time)
- DONE: the real reward screen (auto-pick removed, Back button, owned item icons on the hero cards).
- Build what the user picks from the proposal page (boss engine first: big health bar, cast bar + interrupts, objects, phases), hero kit rework hero by hero, sounds (MUST batch first). Also: skill books, enemy skills, H2 tuning (only when the user has play-tested).
- If the user saved effects or designs in the Studio: "apply the studio designs" (read BOTH db collections `designs` and `effects`).

## Testing tips (learned this session)
- To drive the game from Playwright, build with a temporary `window.__game = new Phaser.Game(...)` in src/main.js (sed it in, `npm run build`, then `git checkout src/main.js`; NEVER commit it; `npm run build:page` must not contain `__game`).
- `npx vite preview --port 4173` in the background; stop it with `ps aux | grep "[v]ite preview" | awk '{print $2}' | xargs -r kill` (never `pkill -f`/`pgrep -f` with that text in the same command: it kills its own shell).
- Never `scene.events.off('preupdate')` in a test page (it kills the scene clock). Screenshots right after a clock step can show the previous frame: to inspect an effect, pin its progress (set `start` = now - ms*q before each step).
- Publishing the game/studio: if the Artifact tool refuses ("not viewed"), build the previous commit in a `git worktree`, compare line hashes with the saved live copy (only the first/last skeleton lines should differ), Read a few lines of the saved file, publish again.

## How the fight works (so you do not break it)
- BattleState (no Phaser) is the rules; BattleScene draws events. Positions live in BattleState (`place()`, `move()`); the scene only draws (`followPositions()`). Do not fake movement in the scene.
- Statuses in `statuses.json` (+ `statusDefs`). Enemy traits `onHit` / `onDeath` in enemies.json. Floors: `enemiesForFloor()` / roster in dungeons.json (`validateDungeon` accepts numeric floor entries).
- A hero's stats come from `refreshStats()`; call it after anything that changes them.

## Tests and checks
- `npm test` runs every `scripts/tests/*.test.mjs` (40 files, all must pass before every commit).
- `node scripts/tests/balance.mjs 20 all` = whole-run bot (slow, run in the background).
- Browser: to reach the game from Playwright, build with a temporary `window.__game = new Phaser.Game(...)` in src/main.js (sed, build, `git checkout src/main.js`; never commit it). Never call `scene.events.off('preupdate')` in a test page (it kills the scene clock). `npm run build`, `npx vite preview --port 4173 &` (never pkill it in the same command), Playwright from a scratch folder with `npm i playwright-core` (Chromium at /opt/pw-browsers/chromium-1194/chrome-linux/chrome). The game opens on the squad screen: START is at (202, 740) (390x844 viewport), the TEST restart-run button at (300, 20), "Unlock every hero" at (195, 806). The Studio Line-up mode (`button[data-mode="lineup"]`, canvas `#lineup`) shows every character/icon at once.

## Gotchas learned
- Never pass the `apply` function in items.js straight to `forEach` (index becomes the multiplier).
- Python replace scripts: assert the old text exists and re-run tests after every edit; avoid nested quotes in one-line Python (write a .py file).
- Effects/art: aim at anchors computed from the sprite (body without weapon), never hand-picked offsets.
- Studio: saved designs (db `designs`) override the game look; the db was empty at hand-off.
