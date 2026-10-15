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

## Stops-growing group
- [decided] Hourglass: each copy cuts 5% of the cooldown that is LEFT (1 = 5%, 10 = 40%, 20 = 64%), no cap.
- [decided] Echo Rune: echo chance creeps closer to 90% (never stops growing); echo power +10% per copy with no limit (past 100%).
- [decided] Overheal Ring: overheal shield cap = +25% max health PER RING (conversion still 40% per ring up to 100%).
- [decided] Tough Skin: EVERY hit the holder takes deals 2 less per copy (never below 1). Replaces the first-hit rule.
- [decided] Necro Crown: NO minion cap bonus any more. Instead: every weak minion gets +stats per copy (grows with copies,
  number to set: proposal +20% health and attack per copy) and weak minions spawn 50% faster (does NOT grow with copies).
  The "kill raises a skeleton" part is kept as is (not mentioned by the user, check at the end).
- [decided] Overseer's Whistle: unchanged (+1 cap up to +4, +15% minion attack speed per copy keeps growing).
- [decided] Plague Flask: at first copy 15% of the dead enemy's poison spreads; each extra copy spreads more stacks
  (number to set: proposal +15% per copy); the +1 enemy per copy stays.
- [decided] Excalibur: tornado chance +8% PER COPY (no more x0.85 shrink) and tornado damage +X% per copy
  (number to set: proposal +20%). Max 3 tornadoes unchanged.
- [decided] Lucky Coin: no max stacks; each coin also adds +5% crit damage (the +10 crit with x0.93 shrink stays; check at the end
  whether the shrink should go).
- [decided] Gambler's Dice: +20 crit stays; EACH die adds +50% crit damage (no max, damage grows forever). Debuff on crit stays.
- [decided] Feather Boots: no max; evasion from boots creeps towards 90 with diminishing steps. OPEN: the global evasion cap
  is 70% (`caps.evasion`), so boots past 70 need that cap raised for them (ask at the end).
- [decided] Shield Totem: no max; each totem blocks 10% of what is left (1 = 10%, 6 = 47%, 20 = 88%), recharge 2.5s stays.

## Barely-grows group
- [decided] Jolly Banner: chance 5% +3% per extra copy (the +0.5s per copy stays).
- [decided] Martyr's Shield: chance 8% +4% per extra copy (the cooldown shrink stays).
- [decided] Mimic Chest: chance 10% +3% per extra copy, and +25% explosion damage per extra copy (stronger mimic stays).
- [decided] Second Wind Flask: unchanged (consumable, spares are the point).
- [decided] Hex Doll: ONE proc, chance 8% +4% per extra doll; Curse STACKS with every proc hit (-15 resist per stack;
  OPEN: stack limit / per-stack timers, check at build).
- [decided] Rusty Nails: same as Hex Doll for Armor Break (8% +4% per extra copy, stacks with every proc hit).
- [decided] Brawler's Streak: counts a COMBO of the holder's hits on ANY enemy (not one target). The combo is lost when the
  holder is stunned, frozen or feared. (+2% per hit, max +10% per copy stays unless said otherwise.)
- [decided] Serrated Edge: bleed chance 10% for the first copy, +5% for each extra (10 copies = 55%).
- [decided] Aid Kit: FLAT heal: +8 health per kit when a floor is cleared (grows forever, replaces the 5% with shrink).
- [decided] Conductor's Baton: first baton +25% (strength and length), each extra baton +8% (no shrink).

## Grows-fine / needs-its-build group
- [decided] Frost Charm: unchanged.
- [decided] Storm Charm: unchanged.
- [decided] Magma Core: burn ticks 40% faster, ONCE (does not grow with cores). +25% damage vs burning per core stays, and
  burn TICK damage grows per core (number to set: proposal +15% per core).
- [decided] Blood Chalice: first chalice +20% vs bleeding, each extra only +10% (kill heal 3% per chalice stays).
- [decided] Shatter Hammer: +60% vs frozen per hammer stays, PLUS +10% per hammer vs chilled (not frozen) enemies.
- [decided] Exploiter's Lens: unchanged.
- [decided] Warding Charm: shields +20% bigger per charm (was +30%).
- [decided] Spiked Aegis: unchanged.
- [decided] Gag Rune: unchanged, but rarity rare -> EPIC.
- [decided] Dread Bell: ONE roll (copies add up instead of rolling separately): 5% chance, +3% per extra bell; fear lasts
  1s on the first bell, +0.2s per extra bell (was 1.5s).
- [decided] Bandage Roll: +2% max health per kill per roll (was 3%).
- [decided] Fire Heart: unchanged, PLUS when its shield breaks it explodes for 50% fire per heart on enemies.
- [decided] Heart Charm: FLAT +40 max health per charm (was +22%) and +0.3% regen per second per charm (was 0.5%).
- [decided] Padded Vest: unchanged.
- [decided] Mage Cloak: +12 resist per cloak (was +10).
- [decided] Bulwark Plate: +35 defense per plate (was 30); reflect 25% does NOT grow with copies (once).
- [decided] Spite Mail: unchanged.

## "Good" group (already grows well)
- [decided] Whetstone: unchanged.
- [decided] Sharp Edge, Eagle Eye, Kindling, Shadow Charm: unchanged.
- [decided] Quick Gloves: +18% attack speed per pair (grows); double-hit chance 8% ONCE (does not grow).
- [decided] Static Crystal: 5% chance per crystal (was 10%) and +1 jump per crystal (1 crystal = 3 jumps? -> read as:
  base 2 jumps +1 per EXTRA crystal; confirm at build).
- [decided] Fire Bombs: unchanged.
- [decided] Chill Band: unchanged.
- [decided] Ember Charm: chance as is (6% per charm); burn damage +10% per extra charm (check at build what
  `scalesWithCopies` gives today and set it to +10% per copy).
- [decided] Venom Fang, Thousand Cuts, Hunter's Sigil: unchanged.
