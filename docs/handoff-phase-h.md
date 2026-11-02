# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 41): NEXT = TRANSITIONS PHASE 1 (docs/transition-plan.md), after the user answers its 4 questions
- BRANCH: `main` has EVERYTHING (session 40 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST ask the 4 questions in `docs/transition-plan.md` section 4 (quick vs cinematic, page content slide vs fade, pop-ups
  grow vs drop, sounds yes/no/later) with the question tool, then build PHASE 1 (motion tokens `UI.motion`, uiKit
  `popIn/popOut`, `slideSwap`, `sceneFade`, retime rows 2/3/4/13), show CLIPS (Playwright recordVideo) on the review page.
- DONE session 40 (details in the system docs, all in the game + preview page):
  - Shooters' attack motion `ch.shoot()` (weapon kick + lean; art.md); Cleric Grace = `ch.bless()` + calm gold buff
    `graceFx` (no projectile) + its own sound `grace`; Cleric hit sound = RPG spell 02 (sound.md).
  - Projectile review (3 rounds, user OK on all): round holy orb, real tumbling Alchemist flask (slower, `lobbed.flightMs`
    450), bigger slower bombs whose hit waits for the landing, bandage roll + white first-aid kit that land as a heal,
    Plague Flask = bubbly acid (effects.md). Element charm on MELEE = one slash in the charm colour (effects.md).
  - QUIVER OF PLENTY = DOUBLE SHOT at the same enemy (item-decisions.md; user kept it stronger: +2.1 / +7.0 floors).
  - Sound board: Cleric group (round 10), dramatic music loop removed, chest/puzzle picks applied (sound.md).
  - UI = CRIMSON AND GOLD framed theme (user picked F from 5 palettes; `UI.theme` 'gold' + `UI.palette` 'crimson';
    'mono' still works): gold-framed wine panels, title strips, SOLID buttons; PRIMARY bright red = TO EXPEDITION and
    BEGIN DESCENT only, every other button = calm secondary; menu pages rise in / drop away (`pageEnter/pageLeave`);
    title = no button (tap anywhere), readable Best floor; TEST buttons = one small top-middle 'TEST' tab (ui.md).
- NOT DONE: fight HUD + reward sheet only got the new frame colours (not redesigned in the crimson style); the CAMP's look
  (user wants it changed: ask what); dev-only trial code still in (GlossaryScene `TRIAL` ?bar/?list, `?frame=` styles):
  remove once the look is settled. Review page (Skill Effects url) now shows the menu-look trial.
- PUBLISH (Artifact tool now): `npm run build:page`, `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > <scratchpad>/
  dungeon-of-soldia.html`, Artifact publish with url https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr. The first publish
  of a session is refused 'not viewed': Read a few lines of the saved live copy it names, publish again. Big pages
  (sound board 4.4 MB): Artifact `read` with `path: index.html` saves it to a file without loading it.
- KIV (older, ask before starting): hero art (user's knight sketches), Studio UI, boss rework floors 80/100, session 33
  item leftovers, music (none yet), real hero looks / banners / lore / wallet / outlines (archive 'session 40 start note').
- Browser checks: run vite + Playwright scripts FROM THE SCRATCHPAD dir (session 40: running them from the repo dropped a
  stray `ui/` folder and `board.png` into the repo).

## How we work with this user
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
