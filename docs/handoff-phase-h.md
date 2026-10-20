# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 19, 2026-10-20): NEXT = Ember Charm + Fire Arrows (analysis done, user said 'hold on')
- LATEST BRANCH: `ccr-f0fe918e-fdbp68` has EVERYTHING. Before building/publishing: `git fetch` and check newer session
  branches are merged (`git merge-base --is-ancestor`); another session pushed to this SAME branch once (pull first).
- DONE session 18 (numbers + itemruns: docs/item-decisions.md 'Session 18'):
  - Small fixes: shield numbers whole (shields soak whole points), no stacked 'Sacrifice!', Mystery Brew own sound (rising
    bubbly pop), fountain back to the potion sound.
  - Element charms: 10% hit + 10% element boost per charm; Chill Band 20% ice hit; same-element sure hits MERGE across
    items. Magma Core v2 (35% fire hit, Burns +40%). NEW legendary THUNDERSTRUCK (circle 1.5s under the strongest enemy,
    then a 700% bolt; triggers on-hit items; once per run).
  - Defense: NEW epic GUARDIAN'S BANNER (squad +15 def/+15 res), NEW epic ASSAULT BREASTPLATE (+35 def, every enemy -8
    def per copy, ARMOR DOWN icon on enemies). Drop odds lowered: epic/legendary 4.5/0.5, 8.5/1.5, 12/3 (rewards.md).
  - Enemy health growth stays +50% per 3 floors (42% was tried: too easy). Smart curve median ~41-44.
  - Item reworks (user picked via the question tool): Sucker Punch = +50% on ANY hit vs enemies above 90% health;
    Bandage Roll = cure 1 DoT + heal 3%; Martyr's Shield = Bodyguard (takes all hits on an ally under 30% for 3s);
    Spiked Aegis = shielded melee thorns 40%; Catalyst Vial = DoT ticks can crit (+25%); item `needs` can be a list.
    LAST STAND BANNER REMOVED (overlapped Phoenix Feather / Aid Kit / Second Wind / Martyr). Quiver: user said keep.
- NEXT: Ember Charm (6% Burn, ~+7% dmg, itemruns ~0) and Fire Arrows (50% x 35% fire hit, ranged only = a weaker
  Magma Core/Kindling; BUG: `provides` says burn but it never burns). Options offered: Ember = sure small burn / bigger
  chance / burn on crit; Fire Arrows = arrows burn / explosive splash / fire volley. User has not picked.
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
- OPEN: Electric has no payoff epic (Shock); Death Coil demo note says 'change'; Eclipse Idol ~0 in itemruns (bot);
  more dark legendaries (Doom Crown, Soul Reaper, Shade Lantern offered). Defense ideas not built: Stoneheart (hit cap
  20%), Aegis of Dawn, Spellward Robe.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` from the scratchpad (npm install first);
  set registry `squadIds`, stop 'Squad', start 'Battle' (retry until a fight, rooms are random); `window.__game`
  .scene.getScene('Battle').state = BattleState. The game runs faster than wall time: poll state, then shoot a burst.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then publish again.

## How we work with this user
- Beginner, vibe coding: explain simply, small steps, ask before design changes. Picks: use the QUESTION TOOL (user asks
  'questions'); include what each extra copy adds (stacking). If it comes back '[No preference]', ask again, don't guess.
- Show ideas on the EXISTING review page first (docs/proposals/skill-fx), build into the game only after the user's OK.
- ART / LOOK CHANGES (user rule, 2026-10-19): ALWAYS show it IN THE GAME first, never apply unseen: a copy of the repo in the
  scratchpad with its own vite port, Playwright screenshots (+ zoomed crops), then copy the files over on 'apply it'.
  Keep replies SHORT (user: 'that is so long!'); few variations, then let them pick.
- Style rules (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things, never
  abstract geometric rings/squares/diamonds; attack skills = aggressive movement + a small shake; hits BRIGHT and BIG
  enough to read; beams short; enemies jitter when hit hard; skill name in CAPITALS over the hero.
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
