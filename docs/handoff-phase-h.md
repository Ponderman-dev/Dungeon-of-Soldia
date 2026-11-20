# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 46): BUILD THE 31 NEW SKILL-BOOK PAGES (user: 'handoff first before executing')
- BRANCH: `main` has EVERYTHING (session 45 merged in at the handoff). Start the next branch from `main`.
- TASK: build the 31 new pages the user picked. The full list (name + one line each, tiers) is in
  `docs/systems/skill-books.md` 'NEXT: 31 NEW PAGES'; read that file first. Build in BATCHES of about 8 (commons first),
  numbers in skillBooks.json, one test per mechanic in `skill-books.test.mjs`, a `tier` on every page, and an ICON
  entry in `src/data/pageIcons.json` for every new page (a test fails without it; hero pages = crimson `heroFrame`).
  Hero pages need `hero: '<heroId>'` and only fit that hero's named skill (pageFit must refuse other skills: not built
  yet). After each batch: full `npm test`, then show the user the new icons (all-icons sheet, see below).
- DONE in session 45 (all on main):
  - NO SHOVING (movement.md 'NO SHOVING'): a walker stops at a standing fighter, steps around it, or waits for a gap.
    Push per fighter in a 12-enemy crowd 222px -> 21-31px. Not yet seen by eye on screen; ask how fights feel now.
  - PHONE SPEED (ui.md 'PHONE SPEED'): text canvases kept in memory, no redraw for an unchanged colour, 'TEST: speed
    (fps)' readout in the TEST menu. User still said 'Lagging' (that was likely the OLD zip on itch.io): ASK for the two
    readout lines (fps / slow / game + device) before more speed work.
  - PAGE TIERS + PAGE ICONS (skill-books.md): common / rare / legendary / hero; golden book 20% legendary, 5% hero
    page (both can happen); every page a coloured spell tome (user picked 'F' out of 6 kinds). First-draft symbols:
    offer tweaks (Razor Ink reads weakest, Titan dull, Desperate small).
- ITCH.IO: `npm run build:itch`, copy `itch-page.html` as `index.html` into an empty folder, zip it (ONLY index.html),
  SendUserFile. The user uploads it, ticks 'played in the browser'. Their page still had the OLD Oct 20 html upload and
  a 405 x 720 viewport (told them: delete the old file, set 390 x 844); ask if done.
- Icon sheet (all page icons with real frames, no browser game needed): a node script calling `pageIconArt` +
  `framedIconPixels` that writes HTML, then a Playwright screenshot (session 45 scratch `icons/all.mjs`, rewrite it).
- OPEN from earlier: art redo KIV, optimization ideas, bosses rework, transitions phase 2-5, camp header frame
  (offered to flatten, no answer), fight HUD not checked in boss fights / rooms: details in the archive.
- DEV TOOLS (`scripts/dev/`, dev server on :5190 from the scratchpad): `smoke.mjs`, `tap-stress.mjs`,
  `idle-time.mjs <repo>`, `push-drift.mjs <repo>` (NEW: px shoved per fighter, drift, swings; before/after tables).
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through. (Last published: session 45, with the no-shoving fix only.)
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`, it dies
  when the worker restarts: start it again). Fresh clone: `npm install` first. Playwright in an .mjs file:
  `createRequire(import.meta.url)('playwright')`. Dev: `window.__game`; start a fight: stop 'Title', start 'Battle'.
  Open the reward screen by hand: `battleScene.scene.launch('Reward', { state, choices: [card], floor, onDone(){} })`,
  then set `bookPages` and call `showPages()` (`g.scene.launch` does not exist on the game's scene manager).
- TESTS: seed BOTH the state rng and Math.random for crowd tests, and use a mixing rng (mulberry32): the simple
  16807 one gives the same fight for small seeds (session 45 hid a 1-in-10 case that way).

## How we work with this user
- RARITY (session 45): the user worries about SNOWBALLING ('OP pages after every boss = too easy'): strong things
  must be RARE (legendary 20% per boss, hero pages 5%). Ask for odds with 'about 1 run in N' meanings.
- PICKING ART (session 45): first round of 3 kinds rejected ('let's try something else'), second round of 3 other KINDS
  got a pick. Mock 8 real items per kind in one PNG (frame = tier), then the question tool.
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
