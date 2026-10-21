# Handoff (phase H). Short on purpose: only the current state. Old sessions: `docs/handoff-archive.md` (search it).

## START HERE (session 22): no task picked yet: ask the user
- BRANCH: session 21's work is on `claude/jolly-davinci-ifsnil` and NOT yet in `main` (the user had not OK'd the merge
  when the session ended): first ask 'bring main up to the session 21 branch?' (Git rule in CLAUDE.md).
- DONE session 21 (details: docs/systems/title-base.md, ui.md, sound.md):
  - TITLE SCREEN (`TitleScene`, `systems/titleArt.js`, `title.json`; Boot starts 'Title'): user's pick F after many
    rejected designs (wants a THICK forest seen FROM ABOVE, round tree tops, a far tower, logo mid-screen, Slay the
    Spire feel). Logo = stand-in text (the user may draw one in the Studio). Settings gear = 'Coming soon'.
  - CAMP / BASE (`BaseScene`, `systems/campArt.js`, `camp.json`): campfire on the dungeon flagstones (no wall: the
    open top is the exit), a random unlocked hero walks in from the bottom, 4 NPCs with names OVER their heads
    (Glossary, Heroes, Leaderboard, Shop) + Profile = 'Coming soon' windows (`uiKit.comingSoonWindow`), big TO DUNGEON
    window at the top: the hero walks round the fire and out, the screen slides up into the squad screen. After a run
    you still go back to the squad screen. User: 'we'll get back to this later' (NPC screens, polish).
  - Sounds: tap on TAP TO START / TO DUNGEON, footsteps on the camp walks, card open/close on the windows.
  - Speech bubbles never hold the game: the first fight starts at once, clear pause back to 0.9s; the bubble is
    removed 0.2s after the reward screen opens (`dialogue.json rules.goneAfterRewardMs`, done on the Reward scene's
    clock because Battle is paused under it).
  - SMALL TEXT FONT: text asked for at 8px or less is Press Start 2P at 8px (`UI.smallFont`; uiKit draws it letter by
    letter on whole pixels and snaps edges); bigger text stays Ironslab. Pixelify Sans and Tiny5 were tried and dropped.
  - itch.io: dev notes `docs/itch-publish.md` (build:itch, rename to index.html, zip, embed 390x844 portrait) and a
    devlog draft `docs/devlog/2026-10-21-title-and-camp.md` (everything since the first itch build, 2026-10-20). The
    zip given to the user predates the bubble/sound/font changes: rebuild before they upload.
- OPEN: NPC screens (Glossary, Heroes, Leaderboard, Shop, Profile, Settings) are placeholders; the user's own logo;
  older item ideas: Electric payoff epic (Shock), Eclipse Idol ~0 in itemruns (bot), more dark legendaries (Doom Crown,
  Soul Reaper, Shade Lantern), defense ideas (Stoneheart hit cap 20%, Aegis of Dawn, Spellward Robe).
- itemruns gives the item to the FRONT hero: unfair for synergy items (shield, DoT, ranged): say so with its numbers.
  It is noisy at 6/squad: use 16/squad and compare old vs new on the same dice (git worktree of HEAD) before judging.
- Test helper (scratchpad, throwaway): Playwright (/opt/node22/lib/node_modules/playwright, executablePath
  /opt/pw-browsers/chromium) + `node_modules/.bin/vite <repo> --port 5177` run FROM the scratchpad (a git worktree in
  the scratchpad + a node_modules symlink = a quick look copy). The game opens on 'Title' now: wait for it, then stop
  scenes and start 'Battle' (registry `squadIds`) or 'Base'; Battle modes: entering / fighting / won / lost.
  NPCs and TO DUNGEON ignore taps while the hero walks in (~3.5s after the title tap). Stop vite with
  `pkill -f "[v]ite.*--port 5177"`.
- PUBLISH: the first publish per session may be refused ('not viewed'): Read 1-8 lines of the saved live copy, then
  publish again (if refused again as 'identical', publish once more: it goes through).

## How we work with this user
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
