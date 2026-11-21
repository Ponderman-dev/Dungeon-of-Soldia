# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 51): DEEP BUG HUNT + OPTIMIZATION + SECURITY CHECK (no new features, no look changes)
- BRANCH: `main` has EVERYTHING (session 50 merged in). Start the next branch from `main`.
- TASK (user): find and fix real bugs, make the game run smoother on the phone, look for security holes. Work in
  small rounds: FIND (list what you found, ranked: crash / wrong rules / stutter / security / tidy-up) -> show the user
  the list in plain words -> fix the ones they OK, one commit each, a test per fixed bug (`scripts/tests/`, 97 files).
  Ask before anything big (refactors, new libraries, changing how saving works).
- BUG HUNT IDEAS: run long seeded runs and watch for errors / NaN health / stuck fights (`node scripts/tests/curve.mjs 3
  smart`, `review.mjs`, `bosscheck.mjs`; docs/systems/balance-tools.md). Scenes are NOT covered by `npm test`: drive
  them in Playwright (`window.__game`, dev url flags `?floor=N ?room= ?elite=1 ?house=1 ?lineup=`) and log
  `pageerror` / console errors through a whole run: floors 1-60, every room kind, every boss, reward steps (books,
  potions, 'Who gets it?'), hero death, Game Over, camp pages and back. Things that run across floors are the usual
  suspects (session 50: the Shield Totem followed the squad into rooms): timers, tweens, `events.on('update')`
  listeners, pools and views that outlive a floor or a scene restart (Phaser REUSES scene objects: anything kept on
  `this` must be reset in create()).
- OPTIMIZATION (session 50 method, keep it): 4x CPU slowdown (CDP `Emulation.setCPUThrottlingRate`), record every
  frame's gap + long tasks + a CPU profile, find WHICH frame and WHAT code; never guess. Already done in session 50:
  letter widths remembered (uiKit measureText), pooled fight pop numbers (effects.js `popPool`), reward cards built
  once + reward tweens wait for the first draw (RewardScene `tweens.timeScale`). Only 4 WebGL shaders, built at fight
  start (not a cause). Headless Chromium draws in SOFTWARE: big '(program)' time in profiles is that, not the phone.
  Left to check: onWin (~30ms at 4x: saveProgress + speech + popTexts in one frame), other `this.add.text` made
  per event (gainText, heroFell, status chips redrawn by drawChips), Graphics redrawn every frame (drawStatusFx,
  drawDangerGlow, refreshHud), the boss floors and the Monster House (most enemies), the 2.5 MB page size / load time.
  Ask the user WHEN it stutters on the phone (many hits, a death, a skill) before tuning.
- SECURITY (a client-only game today; Solana Seeker dApp Store later): (1) `npm audit`: 1 HIGH in vite 8.3.0-8.3.2
  (dev server only, not in the built page) -> ask, then `npm audit fix`; (2) the save (`systems/progress.js`,
  localStorage JSON.parse): a broken or hand-edited save must never crash the game or give impossible values (check
  every field is clamped / type-checked; gems, unlocks, best floor can be edited by anyone: fine for now, but write
  down what a future server / wallet must re-check); (3) `innerHTML` in src/scenes/testPanel.js (dev TEST panel) and
  src/studio/*.js: make sure no saved or user text goes in unescaped; the TEST panel must not ship to players (check
  how it is gated); (4) the Studio page's shared `db` (window.claude.use('db')): treat rows as untrusted data (bad
  shapes must not break the Studio). Explain each finding simply: the user is a beginner.
- PUBLISH only at the end of a batch of visible fixes: `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat
  dist-page.html; } > <scratchpad>/dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr
  (the first publish of a session is refused 'not viewed': Read the LAST 3 lines of the saved copy, publish again).
- Browser checks: `<repo>/node_modules/.bin/vite <repo> --port 5190` from the scratchpad (run `npm install` first if
  node_modules is missing), in the background. Playwright: `NODE_PATH=$(npm root -g) node x.cjs`. Starting a fight
  from a script: stop the running scenes, `game.scene.start('Battle')` (keep 'Debug').
- Pushing to `main` needs the user's OK in chat (the auto check blocks it otherwise).

## How we work with this user
- FEEL WORDS (session 49): 'slow' / 'looks stuck, like low FPS' = STUTTER, not length: record every frame's camera /
  positions under a 4x slowed CPU (CDP setCPUThrottlingRate) and find the frame gaps before changing timings. A faster
  slide was 'way weird and bad' (reverted). 'Not that, X' = undo my change first, then fix X.
- LIVE SWITCH TRIALS (session 49): options in the game behind HTML switch buttons that apply LIVE (no reload: user 'can u
  make it not always restart'); they flip on the phone and answer with a screenshot + fixes ('Dusk looks good, change
  the green button' -> a MAIN colour switch). After the pick: make it the real look, delete the trial, push main.
- They want the REFERENCE'S SHAPES, not only its colours ('sharp borders, no corner borders, one-colour buttons, no
  bevels / bands / gold'): copy the kind of drawing, not just the palette.
- Careful with sed/python one-line edits: a '// comment' put BEFORE a chained call (.setOrigin) disabled it (TAP TO
  START went off centre). Look at the screen after every edit.
- SWITCH TRIALS (session 48, worked very well): for 'not neat' / 'show me options': ask WHICH parts with the question
  tool (multi-select), then put every option IN THE GAME on the squad demo page behind a row of cycling switch buttons
  (NAMES 1/4, BARS 1/4 ...; localStorage), plus PNG sheets side by side. They answer with a phone screenshot of the
  combo they like + one fix ('this, bring the row down a bit'). Then delete the other options + switch, commit.
  For a font they first said 'a PNG is not the best way to see text, show me a mini demo on app': a small phone-size
  page with switch buttons (on the reused review page).
- LOOK ROUNDS (session 47, worked very well): when unsure the user says 'I need to see it' / 'do all three': build
  every option INTO THE GAME behind a small switch button in the dock (registry key + scene restart) on a DEMO PAGE
  (`build:squad-demo`), republish it, let them flip on the phone; on their pick delete the other options + the switch.
  They then send phone screenshots with short fixes ('too crowded', 'not clear how to scroll', 'not bold'): fix all in
  one round, republish the demo. Words can be misheard by voice typing ('goal' = gold, 'bend' = band, 'scroll design'
  = the gold one): when a word makes no sense, match it to what is on screen.
- PAGE / BALANCE WORK (session 46): 'go on' = next batch without asking; 'go with your suggestions' = apply all of my
  listed suggestions; they asked 'how did we test items?' before agreeing to a new tool: explain the existing tools
  first, then propose. They like a ranked table + before / after table, then 2-3 concrete options to pick from.
- 'Rework X' is vague: ask WHAT should change with the question tool (look / how it works / what it offers / steps);
  their 'Other' answer is the real request ('fewer picks so harder to get good choices').
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
