# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 42): NEXT = THE USER PICKS ONE OPEN ITEM BELOW (one per session; ask with the question tool)
- BRANCH: `main` has EVERYTHING (session 41 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- DONE session 41 (details in ui.md 'MOTION' / 'MENU PAGES IN THREE BEATS' / 'PANEL COLOUR' / 'SKILL SQUARES', rewards.md
  'Card frames by rarity', transition-plan.md section 4); game preview page republished with all of it:
  - Transitions PHASE 1: `UI.motion` tokens (QUICK: fast 140 / normal 220 / slow 450 / story 1100), `systems/motion.js`
    (+ `motion.test.mjs`), uiKit `popIn/popOut` (pop-ups DROP from above), `slideSwap` (tabs slide sideways), `sceneFade`.
    User answers: quick, tabs slide SIDEWAYS, pop-ups DROP, sounds LATER. Only 'Coming soon' uses popIn so far.
  - Menu pages in THREE BEATS like camp -> squad: camp buttons leave, the page SLIDES IN FROM ITS OWN SIDE (`UI.page.from`:
    Glossary left, Shop right, Heroes/Leaders bottom, Settings/Profile top; over another page = right), then its top bar
    (`markBar`) drops in; closing is the reverse.
  - Reward cards framed in their RARITY colour (`drawRarityFrame`), LEGENDARY shines (`rarityShine`), book page cards wear
    their book's rarity, icon gaps even; 'Which skill?' rows/boxes in each HERO's colour (heroes.json `color`).
  - Speech bubble = off-white box, dark text (`drawWindow plain`). Panels = EMBER BROWN (user picked C of 4).
  - Battle skill squares = thin 2px skill-colour line (user picked A of 3), no gold frame.
- OPEN (ask which first):
  1. TRANSITIONS PHASE 2 (menus): tab/chapter content `slideSwap` (Glossary chapters, Leaders, Shop, Settings, Profile
     tabs) + every pop-up `popIn/popOut` (item/hero cards, confirms, Who gets it, passive tip). Recommended next.
  2. PHASE 3 opening (boot fade, logo drops in, TAP TO START last) and PHASE 4 the run ('FLOOR 1' card, floor number
     slides in, reward cards deal in, boss letterbox), PHASE 5 sounds (transition-plan.md).
  3. FIGHT HUD redesign in the crimson/ember style (only recoloured so far).
  4. CAMP look: user wants it changed: ask WHAT first.
  5. PASSIVE icons (left of the skill squares) still gold-framed: ask if they get the thin skill-square look.
  6. Clean-up: dev-only trial code (GlossaryScene `TRIAL` ?bar/?list, `?frame=`, `?pal=` palettes, `?theme=`).
  KIV (older): hero art (user's knight sketches), Studio UI, boss rework floors 80/100, session 33 item leftovers, music.
- PUBLISH (Artifact tool): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, publish to https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. First publish of a session is
  refused 'not viewed': Read a few lines of the saved live copy, check the differing lines are only our old build, then
  publish again UNCHANGED (it goes through on the third call if refused twice).
- Browser checks: vite + Playwright FROM THE SCRATCHPAD dir (`vite <repo> --port 5190`, `window.__game` in dev). A battle
  without the menus: `g.registry.set('squadIds', [...]); g.scene.start('Battle')`; reward screen: `battle.scene.launch(
  'Reward', { state: battle.state, choices, floor, onDone })` with items from `await import('/src/data/items.json')`.

## How we work with this user
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
