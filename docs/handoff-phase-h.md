# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 26): NEXT = FLOORS 50+ (user: 'floor 1-50 experiences are good now, focus on the rest')
- BRANCH: `main` has EVERYTHING (session 25 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST (user's order): REVERT the heroes' +15% attack (session 25): set combat.json `heroAttack.percent` to 0 (keep the
  rule; tests use `plainRules()`), then ASK which of the list below to do first (question tool). One step at a time.
- THE USER'S LIST (session 25 end, with screenshots; nothing started):
  1. Two full ROWS of enemies: back-row enemies overlap the front enemy's HP bar (rows too close: combat.json
     `movement.layout.enemyRowGap` 70 / bar height; see `enemySpots()`, `syncBar()`).
  2. Assault Breastplate's debuff icon still shows BEFORE the floor starts (aura 0.5s into the floor was the s24 fix;
     the icon itself still pops early: check `drawChips()` / when the aura status is applied vs drawn).
  3. High floors fill up with HERO MINIONS and enemies can't clear them: ideas from the user = enemies deal more damage
     to minions the deeper you go, enemy AREA skills, more enemy skills that really hurt heroes, and enemy ATTACK SPEED
     scaling with floors (now only health/attack scale: combat.json `floorScaling`). ASK before designing.
  4. Floors 80-100+: enemy stat scaling needs to go up a bit (`floorScaling`; maybe a second band from floor 80).
  5. Proc icon pops (item icon over the hero, e.g. Moonlight Twinblade) form a LONG ROW when many fire at once (pic: 5
     moon icons side by side over the Archer): cap / stack them (one icon + count, or a short queue). `itemFx.js` /
     BattleScene icon pop (effects.md).
  6. ITEM VARIETY (from earlier): rolls ARE random (3 sim runs: 61-67 different items of 92 per 60 floors, a different
     'favourite' each run); it feels samey because half the cards are commons (24 items) and `needs` items are x0.25.
     I listed 13 ideas (anti-repeat, seen-fade, owned fade, fewer commons deep, pity timer, reroll, 4 cards, skip,
     build-aware card, themed screens, more commons...); my pick: anti-repeat + fewer commons deeper in. User to choose.
- DONE session 25 but NOT SEEN IN THE GAME YET (tests pass; committed at the handoff, no preview built):
  - Skill books: NO page limits (combat.json `books` null = no limit; duplicates of a modifier still refused); page marks
    wrap into rows on the skill square (`drawPageMarks()`).
  - Text overflow: 'Which skill?' box note uses `fitText()`; the big banner (e.g. 'Blessed! Regen for the next 3 fights')
    wraps (wordWrap) instead of running off the screen.
  - Sound: at high floors busy fights filled all 8 voices and floor clear / level up went silent. Now only BUSY cues
    (own minGapMs) share `maxVoices`; one-off cues and `always: true` (skill_*) always play (sound.md).
- DONE session 25 (in the game + preview): bosses.md has the details.
  - Grukk (20): Goblin King look (first-draft art, `scripts/art/grukk/`), separate swinging cleaver; War Drum calls
    1 Goblin + 1 Goblin Archer (ranged, poison every hit) at 50% health; Quake Jump (under 50%: 2x hit + 2s stun on all).
    bosscheck 81% win (was 93%).
  - Brood Mother (40): 15% bigger, attack 8, eggs at her SIDES (45 health, hatch 5s), spiderlings weak poison every hit,
    Sticky Webs (2 heroes `tangled`: -70% attack speed 5s). User: 'challenging enough'. Last bosscheck 39% (before the
    egg 45 health / 5s change). Brood Mother demo page (floor 40 on repeat): https://claude.ai/artifact/3ZPdABV5GtWPAFnMU5bAkz
  - Boss floor reward: always 2 epic + 1 legendary (rewards.json `bossRarities`), then the golden book.
  - KIV (user): OUTLINE style (bosses/new enemies outlined, first-batch enemies + most heroes not; decide later, art.md).
- No new curve run this session (hero buff, boss rewards and bosses changed): run `curve.mjs 3 smart` only if the user asks.
- itch.io: the zip given to the user predates the hub, charms, page-2 sounds and sessions 23-25: `npm run build:itch`
  again before an upload, add them to the devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (version 0.1.0: ask
  whether testers played the old build; then bump to 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad (demo pages: `VITE_DEMO=brood`);
  Playwright (/opt/node22/lib/node_modules/playwright, executablePath /opt/pw-browsers/chromium). Dev build exposes
  `window.__game`: wait for 'Title', stop scenes, `scene.start('Battle')` (registry `squadIds`; `?floor=N`). After a
  screen slide, wait ~2.5s before tapping. Stop vite by PID (`ps aux | grep "[n]ode_modules/.bin/vite"`): a
  `pkill -f` with the pattern in the same shell line can kill the shell itself.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).
- Fresh clone: `npm install` first (node_modules is not there).

## How we work with this user
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
