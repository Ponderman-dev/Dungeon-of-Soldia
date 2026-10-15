# Item stacking decisions (phase H)

The user goes through every item one by one (4 ideas each, picks one). We DECIDE ALL ITEMS FIRST and code
after (user: "let's write codes after we sorted all items"). Rule: every extra copy should add a real
+5-10% or more, with no ceiling that wastes copies. Report: https://claude.ai/artifact/UsTbim6dFrUM5DihxWnYQ3

Status: everything below is [built] (phase H). Tests: items-h.test.mjs + the updated G-tests.

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
- [built] Hourglass: each copy cuts 5% of the cooldown that is LEFT (1 = 5%, 10 = 40%, 20 = 64%), no cap.
- [built] Echo Rune: echo chance creeps closer to 90% (never stops growing); echo power +10% per copy with no limit (past 100%).
- [built] Overheal Ring: overheal shield cap = +25% max health PER RING (conversion still 40% per ring up to 100%).
- [built] Tough Skin: EVERY hit the holder takes deals 2 less per copy (never below 1). Replaces the first-hit rule.
- [built] Necro Crown: NO minion cap bonus any more. Instead: every weak minion gets +stats per copy (grows with copies,
  number to set: proposal +20% health and attack per copy) and weak minions spawn 50% faster (does NOT grow with copies).
  The "kill raises a skeleton" part is kept as is (not mentioned by the user, check at the end).
- [built] Overseer's Whistle: unchanged (+1 cap up to +4, +15% minion attack speed per copy keeps growing).
- [built] Plague Flask: at first copy 15% of the dead enemy's poison spreads; each extra copy spreads more stacks
  (number to set: proposal +15% per copy); the +1 enemy per copy stays.
- [built] Excalibur: tornado chance +8% PER COPY (no more x0.85 shrink) and tornado damage +X% per copy
  (number to set: proposal +20%). Max 3 tornadoes unchanged.
- [built] Lucky Coin: no max stacks; each coin also adds +5% crit damage (the +10 crit with x0.93 shrink stays; check at the end
  whether the shrink should go).
- [built] Gambler's Dice: +20 crit stays; EACH die adds +50% crit damage (no max, damage grows forever). Debuff on crit stays.
- [built] Feather Boots: no max; evasion from boots creeps towards 70 (the global cap) with smaller and smaller steps.
- [built] Shield Totem: no max; each totem blocks 10% of what is left (1 = 10%, 6 = 47%, 20 = 88%), recharge 2.5s stays.

## Barely-grows group
- [built] Jolly Banner: chance 5% +3% per extra copy (the +0.5s per copy stays).
- [built] Martyr's Shield: chance 8% +4% per extra copy (the cooldown shrink stays).
- [built] Mimic Chest: chance 10% +3% per extra copy, and +25% explosion damage per extra copy (stronger mimic stays).
- [built] Second Wind Flask: unchanged (consumable, spares are the point).
- [built] Hex Doll: ONE proc, chance 8% +4% per extra doll; Curse STACKS with every proc hit (-15 resist per stack;
  no stack limit, each stack has its own timer, like poison).
- [built] Rusty Nails: same as Hex Doll for Armor Break (8% +4% per extra copy, stacks with every proc hit).
- [built] Brawler's Streak: counts a COMBO of the holder's hits on ANY enemy (not one target). The combo is lost when the
  holder is stunned, frozen or feared. (+2% per hit, max +10% per copy stays unless said otherwise.)
- [built] Serrated Edge: bleed chance 10% for the first copy, +5% for each extra (10 copies = 55%).
- [built] Aid Kit: FLAT heal: +8 health per kit when a floor is cleared (grows forever, replaces the 5% with shrink).
- [built] Conductor's Baton: first baton +25% (strength and length), each extra baton +8% (no shrink).

