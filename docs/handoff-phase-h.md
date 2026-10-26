# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 32): NEXT = BUILD THE PLANNED ITEMS (session 31 = item review, decisions only)
- BRANCH: `main` has EVERYTHING (session 31 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- BUILT in session 31: MIXING ELEMENTS PENALTY (combat.json `elementMix`, `elementMix()` items.js, test
  element-mix.test.mjs): each different element among a hero's items past the first = -10% to that hero's element
  damage (4 elements -30%); Mage exempt; Euclid removes it; Poison Bombs provides dark (TO UNDO when the bomb plan is
  built). Details: docs/systems/items.md (last line).
- PLANNED, NOT BUILT (~40 items): all in docs/item-decisions.md, section 'Session 31' at the END, every line tagged
  '[planned, NOT built]'. Groups: Euclid rework (C + D1 prism burst), regen trio, boss badges (Bounty, Big Game),
  bombs, low-health saves + Phoenix Feather, fire trio, ice, electric (Thunderstruck stacks, Kinetic Coil v2),
  FUSED PAIRS (Ghastly Fire / Frozen Thunderbolt count as one element), Reaper's Bell haunting spirits, Sharp Edge /
  Eagle Eye 25%, conditional damage, minions (families, boosters, 4 NEW epic element totems, 6-minion cap), Soul Lantern.
- BUILD PLAN (suggested): small batches, numbers-only first (no new looks), then new mechanics; every NEW LOOK
  (prism burst, haunting spirits, Kinetic Coil glow + lightning, Eruption, totems) shown in the game first (art rule).
  New effect shapes need a copy in the test fixture (CLAUDE.md 'Tests vs tuning').
- OPEN DECISIONS (ask, don't guess): DEFENSE ITEMS proposals waiting for the user: (1) Shield Totem -> squad block 4%
  each hero (+4%/copy); (2) Spite Mail -> no reflect, while taunting +30 defense +30 resist, heal 1% per hit taken;
  (3) Tough Skin -> 3 or 4% of the hit, whichever bigger. Padded Vest +12: I advised keep (user asked, no answer).
  Not reviewed yet: damage tricks, on-hit statuses, skills (Metronome weak), squad/support (War vs Jolly Banner),
  kill effects (Emergency Buckler weak), Sweeping Strap weak. Euclid prism meter size / blast % still to set.
- ALSO WAITING: MOVE ORDERS (user picked: tap floor = whole squad walks there, drag a hero onto floor = that hero
  walks there; on arrival they go straight back to fighting). Older NEXT: boss rework 80 / 100 (see archive).
- Element bench (not kept, scratchpad only): stacking.mjs loop, floor 30 level 12, every tick set heroes hp=maxHp, sum
  `attack` event amounts where attacker = holder (or its minions), seeded rng per build; 12 trials x 90s each.
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish
  again. Fresh clone: `npm install` first.

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
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
