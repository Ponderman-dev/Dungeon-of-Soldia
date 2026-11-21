# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 47): NO TASK PICKED YET: ask the user (candidates below)
- BRANCH: `main` has EVERYTHING (session 46 merged in at the handoff). Start the next branch from `main`.
- DONE in session 46 (all on main; details in `docs/systems/skill-books.md`, newest blocks at the bottom):
  - ALL 31 NEW SKILL-BOOK PAGES built in 4 batches (8 common, 8 rare, 5 legendary, 10 hero pages), a test per mechanic,
    an icon each. Hero pages: `hero` + `skill` + `patch`; they only fit that hero's named skill ('wrongSkill',
    reward screen 'Not this skill'). Page icons lost the clasp gem (user: 'the lock feels weird').
  - NEW TOOL `scripts/tests/pageruns.mjs [runsPerSquad] [ids]` ranks every page in full runs (same dice with/without,
    all cores, ~6 min for all at 16). Result: survival pages win, damage pages ~0 (skills = 15-40% of a hero's damage,
    `dmgshare.mjs`). Tuning round 1 + 1b applied (Siphon / Blood Price nerfed, Cyclone fixed at +4.8, damage pages and
    4 hero pages buffed, Executioner heals, Elemental Storm weakens). Executioner / Elemental Storm still ~+1 / ~0: user
    chose to keep them as 'small fry' legendaries and move on.
  - DEALER shows 3 pages (was 5). BOSS PRIZE GROWS: `specialsByBoss.golden` (1st boss rares only, 2nd legendary for
    sure + 5% hero, 3rd +15% hero, 4th+ 25% hero), golden card carries `bossNo`. Smart curve median 39-40.
  - Game page republished with all of it (session 46). The user has NOT played the new pages yet: ask how they feel.
- CANDIDATES for the next session (ask the user which; one per session):
  1. SKILLS ARE A SMALL SHARE OF DAMAGE (15-40%), so every skill-damage page is weak: a design talk about making skills
     matter more (bigger skill damage, shorter cooldowns...). Big topic: discuss first.
  2. Small page leftovers: Twin Crescent has no second crescent animation (only a zone flash); Executioner on a
     channel (Arrow Rain) refunds cooldown per wave; power pages don't grow Defense Bash's defense part; icon symbols
     are first drafts (Finisher vs Reckless look alike).
  3. Older OPEN items: art redo KIV, bosses rework, transitions phase 2-5, camp header frame, fight HUD in boss fights /
     rooms (details in the archive), itch.io upload (did the user delete the old Oct 20 upload, viewport 390 x 844?).
- ITCH.IO: `npm run build:itch`, copy `itch-page.html` as `index.html` into an empty folder, zip it (ONLY index.html),
  SendUserFile.
- Icon sheet (all page icons with real frames): a node script calling `pageIconArt` + `framedIconPixels` that writes
  HTML, then a Playwright screenshot (session 46 scratch `icons/all.mjs`, gone with the scratchpad: rewrite it, ~25 lines).
- DEV TOOLS (`scripts/dev/`, dev server on :5190 from the scratchpad): `smoke.mjs`, `tap-stress.mjs`,
  `idle-time.mjs <repo>`, `push-drift.mjs <repo>`.
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish of a session
  is refused 'not viewed', the second as 'unchanged': Read the LAST 3 lines of the saved live copy (offset), then the
  third identical publish goes through.
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`<repo>/node_modules/.bin/vite <repo> --port 5190`). Fresh
  clone: `npm install` first. Playwright in an .mjs file: `createRequire(import.meta.url)('playwright')`. Dev:
  `window.__game`; start a fight: stop 'Title', start 'Battle'.
- TESTS: seed BOTH the state rng and Math.random for crowd tests, with a mixing rng (mulberry32). Test heroes with a
  made-up 100000 health get their REAL max health back after any refreshStats (a heal, a kill, a buff): set health
  relative to the real max (`s.refreshStats()` first), or compare two states that both refreshed.

## How we work with this user
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