## Grows-fine / needs-its-build group
- [built] Frost Charm: unchanged.
- [built] Storm Charm: unchanged.
- [built] Magma Core: burn ticks 40% faster, ONCE (does not grow with cores). +25% damage vs burning per core stays, and
  burn TICK damage grows per core (number to set: proposal +15% per core).
- [built] Blood Chalice: first chalice +20% vs bleeding, each extra only +10% (kill heal 3% per chalice stays).
- [built] Shatter Hammer: +60% vs frozen per hammer stays, PLUS +10% per hammer vs chilled (not frozen) enemies.
- [built] Exploiter's Lens: unchanged.
- [built] Warding Charm: shields +20% bigger per charm (was +30%).
- [built] Spiked Aegis: unchanged.
- [built] Gag Rune: unchanged, but rarity rare -> EPIC.
- [built] Dread Bell: ONE roll (copies add up instead of rolling separately): 5% chance, +3% per extra bell; fear lasts
  1s on the first bell, +0.2s per extra bell (was 1.5s).
- [built] Bandage Roll: +2% max health per kill per roll (was 3%).
- [built] Fire Heart: unchanged, PLUS when its shield breaks it explodes for 50% fire per heart on enemies.
- [built] Heart Charm: FLAT +40 max health per charm (was +22%) and +0.3% regen per second per charm (was 0.5%).
- [built] Padded Vest: unchanged.
- [built] Mage Cloak: +12 resist per cloak (was +10).
- [built] Bulwark Plate: +35 defense per plate (was 30); reflect 25% does NOT grow with copies (once).
- [built] Spite Mail: unchanged.

## "Good" group (already grows well)
- [built] Whetstone: unchanged.
- [built] Sharp Edge, Eagle Eye, Kindling, Shadow Charm: unchanged.
- [built] Quick Gloves: +18% attack speed per pair (grows); double-hit chance 8% ONCE (does not grow).
- [built] Static Crystal: 5% chance per crystal (was 10%); 2 jumps, +1 per EXTRA crystal.
- [built] Fire Bombs: unchanged.
- [built] Chill Band: unchanged.
- [built] Ember Charm: chance as is (6% per charm); burn damage +10% per extra charm (check at build what
  `scalesWithCopies` gives today and set it to +10% per copy).
- [built] Venom Fang, Thousand Cuts, Hunter's Sigil: unchanged.
- [built] Siege Cannon: NO attack bonus any more. +80% skill damage per cannon, +15% skill splash chance per cannon (raised from 40/10 after the bench: it was weak for a legendary).
- [built] Bloodlust Mask: unchanged.
- [built] Lost Cleric's Grimoire: NEW MECHANIC (user's idea, after a Risk of Rain 2 item): the holder stores 100% (+100% per
  extra copy) of the healing it receives as Soul Energy. When Soul Energy reaches 10% of the holder's max health it fires a
  GREEN FIREBALL at an enemy dealing 250% of the stored Soul Energy as damage (energy used up). At most one fireball per
  0.1s. New text, e.g. "Healing you receive is stored as Soul Energy (100% per copy). At 10% of your max health it bursts
  out as a green fireball dealing 250% of the stored energy."
- [built] Fire Arrows: 50% chance stays; extra fire hit = 20% damage per copy (was 50% per copy).
- [built] Sucker Punch Glove: unchanged.
- [built] Full Vigor: +15% per copy while the holder is ABOVE 90% health (was: only at full health).
- [built] Executioner's Axe: unchanged.
- [built] Provoker's Horn: taunt chance 18% ONCE (does not grow); each horn: taunted enemies take +15% damage and the
  taunt lasts +0.3s (3s base).
- [built] War Banner, Gargoyle Idol, Spirit Knight Banner, Phoenix Hatchling, Bone Charm, Grave Dust, Frozen Thunderbolt: unchanged.

