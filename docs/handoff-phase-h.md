# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 29): NEXT = 1) VISUAL GLITCH + BUG HUNT, 2) SIMULATIONS ON THE NEW ITEMS (user asked both)
- BRANCH: `main` has EVERYTHING (session 28 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- 1) INTENSIVE VISUAL GLITCH / BUG FIXING (first). Play real fights in a scratchpad worktree (Test helper below) and look
  for glitches: effects left on screen, wrong positions, overlaps, fx on dead/moved units, text piles, z-order, crashes
  (`pageerror`). Good tools: `docs/proposals/item-fx-review/record.mjs <dir> <port> [clipId]` records each new item
  (Knight ALONE vs 10 Risen Skeletons via the new dev flag `?lineup=risen_skeleton*10`), then ffmpeg contact sheets
  (`fps=..,tile=..`) to scan frames. Things seen in session 28, not yet checked: the Sweeping Strap icon pop fires on
  EVERY strap hit (maybe too noisy now that the cleave shows; ask), Frozen Demon Head icicles can stack on one enemy
  (two holders), item-name labels pile up over a crowded hero, last clip crop was cut at the bottom (taller crop
  `crop=320:400:35:360,scale=960:1200` was about to be tried, user stopped it: ask before re-recording).
- 2) SIMULATIONS on the 21 new items (user OK'd sims for this): balance, combos, extensive review. Tools:
  `node scripts/tests/itemruns.mjs` (one item), `node scripts/tests/review.mjs 4 all`, `curve.mjs 3 smart`
  (docs/systems/balance-tools.md). Look for: too strong/weak items, combos that run away (bombs + Bombardier's
  Barrel, Euclid + charms, Reaper's Bell chains, Frozen Demon Head + ice kits, Kinetic Coil on Rogue, Sharpest Blade
  on physical heroes), Emergency Buckler after its cut. Show the user NUMBERS in tables (see 'How we work').
- DONE session 28 (all in main): item review page round 3 (clips + live stages, notes `notes3`, all 5 notes done):
  Emergency Buckler 6%(+3%) -> 4%(+2%); Frozen Demon Head = giant crooked icicle from the user's sketch, enemy held
  still inside while frozen (`Character.encase()`); Sharpest Blade = big yellow slash; Euclid = fireball / icicle /
  white bolt projectiles per cast; Sweeping Strap = one Sven-style cleave crescent on every strap hit (reach kept 60px:
  user, although enemies usually stand 100-150px apart so side hits are rare). Details: docs/systems/effects.md.
- Item Review page (https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef) still shows the OLD clips (3 heroes); the new
  looks are not on it yet. Rebuild: `make-item-review.mjs` + clips from record.mjs (docs/proposals/README.md).
- STILL OPEN (older): HERO MINIONS PILE UP on high floors; skill books same modifier twice refused: OK?; UNSEEN BONUS /
  FEWER COMMONS from floor 41; Kinetic Coil charges have no look; preview page + itch zip are old (sessions 26-28).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad. Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Battle')` (registry `squadIds`; `?floor=N&room=treasure` on an even
  floor = a fight; `?lineup=` picks the enemies). Playwright: `/opt/node22/lib/node_modules/playwright/index.mjs`.
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish
  again (may need a third identical publish). Publishing with `edits` sends only the page: pass `files` for clips.
- Fresh clone: `npm install` first (node_modules is not there).

## How we work with this user
- ART changes: show in-game clips/frames (SendUserFile, plus a slow-motion copy), then the question tool; the user
  answers with sketches or references (e.g. 'like Sven's cleave') and wants ONE clean line, not layered effects.
- NUMBERS: the user wants to SEE stats (tables in chat, floors side by side, real enemies like Goblin/Orc Brute) before
  picking; 'stop asking questions' = show the numbers in chat, then wait (no question tool, no review page unless asked).
- NO BALANCE SIMULATIONS unless the user asks (user, session 24: 'no need run simulation'): curve/review/itemruns cost time.
- 'Don't commit / don't push a preview' (user, session 25): when they say it, keep changes uncommitted and say so (the
  stop hook will nag; explain, don't commit). Preview only when they ask.
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
