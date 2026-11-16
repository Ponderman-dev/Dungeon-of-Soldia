# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 45): TWO TASKS FROM THE USER (one per session; ask which first)
- BRANCH: `main` has EVERYTHING (session 44 merged in at the handoff). Start the next branch from `main`.
- TASK 1: **PUSHING between units is 'still kind of horrendous'** (user, end of session 44; no details given). Read
  `docs/systems/movement.md` first (pushing, 'TAP FIX', 'BLOCKED MELEE HEROES'). ASK what looks wrong (question tool
  with typical cases: units sliding / jittering, heroes shoved out of place, units stacking, enemies pushed through
  each other), then measure it like session 43 did (they like a stress test with a before / after table:
  `scripts/dev/tap-stress.mjs`, `idle-time.mjs`, real fights in the browser), fix, show clips.
- TASK 2: **20 to 25 MORE skill-book MODIFIER pages** (user: 'add more skills modifier skill books to the mix').
  Read `docs/systems/skill-books.md`; today `src/data/skillBooks.json` has 21 modifiers. Flow that worked for items
  (session 31 / 33): a list of ONE simple line per idea in chat (more ideas than needed, they answer 'more' / 'other'),
  the user picks, then rules + tests, numbers in JSON. Ask before designing: per hero / per skill or general ones.
- DONE in session 44 (all on main, game page republished):
  - FIGHT HUD = layout 'L' (ui.md 'FIGHT HUD: hero slots'): skill squares 54x50, under them a health line + passive
    icon + NAME + health number, items in ONE row. REJECTED: concepts A-K (big panels: 'something more minimalist like
    right now that doesn't cover a lot of screen during runs'), the dark bottom dock (M), ANY enemy info box ('will
    only clutter when lots of enemies'). Only seen in a normal floor-7 fight: boss fights / rooms NOT checked by eye.
  - CAMP buttons flat (title-base.md 'CAMP BUTTONS: flat look'): tabs plain, EXPEDITION = gold bands + bigger words.
    The header panel (name, gems, gear) still has the old ornate frame: offered to flatten it, no answer.
  - Tap fixes from session 43: user says 'Good now'.
  - USER HAS NOT REPORTED BACK from the phone on the new fight HUD and camp: ask for small fixes.
- UI mock-ups: `docs/proposals/ui-concepts/` (`mock.html` A-C ... `mock5.html` P-R; `render.mjs <dir> [letters]` for
  A-K; mock4 / mock5 are drawn over real screenshots, `?v=<letter>`). Rounds that worked: fake HTML over a REAL
  screenshot, then the pick built in a scratch copy (real screenshots), then applied.
- ART REDO = KIV, OPTIMIZATION IDEAS not picked, older open items (BOSSES REWORK, transitions phase 2-5, PASSIVE icons
  gold frame, Studio UI, session 33 item leftovers, music): details in the archive, search 'session 44 start note'.
- DEV TOOLS (`scripts/dev/`, dev server on :5190 from the scratchpad): `smoke.mjs` (headless run, page errors),
  `tap-stress.mjs`, `idle-time.mjs <repo>`.
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through.
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`, it dies
  when the worker restarts: start it again). Fresh clone: `npm install` first. Playwright in an .mjs file:
  `createRequire(import.meta.url)('playwright')`. Dev: `window.__game`; start a fight: stop 'Title', start 'Battle'
  (`?floor=7` is a plain fight; floor 9 rolled a room).

## How we work with this user
- MINIMAL UI (session 44): they want the dungeon visible; small upgrades to today's layout beat new concepts. 'A tiny
  bit fancy' = ONE small ornament on the main button only; show 3-5 real variants, they trim ('without the diamond').
- 'DIFFERENT APPROACH, not a different style' (session 43, art + UI): variants that share a layout or proportions read
  as 'too similar'. Offer concepts that differ in KIND (layout, where things sit, what is shown), and ask first with
  the question tool WHICH kinds they want to see. They reject by family ('don't like clean glass and party cards') and
  ask for 'more that fit the pixel RPG stuff': stay inside pixel-RPG traditions.
- 'See in depth if it can be triggered again' (session 43): they like a STRESS TEST with numbers (before / after table)
  for feel bugs, not just a fix. Real input events found what the unit tests could not.
- 'Let's do all' = go through the whole list without asking per step, still one commit per step.
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
