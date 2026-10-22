# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 24): NEXT = ITEM OPTIMIZATION, then (fresh session) BOSSES REWORK
- BRANCH: `main` has EVERYTHING (session 23 merged in). See the Git rule in CLAUDE.md (every handoff updates main).
- NEXT 1, ITEM OPTIMIZATION: the user's words only ('item optimization'); ASK what they mean first (question tool,
  e.g. balance weak/strong items with `review.mjs` / `itemruns.mjs`, clean up item texts/tooltips, fewer or merged
  items, item code speed). Read `docs/systems/items.md` + `docs/item-decisions.md` (numbers truth) + balance-tools.md.
  Recent: charm / Chill Band / Magma Core 'Per stack' now '+X% of attack as <element>' (they ride INSIDE the hit);
  every other perStack line was checked against the effects and matched (session 23).
- NEXT 2, BOSSES REWORK (its own session): the user's words only; ASK what to change. Read `docs/systems/bosses.md`
  (8 bosses, `bosses.js`, `bosscheck.mjs` win rates). Enemy random picks now go through `pickWeighted()` (below).
- DONE session 23 (details in the docs/systems files):
  - Enemies hit RANGED minions (Wisp, Imp, Phoenix) half as often (`minions.rangedTargetWeight` 0.5, `pickWeighted()`;
    melee enemies never walk to one, but hit it at random if it is in reach; boss random picks too). Curve 3 smart
    mean 56.9 -> 52.9, median 42 -> 40 (minions.md).
  - Tap sound = one take (PIXABAY Button, `picked/tap.mp3`) (sound.md).
  - Squad screen: '< CAMP' + RANDOM in the bottom row, roomier buttons; camp: real up-arrows on TO EXPEDITION, 24px
    side margins; menu buttons slide/fade OUT before a screen slide and IN after (`uiKit.uiShift`, BEGIN DESCENT too)
    (title-base.md, saving-squad.md).
  - Speech bubbles: every line rewritten to 2-5 words, bubble max width 140 (ui.md).
  - The Skill Effects review page (NySVH2UUozwNNSYuky9xBN) currently holds the 3 tap sounds (done; reuse it freely).
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and all of session 23: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad; Playwright
  (/opt/node22/lib/node_modules/playwright, executablePath /opt/pw-browsers/chromium). Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Base')` or 'Battle' (registry `squadIds`); `scene.getScene('Battle')
  .sayLine('clear')` shows a bubble. Copy edited files into the worktree to preview before applying. After a screen
  slide, wait ~2.5s before tapping (taps are blocked while the buttons shift). Remove the worktree after
  (`git worktree remove --force`), stop vite with `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Sound board picks: page 1 = db `picks` (apply-picks.py), page 2 = db `assign` (WINS; applied by hand so far).

## How we work with this user
- Beginner, vibe coding: explain simply, small steps, ask before design changes. Picks: use the QUESTION TOOL (user asks
  'questions'); include what each extra copy adds (stacking). If it comes back '[No preference]', ask again, don't guess.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- 'Propose several designs' = 3 real in-game screenshots side by side, then the question tool; if all are rejected,
  ask WHAT feels wrong (question tool with typical reasons) before drawing more.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
