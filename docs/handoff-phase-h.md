# Handoff: phase H (tuning), item stacking work in progress

Branch: `claude/phase-h-tuning` (all work committed and pushed). Read `CLAUDE.md` first, then this file.

## Done in the last session
- Fixes: heroes no longer stand inside bosses (body size from sprite width, depth sort by y); enemies no longer slide away on skill hits (`BattleScene.nudge()`, hit-stop resets positions); skill banners use rows; level-up popup is 2 lines; tints cached in 10% steps; 47 unused sound files removed.
- Skill books in the bots (`balance.mjs`), new tools: `scripts/tests/review.mjs` (whole-game review), `scripts/tests/bosscheck.mjs` (each boss vs every squad), `scripts/tests/stacking.mjs` (item at 1-20 copies).
- Tougher bosses 40-160 (numbers in CLAUDE.md, BOSSES). User: "let's rework the bosses later". Open question for later: Morthul fights can never end with weak squads (crystal loop); an enrage timer was suggested, not decided.

## Pages made (claude.ai artifacts)
- Game: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr
- 10 new item ideas (NOT built, waiting for the user's pick; updated so every item grows each copy): https://claude.ai/artifact/WoQwhmjdFSoUJTRd4XxQQZ (copy of the page: `docs/proposals/item-sheet/new-items-10.html`)
- Stacking report (every item grouped: broken / stops growing / barely grows / needs its build / good, with a proposed fix each): https://claude.ai/artifact/UsTbim6dFrUM5DihxWnYQ3
- Item sheet (every item at 1, 5, 10, 20 copies, filters): https://claude.ai/artifact/2e6MLowgatSXGSYoRWzLRS
- Rebuild the sheet data: `node docs/proposals/item-sheet/make-sheet-data.mjs` (writes `data.json` next to it), then put it into `sheet-template.html` in place of `__DATA__`. Verdicts + fixes live in `docs/proposals/item-sheet/verdicts.json`.

## The user's item rule (important)
"Every extra copy should add a real +5-10% (or more). No ceiling that makes extra copies wasteful." (Their example: a Soul Lantern capped at +30% even with 4 copies feels bad.)

## Where we stopped
Nothing in items.json has been changed yet. Pending decisions:
1. Apply the stacking fixes from the report ("go"), especially the broken ones:
   - Metronome does nothing (no hero has a 4th-attack counter since the hero rework).
   - Rat Cage / Wisp Lantern / Fire Imp Brazier: upkeep grows per copy (-6% attack speed and defense each, -120% at 20) while only 4 item minions can live. Fix idea: upkeep once per item, copies past the cap make minions stronger.
2. User's new idea: use FLAT values instead of percentages for some items (example: Tough Skin "-30 damage"). Proposed (waiting for OK):
   - Tough Skin: first 3 hits each floor deal 8 less per copy, a hit never drops below 1.
   - Hourglass: -0.3s cooldown per copy, never under 40% of the skill's cooldown.
   - Iron Will Talisman (new item): control effects on the holder 0.2s shorter per copy, min 0.2s.
   - Overheal Ring: stored shield cap +25% max health per copy.
   - Healing items stay as % of max health (just remove the per-copy shrinking).
   Enemy hit sizes for reference (raw, before defense): floor 1 about 6, 20 about 25, 40 about 47, 80 about 88, 160 about 173 (Orc Brute double). So -30 per copy would make heroes immune early; use small flat numbers.
3. Pick which of the 10 new items to build.

After any item change: run `npm test`, re-run `node scripts/tests/stacking.mjs 80 <ids> 1,2,5,10,20`, rebuild the sheet, commit, push, republish the game.
