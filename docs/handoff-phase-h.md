# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 56): BATTLE-FLOOR MUSIC SEARCH (continue)
- BRANCH: `main` has EVERYTHING (session 55 merged in). Start the next branch from `main`.
- SESSION 55 ALSO DID (all on main): NEW FLOOR (user's mix after their 3 reference pictures, drawn by floorArt.js):
  big square slabs, less grain, capstones + 4 pillars, vines, barrels / crates / chest at RANDOM spots (wall foot, or
  only the far left / right edges: never in the fight path), no side walls; the camp uses it too (no props); the squad
  screen is a CLOSE-UP (`closeUpPixel` 4, no props). Details + every rejected round: `docs/systems/floors-rooms.md`.
- NEXT TASK (user, end of session 55): continue the search for BATTLE-FLOOR music. Today battle floors are SILENT
  (`src/data/music.json` screen 'battle' = null; user, session 53: 'the battle floor songs are not good, remove
  everything'). Every other screen has its song (title/camp xDeviruchi, squad RPG Battle 12, boss boss_final).
- READ FIRST: `docs/systems/sound.md` MUSIC section only (what they LOVED / said NO to, rounds 1-5, FINAL PICKS, MUSIC
  PLAYER; `make-game-music.py` makes the game files). Board = the reused Skill Effects page (url in sound.md, db `music`).
- WHAT THEY LIKE: RETRO RPG tracks (Pixel-boy RPG pack, xDeviruchi, Eric Skiff chiptune), full energy from beat 1 (no
  slow starts), simple, 8-bit / 16-bit. NOT: cyber / synthwave, gothic, cheery town / open-land vibes, our own code
  songs never landed. A battle LIST takes turns (music.json supports a list). They may bring their OWN files (zip in
  chat): licence check (CC0 / CC BY / CC BY-SA / Pixabay OK; NC / ND not OK), credit line in music.json.
- How: ask with the question tool first (mood, where to look, own files or my search), then a SMALL board round
  (few options, LOVE / MAYBE / NO), then the pick into the game (music.json + make-game-music.py, `music.test.mjs`).
- KIV (user): HOLY damage (Cleric's smite / holy_nova still holy; user said 'we don't have holy'): don't change until asked.
  Open: a 'made by' name for the credits; Android must allow sound without a tap; Settings HELP -> crypto help at the
  Solana integration; the deep BUG HUNT + OPTIMIZATION + SECURITY CHECK (plan: session-51 note in `docs/handoff-archive.md`).
- PUBLISH the game page only at the end of a batch of visible changes (CLAUDE.md 'Preview pages').

## How we work with this user
- SESSION 55 FLOOR lessons: 4 rounds of my own redesigns were all rejected ('too different', 'not it'); what worked
  was the user's REFERENCE PICTURES drawn with the game's OWN art code (same colours / moss / door), then their mix
  ('floor C, walls mix, props mix'). Ask for a reference picture early. 'Walls mix' did NOT mean side walls (they hated
  them): when a mix word is unclear, show only parts they named. Props must never sit in the fight path.
- SESSION 55 lessons: asked 'what feels wrong' with options, they answered 'my idea' and then described it in one line:
  build THEIR idea directly, then tune in quick rounds ('faster', 'don't wait', 'wait 0.5-0.7s'), republishing each round.
  Feel bugs ('still battling after defeat'): reproduce in the browser with and without the fix (before / after).
- SESSION 54 lessons: pick rounds on the reused review page worked (TODAY / A / B / C per row + I PICK THIS, picks read
  from the db). 'Not centered' / 'doesn't reach' = check the REAL game with frame crops (Playwright, fixed crop on the
  target, hero/enemy made unkillable) and still renders of the effect on a sprite from both sides; then fix the cause
  (it was the front-edge anchor, the push-apart gap). 'Still doesn't feel like it reached' after a picture-only fix =
  change the RULES position (they accepted pushing enemies aside). Ambiguous words ('slide') -> ask with options first.
- SESSION 53 lessons: the user wants pictures / effects to look EXACTLY like the game ('not what it looks like in
  game'): reuse the game's own drawing code (hitFx recipes, orders.js lines, iconPop, bars, popText sizes and colours),
  never look-alikes. A 'simple tool' must be SIMPLE: the music Arranger (many controls) got 'wtf, I can't understand a
  single thing' and was hidden. Before a big feature they asked for '4 questions first on how you will tackle it'
  (question tool, 4 questions with options), then 'do 4 first, then the rest'. Timing words matter: an added bar that
  moved a landing later 'ruined' it: never shift the moment they liked.
- MUSIC (session 52): the user judges by ear on the board (LOVE / MAYBE / NO + short notes) and changes direction often
  ('too cyber', 'too cheery / town', 'too gothic', 'too trebly / reverb', 'just 8-bit'); their LOVES were all retro RPG
  tracks by Pixel-boy and xDeviruchi. Measuring loved tracks (spectrograms, balance numbers) helped explain WHY, but our
  own compositions never landed: prefer music they pick, and help them shape it. They stayed in one very long session
  despite fresh-session advice: suggest it once per topic change, then follow their lead.
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
