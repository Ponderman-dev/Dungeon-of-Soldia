# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 31): NEXT = BOSS REWORK, Rask & Vesh (80) then Morthul (100) (user asked: 'bosses rework, especially 60, 80, 100')
- BRANCH: `main` has EVERYTHING (session 30 merged in at the handoff). Git rule in CLAUDE.md (every handoff updates main).
- HOW SESSION 30 WENT (Frost Warden, 60; copy this flow): user picked MECHANICS + NUMBERS, then WROTE the boss's design
  themselves ('let me write first'): ask what they want, don't push your own ideas. Order: rules + tests first, then each
  look ONE at a time shown in the game (clip + slow-motion x3 + frames, question tool), then numbers with the smart curve
  (`curve.mjs 8 smart`, ~2 min; 3/squad is too few at floor 60+), then a full recorded fight. All details: bosses.md.
- FROST WARDEN NOW (all in docs/systems/bosses.md): plates 80% cut / 15% health each (drawn on him: shoulder pieces +
  breastplate), ice x0.2, HAILSTORM every 5s, UNSTOPPABLE (stuns/other moves can't skip it; whole-screen wind, 10% max health
  + 30s Chill, minions weak 45% / greater 35%; under 25% DESPERATE = random every 2-4s), ICE SPIKES once under 50% (7s, 40 spikes, 1 in 8 aimed in turns + spacing rule, 25% + freeze 3s, deadly; weak minions
  destroyed, greater 50%),
  FROZEN REST once under 25% (3 Ice Spirit Knights attack 12, a hit every ~1.2s + heals 20% in 8s, still hittable), Ice Slam (own look).
  Smart win rate of squads that reach him: 99% -> 33%. New effect code: `src/systems/bossFx.js`.
- SHARPEST BLADE FIX (session 30): the Heart Strike max-health cut was boosted by crits/damage items (a boss's '4%' landed
  as 5-15%); now EXACT (`strike` opts.fixedAmount), bosses 2% (+0.5%) (user). item-decisions.md updated.
- BOSS NUMBERS to beat (smart, 960 runs, session 30 end): 20 Grukk 87%, 40 Brood Mother 80%, 60 Frost Warden 33%,
  80 Rask & Vesh ~97%, 100 Morthul 100%, 120-160 ~90-100% (few runs reach them).
- KIV (user): MOVE ORDERS so the squad can dodge Ice Spikes (drag a hero to a floor spot / tap floor = team walks there).
- STILL OPEN (older): Kinetic Coil and Reaper's Bell ~0 floors; hero minions pile up on high floors; skill books same
  modifier twice refused: OK?; unseen bonus / fewer commons from floor 41; smart bot doesn't keep a Sharpest Blade holder
  pure; preview page, itch zip and the Item Review page are old.
- RECORD A REAL BOSS FIGHT (session 30, user liked it): `node scripts/tests/make-demo-squad.mjs 60 rogue,cleric,necromancer
  demoSquadTry.json` (writes src/data/: MOVE it to the scratchpad, never commit), then in Playwright on the dev server:
  wait for 'Title', `registry.set('squadIds', ids)` + `registry.set('testJump', { floor, room: null, heroes })`, stop
  scenes, `scene.start('Battle')`, `recordVideo`, wait until the boss or the squad is dead, ffmpeg to mp4. Squads with
  many items on one hero win; Knight/Berserker/Alchemist lost at 60.
- Test helper: vite from the SCRATCHPAD: `<repo>/node_modules/.bin/vite <repo> --port 5177` (it dies between turns
  sometimes: restart). Dev build exposes `window.__game` (see the recording recipe). To show a boss move: set the
  boss's other `abilities` timers to 1e9 / done, set `hp` under the threshold. Playwright:
  `/opt/node22/lib/node_modules/playwright/index.mjs`. ffmpeg is installed.
- PUBLISH: the first publish per session is refused ('not viewed'): Read 1-8 lines of the saved live copy, publish
  again (may need a third identical publish). Publishing with `edits` sends only the page: pass `files` for clips.
- Fresh clone: `npm install` first (node_modules is not there).

## How we work with this user
- 'Discuss first' / 'Hold on' / 'let me write first' (session 30) = STOP and wait for their text; no building meanwhile.
- Unfair luck bothers them ('potentially BS'): when a random move can pile up on one hero, show sims (hits per hero) and spread rules.
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
- Item numbers: docs/item-decisions.md is the truth. Old open item notes (Moonlight Twinblade, watch list): archive 'Open right now'.
