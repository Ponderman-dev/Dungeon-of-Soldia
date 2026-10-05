# Item review (full pass over all 66 items)

This is a REVIEW with recommendations only. Nothing here is decided until the user approves it,
and nothing is built. The master list stays `docs/item-list.md`; approved changes get copied there.

Sections:
1. Problems found (rules that must be decided before building)
2. Synergies: per hero, named builds, item pairs, traps
3. Tweaks: every item, keep or change
4. Rarity swaps
5. Drop rates: new system and a drop weight for every item
6. Gaps: things no item or hero covers yet
7. Decisions needed (short list)

---

## 1. Problems found

### 1a. Drop odds get worse as items are added (BIG)
Today `rewards.js` gives EACH ITEM its rarity's weight (common 60, rare 30, epic 9, legendary 3).
So the more items a rarity has, the more often that rarity shows up. Measured:

| | Common | Rare | Epic | Legendary | One specific legendary, per card |
|---|---|---|---|---|---|
| Today (18 items in pool) | 61.9% | 30.9% | 6.2% | 1.0% | 0.52% |
| With the 66-item list | 51.8% | 36.3% | 10.4% | 1.6% | 0.17% |

A specific legendary would show up 3x less often than today, and the share of each rarity
moves every time an item is added. Fix: roll the RARITY first (fixed odds), then pick an item
inside that rarity using a per-item weight. See section 5.

