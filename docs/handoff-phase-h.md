# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 36): NEXT = MOCK-UPS: SETTINGS, then PROFILE, then GAME-OVER ANALYTICS screen (user's order)
- BRANCH: `main` has EVERYTHING (session 35 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- Session 35 = camp menu screens as MOCK-UPS ONLY (nothing in the game code): read docs/systems/title-base.md section 5
  (all picks + the spacing rule) and look at docs/proposals/menu/*.png. Picks: Glossary = book with chapters, fills in
  as you meet things; Heroes = list with unlock bars + hero page C (user's own art on top, hero on a dungeon floor,
  swipe looks); Leaders = podium + WEEK timer / ALL TIME hall of fame; Shop = A (tabs Deals/Looks/Gems, daily timer).
- HOW the mocks were made: a fake HTML page in the scratchpad (390x844 screens side by side) using the real fonts
  (src/assets/fonts), real sprites (heroes.json / enemies.json parts, itemIcons.json, camp.json npcs) and a real floor
  patch (`floorArtPixels` from systems/floorArt.js, 112x112 at 3x), Playwright PNG, SendUserFile. Scratchpad files are
  gone in a new session: rebuild helpers from that description. Same look as section 5: back button 96x44 at (24,16),
  title y 76, 12-16 px gaps, 16 px inside boxes, ALL small text Press Start 2P 8px, no '$' (missing from the font).
- Flow the user liked: one mock -> their tweak ('names too big', 'more white space') -> 'make variations' (3-4 side by
  side, A = last one) -> they pick a letter -> save PNG + notes in title-base.md + commit.
- Game-over analytics = the screen after a run ends (today: `BattleScene.showDefeat()`, docs/systems/ui.md 'Defeat
  screen'); ask the user what stats they want before drawing.
- OPEN (unchanged): STUDIO UI plan (archive 'session 35 start note': simpler draw screen + new SHEET tab, mock-ups in
  docs/proposals/studio-ui/), hero pixel art KIV, session 33 leftovers (weak-item tests, placeholder items, MOVE ORDERS,
  boss rework 80/100). Game page not rebuilt since the session 33 item buffs; studio page not republished since s34.
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
- MENU MOCK-UPS (session 35): they draw phone/iPad sketches ('custom pixel art here'); copy the sketch, then variations.
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
