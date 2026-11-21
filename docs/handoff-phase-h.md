# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 48): TRY A NEW UI LOOK (user: 'I kinda want this vibe'), reference picture below
- BRANCH: `main` has EVERYTHING (session 47 merged in at the handoff). Start the next branch from `main`.
- TASK: a new interface look inspired by `docs/references/ui-vibe-pick-a-class.png` (a screenshot of ANOTHER game's
  'Pick a class' window: make OUR OWN take, never copy it). What gives it its vibe:
  - cool, muted palette: deep navy / slate panels, a dark DITHERED (checker) background, thin 2px pale steel-blue
    lines, flat colours (no gradients, no studs, no gold);
  - the window is split into CELLS by thin divider lines (a grid of sections: icons on top, info left, skill right);
  - a THIN, light pixel font in pale lavender-grey (not bold); the title in salmon / orange CAPITALS in a title bar
    with small '?' and 'X' icons at its right;
  - small square coloured stat icons with numbers; locked choices dim with a small red X; the chosen one has a
    teal / green outline;
  - two big flat buttons side by side along the bottom: green 'Choose' and maroon 'Cancel'.
  Today's look is crimson + gold (`UI.goldTheme`, docs/systems/ui.md; session 38 reverted a stone look: 'check a new
  look IN THE REAL GAME before choosing'). Ask first with the question tool what to try it on (one screen like the
  squad screen or hero card, or the whole interface) and whether the font changes too; then build 2-3 takes as a
  TRIAL (registry / url flag + a switch button), screenshots side by side, let them pick.
- DONE in session 47 (all on main; details at the bottom of `docs/systems/saving-squad.md`, ui.md 'PUSHABLE BUTTONS'):
  - Buttons PUSH IN when held (`pressable()` / `pressDown()` in uiKit, `UI.press`), act on release; the camp's flat
    button is shared (`drawFlatButton` in uiKit, `UI.flat`).
  - SQUAD SCREEN REDONE through many user rounds: squad of 3 in front of the gate (heroes walk in from the side),
    big names on a slope with an X button each (= send back), ONE swipeable row of quiet hero tiles (open heroes +
    one '?' tile for the next unlock; arrow tabs, dark edges, a nudge on open), BEGIN DESCENT = crimson with a gold
    band all round, sinks as one piece. Dock like the camp. Locked hero card shows only shape + goal + progress bar.
    Readable hero card (each skill in a box with a coloured tag, airy cream text).
  - Necromancer is shown as NECROMAGE (id stays `necromancer`).
  - Squad screen demo page: `npm run build:squad-demo` (starts like a new player), https://claude.ai/artifact/91YYyyPt6hFqW5TwJewZQ2
  - Game page republished with all of it (session 47).
- OTHER CANDIDATES (older): skills are a small share of damage (design talk); page leftovers (Twin Crescent animation,
  Executioner on Arrow Rain, Defense Bash power pages, icon look-alikes); bosses rework; transitions phase 2-5.
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through.
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`, run it
  in the background with a long timeout). Fresh clone: `npm install` first. Playwright in an .mjs file:
  `createRequire(import.meta.url)('playwright')`. Dev: `window.__game`; start a screen: stop the others, start 'Squad'.
- TESTS: seed BOTH the state rng and Math.random for crowd tests, with a mixing rng (mulberry32).

## How we work with this user
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
