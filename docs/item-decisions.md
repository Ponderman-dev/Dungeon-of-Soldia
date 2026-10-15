# Item stacking decisions (phase H)

The user goes through every item one by one (4 ideas each, picks one). We DECIDE ALL ITEMS FIRST and code
after (user: "let's write codes after we sorted all items"). Rule: every extra copy should add a real
+5-10% or more, with no ceiling that wastes copies. Report: https://claude.ai/artifact/UsTbim6dFrUM5DihxWnYQ3

Status: [built] = already in the code, [decided] = still to build.

## Broken group
- [built] Metronome: its own counter: every 4th basic attack of the holder deals +50% damage per copy.
  (Note: at 1 copy the bench shows about +0-3%. Maybe raise it later.)
- [built] Rat Cage: no upkeep. Each extra cage: +1 rat allowed (shared item cap 4 +1) and rats come 10% sooner.
  Copies no longer make rats stronger. (Bench: flat. Rats are 18 hp / 4 attack and do not grow with floors.)
- [built] Wisp Lantern: upkeep once. Each extra lantern: wisp bolts jump to 1 more enemy at 50%, wisps +20% stats.
- [built] Fire Imp Brazier: upkeep once. Each extra brazier: imps +15% stats (was +50%).
- [built] All weak minion items (Mimic Chest too) pay their upkeep once, however many copies.
  Found: copies of weak minion items already gave +50% stats each (`copyStatBonus`), now set per item.
