# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 23): NEXT = more MENU tweaks (the camp hub); ask the user what to change
- BRANCH: the session 22 work is on `claude/wonderful-fermat-fg4jn0` (NOT on main yet: ask the user, then bring main
  up to it). See the Git rule in CLAUDE.md.
- CAMP HUB REWORK (session 22, user's sketch 'more of a mobile game menu'; details docs/systems/title-base.md
  section 4): `BaseScene` = campfire in the middle with 3 random unlocked heroes idly wandering (`camp.json hero`),
  Settings gear top left, profile (name box 'Adventurer' + round portrait, `uiKit.pixelDisc`) top right, big
  TO EXPEDITION window (slides up into the squad screen), bottom row of 4 square buttons with 12x12 pixel icons
  (`ui.menu`: Glossary, Heroes, Leaders, Shop) = all 'Coming soon'. No walk-in from the bottom, no NPCs drawn
  (`npcs` data kept for later screens). Likely next asks: the screens behind the buttons, the profile name/portrait,
  settings (sound on/off lives on the squad screen today), polish. In the dev/preview build the yellow TEST buttons
  sit over the profile (not in the itch build).
- Also DONE session 22: clear pause 1.2s (bubble shows first); a skill cuts the attack swing/step short
  (`Character.stopAttack`, `stopStep`); neater 'Who gets it?' hero rows; sound board round 9 (Menus rows, `add-menus.py`)
  + picks applied (tap = 3 random takes, cardOpen page turn, cardClose card place, scroll, descend = appear magic,
  Flask Barrage glass); element charms / Chill Band / Magma Core ride INSIDE the attack (one number, `riders` in
  combat.js, not boosted by +element %: grows evenly; items.md 'ONE HIT'); charm texts simpler.
- itch.io: the zip given to the user predates the hub / charms / page-2 sounds: `npm run build:itch` again before an
  upload, and add those to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version still 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <copy> --port 5177` run FROM the scratchpad (a git worktree in
  the scratchpad + a node_modules symlink; run `npm install` first if node_modules is missing). Dev build exposes
  `window.__game`: wait for 'Title', stop scenes, `scene.start('Base')` or 'Battle' (registry `squadIds`). Remove the
  worktree after (`git worktree remove --force`). Stop vite with `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Sound board picks: page 1 = db `picks` (apply-picks.py), page 2 = db `assign` (WINS; several files = random takes;
  applied by hand so far). Compare with the db copies to spot what is new.

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
