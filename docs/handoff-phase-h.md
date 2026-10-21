# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 20, 2026-10-21): no task picked; offer the OPEN list below
- LATEST BRANCH: `ccr-90aacd64-ir2cer` has EVERYTHING (it contains `ccr-f0fe918e-fdbp68`). Before building/publishing:
  `git fetch` and check newer session branches are merged (`git merge-base --is-ancestor`).
- DONE session 19:
  - Fire Arrows REMOVED (user). Ember Charm burn 6% -> 12% (+10% per extra charm). Spirit Axe v2: spins ONCE when the
    holder is hit, 14% per copy, 400% to every enemy within 110px (itemruns 3 copies +9.0: watch it). docs/item-decisions.md.
  - BUG FIX: the game froze when a Kobold Sapper's late bomb hit something (scene lunged a faded attacker; BattleScene
    'attack' event now skips a missing attacker view).
  - NEW FONT: IRONSLAB, the user's OWN pixel font (`src/assets/fonts/ironslab.ttf`, 10px grid). Scenes still ask for
    8/16/24px; uiKit maps them to 10/20/30 (`UI.fontGrid`). Missing chars: `$ ; @ \ ^ _ { | } ~`. If the user sends a new
    .ttf: check grid + characters (session 19 used small node scripts), swap the file, screenshot. ui.md has it all.
    Jacquard 24 and ~20 Google pixel fonts were tried and turned DOWN.
  - Death Coil: user says it's fine; its 'change' note on the skill-fx page (db notes/look:death_coil3) is now 'ok'.
- OPEN: Electric has no payoff epic (Shock); Eclipse Idol ~0 in itemruns (bot); more dark legendaries (Doom Crown, Soul
  Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap 20%), Aegis of Dawn, Spellward Robe.
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
  It is noisy at 6/squad: use 16/squad and compare old vs new on the same dice (git worktree of HEAD) before judging.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` from the scratchpad (npm install first);
  set registry `squadIds`, stop all scenes, start 'Battle' (retry until a fight); `window.__game`
  .scene.getScene('Battle').state = BattleState; kill units with state.killUnit + scene.showEvents to reach the
  reward / defeat screens; `?floor=11&room=<kind>` for rooms. Stop vite with `pkill -f "[v]ite.*--port 5177"` (the
  brackets stop pkill from killing its own shell).
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then publish again.

## How we work with this user
- Beginner, vibe coding: explain simply, small steps, ask before design changes. Picks: use the QUESTION TOOL (user asks
  'questions'); include what each extra copy adds (stacking). If it comes back '[No preference]', ask again, don't guess.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
