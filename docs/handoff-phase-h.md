# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 40): NEXT = THE USER PICKS FROM THE KIV LIST BELOW (one per session)
- BRANCH: `main` has EVERYTHING (session 39 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- DONE session 39 (KIV 'hit effects', effects.md 'SESSION 39'): Cleric/holy basic hit = short light streak + small
  splash (no pillar); electric basic hit = small spark (no bolt; big bolts stay for skills/items); elemental MELEE basic
  hits = melee slash in the element colour (`impactFx(..., melee)`, `ELEMENT_SLASH`). Cleric/holy HIT SOUND = 'thump +
  sparkle' (ffmpeg-made, sound.md; the bell chime was rejected). Game page republished with all of it.
  Not done (ask if wanted): a melee hero's element-charm rider still shows the old shot-style impact on top of the slash.
- SOUND PICKS (session 39, worked well): make 5 short mp3 options with ffmpeg in the scratchpad, SendUserFile them
  (lettered, one line each), user answers a letter / 'next' / 'more soft'. No sound board page needed.
- PERMISSIONS: publishing still asks once per publish though `.claude/settings.json` allows the 4 publish tools; Claude
  may not edit that file (auto-mode block). User may add `"mcp__claude-artifacts"` to its allow list on main themselves.
- KIV / OPEN (ask the user which first; one per session):
  1. HERO ART (docs/proposals/hero-art/, user's own 3 knight sketches drawn as `ks` / `ksn`; nothing in the game).
  2. STUDIO UI (simpler draw screen + new SHEET tab, archive 'session 35 start note', docs/proposals/studio-ui/).
  3. BOSS REWORK floors 80 (Rask & Vesh) and 100 (Morthul) (archive 'session 31 start note').
  4. Session 33 item leftovers: weak-item build tests, placeholder item choices, first-draft item looks.
  5. SOUND (ON HOLD since session 5; MUSIC slider in Settings is saved but there is no music yet).
  6. From session 37: REAL hero looks (shop sells stand-in recolours; owned looks not worn in fights), banners drawn in
     the Studio (YOUR ART '+'), lore + glossary basics/status lines to review, wallet / payments / online leaderboard
     (server), OUTLINE style for sprites (archive), early floors a bit harder (archive). A new UI look only if the user
     asks (test it IN THE RUNNING GAME on the phone page first; the stone look failed there).
  Studio page not republished since s34.
- PUBLISH: `npm run build:page`, then `{ echo '<!DOCTYPE html>'; cat dist-page.html; } > dungeon-of-soldia.html` IN THE
  REPO (publish_files only reads repo files and needs the doctype), publish_files to slug
  f5023580-38b8-441a-879b-fb80bc2d607d (get_artifact for base_version), then delete the copy. Fresh clone: `npm install`.

## How we work with this user
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
