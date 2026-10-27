# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 34): NEXT = CHARACTER STUDIO (pixel sprite editor) work (user: 'I want to get back on the pixel sprite editor')
- BRANCH: `main` has EVERYTHING (session 33 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- Studio: read docs/systems/studio.md first; build/publish steps there (url https://claude.ai/artifact/1azV1LBUimRkeavNpQBgc7).
  Ask the user what they want in the editor; nothing is planned yet.
- SESSION 33 DONE: every '[planned]' item of sessions 31/32 is BUILT (docs/item-decisions.md, now tagged '[built session 33]';
  mechanics in docs/systems/items.md 'Session 33 batch 1-3', test scripts/tests/items-s31.test.mjs uses the REAL items.json).
  Then: item RANKING sim of all 117 items (scripts/tests/rankitems.mjs, report docs/item-ranking-s33.md) and the user's
  balance picks: Guardian's Banner + Assault Breastplate -> legendary, Cautious Banner -> epic, Conqueror's Flag 10% (+5),
  Bloodlust Mask nerf (extra copies +20% speed / +2% lifesteal, no squad share), 9 weak items buffed (item-decisions.md end).
- ITEM REVIEW page round 4 (session 33 changes + each item's ranking result, notes in db collection `notes4`):
  https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef. Read the notes when the user says they wrote some.
- OPEN (later, user: 'fix this later'): weak items whose sim was unfair need a BUILD test with partner items (Euclid, Kinetic
  Coil, the 4 Collars, Overseer's Whistle, Gag Rune, Shatter Hammer). Placeholder choices to confirm: Euclid prism fill 1000%
  / burst 300%, Collar names (planned 'element totems'), Thunderstruck no longer once per run, Eruption +75%/copy,
  Kindling burn chance flat. FIRST-DRAFT LOOKS never approved: Collar / Conqueror's Flag / Sigil / cleave-axe icons, Shield
  Totem sprite (minions.json), Fear Ring + Prism Burst have no own look yet (reuse effects). Conqueror's Flag: holder's
  MINION kills still don't count (as written).
- ALSO WAITING: MOVE ORDERS (tap floor = squad walks there, drag a hero onto floor = that hero walks; back to fighting on
  arrival). Boss rework 80 / 100 (archive).
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish again
  (if refused as 'identical', publish once more). Fresh clone: `npm install` first.

## How we work with this user
- 'Discuss first' / 'Hold on' / 'let me write first' (session 30) = STOP and wait for their text; no building meanwhile.
- Unfair luck bothers them ('potentially BS'): when a random move can pile up on one hero, show sims (hits per hero) and spread rules.
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
- QUESTION TOOL (session 31): after a worker restart it can come back '[No preference]' twice: then ask in TEXT.
- Item reviews (session 31): user wants ONE simple line per item; lists of 4 ideas, they often answer 'other'/'more':
  give a longer list in text. They decide stacking per copy each time (show copy tables 1/2/3/5).
- Balance (session 33): the user picks from option tables (question tool, copy tables 1/2/3/5) and often says 'No sim'.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
