# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 21, 2026-10-21): NEXT = OPENING TITLE PAGE (user's pick)
- BRANCH: `main` has EVERYTHING (session 20 work merged in). See the Git rule in CLAUDE.md.
- NEXT TASK: an opening TITLE PAGE before the squad screen. Today BootScene starts 'Squad' directly (src/main.js scene
  list: Boot, Squad, Battle, Reward, Puzzle, Debug). Nothing designed yet: ask the user first (game name 'Dungeon of
  Soldia' look, what's on it: tap to start / continue, background art, music is ON HOLD). Follow docs/systems/ui.md
  (black windows, white lines, Ironslab font) and the ART rule below (show it in the game first, screenshots).
- DONE session 20: SPEECH BUBBLES (user idea, purely for show): a hero says a line in a WHITE bubble (black line + text)
  at the run's start and after every cleared floor; boss / fallen-friend / close call (<=25% hp) / hurt (<=50%) lines;
  10 heroes x 6 kinds in `src/data/dialogue.json`, logic `systems/dialogue.js`, test `dialogue.test.mjs`. The clear pause
  is ~2.4s now (bubble time). 'Floor N cleared!' moved up to the centre (combat.json `transition.clearBannerY` 422).
  Details: ui.md 'Speech bubbles'. The user may still want to edit lines.
- OPEN (older ideas): Electric has no payoff epic (Shock); Eclipse Idol ~0 in itemruns (bot); more dark legendaries
  (Doom Crown, Soul Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap 20%), Aegis of Dawn,
  Spellward Robe.
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
