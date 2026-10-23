# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 25): NEXT = BOSSES REWORK
- BRANCH: `main` has EVERYTHING (session 24 merged in). See the Git rule in CLAUDE.md (every handoff updates main).
- NEXT, BOSSES REWORK: the user's words only ('rework bosses'); ASK what to change first (question tool: e.g. new
  moves, harder/easier, new looks, fewer/more bosses, which boss feels bad). Read `docs/systems/bosses.md`
  (8 bosses, `bosses.js`, boss HUD, `bosscheck.mjs` win rates). Top killers in the last curve: Brood Mother, Grukk.
- DONE session 24 (details: `docs/item-decisions.md` 'ITEM OPTIMIZATION round 2' + 'NEW ITEMS session 24'):
  - Item review page round 2 (https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef): notes now in db collection
    `notes2` (`_general` = big top box); round 1 stays in `notes`. All 19 round-2 notes are BUILT.
  - 19 items changed (numbers, Bandage Roll any debuff + defense, Bulwark/Totem block with a shared 60% cap, Eclipse
    resist cut, Heart of the Beast +100 health / 1% regen, Overheal Ring -> Vital Band (common regen, id kept),
    Plague poison damage, Mimic no tougher with copies, Assault aura 0.5s into the floor). Overheal shield and
    healAmp code removed.
  - NEW items: Riposte Cloak (rare), Last Stand (epic), Harvest Scythe (rare, 8% of crit damage, max 10% max health
    per crit; user wants OP moments). Killing Mask was built then CUT (lifesteal stacking ran away). Icons are first
    drafts (user may redraw in the Studio). Tests: items-s24.test.mjs.
  - KIV (user: keep in view): the round-2 changes made early floors a bit harder (alive at 20: 93% -> 88%).
- Last curve 3 smart (all of the above): median 43, mean 56.2, alive at 100: 5%.
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and sessions 23-24: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad; Playwright
  (/opt/node22/lib/node_modules/playwright, executablePath /opt/pw-browsers/chromium). Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Base')` or 'Battle' (registry `squadIds`). After a screen slide, wait
  ~2.5s before tapping. Remove the worktree after (`git worktree remove --force`), stop vite with `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Fresh clone: `npm install` first (node_modules is not there).

## How we work with this user
- NO BALANCE SIMULATIONS unless the user asks (user, session 24: 'no need run simulation'): curve/review/itemruns cost time.
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
