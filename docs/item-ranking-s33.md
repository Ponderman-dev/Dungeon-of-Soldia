# Item ranking (session 33, after building the session 31/32 item decisions)

User asked: "run simulations and rank all the items, and give a detailed report".
Tool: `node scripts/tests/rankitems.mjs 10 1,3 <part>/4` (see docs/systems/balance-tools.md).

## How it was measured
- Whole runs (floor 1 up to 170), played by the review bot: random reward picks, skill books, casts every skill, taps boss objects.
- 6 squads that cover all 10 heroes, 10 seeded runs per squad = **60 runs per number**. The same seeds are used for
  every item, so "item vs no item" is compared on the same dice.
- The item is held FROM THE START by one hero: the hero that fits its `needs` (a melee item goes to a melee hero, a
  ranged item to the Archer/Bard/Alchemist, a minion booster to the Necromancer...), otherwise the FRONT hero (Knight,
  Berserker or Samurai). If no hero in the squad fits, that hero also gets one 'enabler' item (e.g. Rat Cage for
  minion boosters) and the no-item baseline gets the same enabler.
- Number = extra floors reached on average vs the baseline (baseline mean: floor 30.1). "±" = standard error;
  differences under about 3-4 floors are noise.

## Big picture
- Average extra floors with 3 copies, by rarity: **legendary +6.9**, rare +3.3, epic +3.2, common +2.3.
  Legendaries are clearly ahead; **epics are no better than rares** (several epics sit near 0).
- **Defense and sustain win full runs**: Guardian's Banner (+23), Bloodlust Mask (+19), Heart of the Beast (+12),
  Soul Lantern (+11), Assault Breastplate (+11). These keep the whole squad alive, which is what decides depth.
- **Guardian's Banner is far ahead of everything** (+23 with 3, +37 in Knight+Mage+Cleric). It is a squad aura of
  +15 defense and +15 resist per copy, no limit. It is the clearest outlier in the game.
- Many conditional damage items are near 0 here: Giantslayer's Brand, Sucker Punch, Executioner's Axe, Hunter's
  Badge, Full Vigor, Spotter's Lens, Opening Horn, Echo Rune, Gag Rune, Shatter Hammer. Damage that only helps some
  hits does not change how deep a run gets very much.