## Open numbers (user: "yes, use all of these")
- Necro Crown +20% minion health and attack per crown; kills still raise skeletons.
- Plague Flask +15% more poison spread per extra flask.
- Excalibur +20% tornado damage per extra copy.
- Magma Core +15% burn tick damage per core.
- Lucky Coin: drop the x0.93 shrink (full +10 crit per coin) + 5% crit damage per coin.
- Brawler's Streak: +2% per hit, max +10% per copy.

ALL ITEMS BUILT.

## Full-run check of defensive items (itemruns.mjs, 80 runs per number, front hero holds 0/1/3/8 copies; mean floor reached, base 26.9; differences under ~2 floors are noise)
```
padded_vest          0: 26.9 (base)   1: 28.3 (+1.4)   3: 29.2 (+2.3)   8: 33.0 (+6.1)
mage_cloak           0: 26.9 (base)   1: 28.4 (+1.5)   3: 30.3 (+3.4)   8: 28.4 (+1.5)
feather_boots        0: 26.9 (base)   1: 28.3 (+1.4)   3: 29.5 (+2.6)   8: 29.6 (+2.7)
shield_totem         0: 26.9 (base)   1: 26.6 (-0.3)   3: 28.3 (+1.4)   8: 28.1 (+1.2)
heart_charm          0: 26.9 (base)   1: 28.8 (+1.9)   3: 31.5 (+4.6)   8: 38.9 (+12.0)
tough_skin           0: 26.9 (base)   1: 28.6 (+1.8)   3: 31.1 (+4.2)   8: 32.4 (+5.5)
bulwark_plate        0: 26.9 (base)   1: 29.0 (+2.1)   3: 31.8 (+4.9)   8: 32.5 (+5.6)
siege_cannon         0: 26.9 (base)   1: 30.0 (+3.1)   3: 28.7 (+1.8)   8: 30.3 (+3.4)
overheal_ring        0: 26.9 (base)   1: 28.4 (+1.5)   3: 25.2 (-1.7)   8: 25.2 (-1.7)
warding_charm        0: 26.9 (base)   1: 27.4 (+0.5)   3: 27.8 (+0.9)   8: 28.6 (+1.7)
spite_mail           0: 26.9 (base)   1: 26.8 (-0.1)   3: 29.0 (+2.1)   8: 27.9 (+1.0)
martyrs_shield       0: 26.9 (base)   1: 26.5 (-0.4)   3: 26.2 (-0.7)   8: 30.0 (+3.1)
fire_heart           0: 26.9 (base)   1: 28.8 (+1.9)   3: 31.9 (+5.0)   8: 34.7 (+7.8)
spiked_aegis         0: 26.9 (base)   1: 26.6 (-0.3)   3: 27.3 (+0.4)   8: 27.2 (+0.3)
bandage_roll         0: 26.9 (base)   1: 26.4 (-0.5)   3: 26.8 (-0.1)   8: 26.9 (+0.0)
aid_kit              0: 26.9 (base)   1: 27.6 (+0.7)   3: 28.6 (+1.7)   8: 29.1 (+2.2)
second_wind_flask    0: 26.9 (base)   1: 27.9 (+1.0)   3: 28.6 (+1.7)   8: 28.7 (+1.8)
```
Overheal Ring re-checked with 180 runs: +0.1 (no harm, no gain in random squads).

## Round 2 (after the full-run check)
- [built] Shield Totem: 6% block per totem, more totems creep towards 90% (falloff 0.9333), NO recharge (blocks can come back to back).
- [built] Aid Kit: +20 health per kit after each floor (was +8).
- [built] Martyr's Shield: no more health cost; +10 defense per shield.
- [built] Bandage Roll REWORK (user's idea): every 8s in a fight the holder throws 1-3 bandages (random) at the most hurt heroes,
  each heals 5 FLAT health per roll (only the heal grows with copies). Drawn as a lobbed flask in bandage colour. `tickBandages()`.
- Kept: Rat Cage (user: rats get Bone Charm / Overseer's Whistle stacks), Metronome.
