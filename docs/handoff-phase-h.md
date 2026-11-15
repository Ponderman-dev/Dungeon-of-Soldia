# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 44): NEXT = THE USER PICKS A NEW UI (pixel-RPG concepts D / E / F, or C)
- BRANCH: see the last line of this section (written at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- WAITING FOR THE USER: **new UI** ('new style and new arrangements'). Round 1 A Party Cards (paper) + B Clean Glass
  (modern) REJECTED ('don't like'); C Retro Handheld not rejected. Round 2 ('more UIs that fit the pixel RPG stuff'):
  **D Classic JRPG Windows** (blue windows, heroes as rows, skills as NAMED commands), **E Dungeon Stone** (carved stone
  bar, health gems, iron skill sockets; my pick), **F 16-bit Tactics** (bevelled colour panels, face portraits, target
  panel on top). Each = fight screen + camp screen. NO ANSWER YET: ask which one / which mix (question tool).
  Sources: `docs/proposals/ui-concepts/` (`mock.html` A-C, `mock2.html` D-F, fake HTML; `node docs/proposals/
  ui-concepts/render.mjs <scratch dir>` -> 12 PNGs, then SendUserFile). After the pick: build it in a SCRATCH COPY of
  the repo first (real game screenshots), then apply. Known problem every concept fixes: skill squares are ~40px
  (under the 44px finger size), no HP numbers, no target info.
- ART REDO = KIV (user: 'still not very different'). Wanted: every sprite 'like one artist made it', DIFFERENT
  APPROACHES not style variants, heroes may be REDESIGNED. Round 1 (3 styles: big heads / classic / blocky) = 'way too
  similar'. Round 2 (big detailed 48px sprites vs simple mascots) was drawn but NEVER SENT. Scripts:
  `docs/proposals/hero-art/pilot-round1.py`, `pilot-round2.py` (`python3 <file> <out.png>`); today's 65 sprites side by
  side: `node scripts/dev/sprite-sheet.mjs <repo> <out.png>` (measured: 265 colours, outlines on some, not on others).
  Before round 3 ASK for references / sketches (question tool); scope = characters only (no icons / props).
- OPTIMIZATION IDEAS offered (user has not picked): (1) sounds out of the code bundle (3.5 MB page, 1.3 MB of it = 105
  sounds as data urls, Phaser ~1.4 MB), (2) fps counter in the TEST menu + try a real low-end Android, (3) overlays
  redrawn every frame (status, orders, bars, hit fx), (4) custom Phaser build, (5) a guided first floor (no tutorial for
  tap focus / drag / move orders), (6) thin health bars, no enemy names. Desktop headless: steady 60 fps.
- DONE this session (all on the branch, game page republished):
  - CODE CLEANUP: stray root files gone; UI trial flags + the old mono theme + unused palettes removed (crimson and
    gold is the ONLY theme, `UI.goldTheme`); 15 item test files -> 3 (`items-batch`, `items-g`, `items-s`);
    **BattleState.js split** (925-line core + `src/systems/battle/*.js`) and **BattleScene.js split** (440-line core +
    `src/scenes/battle/*.js`, `shared.js` = constants): mixins, every method unchanged (combat.md 'WHERE THE CODE IS');
    7 dead proposal pages deleted. NOT checked by eye: Glossary + Squad screens after the theme clean-up.
  - TAP FIXES (movement.md 'TAP FIX' + 'BLOCKED MELEE HEROES'; user: 'heroes focus on moving instead of attacking'):
    enemy tap circle 70px, a short press on a hero = a tap (its touch box swallowed 4 in 10 enemy taps), tapping an
    enemy ends a walk, stuck walkers give up after 0.4s, blocked melee heroes hit the enemy in their way.
    USER HAS NOT CONFIRMED ON THE PHONE YET: ask how it feels; all numbers in combat.json `moveOrders` / `movement`.
- NEW TOOLS (`scripts/dev/`, dev server on :5190 from the scratchpad): `smoke.mjs` (headless run over floors / bosses /
  rooms, reports page errors: use after any scene refactor), `tap-stress.mjs` (real mouse taps with finger error: right
  enemy / other / squad walks / nothing), `idle-time.mjs <repo>` (rules only: longest time a hero does not attack).
  Lint for undefined names: eslint 9 `no-undef` on a scratch copy of `src` (not installed in the repo).
- STILL OPEN (older): BOSSES REWORK (was next in session 43's note: archive, search 'session 43 start note'),
  transitions phase 2-5, PASSIVE icons gold frame, Studio UI, session 33 item leftovers, music (user named it; sound is
  on hold: ask what 'music' means, tracks or the sound effects).
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through.
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`, it dies
  when the worker restarts: start it again). Fresh clone: `npm install` first. Playwright in an .mjs file:
  `createRequire(import.meta.url)('playwright')`. Dev: `window.__game`; start a fight: stop 'Title', start 'Battle'.
- BRANCH STATE: `main` has EVERYTHING (session 43 merged in at the handoff, user said yes). Start the next branch from `main`.

## How we work with this user
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