## Notes on items built this session
- Strong after the rework: **Heart of the Beast** (#3), **Soul Lantern** (#4), **Cautious Banner** (#9, a rare above
  most legendaries), Fire Imp Brazier (#8, now rare), Frozen Demon Head (#11), Shield Totem (#17), Heart Charm (#18),
  Phoenix Feather (#25; one copy +4.2 is very steady), Chill Band / Frost Mantle / Ember Charm (#26-29).
- Middle: War Banner (+5), Bombs (Electric +6, Poison +4.6, Fire +4), Aid Kit (+4), Sharp Edge (+3.9), Metronome
  (+3.4), Dread Bell (+3.1), Buckler (+3.0), Conqueror's Flag (+2.9, weak for a legendary), Reaper's Bell (+1.6).
- Weak (near 0): **Euclid of Elements** (+0.9), **Kinetic Coil** (+0.2), **Sweeping Strap** (0), **Giantslayer's Brand**
  (-0.3), **Overseer's Whistle** (-0.5), **Storm / Shadow / Frost / Ember Collar** (-1 to +2), Elite's Badge (+1.1),
  Better Odds (+0.8 with 3, +3.5 with 1 = noise), Thunderstruck (+2.3).
- CAUTION, the setup is unfair to some build items: Euclid went to a front hero with NO element items (it only does
  something with 2+ elements); Kinetic Coil needs evasion; Shatter Hammer needs freezes; collars and the Whistle only
  had a Rat Cage to work with; Gag Rune had nothing to stun (it shows exactly 0). Those need a build test (item +
  its partners) before judging them.

## Ideas (NOT applied, for the user to decide)
- Guardian's Banner: let extra copies add less (e.g. +15 then +8), or make it legendary.
- Epics that are weak for their rarity: Giantslayer's Brand, Echo Rune, Gag Rune, Shatter Hammer, Spiked Aegis,
  Better Odds, Ghastly Fire, the four collars.
- Conqueror's Flag (legendary) is middle of the pack: maybe 8% heal, or heal the holder too.
- Build tests for Euclid / Kinetic Coil / collars / Whistle with their partner items.

## Full ranking (sorted by 3 copies)
Holder = who held the item in the 6 squads (+enabler when nobody fitted).

| # | Item | Rarity | 1 copy | 3 copies | Holder(s) | |
|---|---|---|---|---|---|---|
| 1 | Guardian's Banner | epic | +7.3 ±1.9 | +23.4 ±2.3 | knight, berserker, samurai |  |
| 2 | Bloodlust Mask | legendary | +8.7 ±2.0 | +18.6 ±1.7 | knight, berserker, samurai |  |
| 3 | Heart of the Beast | legendary | +7.8 ±1.9 | +12.2 ±2.1 | knight, berserker, samurai | changed s33 |
| 4 | Soul Lantern | legendary | +1.2 ±1.9 | +11.0 ±1.9 | knight, berserker, samurai | changed s33 |
| 5 | Assault Breastplate | epic | +4.3 ±2.0 | +10.7 ±2.0 | knight, berserker, samurai |  |
| 6 | Gambler's Dice | legendary | +2.8 ±2.0 | +9.8 ±2.1 | knight, berserker, samurai |  |
| 7 | Moonlight Twinblade | legendary | +4.1 ±2.0 | +9.5 ±2.1 | knight, berserker, samurai |  |
| 8 | Fire Imp Brazier | rare | +5.0 ±1.8 | +9.2 ±1.9 | knight, berserker, samurai | changed s33 |
| 9 | Cautious Banner | rare | +4.8 ±1.3 | +9.2 ±1.5 | knight, berserker, samurai | changed s33 |
| 10 | Dark Spirit | legendary | +4.4 ±1.9 | +8.4 ±2.0 | knight, berserker, samurai |  |
| 11 | Frozen Demon Head | legendary | +7.5 ±1.8 | +8.3 ±2.0 | knight (+frost_charm), mage, berserker (+frost_charm), alchemist | changed s33 |
| 12 | Wisp Lantern | rare | +0.7 ±2.0 | +7.4 ±1.8 | knight, berserker, samurai |  |
| 13 | Eclipse Idol | legendary | +3.5 ±1.3 | +7.3 ±1.6 | knight (+shadow_charm), berserker (+shadow_charm), necromancer, alchemist |  |
| 14 | Bombardier's Barrel | legendary | +1.3 ±2.0 | +7.3 ±1.7 | knight (+fire_bombs), berserker (+fire_bombs), samurai (+fire_bombs) |  |
| 15 | Fire Heart | legendary | +5.5 ±1.8 | +7.2 ±1.8 | knight, berserker, samurai |  |
| 16 | Rat Cage | common | +2.2 ±1.9 | +7.0 ±2.0 | knight, berserker, samurai |  |
| 17 | Shield Totem | rare | +2.1 ±1.8 | +7.0 ±2.0 | knight, berserker, samurai | changed s33 |
| 18 | Heart Charm | rare | +4.0 ±1.6 | +7.0 ±1.8 | knight, berserker, samurai | changed s33 |
| 19 | Martyr's Shield | epic | +2.7 ±1.4 | +6.6 ±1.7 | knight, berserker, samurai |  |
| 20 | Sharpest Blade | legendary | +2.8 ±1.7 | +6.3 ±1.8 | knight, berserker, samurai |  |
| 21 | Necro Crown | legendary | +4.6 ±1.9 | +6.3 ±2.3 | knight (+rat_cage), berserker (+rat_cage), necromancer | changed s33 |
| 22 | Tough Skin | common | +2.4 ±1.7 | +6.1 ±1.9 | knight, berserker, samurai |  |
| 23 | Electric Bomb | rare | +2.8 ±1.6 | +6.0 ±2.0 | knight, berserker, samurai |  |
| 24 | Excalibur | legendary | +4.6 ±1.9 | +6.0 ±1.7 | knight, berserker, samurai |  |
| 25 | Phoenix Feather | legendary | +4.2 ±0.8 | +6.0 ±0.9 | knight, berserker, samurai | changed s33 |
| 26 | Chill Band | rare | +4.8 ±1.9 | +5.9 ±1.7 | knight, berserker, samurai | changed s33 |
| 27 | Siege Cannon | legendary | +5.0 ±1.8 | +5.7 ±2.0 | knight, berserker, samurai |  |
| 28 | Frost Mantle | rare | +2.9 ±1.9 | +5.7 ±2.0 | knight, berserker, samurai | changed s33 |
| 29 | Ember Charm | rare | +3.0 ±2.0 | +5.5 ±1.8 | knight, berserker, samurai | changed s33 |
| 30 | Static Crystal | epic | +3.4 ±2.0 | +5.4 ±2.1 | knight, berserker, samurai |  |
| 31 | Spirit Axe | epic | +1.4 ±1.9 | +5.4 ±1.8 | knight, berserker, samurai |  |
| 32 | Gargoyle Idol | rare | +3.9 ±1.8 | +5.2 ±1.8 | knight, berserker, samurai |  |
| 33 | Jolly Banner | epic | +2.1 ±1.4 | +5.2 ±1.9 | knight, berserker, samurai |  |
| 34 | War Banner | rare | +2.1 ±1.9 | +5.0 ±1.5 | knight, berserker, samurai | changed s33 |
| 35 | Phoenix Hatchling | legendary | +4.9 ±1.8 | +4.8 ±1.6 | knight, berserker, samurai | changed s33 |
| 36 | Poison Bombs | rare | +3.0 ±1.8 | +4.6 ±1.8 | knight, berserker, samurai | changed s33 |
| 37 | Bulwark Plate | epic | +2.6 ±1.8 | +4.2 ±1.9 | knight, berserker, samurai |  |
| 38 | Aid Kit | common | +0.9 ±1.0 | +4.1 ±1.2 | knight, berserker, samurai | changed s33 |
| 39 | Fire Bombs | rare | +3.0 ±1.5 | +4.0 ±1.7 | knight, berserker, samurai | changed s33 |
| 40 | Harvest Scythe | rare | +2.3 ±1.3 | +4.0 ±1.4 | knight, berserker, samurai |  |
| 41 | Sharp Edge | common | +3.3 ±1.5 | +3.9 ±2.0 | knight, berserker, samurai | changed s33 |
| 42 | Thousand Cuts | epic | +1.1 ±1.9 | +3.9 ±1.8 | knight, berserker, samurai |  |
| 43 | Blood Chalice | epic | +2.1 ±1.9 | +3.8 ±1.5 | rogue, knight (+serrated_edge), samurai, berserker (+serrated_edge) |  |
| 44 | Hunter's Sigil | epic | +2.4 ±1.9 | +3.8 ±1.9 | knight, berserker, samurai |  |
| 45 | Second Wind Flask | common | +2.9 ±0.9 | +3.7 ±1.0 | knight, berserker, samurai | changed s33 |
| 46 | Padded Vest | common | +2.1 ±1.6 | +3.6 ±2.0 | knight, berserker, samurai |  |
| 47 | Whetstone | common | +0.6 ±1.7 | +3.6 ±1.7 | knight, berserker, samurai |  |
| 48 | Bandage Roll | common | +2.9 ±1.6 | +3.6 ±1.6 | knight, berserker, samurai |  |
| 49 | Metronome | rare | -0.5 ±1.8 | +3.4 ±1.9 | knight, berserker, samurai | changed s33 |
| 50 | Plague Flask | epic | +3.3 ±1.8 | +3.4 ±1.7 | knight (+venom_fang), berserker (+venom_fang), necromancer, alchemist |  |
| 51 | Spirit Knight's Sigil | epic | +1.8 ±1.7 | +3.3 ±2.0 | knight, berserker, samurai | changed s33 |
| 52 | Provoker's Horn | rare | +2.7 ±1.9 | +3.2 ±2.1 | knight, berserker, samurai |  |
| 53 | Rusty Nails | common | +1.6 ±1.8 | +3.1 ±1.9 | knight, berserker, samurai |  |
| 54 | Dread Bell | rare | +3.1 ±1.9 | +3.1 ±1.9 | knight, berserker, samurai | changed s33 |
| 55 | Buckler | common | +0.9 ±1.7 | +3.0 ±1.9 | knight, berserker, samurai | changed s33 |
| 56 | Warding Charm | rare | +0.5 ±1.3 | +3.0 ±1.6 | knight (+warding_charm), mage, berserker (+warding_charm), necromancer, alchemist |  |
| 57 | Quick Gloves | epic | +3.3 ±1.8 | +3.0 ±1.9 | knight, berserker, samurai |  |
| 58 | Venom Fang | common | +1.0 ±1.9 | +3.0 ±2.1 | knight, berserker, samurai |  |
| 59 | Conqueror's Flag | legendary | -0.1 ±1.5 | +2.9 ±1.7 | knight, berserker, samurai | NEW |
| 60 | Frozen Thunderbolt | legendary | +1.6 ±1.7 | +2.9 ±1.3 | knight (+storm_charm), mage, berserker (+storm_charm), samurai (+storm_charm) | changed s33 |
| 61 | Last Stand | epic | +2.3 ±1.1 | +2.6 ±1.2 | knight, berserker, samurai |  |
| 62 | Shadow Charm | common | +0.2 ±1.7 | +2.5 ±1.9 | knight, berserker, samurai |  |
| 63 | Mirror Buckler | rare | +3.5 ±1.8 | +2.5 ±1.8 | knight, berserker, samurai |  |
| 64 | Swarm Swatter | common | +3.3 ±1.8 | +2.5 ±1.8 | knight, berserker, samurai | changed s33 |
| 65 | Bone Charm | rare | +1.3 ±1.8 | +2.3 ±2.0 | knight (+rat_cage), berserker (+rat_cage), necromancer |  |
| 66 | Exploiter's Lens | epic | +0.2 ±1.7 | +2.3 ±1.8 | knight, berserker, samurai |  |
| 67 | Mimic Chest | rare | +2.3 ±1.3 | +2.3 ±1.1 | knight, berserker, samurai | changed s33 |
| 68 | Thunderstruck | legendary | +1.5 ±2.0 | +2.3 ±2.1 | knight, berserker, samurai | changed s33 |
| 69 | Grave Dust | rare | +2.9 ±1.8 | +2.3 ±1.9 | knight (+rat_cage), berserker (+rat_cage), necromancer |  |
| 70 | Kindling | common | -0.6 ±1.7 | +2.0 ±1.7 | knight, berserker, samurai | changed s33 |
| 71 | Ember Collar | epic | +0.7 ±1.9 | +2.0 ±1.9 | knight (+rat_cage), berserker (+rat_cage), necromancer | NEW |
| 72 | Spite Mail | epic | +0.0 ±1.6 | +1.9 ±1.7 | knight, berserker (+provokers_horn), samurai (+provokers_horn) | changed s33 |
| 73 | Mage Cloak | common | +2.9 ±1.1 | +1.9 ±1.5 | knight, berserker, samurai |  |
| 74 | Serrated Edge | rare | -0.0 ±1.9 | +1.9 ±2.0 | knight, berserker, samurai | changed s33 |
| 75 | Catalyst Vial | epic | +2.1 ±1.8 | +1.9 ±1.7 | rogue, mage, samurai, alchemist, necromancer | changed s33 |
| 76 | Iron Will Talisman | common | +0.5 ±1.2 | +1.9 ±1.4 | knight, berserker, samurai |  |
| 77 | Feather Boots | rare | +1.6 ±1.8 | +1.8 ±1.8 | knight, berserker, samurai |  |
| 78 | Magma Core | epic | +1.1 ±1.1 | +1.8 ±1.3 | knight, berserker, samurai | changed s33 |
| 79 | Dark Bomb | rare | +1.4 ±1.9 | +1.7 ±1.6 | knight, berserker, samurai |  |
| 80 | Frost Charm | common | +0.7 ±2.0 | +1.6 ±1.8 | knight, berserker, samurai |  |
| 81 | Reaper's Bell | epic | -0.1 ±2.0 | +1.6 ±1.6 | knight, berserker, samurai | changed s33 |
| 82 | Eagle Eye | common | +2.7 ±1.6 | +1.6 ±1.5 | archer, knight, bard, alchemist | changed s33 |
| 83 | Riposte Cloak | rare | +2.8 ±1.8 | +1.6 ±1.9 | knight, berserker, samurai |  |
| 84 | Vital Band | common | +1.2 ±1.6 | +1.6 ±1.3 | knight, berserker, samurai |  |
| 85 | Quick Fingers | common | -0.6 ±2.0 | +1.5 ±1.7 | knight, berserker, samurai |  |
| 86 | Ice Bomb | rare | +3.2 ±1.9 | +1.5 ±1.9 | knight, berserker, samurai |  |
| 87 | Frost Collar | epic | -0.1 ±1.8 | +1.2 ±1.7 | knight (+rat_cage), berserker (+rat_cage), necromancer | NEW |
| 88 | Elite's Badge | rare | +0.6 ±1.0 | +1.1 ±1.2 | knight, berserker, samurai | changed s33 |
| 89 | Executioner's Axe | rare | -0.6 ±1.6 | +1.1 ±1.6 | knight, berserker, samurai | changed s33 |
| 90 | Full Vigor | common | -0.5 ±1.8 | +1.0 ±2.1 | knight, berserker, samurai |  |
| 91 | Brawler's Streak | common | +1.9 ±1.6 | +0.9 ±1.9 | knight, berserker, samurai | changed s33 |
| 92 | Ghastly Fire | epic | +0.3 ±1.6 | +0.9 ±1.7 | knight (+kindling), mage, berserker (+kindling), alchemist | changed s33 |
| 93 | Storm Charm | common | +1.8 ±1.8 | +0.9 ±1.8 | knight, berserker, samurai |  |
| 94 | Conductor's Baton | rare | -0.1 ±1.3 | +0.9 ±1.1 | knight, berserker, samurai |  |
| 95 | Euclid of Elements | legendary | +0.5 ±0.9 | +0.9 ±0.9 | knight, berserker, samurai | changed s33 |
| 96 | Spiked Aegis | epic | +0.1 ±1.0 | +0.9 ±1.5 | knight (+warding_charm), mage, berserker (+warding_charm), necromancer, alchemist |  |
| 97 | Better Odds | epic | +3.5 ±1.7 | +0.8 ±2.0 | knight, berserker, samurai | changed s33 |
| 98 | Life Crystal | common | +1.0 ±1.7 | +0.8 ±1.7 | knight, berserker, samurai |  |
| 99 | Scholar's Bookmark | rare | +0.7 ±0.7 | +0.8 ±0.8 | knight, berserker, samurai |  |
| 100 | Lucky Coin | common | +2.0 ±2.0 | +0.8 ±1.9 | knight, berserker, samurai |  |
| 101 | Sucker Punch Glove | common | +0.3 ±1.9 | +0.7 ±1.4 | knight, berserker, samurai | changed s33 |
| 102 | Lost Cleric's Grimoire | legendary | -0.4 ±1.7 | +0.7 ±1.7 | knight (+bandage_roll), cleric, bard, alchemist, berserker (+bandage_roll) |  |
| 103 | Hourglass | common | -0.7 ±1.6 | +0.6 ±1.5 | knight, berserker, samurai |  |
| 104 | Spotter's Lens | rare | +1.5 ±1.5 | +0.2 ±1.5 | knight, berserker, samurai |  |
| 105 | Hex Doll | rare | +2.3 ±1.8 | +0.2 ±1.8 | knight, berserker, samurai |  |
| 106 | Hunter's Badge | common | +0.5 ±1.1 | +0.2 ±1.2 | knight, berserker, samurai |  |
| 107 | Kinetic Coil | rare | +0.7 ±1.1 | +0.2 ±1.0 | knight, berserker, samurai | changed s33 |
| 108 | Quiver of Plenty | rare | +1.7 ±1.3 | +0.1 ±1.6 | archer, knight, bard, alchemist |  |
| 109 | Opening Horn | common | -0.4 ±1.7 | -0.0 ±1.8 | knight, berserker, samurai |  |
| 110 | Sweeping Strap | common | +0.6 ±1.8 | -0.0 ±1.6 | knight, berserker, samurai | changed s33 |
| 111 | Gag Rune | epic | -0.1 ±0.1 | -0.1 ±0.1 | knight (+chill_band), mage, berserker (+chill_band), alchemist |  |
| 112 | Giantslayer's Brand | epic | -0.1 ±1.3 | -0.3 ±1.3 | knight, berserker, samurai | changed s33 |
| 113 | Echo Rune | epic | -0.7 ±1.7 | -0.3 ±1.8 | knight, berserker, samurai |  |
| 114 | Overseer's Whistle | rare | -0.1 ±2.0 | -0.5 ±2.1 | knight (+rat_cage), berserker (+rat_cage), necromancer | changed s33 |
| 115 | Storm Collar | epic | -0.3 ±1.9 | -0.7 ±2.0 | knight (+rat_cage), berserker (+rat_cage), necromancer | NEW |
| 116 | Shadow Collar | epic | -0.8 ±2.1 | -1.0 ±1.9 | knight (+rat_cage), berserker (+rat_cage), necromancer | NEW |
| 117 | Shatter Hammer | epic | -1.9 ±2.1 | -1.4 ±1.8 | knight (+chill_band), mage, berserker (+chill_band), alchemist |  |
