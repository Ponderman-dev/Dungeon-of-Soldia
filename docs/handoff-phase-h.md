# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 43): NEXT = BOSSES REWORK (user asked at the end of session 42)
- BRANCH: `main` has EVERYTHING (session 42 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST read `docs/systems/bosses.md` (one long line per boss), then ASK with the question tool: WHICH bosses (the old
  plan was 'especially 60, 80, 100'; 60 Frost Warden was reworked in session 30, so 80 Rask & Vesh and 100 Morthul are
  next, then 120 Ignatius / 140 Sela / 160 Vharox) and WHAT is wrong (too easy, boring, unfair, looks). The user often
  wants to WRITE the design themselves ('let me write first' = stop and wait): offer mechanics + numbers, don't push.
- COPY SESSION 30's FLOW (Frost Warden; archive: search 'session 31 start note'): rules + tests first, then each new
  look ONE at a time IN THE GAME (clip + slow-motion x3 + frames, question tool), then numbers with the smart curve
  (`node scripts/tests/curve.mjs 8 smart`, ~2 min, 3/squad is too few past floor 60) and `bosscheck.mjs`, then a full
  recorded fight. Recording recipe + 'show a boss move' trick: archive, same note. Effects: `src/systems/bossFx.js`.
- Last boss numbers (bosses.md, smart bot, squads that REACH the boss): Grukk ~87-93%, Brood Mother ~73-80%, Frost
  Warden 39-55%, Rask & Vesh ~10% (fixed tool) / ~97% (session 30 curve: numbers disagree, re-run first), Morthul
  ~67-100%, Ignatius ~32%, Sela ~85%, Vharox ~43%. Show NUMBERS in tables before changing any.
- Dev url flags for a boss floor: `?floor=80` (also `?elite=1`, `?lineup=`); Brood Mother demo page exists (CLAUDE.md).
- DONE session 42 (title-base.md '4b. HUB v2'), game page republished: camp = mobile-game hub (ONE gold header panel:
  profile, best floor, gems, gear; gold-framed EXPEDITION with 'NEXT BOSS: FLOOR n' (`dungeon.js nextBossFloor`); tab bar
  HEROES / GLOSSARY / LEADERS / SHOP); richer camp props (banner, stone brazier with glow, weapon rack + shield, cooking
  pot, sleeping dog, rolled bedroll, supplies), loose clusters, NO outlines, drawn in the FLOOR's style (`propLook`:
  under the floor light, muted + speckle + dark edge); tent removed (prop kept).
  Battle PAUSE + SPEED buttons top right (ui.md; `pause.json`, `PauseScene`: RESUME / SETTINGS / GIVE UP = defeat).
- STILL OPEN (other topics, one per session): transitions phase 2 (menu tabs slideSwap + pop-ups popIn), phase 3-5
  (opening, the run, sounds), FIGHT HUD redesign, PASSIVE icons gold frame. KIV: hero art (knight sketches), Studio UI, session 33 item leftovers, music.
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through.
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`, it dies
  when the worker restarts: start it again). Fresh clone: `npm install` first. Camp: stop 'Title', start 'Base'.

## How we work with this user
- LOOK ROUNDS (session 42): a SCRATCH COPY of the repo (`tar` to the scratchpad, symlink node_modules, own vite port,
  `?hub=` flags) for big layout trials; 3-up PNG sheets on the real floor for new prop shapes (python draws pixel rows).
  Their answers are often a new direction in 'Other' ('neater', 'simpler', 'not that kinda dim'): ask what they mean
  with options before building. Keep the stop hook waiting until they say 'great'.
- LOOK TRIALS (session 41, worked well): a dev url flag per variant (?pal=, ?skf=), Playwright screenshots side by side
  (2x zoom crops for small HUD bits), SendUserFile + the question tool; apply the pick, delete the trial code.
- Ambiguous 'the box colour' (session 41): ask WHICH box before building variations (I guessed wrong once).
- Look changes stay UNCOMMITTED until the user OKs them ('great' counts); explain to the stop hook instead of committing.
- REFERENCE PICTURES (session 40): the user sends screenshots of other games ('like this'); make OUR OWN take, try it in
  the real game, show real screenshots on the review page; they then ask for 'more variations / other palettes'.
- They reply with short fixes after trying the preview on the phone (overlaps, readability, which button is red):
  fix all in one round, rebuild the preview once.
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
