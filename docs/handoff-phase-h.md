# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 15, 2026-10-19)
- LATEST BRANCH: `claude/screen-review-notes-zk4cfb` has EVERYTHING (session 14's ccr-a98ebfed-s4fhg6 merged in). Start
  the next session from it. LESSON: before building/publishing the game, `git fetch` and check other session branches are
  merged (`git merge-base --is-ancestor`); a build from a stale branch once wiped the skill looks off the game page.
- SOUND DONE: sound board https://claude.ai/artifact/2pLgb918eNpVWUy2ePTSw8 (page 1 = moments + a row per hero skill,
  page 2 = every sound with a moment drop-down, 'All my sounds' = drop-down; the user's 40 PIXABAY sounds; credits
  docs/credits-sounds.md). Picks APPLIED: each skill plays its own `skill_<id>` sound (fallback skillCast); Mystery Brew
  (alch_brew) has none yet. How to re-apply / add sounds: docs/systems/sound.md 'ROUND 6' .. 'APPLIED'.
- SKILL LOOKS: all approved and in the game (heroLooks.js). Checked this session: all 20 skills cast in real fights, no
  errors, every look draws. Death Coil's demo note still says 'change' (round 2 hit is in; ask the user to re-mark it).
- OPEN (offered, not done): Bone Sacrifice pops 'Sacrifice!' 3-4 times stacked (one per skeleton) -> show it once?
- PARKED: HERO REDRAW proposal: chunky heroic body, 3/4 view, BIG weapons; open question: keep 3 parts or go to 6.
- Test helper (scratchpad, throwaway): Playwright + vite dev; `window.__game`, registry `squadIds`, `?floor=5&room=fight`,
  `sc.castFromUI(uid, i)` after zeroing cooldowns, wrap `sc.playSkillFx` to log looks.

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
