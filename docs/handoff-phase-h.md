# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 27): NEXT = DISCUSS THE NEW ITEMS (21), then build them
- BRANCH: `main` has EVERYTHING (session 26 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST: go through `docs/proposals/new-items-batch1.md` with the user (FINAL list, numbers OK'd, 'for discussion'):
  21 items (92 -> 113): bomb family (Ice/Electric/Dark/Poison Bombs + Bombardier's Barrel; existing Fire Bombs is the
  fire member), badges (Hunter's vs elites, Elite's vs bosses, Better Odds per enemy), legendaries (Frozen Demon Head,
  Euclid of Elements, Sharpest Blade), commons (Life Crystal, Emergency Buckler, Opening Horn, Swarm Swatter, Sweeping
  Strap, Quick Fingers), Frost Mantle, Kinetic Coil, Rally Flag, Reaper's Bell. Ask before building; then build in small
  batches (items.json + item-decisions.md + items.md; new effect shapes need fixture copies, see CLAUDE.md Tests).
  Open design points to raise: Frozen Demon Head 'ice only' (what happens to fire/electric skills and charms?),
  Euclid needs 2+ elements on ONE attack (which heroes/items make that?), Better Odds = alive enemies or floor start.
- WHY NEW ITEMS (session 26 finding): in a 60-floor run each epic shows ~0.7x and each legendary ~0.2x (+boss cards):
  most never appear. User chose more items first; my fix ideas kept for later: UNSEEN BONUS (items not seen this run
  get a higher chance) and FEWER COMMONS from floor 41 (user OK with repeats). Adding epics/legendaries spreads them thinner.
- STILL OPEN from the session 25 list: 3. HERO MINIONS PILE UP on high floors (ideas: enemies deal more to minions deeper,
  enemy area skills, harder enemy skills; floor 80+ attack speed now helps a little). Ask before designing.
  Also unanswered: skill books: the same modifier twice on one skill is still refused: OK?
- DONE session 26 (all tested, committed, merged to main):
  - Heroes' +15% attack reverted (combat.json `heroAttack.percent` 0; rule kept, tested with its own percent).
  - SMART ENEMY ROW GAP (formation.js): the gap behind a row = its tallest enemy as drawn + `rowRoom` 45 (`eliteRowRoom`
    60), min 70, max 160; a tall formation shifts down instead of passing the wall line (y 300). enemies.md.
  - Assault Breastplate icon no longer pops during the walk-in (`spawnEnemies()` resets `floorMs`). statuses.md.
  - ITEM ICON POPS = 'deck' (user pick): icons dealt onto one pile 0.1s apart like cards, each fades on its own
    (itemFx.json `iconPop.stack`; count/bounce/queue/row also exist). effects.md.
  - FLOORS 80+: enemy health/attack x1.015 per floor past 80, compounding (snowball option 3: x1.35 at 100, x2.8 at 150)
    + attack speed +1%/floor, max +40% (option 2). Together ~x3.9 damage per second at 150. combat.json `floorScaling`,
    test floor-snowball.test.mjs, balance-tools.md. NO curve run yet (user did not ask).
  - `needs` drop rule OFF (rewards.json `needsMissingFactor` 1): every item the same chance (user, after an example).
- Not shown in the preview yet: session 26 visuals (row gap, deck pops). `npm run build:page` + publish when the user asks.
- Look and Pick page (https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN, `docs/proposals/skill-fx` reuse) now holds the
  icon pop clips (recorded with Playwright recordVideo + ffmpeg crop, a nice way to show MOTION; user liked clips).
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and sessions 23-26: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad. Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Battle')` (registry `squadIds`; `?floor=N`, `?room=treasure` on an even
  floor = a fight). Seed Math.random in addInitScript for the same line-up. Remove the worktree at the end.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again. Publishing with `edits` sends only the page: pass `files` again for changed videos/images.
- Fresh clone: `npm install` first (node_modules is not there).

## How we work with this user
- NUMBERS: the user wants to SEE stats (tables in chat, floors side by side, real enemies like Goblin/Orc Brute) before
  picking; 'stop asking questions' = show the numbers in chat, then wait (no question tool, no review page unless asked).
- NO BALANCE SIMULATIONS unless the user asks (user, session 24: 'no need run simulation'): curve/review/itemruns cost time.
- 'Don't commit / don't push a preview' (user, session 25): when they say it, keep changes uncommitted and say so (the
  stop hook will nag; explain, don't commit). Preview only when they ask.
- Beginner, vibe coding: explain simply, small steps, ask before design changes. Picks: use the QUESTION TOOL (user asks
  'questions'); include what each extra copy adds (stacking). If it comes back '[No preference]', ask again, don't guess.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- 'Propose several designs' = 3 real in-game screenshots side by side, then the question tool; if all are rejected,
  ask WHAT feels wrong (question tool with typical reasons) before drawing more.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
