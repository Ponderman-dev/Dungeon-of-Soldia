# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 35): NEXT = BUILD THE STUDIO UI (user: 'let's build the sprite editor'; hero pixel art is KIV = parked)
- BRANCH: `main` has EVERYTHING (session 34 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- Studio: read docs/systems/studio.md first (build/publish steps there). Session 34 added the ELLIPSE tool (O) and SHADE
  brush (D, Shift / "Shade lightens" = lighter); the studio page is NOT republished since: republish with this work.
- PLAN (user-shaped through mock-ups; show a screenshot of the REAL studio before/after each step, ask before big moves):
  1) SIMPLER DRAW SCREEN = docs/proposals/studio-ui/mock-draw.png (source mock.html?view=draw, a fake page, not code).
     No empty columns (user: 'the left and right is empty, rearrange'): LEFT column = preview (Play drop-down + play +
     Arena + zoom + speed drop-downs, Mirror) + PARTS list (small picture of each part, up/down, '...' menu = copy,
     delete, rename, flip, turn, outline, copy to) + WHOLE CHARACTER (health bar slider, swap colour, versions, trace,
     undo unsaved, back to game). RIGHT = ONE vertical tool strip (+ mirror, undo, redo) + the board filling the rest;
     the picked tool's options in a row above the board (+ board zoom); ONE colour strip under it (current, character,
     starter); long help text -> a '?' button + tooltips. Animate / Items / Effects: same look where it applies.
  2) NEW 'SHEET' TAB = docs/proposals/studio-ui/mock-sheet.png (from the user's sketch): 6 canvases (3 x 2), each with a
     drop-down to pick ANY sprite and its parts as SMALL thumbnails on its right (user: the parts column was 'super
     big'); a button per canvas switches it to ITEM MODE = 3 x 3 small canvases, each with its own item-icon drop-down;
     tap a canvas to draw on it (gold border); one shared SWATCHES bar + one TOOLS bar at the bottom.
- HERO ART (KIV, user will come back to it): 20+ directions drawn as pixel mock-ups in docs/proposals/hero-art/
  (styles.html = all drawings as letter grids + a renderer, `?only=<keys>`; PNGs of each round). User's LATEST: their own
  3 KNIGHT SKETCHES (barred helmet + plume, floating fist with sword, shield, big head; angry / sleepy / 3/4) drawn as
  `ks`, then WITHOUT outline (`ksn`, styles-ksn.png). Rejected / dropped: shading-only variants ('I want different
  sprites'), the round-head + wide-legs sketch (O-O5, 'ditch this'). Nothing is in the game.
- OPEN from session 33 (unchanged, see archive 'session 34 start note'): weak-item build tests, placeholder item choices,
  first-draft item looks, MOVE ORDERS, boss rework 80 / 100. Game page not rebuilt since the session 33 item buffs.
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish again
  (if refused as 'identical', publish once more). Fresh clone: `npm install` first.

## How we work with this user
- 'Discuss first' / 'Hold on' / 'let me write first' (session 30) = STOP and wait for their text; no building meanwhile.
- Unfair luck bothers them ('potentially BS'): when a random move can pile up on one hero, show sims (hits per hero) and spread rules.
- MOCK-UPS (session 34): 'before doing anything show me a png' = fake HTML page in the scratchpad + Playwright PNG
  (SendUserFile), no code changes; then small rounds of their tweaks. Art: they want DIFFERENT SPRITES (shapes), not
  shading variants; they send phone sketches to copy; hero sprites ~24 px tall like today's.
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
