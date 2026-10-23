# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 30): NEXT = BOSS REWORK for floors 60, 80, 100 (user asked)
- BRANCH: `main` has EVERYTHING (session 29 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- BOSS REWORK (user: 'bosses rework, especially 60, 80, 100'): Frost Warden (60), Rask & Vesh (80), Morthul (100).
  Read docs/systems/bosses.md first. Smart-player curve (session 29, `curve.mjs 3 smart`): bosses beaten by squads that
  reach them: 20 Grukk 87%, 40 Brood Mother 81%, 60 Frost Warden 99%, 80 Rask & Vesh 97%, 100 Morthul 100%, 120-160
  91-100%. Why: squads past floor 40 have snowballed (dozens of items on one hero), boss numbers were set for weaker
  runs. Two roads (user has NOT picked yet, ask): numbers (bosses scale / much tougher) and/or MECHANICS items can't
  just outdamage. Show NUMBERS in tables; `bosscheck.mjs` + `curve.mjs`.
- DONE session 29 (all in main): BUG HUNT (auto-play script over ~450 floors, no crashes): ranged shots leaked and
  removed the new shot mid-flight (fixed), one Frozen Demon Head icicle per enemy, gain-name labels stack, icon-pop
  deck backlog capped. ITEM SIMS + CHANGES (user picks, numbers in docs/item-decisions.md 'Session 29'): Sweeping
  Strap quiet (no pop) + reach 100px; Bombardier's Barrel extra copies +50% (was +100%, floor-305 runaway); Frozen
  Demon Head turns the holder's own fire/electric/dark attacks to ICE (Mage was -9 floors); Euclid 25%/70%; Reaper's
  Bell 150px; Kinetic Coil charges from blocks too. SHARPEST BLADE REWORK (user: gimmick = NO elements): pure steel
  +40%, every 5th pure attack = Heart Strike 500% + 15% max health (boss 4%) + stun + armor break -50% defense 5s,
  a Heart Strike kill = the next one too; gold weapon glint before it (user OK'd the look); stacking = numbers only.
  Best legendary on physical heroes now (+10..+13 floors vs Dice +2..+8).
- STILL OPEN: Kinetic Coil and Reaper's Bell still ~0 floors (need a new idea, not numbers); HERO MINIONS PILE UP on
  high floors; skill books same modifier twice refused: OK?; UNSEEN BONUS / FEWER COMMONS from floor 41; smart bot
  doesn't keep a Sharpest Blade holder free of elements (undersells it in curve.mjs); preview page, itch zip and the
  Item Review page (https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef) are old.
- Sim helpers from session 29 lived in the scratchpad (gone): a combo runner = itemruns.mjs with a per-hero loadout and
  the same seeds per line (+ a 'keep the Blade holder pure' reward filter); an auto-play bug hunter (Playwright, 3x
  speed via rAF/performance.now, autopilot for Reward/Puzzle/rooms, leak probes). Rebuild if needed.
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
  (Session 29: the user asked for sims and liked the tables; for a balance topic they ask for, sims are welcome.)
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
- Item reworks: the user keeps an item's GIMMICK (Sharpest Blade = no elements); rework around it, don't remove it.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
