# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 38): NEXT = THE USER PICKS FROM THE KIV LIST BELOW (session 37 ended on 'let's revisit our kivs')
- BRANCH: `main` has EVERYTHING (session 37 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- DONE session 37 (all in the game, docs/systems/title-base.md section 5 + ui.md): SETTINGS, GAME-OVER summary (+ run
  stats, systems/runStats.js), PROFILE (achievements, banners, rename), HEROES page (lore DRAFTS), GLOSSARY (learns as you
  play: progress.seen), LEADERS + SHOP (look only, sample players, stand-in recolour looks), and the new UI LOOK: STONE
  windows (user's pick after 7 rounds: 'gothic shape + Torchlit Stone colours, stone frame', neat version S2; ui.md).
- KIV / OPEN (ask the user which first; one per session):
  1. HERO ART (docs/proposals/hero-art/, user's own 3 knight sketches drawn as `ks` / `ksn`; nothing in the game).
  2. STUDIO UI (simpler draw screen + new SHEET tab, archive 'session 35 start note', docs/proposals/studio-ui/).
  3. MOVE ORDERS (tap floor = squad walks there, drag a hero onto floor = that hero walks; back to fighting on arrival).
  4. BOSS REWORK floors 80 (Rask & Vesh) and 100 (Morthul) (archive 'session 31 start note').
  5. Session 33 item leftovers: weak-item build tests, placeholder item choices, first-draft item looks.
  6. SOUND (ON HOLD since session 5; MUSIC slider in Settings is saved but there is no music yet).
  7. From session 37: REAL hero looks (shop sells stand-in recolours; owned looks not worn in fights), banners drawn in
     the Studio (YOUR ART '+'), lore + glossary basics/status lines to review, wallet / payments / online leaderboard
     (server), OUTLINE style for sprites (archive), early floors a bit harder (archive).
  Game page NOT rebuilt since session 33 (all session 37 screens unseen on the phone): rebuild when the user says
  'show me'. Studio page not republished since s34.
- UI style trials lived in /home/user/ui-trials (a repo copy with `?ui=` themes; gone in a new session). Lesson: check
  ui.md / the session-6 page (https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC) before proposing UI looks again.
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish again
  (if refused as 'identical', publish once more). Fresh clone: `npm install` first.

## How we work with this user
- UI LOOK rounds (session 37): they reject a lot and say 'try more first'; show the real game (camp + 4 menus) per style,
  label each, and offer palettes / 'neater' versions of the one they half-like. '[No preference]' = ask again in text.
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
