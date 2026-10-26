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
- [built] Second Wind Flask: heals 80% (was 30%), now below 20% health (was 40%), still used up, once per floor (user: 'truly a life saver').
- Kept: Rat Cage (user: rats get Bone Charm / Overseer's Whistle stacks), Metronome.
- Full-run check after round 2 (80 runs per number, mean floor, base ~27-29):
  Shield Totem +3.1 / +2.4 / +6.3 (1/3/8), Bandage Roll +2.7 / +2.4 / +8.0, Martyr's Shield +3.6 / +5.5 / +10.4,
  Second Wind Flask (80% below 20%) +1.5 / +2.8 / +4.0, Aid Kit +0.1 / +0.4 / +0.2 (still does almost nothing).

## Runs WITH vs WITHOUT summoning items (nominions.mjs, all 120 squads x 4 runs, same dice)
```
90s, 120 squads x 4 runs, same dice for both
NORMAL runs            mean 24.9  median 20  top10% 39  best 100  (480 runs)
NO summoning items     mean 23.3  median 20  top10% 37  best 70  (480 runs)
  bosses won (normal):  20: 232/289  40: 38/44  60: 3/5  80: 1/2  100: 0/1
  bosses won (none):    20: 223/273  40: 18/34  60: 2/3
with Necromancer   normal 22.8  none 19.8
without Necromancer normal 25.9  none 24.7
normal runs that picked 1+ summoning item: 410 (mean floor 26.3, avg 3.1 items); picked none: 70 (mean 17.2)
same dice, without summoning items the run went: deeper 198, shallower 257, same 25

```
Reading: summoning items add about +1.6 floors on average, matter most for the Necromancer (+3) and the floor-40 Brood Mother (86% wins with, 53% without). Runs that never picked one (mean 17.2) are mostly runs that died early, so that number is not a fair comparison.

## Aid Kit rework (round 3)
- [built] Aid Kit = TRIAGE (user's pick): when ANY hero drops below 30% health, the holder patches them at once for 15 FLAT
  health per kit, then a 10s cooldown (`tryTriage()`, specials `triage` / `triageBelow` / `triageCooldownMs`). Replaces the
  after-floor heal, which did nothing next to the 25% win heal.
- Full-run check (80 runs per number, base 30.4): 1 kit +1.3, 3 kits +6.7, 8 kits +15.0 floors. Now one of the strongest
  defensive items (Heart Charm +12, Martyr's Shield +10 at 8) although it is a common: watch it.

## 10 new items (user: "implement all", proposal docs/proposals/item-sheet/new-items-10.html), items 73-82
- Quiver of Plenty (rare, needs ranged): ranged basic attack 15%/copy for an extra arrow at a different enemy (full damage,
  on-hit items roll); past 100% the rest is a chance for a third (max 2 extra). `extraArrows()`.
- Spotter's Lens (rare, squad): the TAPPED enemy takes +12% per copy from the whole squad. `itemDamageBonus` spotter.
- Giantslayer's Brand (epic): +30% damage to bosses per copy; while a holder lives boss wind-ups take 20% longer per copy.
- Catalyst Vial (epic): each different DoT kind on an enemy makes the holder's ticks on it 15% stronger per copy.
- Scholar's Bookmark (rare): +4% skill damage per copy per page on the holder's skills (modifiers count double).
- Last Stand Banner (epic): a hero falls = survivors get a shield of 20% max health and +30% attack for 8s, per copy;
  the holder's morale penalty x0.5 per copy.
- Mirror Buckler (rare): 12%/copy (max 60%) that a ranged/magic hit on the holder bounces back at the attacker; past 5
  copies +25% bounce damage per copy.
- Soul Lantern (epic): every 8 squad kills +1% attack and max health per lantern, up to +30% per lantern.
- Phoenix Feather (legendary, used up): a killing blow leaves the holder at 1 health and heals 40% (+10% per feather
  left) over 3s.
- Iron Will Talisman (common): +6 resist; stuns/freezes/webs/fears on the holder 25% shorter, each copy cuts 25% of what
  is left. Icons written by `scripts/art/new-item-icons.mjs` from the proposal page. Tests: `items-new10.test.mjs`.

Full-run check of the 10 new items (itemruns.mjs, 60 runs per number, front hero holds them, base 26.8; under ~2 floors = noise):
```
spotters_lens        0: 26.8 (base)   1: 27.3 (+0.5)   3: 28.7 (+2.0)
giantslayers_brand   0: 26.8 (base)   1: 26.2 (-0.6)   3: 28.5 (+1.8)
catalyst_vial        0: 26.8 (base)   1: 27.4 (+0.6)   3: 27.6 (+0.9)
scholars_bookmark    0: 26.8 (base)   1: 28.7 (+1.9)   3: 27.7 (+0.9)
last_stand_banner    0: 26.8 (base)   1: 27.3 (+0.5)   3: 27.4 (+0.6)
mirror_buckler       0: 26.8 (base)   1: 30.4 (+3.7)   3: 28.6 (+1.9)
soul_lantern         0: 26.8 (base)   1: 28.4 (+1.6)   3: 34.5 (+7.8)
phoenix_feather      0: 26.8 (base)   1: 27.5 (+0.7)   3: 28.6 (+1.8)
iron_will_talisman   0: 26.8 (base)   1: 26.4 (-0.4)   3: 27.8 (+1.1)
quiver_of_plenty     0: 26.8 (base)   1: 26.8 (+0.0)   3: 26.8 (+0.0)

```
Caveats: the front hero is always melee in this check (Quiver does nothing on melee), the bot only taps boss objects (Spotter's Lens rarely active), Giantslayer only matters on boss floors, Bookmark needs skill book pages.

## Round after the 10 new items (user)
- [built] Phoenix Feather: after the save the holder is INVULNERABLE for 1s and heals back up to 70% of max health over 3s.
- [built] Soul Lantern: LEGENDARY, `oncePerRun` (offered on a reward card at most once per run: `rollChoices({ offered })`,
  the Set lives on BattleState `offeredOnce`), and NO limit (+1% attack and max health every 8 squad kills, forever).

## The user's own items (numbers are my first guesses, all in items.json)
- [built] Flame Spirit (legendary, onhit): 8% per copy on attack (was 4%), 300% per fireball (was 80%) after the full-run check;: 3-5 slow dark fireballs (darkbolt shots, 0.25s apart,
  0.9s flight) at random enemies, 80% dark each (item damage). `conjureSpirit()`, delayed hits via `later()/tickDelays()`.
- [built] Spirit Axe (epic): 8% per copy when the holder is hit: a ghostly axe spins around it for 3s, every 0.5s it hits
  every enemy within 110 px for 35% (item damage, 6 pulses). `trySpiritAxe()/tickSpiritAxe()`, effect `spiritAxe`.
- [built] Heart of the Beast (legendary): +2% max health regen per second (fights) and +30% healing received, per copy
  (`healAmp` in healUnit and regen).
- [built] Moonlight Twinblade (legendary, onhit; user: works on ANY attack, melee or ranged, the crescent's damage is ranged): 18% per copy on any attack (was 8%, user: higher chance; full runs 12x: 1 copy +0, 3 copies +8.5 floors): a moonlight SESSION 5: hits 85% -> 110% each (user: +30% damage).
  crescent (projectile `moon`) hits its target 3 times for 60% each, +20% per extra copy. The ranged twin of Excalibur.
- [built] Ghastly Fire (epic, needs fire): the holder's fire hits and burns also deal 20% (per copy) of their damage as
  dark; enemies burning from the holder attack 5% slower per burn stack (+2% per extra copy), max 75% (`ghastlySlow()`).

Full-run check (itemruns.mjs, 60 runs per number, front hero, base 26.9; under ~2 floors = noise; Soul Lantern 3 copies cannot happen any more):
```
phoenix_feather      0: 26.9 (base)   1: 28.2 (+1.3)   3: 29.4 (+2.5)
flame_spirit         0: 26.9 (base)   1: 26.0 (-0.9)   3: 28.2 (+1.3)
spirit_axe           0: 26.9 (base)   1: 29.7 (+2.8)   3: 30.2 (+3.3)
heart_of_the_beast   0: 26.9 (base)   1: 30.1 (+3.2)   3: 35.4 (+8.5)
ghastly_fire         0: 26.9 (base)   1: 27.8 (+0.9)   3: 30.2 (+3.3)
soul_lantern         0: 26.9 (base)   1: 29.7 (+2.8)   3: 28.7 (+1.8)

```
- Flame Spirit re-check (8%, 300%): 1 copy +3.7, 3 copies +7.3 floors (base 27.5).

## Session 5: rare item buffs (user: 'let's try these numbers')
Full-run test (itemruns.mjs 3/squad, copies 0/1/3) showed these rares adding ~0 floors; buffed:
- Warding Charm: NEW shield of 8% max health at every fight start and every 10s (`wardPulse`, unique; its own +20% shield bonus applies), shields +20% kept.
- Scholar's Bookmark +4% -> +8% skill damage per page. Overseer's Whistle: weak minions also +25% health per whistle (`whistleHealth`).
- Grave Dust explosion 200% -> 400% of the minion's attack per copy (`graveDust` percent now IS the %), and it Poisons (5s, 0.3x).
- Fire Bombs 5% -> 8%, 250% -> 300%. Conductor's Baton extra copies +8% -> +15%. Spotter's Lens +12% -> +20%, also on drag-ordered enemies.
- Fire Arrows extra hit 20% -> 35%. Quiver of Plenty 15% -> 25%.
Strong rares left alone: Chill Band, Gargoyle Idol, Feather Boots, Provoker's Horn, Wisp Lantern, Mirror Buckler. Tests: `rares-s5.test.mjs`.

## Session 17: element charms add their element (user: 'it only helps mage and proc hit, basic attack is worthless')
- Kindling / Frost Charm / Storm Charm / Shadow Charm: every basic attack ALSO adds a small hit of that element (15% of
  attack per charm, silent `strike` proc like Chill Band; one hit per copy) AND keep +15% to that element. No `needs`
  any more (normal drop weight for every squad); each `provides` its element (counts as a source for Ghastly Fire etc.).
  The extra hits are fire/ice/electric/dark item hits: Magma Core / Ghastly Fire / Frozen Thunderbolt / Mage reactions see them.
- itemruns (6/squad, copies 0/1/3) before: Kindling -2.1/-0.5, Storm +0.7/+0.3 (useless). After: Kindling +4.0/+8.0,
  Storm +3.6/+5.0, Frost +3.3/+6.5, Shadow +1.5/+3.7 (Whetstone +4.8/+6.6, Sharp Edge +2.8/+5.4 same runs).
  Smart curve median 40 -> 43. Tests: `items-g1-g2.test.mjs` (charms).

## Session 17 (2): minions get their element, Phoenix / Frozen Thunderbolt rework (user's list)
- Gargoyle defense 8 -> 14.
- Imp, Wisp, Phoenix, Ice Spirit Knight: `holderElementShare` 0.5 = half of their hero's +% for their element (Kindling
  +15% -> Imp +7.5%). Only the +% boosts (user's pick), not charm hits or payoff items. Melee minions get nothing.
- Spirit Knight -> ICE Spirit Knight: walks and swings as melee, its hits are ICE (`hitType: 'ice'`). New look: NOT done yet.
- Phoenix: hits Burn (like the Imp), heals ITSELF 2% max health per second (`regenPercent`); no more squad heal when hit.
- Shadow Charm no longer boosts Poison (statuses.json poison `typeBonus: false`). Kindling still boosts Burn.
- Frozen Thunderbolt REWORK: an electric hit on a CHILLED or FROZEN enemy shatters: 150% ice on it AND its neighbours, the
  chill/freeze on the target is used up (no more chill from it). Needs a chill source (Chill Band, Mage, Gambler's Dice).
- itemruns (6/squad, copies 0/1/3; noisy, base moved 31 -> 36 between runs): Gargoyle +1.7/+4.2, Phoenix +3.5/+4.5,
  Ice Knight +2.2/-0.8, Imp +3.5/+8.9, Wisp -0.4/+6.3, Frozen Thunderbolt -0.9/+1.2 (weak now), Shadow Charm +0.3/-0.6.
  Smart curve median 43 -> 41. Tests: items-g4 (Thunderbolt), items-g7 (Phoenix, element share), damage-types (poison).
- Frozen Thunderbolt v2 (user: 'should apply freeze damage as well and apply chill'): every electric hit also adds a 30% ice
  hit (`thunderIce`, per copy) and 1 Chill; at 3 Chill (`thunderShatterAt`, unique) or Frozen -> the 150% shatter above.
  itemruns 1/3 copies: -1.1/+2.2 (it still needs electric hits: Mage, Storm Charm, Static Crystal). Curve median 41.
- Mimic = BAIT (user): never attacks; on its attack turns it taunts every enemy within 110px for 2.5s (`bait` in
  minions.json, `baitTaunt()`); health 30 -> 14, defense 2 -> 0; explosion 300% kept. itemruns ~0 before and after (weak item).
- Flame Spirit renamed DARK SPIRIT (id stays flame_spirit). Ice Spirit Knight keeps its look (user: blue enough).
- NEW LEGENDARY Eclipse Idol (user's design, id eclipse_idol, needs dark): stores the holder's DARK damage (hits, Dark
  Spirit orbs, Shadow Charm hits, Poison/dark ticks, Ghastly dark; not Doom). At 1000% of attack (`eclipseCharge`) a dark orb
  flies to 2-3 random enemies: DOOM (new status, statuses.json) for 4s = 350% attack dark per second (`eclipse`, per copy)
  + 50% slower attacks. Look: Dark Spirit orb + Curse swirl, new item icon + DOOM status icon. itemruns ~0 (the test player
  gives it to heroes with no dark damage); curve median 40. Tests: `dark-items.test.mjs`.
- Element charm / Chill Band copies MERGE into one bigger hit (one number). Ember Charm, Venom Fang, Thousand Cuts' bleed:
  ONE roll per attack, chance grows per copy (`unique` + `chancePerExtra` = base chance; user: 'more copies = more chance, not
  more stacks'); each extra copy ALSO makes the status 10% stronger (`damagePerExtraPercent`; user: 'each copy boosts damage and chance').
- NEXT (user list): Flame Spirit -> Dark Spirit look + name; 1-2 new dark synergy items; Mimic ideas; Ice Knight look.

## Session 18: charm vs band, Magma Core, Thunderstruck (user: 'frost charm and chill band have too little difference')
- Element charms (Kindling, Frost, Storm, Shadow): every attack adds a 10% hit of the charm's element per charm (was 15%), AND
  +10% damage of that element per charm (was 15%; kept after a try without it). Same element adds up: 3 Kindling + 1 Frost +
  2 Storm = 30% fire + 10% ice + 20% electric hits, +30% fire / +10% ice / +20% electric damage.
- Chill Band: ice hit 10% -> 20% per band, + 1 Chill (unchanged).
- Same-element sure hits from DIFFERENT items now merge into ONE hit too (`mergeCopies`, matched by damage type): Frost
  Charm 10% + Chill Band 20% = one 30% ice hit; Kindling + Magma Core = one fire hit.
- Magma Core v2 (user: 'more clearer'): every attack adds a 35% fire hit (merges with Kindling) + Burns deal +40% damage
  per core (`magmaBurn`). Gone: +35% vs burning (`magmaCore`), burns tick 40% faster (`burnSpeed`), `needs: burn`.
- NEW LEGENDARY Thunderstruck (user's design, id thunderstruck, electric, `oncePerRun`, does not stack): 5% on attack, a
  circle grows for 1.5s under the STRONGEST enemy (boss > elite > most max health; it follows the enemy), then a giant
  THUNDERBOLT hits it for 700% electric. The bolt can't be dodged (`sure`) and is a real hit: lifesteal, thorns and the
  holder's on-hit items go off (not Thunderstruck itself). One circle per holder at a time; if the marked enemy dies first
  the bolt hits the next strongest. Look: itemFx `thunderMarkFx` (circle) + `thunderstruckFx` (bolt), new item icon.
  Tests: `items-s18.test.mjs`.
- NEW EPIC Guardian's Banner (id guardians_banner, user: more defense items; 'epic, a bit higher stats'): squad item, every
  hero gets +15 defense and +15 resist while the holder lives (type/scope `squad`, so Bard's Hymn makes it stronger).
  Tests: `items-s18.test.mjs`. Other defense ideas offered, not built: Stoneheart (a hit takes at most 20% max health),
  Aegis of Dawn (legendary, shield on the most hurt hero every 15s), Spellward Robe (+30 resist, first magic hit blocked).
- NEW EPIC Assault Breastplate (id assault_breastplate, user's design): +35 defense per copy for the holder, and while the
  holder lives EVERY enemy has 8 less defense per copy (`assaultShred` special; an aura worked out at each hit in
  `BattleState.assaultShred()` -> computeDamage `opts.defenseShred`, physical hits only, can go below 0 like Armor Break;
  no icon on the enemies). Tests: `items-s18.test.mjs`.
- Sucker Punch Glove v2 (user: 'skills and other damage count; several gloves can one-shot with skills'): ANY hit from the
  holder (basic attack, skill, item hit) on an enemy above 90% health (`above` in the effect -> `suckerPunchAbove`) deals
  +50% per glove. Was: the first basic attack on each enemy (+50%). `firstHits` removed.
- Weak-item rework (user's picks, all stacking): itemruns 4/squad copies 1/3 after: Bandage Roll +3.1/+7.8, Martyr's Shield
  +5.8/+8.2, Last Stand Banner +5.9/+10.6 (before ~0 for all three). Curve median 41 -> 44.
  - Bandage Roll = CURE: every 6s the most hurt hero (hurt or with a DoT) loses 1 bleed/poison/burn kind (most stacks
    first) and heals 3% max health; per roll +1 kind and +3% (`bandageCure`, `bandageCount`, `bandageCureEveryMs`).
  - Martyr's Shield = BODYGUARD: +20 defense; an ally under 30% -> the holder takes ALL enemy hits on them for 3s (+1s per
    extra shield), 20s cooldown, GUARD icon on the ally (`tryBodyguard()`, `martyrFor()`; the old 8% chance is gone).
  - Last Stand Banner REMOVED (user): tried cheat death (= Phoenix Feather) and a low-health rally (overlapped Aid Kit,
    Second Wind Flask, Martyr's Shield, and there are 4 other banners). Demo squad got Guardian's Banner instead.
- Spiked Aegis v2 (user's pick): while the holder has a shield (or this hit broke one), a MELEE attacker takes 40% of its
  WHOLE hit back, even when the shield soaked it all; +40% per copy (`shieldThorns`, `aegisSpikes()`). The old
  explosion on a broken shield is gone. Needs: shield.
- Catalyst Vial v2 (user's pick): the holder's burn/poison/bleed ticks can CRIT (one roll per holder per tick, the holder's
  crit chance); a crit tick = critMultiplier + 25% per vial (`dotCrit`), shown big and gold with '!'. Old +21% per
  different DoT gone. `needs` can now be a LIST (any one): Catalyst needs burn, poison or bleed.
- itemruns (front hero gets the item, often with no shield / no DoT of its own) shows ~0 or below for both: not a fair
  test for synergy items (curve median 41, unchanged).
- Fire Arrows REMOVED (user, session 19): a weaker Magma Core/Kindling for ranged heroes only (and its burn never worked).
- Ember Charm v2 (user: 'bigger chance'): 6% -> 20% burn chance, +10% per extra charm (was +6%), burn damage +10% per extra
  as before. itemruns 6/squad (copies 1/3): before ~0; after +0.2/+2.0 (Kindling +0.3/+3.8, Venom +1.8, Serrated +2.2 at 3). Curve median 44.
  Then set to 12% (user), +10% per extra charm kept.
- Spirit Axe v2 (user, session 19): spins ONCE instead of 3s: 8% (+8% per copy) when the holder is hit, one hit on
  every enemy within `spiritAxeRadius` 110 px for `spiritAxeDamage` 400% (was 6 pulses x 50%). Look = one fast turn
  (700ms). itemruns 16/squad (copies 1/3) old -1.3/+3.3, new 0.0/+1.4 (noisy; front hero holds it).
  Then chance 8% -> 14% per copy (user): itemruns 16/squad +0.1 / +9.0 (3 copies = 42%).

## ITEM OPTIMIZATION round 2 (session 24, user notes on the item review page, db `notes2`) [built]
- Numbers: Full Vigor +20% dmg; Hourglass 7% (falloff 0.93); Mage Cloak +15 resist; Quick Gloves +24% atk speed;
  Tough Skin 3 less; Siege Cannon splash 20%; Shatter Hammer +24% vs chilled; Quiver of Plenty extra copy +8% (was +25%).
- Gambler's Dice: text only ('+20% crit chance').
- Assault Breastplate: the enemy defense aura (and its ARMOR DOWN icon) starts 0.5s into each floor (`assaultDelayMs`, `floorMs`).
- Bandage Roll: no heal. Every 6s the most hurt (or debuffed) hero loses 1 debuff of ANY kind (+1 per copy) and gets
  +8 defense for 6s (+8 per copy) (`bandageArmor`, `bandageArmorMs`).
- Bulwark Plate: reflect removed; per copy +35 defense, +8% block, -15 evasion. Shield Totem: flat +6% block per copy.
  ALL block from items stops at 60% (shared `cap` on the `block` special).
- Eclipse Idol: Doom also takes 35% of the enemy's resist (`eclipseResistCut`, doom `resistCutPercent`; the biggest cut counts, no stacking).
- Excalibur: base tornado +25% (damageMultiplier 0.85 -> 1.0625); extra copies still +20%.
- Heart of the Beast: now +100 max health and 1% regen per copy (no +30% healing; healAmp code removed). Orange regen
  look now keys on holding the item.
- Overheal Ring -> VITAL BAND (id stays `overheal_ring`), common, 0.2% regen per copy. Overheal shield code removed.
- Plague Flask: + `plaguePoison` 28% poison damage per copy (spread unchanged).
- Mimic Chest: extra chests no longer make the Mimic tougher (`copyStatBonus` 0); +3% chance and +25% explosion per copy stay.
- Curve 3 smart (same seeds): mean 52.9 -> 48.8, median 40 -> 40, alive at 20: 93% -> 88% (more early deaths). Open: user to
  pick commit as is / find the cause / tweak numbers.

## NEW ITEMS session 24 [built]
- Riposte Cloak (rare): +5 evasion; after a DODGE (not block/miss) strikes back for 120% (+60% per extra copy) (`riposte`).
- Last Stand (epic): below 30% health +40% damage (+20 per copy) and +20% attack speed (+10 per copy) (`lastStand`, `lastStandSpeed`).
- Harvest Scythe (rare, user's idea): crits heal 8% of the damage (+8 per copy), at most 10% of max health per crit
  (`critHeal`, `critHealCap`; user wants OP moments). Was 15% with no cap: curve mean 69.4. Now: median 43, mean 56.2, alive at 100: 5%.
- Killing Mask (rare, user's idea, 8% lifesteal per copy): CUT by the user (too strong, lifesteal stacking ran away).
- Icons drawn (first draft) in itemIcons.json. Tests: items-s24.test.mjs.
- Curve 3 smart with all 4: median 40 -> 52, mean 48.8 -> 88 (Scythe + Mask most picked). Mask cut (user).
  With Scythe, Riposte, Last Stand only: median 46, mean 69.4, alive at 100: 10% (was 4%). Scythe kept as is (user).

## Session 27: new items batch 1 (6 of 21, list in docs/proposals/new-items-batch1.md)
- Hunter's Badge (common): +20% damage to elites, +20% per copy (`eliteDamage`).
- Elite's Badge (rare): +20% damage to bosses, +20% per copy (`bossDamage`, adds up with Giantslayer's Brand).
- Swarm Swatter (common): +25% damage to fodder, +12% per extra copy (`fodderDamage`, enemy `tier` 'fodder').
- Better Odds (epic): +2.5% damage per enemy alive right now, +2.5% per copy (`betterOdds`).
- Opening Horn (common): first 4s of every floor +30% attack speed, +12% per extra copy (`openingHorn`, `durationMs`).
- Quick Fingers (common): every kill BY THE HOLDER: holder's skill cooldowns -0.5s, -0.3s per extra copy (`killCooldownMs`).
- Icons drawn in `scripts/art/new-item-icons.mjs`. Tests: items-batch1.test.mjs. No balance run (user rule).

## Session 27: new items batch 2 (5 more; 11 of 21 built)
- Life Crystal (common): when ANY enemy dies, 15% chance (+5% per extra copy) for a green orb that heals every hero
  within 120px of the dead enemy 5% max health (`lifeCrystal`, `lifeCrystalHeal`, radius in the item).
- Emergency Buckler (common): every kill BY THE HOLDER: holder gets a 4% max-health shield (+2% per extra copy) that
  fades evenly to 0 over 4s (`killShield`; shield `fade`). A new kill refills it (no stacking).
  Session 28 (user): was 6% (+3%), too strong on floors with many enemies -> 4% (+2%).
- Rally Flag (rare): when a hero drops below 30%, one unused flag (once per floor per holder) gives every hero a 12%
  max-health shield (+6% per extra copy). Each hero sets off one rally per floor; rally shields replace each other.
- Frost Mantle (rare): a melee hit on the holder: 30% chance (+5% per extra copy) to chill the attacker (3s).
- Reaper's Bell (epic): the holder's kills (attacks, skills, item hits) explode for 18% of the dead enemy's max health
  (+8% per extra copy) as dark damage within 100px; blast kills explode again (chains forever).
- Icons in `scripts/art/new-item-icons.mjs`. Tests: items-batch2.test.mjs. No balance run (user rule).

## Session 27: new items batch 3, the bomb family (5 more; 16 of 21 built)
- Ice Bomb / Electric Bomb / Dark Bomb / Poison Bombs (rare): exactly like Fire Bombs (8% chance per attack per copy,
  300% damage of their element) + a debuff on the enemy hit: Chill (3s) / Stun 1s / Weaken -15% damage for 4s /
  3 poison stacks (4s, 0.3x, dark). Poison Bombs deal dark damage.
- Bombardier's Barrel (legendary): +100% bomb damage per barrel; when a bomb goes off 25% chance (+5% per extra
  barrel) to throw 2-4 more bombs at random enemies, one every 0.15s, each a random pick of the holder's bomb items.
  Barrel bombs CAN set the Barrel off again, but it has a 0.3s cooldown (user: so it can't loop forever).
  Fire Bombs counts (proc `bomb: true`).
- Tests: items-batch3.test.mjs. No balance run (user rule).

## Session 27: new items batch 4 (3 more; 19 of 21 built)
- Sweeping Strap (common, melee): basic melee attacks also hit every other enemy within 60px of the target for 15%
  (+8% per extra copy) as item damage (`sweep`).
- Kinetic Coil (rare): every dodge stores a charge (max 3, per floor); the next basic attack spends them all:
  +40% electric per charge (+20% per charge per extra copy), inside the hit (`kineticCoil`, a rider).
- Sharpest Blade (legendary): a basic attack with NO element (no charm / Chill Band / Coil riders, not the Mage)
  has 6% (+3% per extra copy) to deal 4.5x damage (+0.5x per extra copy) and stun 2.5s (`heartStrike`).
- Tests: items-batch4.test.mjs. No balance run (user rule).

## Session 27: new items batch 5 (the last 2; all 21 built, 113 items)
- Euclid of Elements (legendary): a hit (attack or skill, not item damage) carrying 2+ different elements (its own
  magical type + its riders: two different charms, Chill Band, Magma Core, Kinetic Coil charges) has 15% chance
  (+5% per extra copy) to cast 3 more times, 0.15s apart, each 60% (+20% per extra copy) of the hit with the same
  elements. Physical does not count. The extra casts are item hits (trigger nothing).
- Frozen Demon Head (legendary): +50% ice damage (+35% per extra copy). The holder's ice damage fills the Head; at
  8x its attack Ice Spikes hit the strongest enemy (boss > elite > most health) for 700% (+150% per extra copy) ice
  + Freeze 5s. The holder's fire / electric / dark HITS do nothing (charm riders of those elements are dropped);
  damage over time it already put on (burn, poison) still ticks.
- Tests: items-batch5.test.mjs. No balance run (user rule).

## Session 29: simulations on the 21 new items (user asked)
- itemruns.mjs (40 runs per number, front hero holds it, base 29.6; under ~2.5 floors = noise), 1 / 3 copies:
  Rally Flag +4.7/+4.6, Kinetic Coil +3.9/+1.8, Sharpest Blade +3.4/+1.5, Quick Fingers +3.3/-0.4, Life Crystal
  +3.0/+2.3, Ice/Electric/Poison Bomb +2.2/+2.6/-1.3 (3: +5.2/+1.7/+3.1), Hunter's Badge +2.4/+1.7, Reaper's Bell
  +1.3/+0.8, Emergency Buckler -0.5/0, Sweeping Strap / Frost Mantle / Elite's Badge / Opening Horn / Better Odds /
  Dark Bomb ~0, Swarm Swatter -2.6/-2.1.
- Combos (scratch combos.mjs, 30 runs, items from floor 1): 5 bombs on Archer +10.9, + Barrel +26.4, + 2 Barrels
  +38.8; Frost Charm + Chill Band on Archer +7.0, + Frozen Demon Head +22.9; Demon Head on Mage -9.0 (its fire hits
  were blocked). Smart-player floor-305 run: Rogue with 8 Barrels + 20 bombs.
- Bombardier's Barrel (user): +100% bomb damage, each extra barrel only +50% (was +100%).
- Frozen Demon Head (user): the holder's own fire / electric / dark attacks and skills turn to ICE (Mage,
  Necromancer); fire / electric / dark ITEM hits still do nothing, charm riders of those elements still dropped.
- Weak items (sims: Euclid +2.6 over its charms, Sharpest Blade +0.6..+1.7, Kinetic Coil / Sweeping Strap /
  Reaper's Bell ~0 even with much bigger numbers: they happen too rarely), user picks:
  Euclid of Elements 15% / 60% -> 25% chance / 70% casts (tested 30/80: +8.7 over the charms alone).
  Sharpest Blade 6% (+3%) / 4.5x -> 12% (+4%) / 5x (tested: Archer +3.1, Knight +3.7).
  Sweeping Strap reach 60 -> 100px. Reaper's Bell blast 100 -> 150px. Kinetic Coil: BLOCKS (parries) store a
  charge too, not only dodges.
- Check after all session 29 changes: Euclid + 3 charms on Archer +4.5 over the charms alone (was +2.6), Sharpest
  Blade Archer +2.5 / Knight +3.6, Sweeping Strap +0.2..+1.6, Reaper's Bell and Kinetic Coil still ~0 (Coil on
  Samurai / Knight with Shield Totems too). Curve 3 smart: mean 43.6 -> 44.9, median 38 -> 38, p90 68 -> 77,
  max 305 -> 257; Necromancer 45.7 -> 49.5 avg floor (Demon Head no longer blocks its dark attacks).
- SHARPEST BLADE REWORK (user: 'one of the best legendaries', the gimmick stays: NO elemental damage): PURE STEEL =
  the holder has no element (no charm / Chill Band / Magma Core / Coil charges; the Mage never): every pure attack
  +40% (+20% per extra), every 5th pure attack of the floor is a HEART STRIKE: 500% (+50%) + 15% (+5%) of the enemy's
  max health (bosses 2% (+0.5%); session 30 fix: EXACTLY that share, no crit or damage bonuses: it landed as 5-15% on a boss, user picked 2%), stun 2.5s, ARMOR BREAK -50% defense 5s (user: helps the squad); a Heart Strike kill
  makes the next attack one too. The weapon glints gold
  before it (itemFx.json `sharpest_blade.glint`). Sims (scratch copy, the bot never gives the holder elements, 30 runs):
  Knight +13.1, Rogue +15.7, Archer +10.7, Berserker +7.0 floors (old: +5.7 / +9.3 / +6.7 / -0.6; Gambler's Dice
  +0.6 / +6.7 / +10.6, Bloodlust Mask on Rogue +9.6).
- Final Blade (with the armor break), 60 runs, pure holder: Knight +10.3, Rogue +11.3, Archer +13.1, Berserker +6.4;
  with a Frost Charm on the Archer +0.3 (it is off). Same test: Gambler's Dice +1.6 / +6.2 / +8.2, Bloodlust Mask on
  Rogue +8.1. Best legendary on every physical hero tested.
- Blade stacking (user: keep NUMBERS only, not a faster rhythm): each extra copy +20% pure damage, +50% Heart
  Strike, +5% max health (+1% boss); still every 5th, armor break -50% does not stack. 40 runs, pure holder:
  Rogue 1/2/3 Blades +11.3 / +17.1 / +18.2, Archer +12.8 / +15.5 / +19.1.

## Session 31: mixing elements penalty (user)
- [built] Every different element among a hero's items past the first: -15% to ALL that hero's element damage
  (2 = -15%, 3 = -30%, 4 = -45%). Physical untouched. Euclid of Elements removes it. Poison Bombs counts as dark.
- Damage per second, floor 30, 4 charms (one element / mixed / mixed + Euclid): before Berserker +41/+34/+115%,
  Archer +58/+55/+108%, Mage +56/+58/+111%; after Berserker +38/+22/+101%, Archer +68/+37/+113%, Mage +53/-13/+112%.
- [built] Then (user): -10% per extra element (4 = -30%), and the MAGE never has the penalty. Floor 30, 4 charms:
  Berserker one element +37..+50% / mixed +34% / mixed + Euclid +120%; Archer +49..+58% / +33% / +107%.
- [planned, NOT built] EUCLID REWORK (user, session 31): C + D1, replaces the old '25% chance to cast 3 more times'.
  C: +15% element damage per element past the first (instead of the -10% penalty), +10% more per element per extra
  copy (1 copy 4 elements = +45%, 2 copies = +75%, 3 = +105%). D1: PRISM BURST: damage of the holder's mixed-element
  hits fills a meter; full = a 4-colour blast on every enemy; each extra copy +50% blast damage. Meter size / blast %
  still to set. Build after the item list review.
- [planned, NOT built] REGEN TRIO (user, session 31): all three keep regen, each its own job.
  Vital Band (common): plain regen 0.2%/s per copy, nothing else.
  Heart Charm (rare): +40 health, regen 0.3 -> 0.5%/s, and +5% extra floor-win heal per copy (win heal 25% -> 30%).
  Heart of the Beast (legendary): +100 health AND +10% max health, regen 1 -> 2%/s, DESPERATE: regen x2 below 30%
  health (4%/s). Each EXTRA copy: only +100 health and +0.5%/s regen (user: the +10% health and full 2% are
  first copy only, else 3 copies = 38 hp/s on a level-20 Knight); the x2 does not grow with copies.
  Vital Band and Heart Charm: every number adds up per copy.
- [planned, NOT built] BOSS BADGES (user, session 31): Hunter's Badge (common) stays +20% damage to elites.
  Elite's Badge (rare) -> BOUNTY: when an elite dies, the squad heals 10% max health and gets +50% XP from it;
  each extra copy +5% heal and +25% XP.
  Giantslayer's Brand (epic) -> BIG GAME: +40% damage to bosses AND elites, +20% per extra copy; the wind-up part
  is dropped (user wanted ONE simple line; complicated ideas were rejected).
- [planned, NOT built] BOMBS (user, session 31): keep all 5 (with the mix penalty each element needs its bomb).
  Fire Bombs: + Burn 3s (every bomb now has its own extra). Poison Bombs: the NO-ELEMENT bomb: plain (physical)
  damage + 3 poison, its poison not dark either, drop 'dark' from its provides (added this session) so it never
  counts for the mix penalty. Ice / Electric / Dark Bomb unchanged.
- [planned, NOT built] LOW-HEALTH SAVES (user, session 31): Second Wind Flask stays used up but heals 50% (was 80%).
  Aid Kit patch = 8% of the hurt hero's max health (was 15 flat), +4% per extra copy. Rally Flag and Phoenix Feather
  unchanged.
- [planned, NOT built] PHOENIX FEATHER buff (user, session 31): still used up (one save per copy), but the save gives
  invulnerable 3s (was 1s), heals to 100% (was 70%), and every OTHER living hero heals 30% max health too.
- [planned, NOT built] FIRE TRIO (user, session 31): Kindling (common) also gets 10% chance per attack to Burn 3s
  (takes Ember Charm's old job). Ember Charm becomes RARE -> BURNING SKIN: +15 resist; melee attackers
  that hit this hero are Burned 3s (extra copy proposal: +15 resist, +20% of that burn's damage). Magma Core (epic) ->
  ERUPTION: no fire hit any more; burns deal +40%, and when a Burn ends it explodes for 150% fire on nearby enemies.
- [planned, NOT built] ICE (user, session 31): Frost Mantle -> FROST SKIN: +15 defense, EVERY melee attacker gets
  1 Chill (no roll). Frozen Demon Head: the holder's fire/electric/dark ITEM hits turn to ice at 50% damage
  instead of doing nothing. Frozen Thunderbolt: see FUSED PAIRS below (replaces 'keeps the mix penalty').
  Chill Band -> NUMBING COLD: no ice hit any more; every attack 1 Chill (5 = Freeze) and chilled enemies deal 10%
  less damage (extra copy proposal: +5% less damage). Frost Charm, Ice Bomb, Shatter Hammer, Spirit Knight Banner unchanged.
- [planned, NOT built] ELECTRIC (user, session 31): Thunderstruck now stacks: each extra copy +350% bolt damage
  (1 = 700%, 2 = 1050%). Kinetic Coil v2 (user's design): only DODGES give a charge (blocks no
  longer); charges are NOT spent on the next attack any more; at 3 charges the weapon GLOWS and the next attack is a
  powerful LIGHTNING strike for 400% electric, then charges reset. Each extra copy +200% (2 = 600%, 3 = 800%).
  Best with evasion items (Feather Boots, Riposte Cloak). Storm Charm, Electric Bomb, Wisp Lantern,
  Static Crystal unchanged.
- [planned, NOT built] FUSED PAIRS (user, session 31): hybrid items count their two elements as ONE for the mix
  penalty while the hero holds them: Ghastly Fire fuses fire + dark, Frozen Thunderbolt fuses electric + ice.
  E.g. Kindling + Ghastly Fire = 1 element (no cut); + Frost Charm = 2 (-10%). Data idea: item field `fuses`.
- [planned, NOT built] REAPER'S BELL -> HAUNTING SPIRITS (user's design, session 31; the explosion is removed):
  when THIS hero kills an enemy, 50% chance a ghost spirit rises and flies to another not-yet-haunted enemy, haunting
  it for 5s: -20% damage dealt, Silence 2s (BOSSES are not silenced, the other two still apply), 1 Armor Break
  stack. Max 3 spirits at once. NO element (drop 'dark' from provides; never counts for the mix penalty).
  Extra copy: +15% spawn chance (50 -> 65 -> 80 -> 95 -> 100) and +1s haunt (keeps growing after 100%).
- [planned, NOT built] BASIC DAMAGE (user, session 31): Sharp Edge +15% -> +25% melee damage per copy, Eagle Eye
  +15% -> +25% ranged damage per copy (specialists edge out Whetstone, the all-rounder). Whetstone unchanged.
- [planned, NOT built] CONDITIONAL DAMAGE (user, session 31): Sucker Punch Glove (common, enemies above 90%) and
  Executioner's Axe (rare, enemies under 25%) both +40% per copy (opener / finisher; the Axe no longer shrinks per
  copy). Brawler's Streak: +3% per hit in a row, max +15% (+15% to the max per extra copy). Swarm Swatter: +25% to
  NORMAL enemies (not elites, not bosses), +12% per extra copy (set: Swatter normal / Hunter's Badge elites / Big
  Game bosses + elites). Better Odds (epic): +5% damage per enemy alive, +2.5% per enemy per extra copy.
- [planned, NOT built] MINIONS (user, session 31). Boosters, each its own job:
  Overseer's Whistle = MORE swarm (+1 weak minion allowed, 25% faster; its +25% health removed; copy +1, +10%).
  Grave Dust = unchanged (weak minions explode 400% + Poison). Bone Charm = +20% health and attack, ALL minions.
  Necro Crown = +38% health and attack, ALL minions, and every squad kill raises a skeleton, MAX 4 (+2 per extra
  copy); its 'weak minions 50% faster' part removed.
  NEW: 4 EPIC ELEMENT TOTEMS (names placeholder: Ember / Frost / Storm / Shadow Totem): all of the holder's minions'
  attacks become that element (NO extra debuff, user: too powerful); each extra copy +25% minion damage of that
  element. Two different totems: the NEWEST wins; the item text must WARN 'does not stack with other totems'.
  Also CONFIRMED (user, 1-6 yes): swarm vs champion families; every minion gets half its holder's matching
  damage bonus (Rats/Gargoyle: +melee); minion items don't count for the mix penalty; 6 minions max per hero
  (Necro Crown skeletons not counted); Fire Imp Brazier epic -> rare; Mimic Chest appears below 50% health (30% chance);
  Phoenix revives once per floor at 50%.
- [planned, NOT built] SOUL LANTERN (user, session 31): stays once per run, counts squad kills from pick-up (not
  retroactive). Every 7 kills (was 8): +1% health, +1% attack, +1% attack speed, +1 FLAT defense (user; was
  +0.5%, which was tiny: % of level defense only), no limit. Attack stays +1% (flat attack rejected: +50 at 350 kills).
- [planned, NOT built] DEFENSE (user, session 32): Tough Skin UNCHANGED (3 less per hit, no % part).
  Spite Mail: reflect REMOVED; while taunting +30 defense, +30 resist, heals 1% max health per hit taken.
  Shield Totem -> SUMMONS A TOTEM (greater minion, one per item): never attacks; while it stands EVERY hero blocks 4%
  (+4% per extra copy; extra copy also +50% totem health as usual; 60% block cap stays). Stands in the FRONT line,
  just in front of the heroes, in the centre. NO upkeep for this item. Dies -> back after 2 floors (normal rule).
  Gets health from minion boosters (Bone Charm, Necro Crown). Start ~120 health, 20 defense, 0 attack (to tune).
  Note: the planned element totems (placeholder names) do nothing for it (it never attacks); rename them later.
  Padded Vest: unchanged (+12 defense, user OK). The other defense items stay as they are.
  Emergency Buckler -> renamed BUCKLER (common): the holder-only block item (Shield Totem's old job): 5% block per
  copy (1=5%, 3=15%, 12=60% cap); the kill shield is REMOVED.
- [planned, NOT built] MINION UPKEEP (user, session 32): the DEFENSE part is removed (combat.json upkeepDefensePercent
  -> 0); attack speed upkeep stays and still adds up PER summon item (greater -12%, weak -6%; user: paying once
  would let everyone go summoner). Shield Totem stays free.
