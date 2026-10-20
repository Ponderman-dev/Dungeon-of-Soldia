# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 18, 2026-10-20): NEXT = more ITEM COMBOS / DARK ITEMS (user picks)
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING. Before building/publishing: `git fetch` and check newer session
  branches are merged (`git merge-base --is-ancestor`); old branches = history, ignore.
- DONE session 17 (item adjustments; numbers + itemruns in docs/item-decisions.md 'Session 17'):
  - Element charms ADD their element: every basic attack + a 15% fire/ice/electric/dark hit, +15% boost kept, no `needs`.
    Copies MERGE into one bigger hit (`mergeCopies`, also Chill Band). Shadow Charm no longer boosts Poison (`typeBonus`).
  - Debuff procs (Ember, Venom Fang, Thousand Cuts): ONE roll per attack, each copy = more chance AND +10% status damage.
  - Minions: Imp/Wisp/Phoenix/Ice Spirit Knight get half the hero's +% for their element (`holderElementShare`);
    Spirit Knight hits ICE (`hitType`, look kept: 'blue enough'); Phoenix burns + 2%/s self regen (no squad heal);
    Gargoyle defense 14; Mimic = BAIT (never attacks, taunts nearby, 14 hp, explodes). minions.md.
  - Frozen Thunderbolt v2: electric hits add a 30% ice hit + 1 Chill; 3 Chill / Frozen = shatter 150% ice on it + neighbours.
  - Flame Spirit renamed DARK SPIRIT. NEW legendary ECLIPSE IDOL (stores dark damage, at 10x attack Dooms 2-3 enemies:
    350% dark/s + 50% slow, 4s; new DOOM status). Screenshots shown; look = Dark Spirit orb + Curse swirl (offered a
    unique Doom look, not asked yet).
  - Sapper bomb: nobody avoids/walks out of its circle any more (it blocked walking).
  - Curve median ~41-42 throughout (40 at session start).
- OPEN / offered: more dark legendaries (user: 'we need more legendary dark items'; ideas offered: Doom Crown, Soul Reaper,
  Shade Lantern); Electric has no own legendary, Ice only Thunderbolt; Shadow Charm and Mimic Chest score ~0; Eclipse Idol
  ~0 in itemruns (smartbot gives it to non-dark heroes). Older OPEN: Bone Sacrifice popups, Mystery Brew sound, Death Coil note.
- Session lessons (user asked 'why failures every prompt'): update the old tests IN THE SAME STEP as a rule change (no
  visible FAIL round), check a test file's helpers (`near`, `mk`) before using them, never `pkill -f` a pattern that matches
  your own shell. PUBLISH QUIRK: first publish per session is refused ('not viewed'); an identical resend is refused again
  unless you first compare one changed line of the saved live copy (sed -n Np | grep) -> then publish goes through.
  User wants the CLAUDE.md preview note fixed with these exact steps (asked: handoff first, do it next).
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` started FROM the scratchpad; set registry
  `squadIds`, stop 'Squad', start 'Battle'; `window.__game.scene.getScene('Battle').state` = BattleState (giveItem etc.).

## How we work with this user
- Beginner, vibe coding: explain simply, small steps, ask before design changes; 4 ideas via the question tool for picks.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