### 1b. Dead cards (items whose trigger the squad cannot make)
With 10 heroes and only 3 per run, many items do nothing in some squads:
- Taunt items (Provoker's Horn, Spite Mail): only the Knight taunts.
- Shield items (Bulwark Charm, Spiked Aegis): shields come only from Mage (Arcane Ward), Necromancer (Bone Ward), Alchemist (Mystery Brew), Fire Heart, Overheal Ring. NOTE: the Knight has NO shield in his final kit (the draft said he did; fixed here).
- Beat items (Metronome): only Bard, Mage, Cleric have empowered 4th hits.
- Minion boosters (Bone Charm, Overseer's Whistle, Grave Dust): need a Necromancer or a spawner item.
- Freeze/burn/bleed/poison/electric payoffs (Shatter Hammer, Magma Core, Blood Chalice, Plague Flask, Frozen Thunderbolt): need a source.
- Melee-only / ranged-only (Sharp Edge, Excalibur / Eagle Eye, Fire Arrows): Rogue and Samurai are melee but their attack skills count as ranged.
Recommendation: SOFT gating. An item with a "needs" tag gets its drop weight x0.25 while the squad
has no source for it (not zero, because a source can still arrive later). Hard-blocking is too strict.

### 1c. Endless loops (must have a rule)
- Lost Cleric's Grimoire + lifesteal (Bloodlust Mask): fireball hits > lifesteal heal > fireball > ... forever.
- Overheal Ring + any regen at full health: a shield that grows forever.
- Frozen Thunderbolt + Static Crystal: a proc (chain) triggering another proc (ice burst).
Recommended rule "proc depth 1": damage made BY an item proc (bombs, chains, bursts, fireballs, knife bursts,
tornado ticks, minion explosions) does NOT trigger other procs, lifesteal, or on-hit items. ONE named exception:
Frozen Thunderbolt may react to Static Crystal / Chain Lightning (that is its whole point); its ice bursts trigger nothing.
- Overheal shield cap: the shield from Overheal Ring is capped at a % of max health (suggest 25%, more copies raise it a little).

### 1d. Heals counted unfairly
Regen heals every frame. If each tiny regen tick counted as a "heal received", Grimoire would roll hundreds of times.
Rule: regen counts as ONE heal per second. Only heals that restore at least 1 health count (heals at full health do not).

### 1e. What counts as an "attack"
Rule needed for every "per attack" item. Recommended:
- "Per attack" = the holder's BASIC attacks only (not skills, not minions, not proc damage). Matches today's `onAttack`.
- Quick Gloves' double hit counts as the same attack (does not roll procs twice, does not count a Bard beat twice).
- Skills that hit many enemies (Fan of Knives, Rain of Arrows, Wind Cutter, Ground Pound, Crescendo) are NOT attacks,
  so Sucker Punch Glove and Brawler's Streak do not apply to them (otherwise Sucker Punch +50% hits every enemy at once).
- Do item procs on the Rogue / Samurai count as "their own chance-based debuffs" for the easier-debuff passive?
  Recommend YES: it makes them the best holders for on-hit debuff items, which is their identity.

### 1f. Naming clashes
- Executioner's Mark (item) does not Mark anything, but Hunter's Mark (Archer skill) and Hunter's Sigil (item) do. Rename to **Executioner's Axe**.
- Bulwark Charm vs Bulwark Plate are different things. Rename Bulwark Charm to **Warding Charm**.
- Knife Fan (working name): suggest **Thousand Cuts**.

### 1g. Stacking text that is out of date
- Spite Mail row still says "capped at 75%" (defense now uses the curve).
- `items.json` has hidden stack caps not in the list: Feather Boots max 7, Bulwark Plate max 3, Gambler's Dice max 3.
  With the 70% evasion cap Feather Boots can go to max 8. Bulwark Plate's max 3 was there because of the 75% defense cap: the curve makes it unnecessary (suggest remove). Keep Gambler's Dice max 3.

### 1h. Upkeep is too harsh on cheap spawners
-12% attack speed and defense per minion item makes a COMMON Rat Cage cost as much as a legendary Phoenix.
Suggest: weak spawners -6% each, greater spawners -12% each. Boosters (Bone Charm, Overseer's Whistle, Grave Dust) cost nothing.
Necro Crown spawns, so it counts as a weak spawner. The Necromancer's own skeletons cost nothing (they are his passive).
Also decide: are boosters squad-wide (work on every minion on the hero side, whoever holds them)? Recommend YES,
so the booster can sit on any hero and the Necromancer is not forced to hold everything.

### 1i. Sources that exist in the debuff list but nothing applies them
- **Curse** (-resist): nobody applies it now (Bloodmoon Curse was not picked), but Death Coil and Smite mention it.
- **Fear** and **Silence**: no hero or item applies them.
Either drop them from Part 1 for now, or add an item (see section 6).

---

## 2. Synergies

### 2a. Best items per hero
| Hero | Best items | Why | Traps (avoid) |
|---|---|---|---|
| Knight | Provoker's Horn, Spite Mail, Bulwark Plate, Mimic Chest, Martyr's Shield, Shield Totem, Padded Vest, Fire Heart, Tough Skin | Taunt pulls hits onto him; everything that pays off "being hit" works best here | Damage items (his attack is low); Eagle Eye, Fire Arrows |
| Berserker | Bloodlust Mask, Blood Chalice, Serrated Edge, Thousand Cuts, Excalibur, Quick Gloves, Executioner's Axe | Bloodrage wants low health + lifesteal to stay alive; Savage Leap doubles on bleeding | Full Vigor (never full), Second Wind Flask, big regen (keeps his health high, so Bloodrage stays weak) |
| Rogue | Venom Fang, Rusty Nails, Ember Charm, Serrated Edge, Gambler's Dice, Exploiter's Lens, Hunter's Sigil, War Banner, Jolly Banner, Fire Bombs, Static Crystal, Eagle Eye/Fire Arrows (for Fan of Knives) | Fastest attacks (140) = most rolls per second; his debuff bonus boosts item debuffs; Opportunist loves debuffs | Brawler's Streak without tapping, Sharp Edge is fine but weaker than Eagle Eye for his skill |
| Archer | Eagle Eye, Fire Arrows, Full Vigor, Hunter's Sigil, Echo Rune, Hourglass, Siege Cannon, Static Crystal | Steady Aim + Full Vigor both reward never being hit (protect him with Knight taunt, Gargoyle, Martyr's Shield) | Sharp Edge, Excalibur; minion upkeep (speed loss) |
| Samurai | Lucky Coin, Gambler's Dice, Executioner's Axe, Sucker Punch Glove, Shatter Hammer, Serrated Edge, Blood Chalice, Siege Cannon, Eagle Eye (Wind Cutter) | Few but huge hits: flat "per hit" bonuses beat "per attack chance" items | Chance-per-attack procs (Fire Bombs, War Banner) - he attacks slowly; Quick Gloves is fine |
| Mage | Kindling, Frost Charm, Ember Charm, Chill Band, Fire Bombs, Static Crystal, Frozen Thunderbolt, Magma Core, Fire Arrows, Metronome, Echo Rune | Spellweaver fires ALL his elemental on-hit items on every 4th attack; rotation applies burn/freeze/electric | Melee items; minion upkeep |
| Cleric | Heart Charm, Overheal Ring, Warding Charm, Conductor's Baton, Metronome, minion spawners (cheap upkeep) | Her passive multiplies item regen; 4th-attack heal + Metronome; Divine Shield + Baton | Pure damage items |
| Necromancer | Necro Crown, Bone Charm, Overseer's Whistle, Grave Dust, spawners, Plague Flask, Venom Fang | Death Coil kills raise skeletons; boosters affect his skeletons; low upkeep cost | Defense items (upkeep eats them) |
| Bard | Metronome, Quick Gloves, War Banner, Jolly Banner, Conductor's Baton, minion spawners | Rhythm empowers every 4th squad attack; more squad attacks = more beats | Melee items |
| Alchemist | Ember Charm, Venom Fang, Chill Band, Plague Flask, Magma Core, Exploiter's Lens, Bulwark/Warding Charm, Spiked Aegis | Catalyst makes all enemy debuffs stronger and longer; Flask Barrage spreads 3 debuff types (Exploiter's Lens needs 3) | Melee items |

### 2b. Named builds (combos to aim for)
1. **Inferno** (Mage, Alchemist): Kindling + Ember Charm + Fire Bombs + Magma Core + Fire Arrows + Fire Imp Brazier. Fireball sets Burn, Catalyst makes burns longer, Magma Core makes burning enemies take more. Mage's 4th attack fires every fire item at once.
2. **Shatter** (Mage + Samurai/Berserker): Chill Band / Frost Nova / Frozen Thunderbolt freeze; Shatter Hammer on a BIG single hitter cashes it in (+60%). Even on one hero: Chill Band freezes, the next hit shatters.
3. **Storm** (Mage): Static Crystal + Frozen Thunderbolt + Shatter Hammer + Chain Lightning. Every chain bounce bursts ice, frozen enemies take more from Chain Lightning.
4. **Bleed Out** (Samurai + Berserker + Alchemist): Serrated Edge + Thousand Cuts (3 stacks) + Blood Chalice; Savage Leap deals double on bleeding; bleed ignores defense; Catalyst lengthens it.
5. **Plague** (Alchemist + Necromancer + Rogue): Venom Fang + Plague Flask + Gambler's Dice (poison option); deaths spread poison, Death Coil hits poisoned harder, Necro Crown raises skeletons on every kill.
6. **Debuff Storm** (Rogue): Venom Fang + Rusty Nails + Ember Charm + Gambler's Dice + Exploiter's Lens + Hunter's Sigil. Fast attacks + easier debuffs reach 3 debuffs quickly; Opportunist adds crit vs debuffed.
7. **Executioner** (Samurai): Lucky Coin + Gambler's Dice + Executioner's Axe + Sucker Punch Glove. Focus Stance and Jolly Banner give guaranteed crits.
8. **Holy Engine** (Cleric + Bard): Heart Charm + Overheal Ring + Warding Charm + Spiked Aegis + Lost Cleric's Grimoire. Regen > overheal shield > shield breaks explode; heals received launch fireballs. Ballad of Rest is a 4-second fireball storm on the Grimoire holder.
9. **Untouchable** (Archer + Knight): Archer holds Full Vigor + Fire Arrows + Eagle Eye; Knight holds Provoker's Horn + Martyr's Shield. The Archer is never hit, so Steady Aim and Full Vigor stay on.
10. **Iron Wall** (Knight): Provoker's Horn + Spite Mail + Bulwark Plate + Mimic Chest + Fire Heart + Shield Totem. Taunt > every hit reflects, burns, and may pop a Mimic.
11. **Army** (Necromancer + Cleric/Bard holding spawners): Necro Crown + Bone Charm + Overseer's Whistle + Grave Dust + Rat Cage (bursts). War Cry and Rally Cry buff minions too. Kill > minion > explodes > kill.
12. **Skill Spam** (anyone with strong skills): Hourglass + Echo Rune + Siege Cannon + Conductor's Baton. Echo of Divine Shield, Mystery Brew (4 flasks), Ground Pound.
13. **Tempo** (Bard + Rogue): Metronome + Quick Gloves + War Banner + Jolly Banner. More attacks = more Rhythm beats; Metronome on the Bard boosts every squad beat.
14. **Last Stand** (Berserker): Bloodlust Mask + Blood Chalice + Serrated Edge. Low health = fast; lifesteal and kill heals keep him just alive.

### 2c. Item + item pairs (quick list)
- Chill Band + Shatter Hammer (freeze then cash in, same holder works)
- Static Crystal + Frozen Thunderbolt (chain bursts ice on every bounce)
- Ember Charm + Magma Core; Kindling + anything Fire (Fire Bombs, Fire Arrows, Imp, Fire Heart burn)
- Serrated Edge + Thousand Cuts + Blood Chalice
- Venom Fang + Plague Flask
- Rusty Nails + Sharp Edge / Samurai (armor break helps physical hits)
- Gambler's Dice + Lucky Coin + Exploiter's Lens (crits add debuffs)
- Heart Charm + Overheal Ring + Warding Charm + Spiked Aegis
- Bandage Roll / Heart Charm / Jolly Banner + Lost Cleric's Grimoire (all are heals received)
- Provoker's Horn + Spite Mail + Bulwark Plate + Mimic Chest
- Martyr's Shield + Mimic Chest (more hits on the holder = more Mimics)
- Gargoyle Idol (draws attacks) + Full Vigor / Archer Steady Aim
- Phoenix Hatchling (heals squad when hit) + Gargoyle (keeps Phoenix safer) + Grimoire (Phoenix heals count)
- Necro Crown + Grave Dust + Bone Charm + Overseer's Whistle
- Hourglass + Echo Rune + Siege Cannon (+ Conductor's Baton for support skills)
- Metronome + Bard / Mage / Cleric
- Sucker Punch Glove + random auto-target (each new enemy is a first hit) - good WITHOUT tapping
- Brawler's Streak + tap-to-focus - good only WITH tapping
- Second Wind Flask + Tough Skin + Aid Kit (safe early run)
- Fire Heart + Spiked Aegis (fire shield breaks = explosion) + Magma Core (burned attackers take more)
- Hunter's Sigil + Archer's Hunter's Mark (decide if two marks stack; recommend yes, different sources)

### 2d. Anti-synergies (players may fall into these)
- Full Vigor / Second Wind on the Berserker (fights his passive).
- Martyr's Shield on a fragile hero: he dies, ALL his items stop working.
- Minion items on the Archer/Samurai: upkeep eats their damage.
- Brawler's Streak with no tapping (auto-target is random every attack, the streak keeps resetting).
- Spite Mail with no taunt source.
- Shatter Hammer on the Rogue: fast hits break freezes early and waste the control.

---

## 3. Tweaks (every item)
"Keep" = no change recommended. Numbers are still tuned last.

### Common
| Item | Recommendation |
|---|---|
| Whetstone | Keep |
| Padded Vest | Keep |
| Lucky Coin | Keep. Note: Rogue 20 base crit + 10 coins = 95%; make sure total crit caps at 100% |
| Sharp Edge | Keep. Tag "melee" for soft gating |
| Eagle Eye | Keep. Tag "ranged". Make it clear in the text that it boosts Fan of Knives and Wind Cutter |
| Aid Kit | Keep |
| Sucker Punch Glove | Keep, but basic attacks only (rule 1e) |
| Bandage Roll | Keep |
| Second Wind Flask | Keep |
| Full Vigor | Keep. Overheal shields should count as "full health" so the Holy Engine combo works |
| Brawler's Streak | Keep. Text should say "best when you tap an enemy" |
| Tough Skin | Small buff: first copy 60% (was 50%), so it is not weaker than Padded Vest late |
| Kindling | Keep. Rule: also boosts BURN damage (burn is fire) |
| Frost Charm | Keep. Rule: also boosts Chill Band's ice hit and Frozen Thunderbolt bursts |
| Rat Cage | Keep. Upkeep -6% (weak spawner) |

### Rare
| Item | Recommendation |
|---|---|
| Feather Boots | Keep. Raise hidden max stacks from 7 to 8 (70% cap) |
| Heart Charm | Keep |
| War Banner | Keep |
| Shield Totem | Keep |
| Fire Bombs | Keep. Bombs follow proc depth 1 |
| Chill Band | Keep, but watch it: 50% freeze per attack on a fast hero is very strong control. If too strong, lower to 35% |
| Fire Arrows | Keep. Also counts ranged skills (as decided) |
| Ember Charm | Move to COMMON (see 4). Lower to 6% per copy |
| Serrated Edge | Keep rare |
| Venom Fang | Move to COMMON. Lower to 8% per copy |
| Rusty Nails | Move to COMMON |
| Executioner's Mark | Rename to Executioner's Axe |
| Bulwark Charm | Rename to Warding Charm. Tag "shield" |
| Overheal Ring | Add the shield cap (rule 1c). Tag "heal" |
| Provoker's Horn | Change: gives ANY holder a 10% taunt chance on attack (the Knight adds it to his own). Not a dead card without the Knight, and makes Spite Mail work for others |
| Hourglass | Move to COMMON (only -5% now, needs many copies) |
| Conductor's Baton | Keep |
| Bone Charm | Keep. Squad-wide (rule 1h). Tag "minion" |
| Overseer's Whistle | Keep. Applies to every weak minion source on the team |
| Wisp Lantern | Keep |
| Gargoyle Idol | Keep. Its "draws attacks" should use the real taunt status, so Provoker's Horn/Spite Mail logic is shared |

### Epic
| Item | Recommendation |
|---|---|
| Quick Gloves | Keep |
| Bulwark Plate | Keep. Remove the hidden max 3 stacks (defense curve) |
| Siege Cannon | Move to LEGENDARY: +40% attack AND +30% skill damage is above every other epic now that skills matter more |
| Static Crystal | Keep |
| Magma Core | Keep. Tag "burn" |
| Shatter Hammer | Keep. Tag "freeze" |
| Blood Chalice | Keep. Tag "bleed" |
| Plague Flask | Keep. Tag "poison" |
| Exploiter's Lens | Buff to +30% (it now needs 3 different debuffs, which is hard) |
| Hunter's Sigil | Keep. Strong (squad-wide); watch it in tuning |
| Spiked Aegis | Keep. Rule: only a shield BROKEN by damage explodes (timed shields that run out do not). Tag "shield" |
| Spite Mail | Keep. Fix the "75% cap" text. Tag "taunt" |
| Echo Rune | Keep. Rules: an echo cannot echo; the Mage rotation advances once (the echo repeats the same spell); a channel (Rain of Arrows, Crescendo) echoes as a second, weaker channel right after |
| Metronome | Move to RARE (narrow). Rule: boosts every empowered beat the HOLDER causes; on the Bard that is every squad Rhythm beat. Tag "beat" |
| Knife Fan | Rename to Thousand Cuts. Keep |
| Martyr's Shield | Keep. Rule: thorns/reflect from the holder DO apply to redirected melee hits |
| Grave Dust | Move to RARE (needs minions). Explosions follow proc depth 1 |
| Fire Imp Brazier | Keep |
| Mimic Chest | Move to RARE (cheap, fun, conditional) |
| Spirit Knight Banner | Keep. Cap its per-floor growth (suggest +5% per floor survived, max +100%) |

### Legendary
| Item | Recommendation |
|---|---|
| Bloodlust Mask | Keep |
| Gambler's Dice | Keep (max 3) |
| Shared Potion | Keep (separate 5% rule) |
| Lost Cleric's Grimoire | Keep with rules 1c and 1d (fireballs do not lifesteal; regen counts once per second) |
| Excalibur | Keep. Tornado ticks follow proc depth 1. Tag "melee" |
| Jolly Banner | Move to EPIC (5% for 2s on 2 heroes is close to the rare War Banner). Or keep legendary and make it 8% / 3s |
| Frozen Thunderbolt | Keep. The one proc-depth exception. Tag "electric" |
| Fire Heart | Keep |
| Necro Crown | Keep. Counts as a weak spawner for upkeep |
| Phoenix Hatchling | Keep. Its squad heal counts as heals received (Grimoire) |

---

## 4. Rarity swaps (recommended)
| Item | From | To | Why |
|---|---|---|---|
| Ember Charm | Rare | Common | Debuff STARTERS should be easy to find so debuff builds can begin early; the PAYOFFS stay epic |
| Venom Fang | Rare | Common | Same |
| Rusty Nails | Rare | Common | Same |
| Hourglass | Rare | Common | Now only -5% per copy, needs many copies |
| Metronome | Epic | Rare | Only 3 heroes use it |
| Grave Dust | Epic | Rare | Needs minions first |
| Mimic Chest | Epic | Rare | Small, conditional effect |
| Jolly Banner | Legendary | Epic | Close in power to War Banner (rare) |
| Siege Cannon | Epic | Legendary | Strongest epic by far |

After swaps: Common 19, Rare 20, Epic 17, Legendary 10 (9 + Shared Potion). Total still 66.

---

## 5. Drop rates

### 5a. New roll (recommended)
For each of the 3 cards:
1. Roll the RARITY with fixed odds that improve deeper in the dungeon.
2. Pick an item of that rarity using its drop WEIGHT (100 = normal). Items with a "needs" tag get x0.25 while the squad has no source.
3. Same as today: no duplicate cards on one screen, items a hero cannot take are skipped (max stacks, dead heroes), Shared Potion stays a separate 5% roll.

| Floors | Common | Rare | Epic | Legendary | Chance a screen (3 cards) shows at least one legendary |
|---|---|---|---|---|---|
| 1-10 | 62% | 29% | 7.5% | 1.5% | about 4% |
| 11-30 | 52% | 32% | 13% | 3% | about 9% |
| 31+ | 42% | 34% | 19% | 5% | about 14% |

All odds and weights go in JSON (`rarities.json` per floor band, `dropWeight` and `needs` per item in `items.json`).

### 5b. Per-item drop weight and chance per card (all needs met)
Weights below 100: strong items, or items that need a setup. "Needs" sources:
melee = a melee hero (or Rogue/Samurai); ranged = a ranged hero OR Rogue/Samurai (ranged skills); fire = Mage, Alchemist, or a fire item;
ice = Mage, Alchemist, Chill Band; burn = Mage, Alchemist, Ember Charm, Fire Imp, Fire Heart; freeze = Mage, Chill Band, Frozen Thunderbolt;
bleed = Samurai, Serrated Edge, Thousand Cuts; poison = Alchemist, Venom Fang, Gambler's Dice; electric = Mage, Static Crystal;
shield = Mage, Necromancer, Alchemist, Fire Heart, Overheal Ring; heal = Cleric, Bard, or any heal/regen item; taunt = Knight, Provoker's Horn, Gargoyle;
minion = Necromancer or any spawner item; beat = Bard, Mage, Cleric.
### COMMON (19 items)
| Item | Weight | Needs (x0.25 if squad has no source) | Per card, floors 1-10 | 11-30 | 31+ |
|---|---|---|---|---|---|
| Whetstone | 100 | - | 3.39% | 2.84% | 2.30% |
| Padded Vest | 100 | - | 3.39% | 2.84% | 2.30% |
| Lucky Coin | 100 | - | 3.39% | 2.84% | 2.30% |
| Sharp Edge | 100 | melee | 3.39% | 2.84% | 2.30% |
| Eagle Eye | 100 | ranged | 3.39% | 2.84% | 2.30% |
| Aid Kit | 100 | - | 3.39% | 2.84% | 2.30% |
| Sucker Punch Glove | 100 | - | 3.39% | 2.84% | 2.30% |
| Bandage Roll | 100 | - | 3.39% | 2.84% | 2.30% |
| Second Wind Flask | 110 | - | 3.73% | 3.13% | 2.52% |
| Full Vigor | 90 | - | 3.05% | 2.56% | 2.07% |
| Brawler's Streak | 80 | - | 2.71% | 2.27% | 1.84% |
| Tough Skin | 80 | - | 2.71% | 2.27% | 1.84% |
| Kindling | 100 | fire | 3.39% | 2.84% | 2.30% |
| Frost Charm | 100 | ice | 3.39% | 2.84% | 2.30% |
| Rat Cage | 80 | - | 2.71% | 2.27% | 1.84% |
| Hourglass (from rare) | 100 | - | 3.39% | 2.84% | 2.30% |
| Venom Fang (from rare) | 100 | - | 3.39% | 2.84% | 2.30% |
| Rusty Nails (from rare) | 90 | - | 3.05% | 2.56% | 2.07% |
| Ember Charm (from rare) | 100 | - | 3.39% | 2.84% | 2.30% |

### RARE (20 items)
| Item | Weight | Needs (x0.25 if squad has no source) | Per card, floors 1-10 | 11-30 | 31+ |
|---|---|---|---|---|---|
| Feather Boots | 100 | - | 1.64% | 1.81% | 1.92% |
| Heart Charm | 100 | - | 1.64% | 1.81% | 1.92% |
| War Banner | 100 | - | 1.64% | 1.81% | 1.92% |
| Shield Totem | 90 | - | 1.47% | 1.63% | 1.73% |
| Fire Bombs | 100 | - | 1.64% | 1.81% | 1.92% |
| Chill Band | 80 | - | 1.31% | 1.45% | 1.54% |
| Fire Arrows | 100 | ranged | 1.64% | 1.81% | 1.92% |
| Serrated Edge | 100 | - | 1.64% | 1.81% | 1.92% |
| Executioner's Mark | 100 | - | 1.64% | 1.81% | 1.92% |
| Bulwark Charm | 80 | shield | 1.31% | 1.45% | 1.54% |
| Overheal Ring | 80 | heal | 1.31% | 1.45% | 1.54% |
| Provoker's Horn | 90 | - | 1.47% | 1.63% | 1.73% |
| Conductor's Baton | 100 | - | 1.64% | 1.81% | 1.92% |
| Bone Charm | 80 | minion | 1.31% | 1.45% | 1.54% |
| Overseer's Whistle | 70 | minion | 1.15% | 1.27% | 1.34% |
| Wisp Lantern | 90 | - | 1.47% | 1.63% | 1.73% |
| Gargoyle Idol | 80 | - | 1.31% | 1.45% | 1.54% |
| Metronome (from epic) | 80 | beat | 1.31% | 1.45% | 1.54% |
| Grave Dust (from epic) | 70 | minion | 1.15% | 1.27% | 1.34% |
| Mimic Chest (from epic) | 80 | - | 1.31% | 1.45% | 1.54% |

### EPIC (17 items)
| Item | Weight | Needs (x0.25 if squad has no source) | Per card, floors 1-10 | 11-30 | 31+ |
|---|---|---|---|---|---|
| Quick Gloves | 100 | - | 0.48% | 0.84% | 1.23% |
| Bulwark Plate | 100 | - | 0.48% | 0.84% | 1.23% |
| Static Crystal | 100 | - | 0.48% | 0.84% | 1.23% |
| Magma Core | 90 | burn | 0.44% | 0.75% | 1.10% |
| Shatter Hammer | 90 | freeze | 0.44% | 0.75% | 1.10% |
| Blood Chalice | 90 | bleed | 0.44% | 0.75% | 1.10% |
| Plague Flask | 80 | poison | 0.39% | 0.67% | 0.98% |
| Exploiter's Lens | 80 | - | 0.39% | 0.67% | 0.98% |
| Hunter's Sigil | 100 | - | 0.48% | 0.84% | 1.23% |
| Spiked Aegis | 80 | shield | 0.39% | 0.67% | 0.98% |
| Spite Mail | 80 | taunt | 0.39% | 0.67% | 0.98% |
| Echo Rune | 90 | - | 0.44% | 0.75% | 1.10% |
| Knife Fan | 100 | - | 0.48% | 0.84% | 1.23% |
| Martyr's Shield | 90 | - | 0.44% | 0.75% | 1.10% |
| Fire Imp Brazier | 90 | - | 0.44% | 0.75% | 1.10% |
| Spirit Knight Banner | 90 | - | 0.44% | 0.75% | 1.10% |
| Jolly Banner (from legendary) | 100 | - | 0.48% | 0.84% | 1.23% |

### LEGENDARY (9 items)
| Item | Weight | Needs (x0.25 if squad has no source) | Per card, floors 1-10 | 11-30 | 31+ |
|---|---|---|---|---|---|
| Bloodlust Mask | 100 | - | 0.18% | 0.37% | 0.61% |
| Gambler's Dice | 100 | - | 0.18% | 0.37% | 0.61% |
| Siege Cannon (from epic) | 100 | - | 0.18% | 0.37% | 0.61% |
| Lost Cleric's Grimoire | 80 | heal | 0.15% | 0.29% | 0.49% |
| Excalibur | 100 | melee | 0.18% | 0.37% | 0.61% |
| Frozen Thunderbolt | 70 | electric | 0.13% | 0.26% | 0.43% |
| Fire Heart | 100 | - | 0.18% | 0.37% | 0.61% |
| Necro Crown | 80 | - | 0.15% | 0.29% | 0.49% |
| Phoenix Hatchling | 90 | - | 0.16% | 0.33% | 0.55% |

Shared Potion: not in the table, stays a separate 5% chance per screen (only when a living hero is hurt).

---

## 6. Gaps (suggested NEW items, optional)
| Idea | Rarity | Effect | Fills |
|---|---|---|---|
| Storm Charm | Common | +15% electric damage | Electric has no damage-type item (fire and ice do) |
| Shadow Charm | Common | +15% dark damage (poison and Death Coil are dark) | Dark has none |
| Mage Cloak | Common | +10 resist | No resist item at all (magic enemies come later) |
| Hex Doll | Rare | 8% chance per attack to Curse (-resist) | Curse has no source |
| Dread Bell | Rare | 5% chance per attack to Fear (enemy skips its next attack) | Fear has no source |
| Gag Rune | Rare | Stun / freeze on an enemy also Silences it for 2s | Silence has no source (only useful once enemies get skills) |
| Phoenix Feather | Legendary | Once per run, a hero who dies comes back with 30% health | Old draft idea; dead heroes are otherwise gone for the run |

---

## 7. Decisions needed (short list)
1. New drop roll (rarity first, then item weight) and the floor odds table?
2. Soft gating x0.25 for "needs" items?
3. Proc depth 1 rule (with Frozen Thunderbolt as the exception)?
4. Overheal shield cap (25% of max health)? Regen counts as one heal per second?
5. "Per attack" = basic attacks only; Rogue/Samurai debuff bonus applies to item procs?
6. Renames: Executioner's Axe, Warding Charm, Thousand Cuts?
7. The 9 rarity swaps?
8. Upkeep split: weak spawners -6%, greater -12%, boosters free and squad-wide?
9. Provoker's Horn gives any holder taunt? Exploiter's Lens to +30%? Tough Skin to 60%? Spirit Knight growth cap?
10. Drop Curse / Fear / Silence for now, or add Hex Doll / Dread Bell / Gag Rune? Add Storm Charm, Shadow Charm, Mage Cloak, Phoenix Feather?
