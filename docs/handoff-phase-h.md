# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 16, 2026-10-20): NEXT = ENEMY ADJUSTMENTS
- LATEST BRANCH: `ccr-6323ff2c-ctwhz9` has EVERYTHING (claude/screen-review-notes-zk4cfb and session 14 merged in). Start
  the next session from it. Before building/publishing: `git fetch` and check newer session branches are merged
  (`git merge-base --is-ancestor`); the old ccr-a59eab7b / ccr-a7ab1d1c / phase-h-tuning / scaffold / quick-gloves branches
  are pre-squash history, already in (ignore them).
- DONE this session (user played and asked):
  - Heroes tougher: +10% defense/resist, once-per-run DEATH SAVE (first killing hit does 50%, still lethal = dies; NO
    'SAVED!' pop-up, user's choice). combat.json `heroDefense`, `deathSave`; docs/systems/combat.md.
  - Danger look: red low-health glow at the bottom edge under the hero (<30%), a fallen hero tips over, POOFs into a
    tombstone, '<NAME> FELL'. combat.json `heroDanger`.
  - Fixes: heroes now really fade out in the entrance door (SquadScene.placeBench kept resetting them); the passive text
    closes on any tap.
  - FIRST ENEMY ADJUSTMENT: Shieldbearer nerfed (Guard shield 20% -> 12% of its health, never on itself). docs/systems/enemies.md.
- NEXT TASK (user): ENEMY ADJUSTMENTS. Ask which enemies feel bad in play (user plays on phone and reports). Smart curve
  now: median floor 37, mean 47.5, alive after 20/40: 84%/41%. Top killers: BOSS Grukk (floor 20), BOSS Brood Mother,
  mimic, Monster House. Read docs/systems/enemies.md (roster, traits, director) / bosses.md first. Tools:
  `node scripts/tests/curve.mjs 3 smart` before/after every change; `scripts/tests/tune-enemies.mjs`; enemy tests
  enemies-batch1/2, enemy-traits, dungeon-roster. Enemy abilities = boss format (`abilities`, bosses.js abilityTargets).
- OPEN (offered, not done): Bone Sacrifice pops 'Sacrifice!' 3-4 times stacked; Mystery Brew (alch_brew) has no sound;
  Death Coil demo note still says 'change' (ask the user to re-mark it).
- PARKED: HERO REDRAW proposal (chunky heroic body, 3/4 view, BIG weapons; keep 3 parts or go to 6).
- Test helper (scratchpad, throwaway): Playwright + vite dev on its own port from a git worktree copy; the squad screen
  shows first: set registry `squadIds`, stop 'Squad', start 'Battle'; `window.__game`, `?floor=5&room=fight`.

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
