# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 21, 2026-10-21): no task picked; offer the OPEN list below
- BRANCH: `main` has EVERYTHING and is the GitHub default (session 20). All old branches deleted. At the end of a task,
  ask the user, then bring `main` up to the session branch (`git push origin HEAD:main`). If that push is blocked
  (it was in session 20), the user does it on GitHub: "Compare & pull request" on the session branch, then "Merge".
  Then the user deletes the session branch (Branches page, trash icon).
- DONE session 20 (workflow speed-up, no game changes): CLAUDE.md rules now say: related tests while working, full
  `npm test` before commit; rebuild + republish the game page ONLY on "show me" or end of a batch; one task per
  session; screenshots only for art/look. (Timed: `npm test` 20s, `build:page` 3s; the slow part was republishing.)
- Session 19 (items, Sapper freeze fix, IRONSLAB font): see the archive.
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
