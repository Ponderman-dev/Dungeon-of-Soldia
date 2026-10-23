# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 28): NEXT = EFFECTS VISUAL REVIEW of the new items (in the game, with the user)
- BRANCH: `main` has EVERYTHING (session 27 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- FIRST: show the user the NEW ITEM LOOKS IN A REAL FIGHT (ART rule below: scratchpad worktree + Playwright screenshots /
  short clips like the icon-pop clips, then the question tool). None of these were seen in the game yet:
  - Bombs: Ice / Electric / Dark / Poison Bombs = Fire Bombs' bomb in the element's colours (`itemFx.bombFx` +
    `BOMB_KINDS`); Bombardier's Barrel throws its extra bombs 0.15s apart ('Bombs away!' icon pop).
  - Life Crystal: green orb pops out of the dead enemy, small orbs fly to the healed heroes (BattleScene `lifeOrb`).
  - Reaper's Bell: purple `deathBurst` cloud (reused Puffshroom look) on every exploding kill, chains.
  - Frozen Demon Head: Ice Spikes = 5 pale triangles bursting up under the enemy + shake (BattleScene `iceSpikes`;
    plain Phaser triangles: maybe redo as pixel fx in itemFx.js, the user likes REAL things, no abstract shapes).
  - Euclid of Elements: 3 extra casts 0.15s apart (normal hits of their elements, 'Euclid!' pop).
  - Sharpest Blade 'Heart strike!' (4.5x hit + stun: only the icon pop and the normal crit-less hit; may want a big
    dramatic slash, user liked dramatic for its icon). Kinetic Coil charges have NO look yet (maybe sparks on the hero).
  - Emergency Buckler / Rally Flag shields (normal shield bar), Sweeping Strap side hits, Frost Mantle chill.
  Easy way to see them: dev url flags + give items in the worktree (or a seeded run); `?floor=N`, `?elite=1`.
- ALL 21 NEW ITEMS BUILT (92 -> 113), list + every decision: `docs/proposals/new-items-batch1.md`; numbers in
  `docs/item-decisions.md` 'Session 27' sections; code notes in `docs/systems/items.md` (batch 1-5 lines).
  Tests items-batch1..5.test.mjs. Icons: `scripts/art/new-item-icons.mjs` (bombs = Fire Bombs icon recoloured, user).
- NO balance run yet for the new items (user rule: only when asked). Short itemruns smoke runs: no crashes.
- STILL OPEN (older): HERO MINIONS PILE UP on high floors (ask before designing); skill books: same modifier twice on
  one skill is refused: OK?; UNSEEN BONUS / FEWER COMMONS from floor 41 (my ideas for items rarely showing up, later).
- Not in the preview page yet: sessions 26-27 visuals. `npm run build:page` + publish when the user asks.
- itch.io zip is old (predates hub, charms, sessions 23-27): `npm run build:itch` before an upload, devlog draft
  `docs/devlog/2026-10-21-title-and-camp.md` (ask about testers; bump 0.1.0 -> 0.2.0).
- Test helper (scratchpad, throwaway): `git worktree add <scratch>/wt HEAD`, symlink node_modules, run
  `<scratch>/wt/node_modules/.bin/vite <scratch>/wt --port 5177` FROM the scratchpad. Dev build exposes `window.__game`:
  wait for 'Title', stop scenes, `scene.start('Battle')` (registry `squadIds`; `?floor=N`, `?room=treasure` on an even
  floor = a fight). Seed Math.random in addInitScript for the same line-up. Remove the worktree at the end.
  Playwright: global install `/opt/node22/lib/node_modules/playwright/index.mjs` (not in the repo's node_modules).
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
