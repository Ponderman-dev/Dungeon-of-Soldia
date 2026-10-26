# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 33): NEXT = BUILD THE PLANNED ITEMS (sessions 31 + 32 = item review, decisions only)
- BRANCH: `main` has EVERYTHING (session 32 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- REVIEW IS DONE: every item group reviewed. Nothing from sessions 31/32 is built except the mixing elements penalty
  (session 31; docs/systems/items.md last line).
- PLANNED, NOT BUILT: all in docs/item-decisions.md, sections at the END tagged '[planned, NOT built]'.
  Session 31: Euclid rework, regen trio, boss badges, bombs, low-health saves + Phoenix Feather, fire trio, ice,
  electric, fused pairs, Reaper's Bell spirits, Sharp Edge / Eagle Eye 25%, conditional damage, minions, Soul Lantern.
  Session 32: DEFENSE (Spite Mail rework; Shield Totem -> block-aura TOTEM minion, front centre, no upkeep; Emergency
  Buckler -> BUCKLER 5% block/copy), MINION UPKEEP (defense part removed, attack speed stays per item), BANNERS (War
  Banner steady +10% atk speed aura; Rally Flag -> Cautious Banner; Spirit Knight Banner -> Spirit Knight's Sigil;
  NEW legendary Conqueror's Flag), Metronome every 3rd +100%, Sweeping Strap -> CLEAVE, Catalyst Vial +30% DoT,
  Serrated Edge copies, Dread Bell -> FEAR RING (3s cooldown), BOSSES IMMUNE TO FEAR.
- BUILD PLAN (suggested): small batches, numbers-only first (no new looks), then new mechanics; every NEW LOOK shown in
  the game first (art rule): prism burst, haunting spirits, Kinetic Coil glow + lightning, Eruption, element totems,
  Shield Totem minion, fear ring, cleave swing, new icons (Sweeping Strap, Spirit Knight's Sigil, Conqueror's Flag).
  New effect shapes need a copy in the test fixture (CLAUDE.md 'Tests vs tuning').
- OPEN (ask, don't guess): Conqueror's Flag: do the holder's MINION kills count? (written as holder's own kills only).
  Euclid prism meter size / blast % still to set. Element totems need new names (they do nothing for the Shield Totem).
- ALSO WAITING: MOVE ORDERS (user picked: tap floor = whole squad walks there, drag a hero onto floor = that hero
  walks there; on arrival they go straight back to fighting). Older NEXT: boss rework 80 / 100 (see archive).
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
