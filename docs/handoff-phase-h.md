# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 17, 2026-10-20): NEXT = ITEM ADJUSTMENTS
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING (session 16's ccr-6323ff2c-ctwhz9 is in). Start the next session
  from it. Before building/publishing: `git fetch` and check newer session branches are merged (`git merge-base
  --is-ancestor`); ccr-a59eab7b / ccr-a7ab1d1c / phase-h-tuning / scaffold / quick-gloves = old history, ignore.
- DONE this session (user played and asked):
  - Enemy scaling: floors 25-35 hit too hard -> enemy growth per 3 floors +50% health / +42% attack (was +35% / +52.5%),
    Orc Brute attack 12 -> 9 (a hero health buff was tried and REMOVED: user wants it no easier). Smart curve median 37 -> 40.
  - Movement: minions make way (never block a hero / shove an enemy), standing minions let walkers pass through, bosses
    are not pushed by small fighters or their own eggs. PARKED: 'bosses should NEVER be shoved' (movement.md).
  - Hero death: red screen pulse + low bell (`heroDeath` cue). Sound board round 8: rows heroDeath, descend, gateSlam
    (`add-rows.py`); user has NOT picked yet -> 'apply the sound picks' = apply-picks.py (sound.md).
  - Playtest: `npm run build:itch` = itch-page.html without test buttons (user uploads to itch.io); 'Choose 3 heroes' box
    gone; sound button = pixel speaker icon.
  - Skills: Defense Bash / Multistrike / Savage Leap STAY where they hit (rules move, `staysAtImpact`); every melee basic
    attack STEPS IN to the target at the hit (`attackMotion.meleeStep`, view only). Both just applied: ask how they feel
    (step size/speed, heroes only?).
- NEXT TASK (user): ITEM ADJUSTMENTS. Ask which items feel bad/weak/too strong in play. Read docs/systems/items.md and
  docs/item-decisions.md (the truth for item numbers) first. Item review page (user notes in db `notes`):
  https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef (read its notes with ArtifactData). Tools: `node scripts/tests/itemruns.mjs`
  (one item), `node scripts/tests/review.mjs 4 all` (heroes/items), curve.mjs before/after. Item tests use the frozen
  fixture: changing NUMBERS needs no test edits (CLAUDE.md).
- OPEN (offered, not done): Necromancer got stronger once minions stopped blocking (watch); Bone Sacrifice pops
  'Sacrifice!' 3-4 times stacked; Mystery Brew (alch_brew) has no sound; Death Coil demo note still says 'change'.
- PARKED: HERO REDRAW proposal (chunky heroic body, 3/4 view, BIG weapons; keep 3 parts or go to 6).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright) + `npx vite --port 51xx`
  (log to the scratchpad); squad screen first: set registry `squadIds`, stop 'Squad', start 'Battle'; `window.__game`,
  `?floor=5&room=fight`; poll in a loop (page.waitForFunction with polling was flaky). Balance probes used this session
  (scaling per floor, big hits by source, shove per fight) were scratch scripts: rewrite if needed.

## How we work with this user
- Beginner, vibe coding: explain simply, small steps, ask before design changes; 4 ideas via the question tool for picks.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
