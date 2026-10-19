# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 14, 2026-10-19)
- SOUND DONE (parallel session on claude/screen-review-notes-zk4cfb, merged in): sound board round 6/7 (a row per hero
  skill, page 2 = all sounds, the user's 40 PIXABAY sounds, credits docs/credits-sounds.md) and the picks APPLIED: every
  skill plays its own `skill_<id>` sound (Mystery Brew not picked yet). Details: docs/systems/sound.md 'ROUND 6' .. 'APPLIED'.
- NEXT (user): SOUND. Read docs/systems/sound.md first. Open sound work: the new skill looks (HERO LOOKS v2) have no
  sounds of their own; older cue notes in sound.md. GETTING FILES: this cloud session could reach ONLY its own GitHub repo
  (itch.io, kenney.nl, opengameart, other GitHub repos all blocked/refused), so ask the user to UPLOAD CC0 packs (as with
  Kenney before); ffmpeg trims/converts. Show/let the user hear picks on the existing review page before building in.
- DONE this session: bug hunt (bots 480 runs + browser auto-player with glitch detectors: no crashes); fixes: Grukk float
  (hop only at own walking pace), bosses swing from their own edge (retuned Brood Mother 6 atk, Frost Warden 10, Grukk 7),
  Morthul max 2 comebacks (fights could never end), bosscheck tool revives protected heroes, tremble offset, golden-book
  banner wrap, pop-up word pile, bars on screen at walls, skill names stack, reward sheet fade, elite shield before slide-in.
  ART, ONE PIXEL SIZE (3) everywhere (docs/systems/floors-rooms.md): floor + wall one stone style ("option B, no highlight"),
  pixel doors (doorArt.js) and torches (torchArt.js, on the pillars), room props redrawn (scripts/art/room-props-v2.py),
  pixel puddles/glows, heroes darken in doorways, squad bench fades at the edges.
- PARKED: HERO REDRAW proposal (pictures were sent in chat): chunky heroic body, 3/4 view facing the target, BIG weapons;
  open question to the user: keep 3 parts or go to 6 (head, body, back leg, front leg, weapon+hand, off-hand).

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
