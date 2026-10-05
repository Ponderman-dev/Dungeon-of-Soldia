# Item list (master list, recompiled for the big update)

Status: `BUILT` = already in `src/data/items.json`. `NEW` = designed in chat, not built yet. Numbers are placeholders, tuned last.
No mana items. Items are passive only. Items on a dead hero stop working. Details of how new systems work are in `docs/big-update-plan.md`.

## General stacking rules
- Copies of an item stack by default with no cap, unless the Stacking column says otherwise.
- RULE CHANGES (decided): defense no longer has a hard 75% cap; it uses a diminishing curve that never reaches 100% (formula tuned last, keep low values close to today: 10 defense is about 10% less). Evasion cap is now 70% (was 60%). Crit caps stay item-set. Resist uses the same curve as defense (decided).
- Defense, resist, evasion, crit items add flat points; attack, health items add a % of the hero's base stat.
- Chance effects: each copy rolls separately, unless noted as unique (does not stack). Same status from the same source refreshes instead of stacking.
- Dodge/crit-type chances have caps set in the item JSON. `falloffRatio` means diminishing returns (each extra copy adds ratio^(copies-1) of the effect).
- Greater minion items: one minion per item, extra copies stack only its stats. Weak minion items: each copy has its own spawn timer, with a shared cap.
- All stacking rules were reviewed with the user one by one. A few exact numbers marked "(suggest)" inside a row are still my starting values to tune last.

Totals: 66 items. Common 15, Rare 21, Epic 20, Legendary 10.

## COMMON (15)
| Item | Type | Status | Effect | Stacking |
|---|---|---|---|---|
| Whetstone | stat | BUILT | +12% attack and +3 attack | Fully additive, no cap |
| Padded Vest | stat | BUILT | +12 defense (reviewed, kept) | Flat points add up with no item cap. Defense now uses a diminishing curve instead of the hard 75% cap (see rule changes) |
| Lucky Coin | stat | BUILT | +10 crit, diminishing, max 10 coins = +75 | Diminishing: each extra coin adds 0.934x the last. Max 10 coins (+75 total) |
| Sharp Edge | stat | BUILT | +15% melee damage (reviewed, kept) | Fully additive, no cap |
| Eagle Eye | stat | BUILT | +15% ranged damage (reviewed, kept) | Fully additive, no cap |
| Aid Kit | special | BUILT | heal 5% max health when a floor is cleared, falloff per extra kit | Diminishing: each extra kit adds 0.85x the last |
| Sucker Punch Glove | on-hit | NEW | first attack on each enemy deals +50% damage | Bonus adds up per copy (+50% each). First-attack tracking is shared |
| Bandage Roll | special | NEW | holder heals 3% max health on each kill | Heal adds up per copy (3% each), no cap |
| Second Wind Flask | special | NEW | CONSUMABLE: when the holder drops below 40% health, one flask is used up and heals 30% max health (raised from 15%) | CONSUMABLE: each copy is one use (like potions in an inventory). A trigger uses up one copy and the rest wait. At most ONE trigger per floor per holder. Stacking = more uses over the run, not a bigger heal |
| Full Vigor | special | NEW | +15% damage while the holder is at full health | Bonus adds up per copy (+15% each) |
| Brawler's Streak | on-hit | NEW | each consecutive hit on the same target adds +2% damage (max +10%), resets on a new target | Per-hit bonus stays +2%. Each extra copy raises the MAX (+10%, +20%, +30%...), so the streak takes longer to build but gets bigger |
| Tough Skin | special | NEW | the first hit the holder takes each floor deals 50% less damage | One protected hit per floor. Each extra copy makes the cut bigger (50%, 65%, 75%... capped at 90%) |
| Kindling | stat | NEW | +15% fire damage | Additive (+15% each), no cap |
| Frost Charm | stat | NEW | +15% ice damage | Additive (+15% each), no cap |
| Rat Cage | minion | NEW | every 12s a Rat (weak minion) bites a random enemy | Spawn in bursts: each extra copy adds one more minion to every spawn (1 rat, then 2 rats at once...). One shared timer. Weak minion cap is shared |

## RARE (21)
| Item | Type | Status | Effect | Stacking |
|---|---|---|---|---|
| Feather Boots | stat | BUILT | +8 evasion (reviewed, kept) | Flat points add up. Evasion cap raised to 70% for everyone (was 60%) |
| Heart Charm | stat | BUILT | +22% max health and regen 0.5% max health per second in fights | Health % and regen both add up per charm, no cap |
| War Banner | squad | BUILT | 8% per attack: Battle Cry, squad +25% attack speed 2s | Each copy rolls its own 8% separately. The buff refreshes, it does not stack |
| Shield Totem | special | BUILT | 10% block chance, 2.5s recharge, max 6 | +10% block chance per totem, max 6. Any block recharges ALL totems together |
| Fire Bombs | on-hit | BUILT | 5% per attack: bomb, 250% fire damage (ranged) | Each copy rolls its own 5% separately |
| Chill Band | on-hit | BUILT | every attack adds a 10% ice hit per band, 50% chance to freeze 0.7s (no stack) | Ice hit adds per band (+10% each). The 50% freeze is unique: more bands do NOT raise it |
| Fire Arrows | on-hit | NEW | ranged attacks 50% chance (no stack) for an extra fire hit; extra copies raise fire damage | Chance does NOT stack (stays 50%). Extra copies add to the fire hit damage (stacks) |
| Ember Charm | on-hit | NEW | 8% chance per attack to Burn the target (fire damage over time, 3s) | Burn chance adds up per copy (8% each) AND burn damage adds up per copy. Burn from these charms refreshes, it does not stack as separate burns |
| Serrated Edge | on-hit | NEW | 10% chance per attack to make the target Bleed | Chance adds up but with diminishing returns per extra copy (suggest 0.8x the last: 10%, 8%, 6.4%...) |
| Venom Fang | on-hit | NEW | 10% chance per attack to Poison the target | Chance adds up normally (10% per copy). Poison from the same item refreshes |
| Rusty Nails | on-hit | NEW | 8% chance per attack to Armor Break the target (-defense) | Chance adds up normally (8% per copy). Armor Break refreshes, it does not stack |
| Executioner's Mark | special | NEW | +30% damage to enemies under 25% health | Diminishing with a very small gap (suggest 0.95x the last: +30%, +28.5%, +27%...) |
| Bulwark Charm | stat | NEW | shields the holder receives are 30% bigger | Additive (+30% each), no cap |
| Overheal Ring | special | NEW | healing above full health becomes a shield | A % of the healing above 100% health is converted to shield (suggest 40% per copy). Each extra copy adds more %, up to 100% |
| Provoker's Horn | special | NEW | taunt chance +10%, taunted enemies take +15% damage | Both add up per copy (+10% taunt chance and +15% damage vs taunted), no cap |
| Hourglass | skill | NEW | skill cooldowns 5% shorter (lowered from 12%, so it needs several copies) | Additive (-5% per copy). Cap not stated: suggest 50% shorter total |
| Conductor's Baton | skill | NEW | support skill effects 25% stronger and 25% longer | Diminishing: each extra copy adds less to both strength and length (suggest 0.85x the last) |
| Bone Charm | minion | NEW | all minions (weak and greater) +20% health and attack (lowered from 30%) | Additive (+20% each), no cap |
| Overseer's Whistle | minion | NEW | weak minion cap +1, weak minions attack 15% faster | +1 weak minion cap per copy, max +4 total. Attack speed bonus adds up (+15% each) |
| Wisp Lantern | minion | NEW | every 15s a flying Wisp (weak minion, ranged magic) | Spawn in bursts: each extra copy adds one more Wisp to every spawn. One shared timer. Weak minion cap is shared |
| Gargoyle Idol | minion | NEW | greater minion: a slow, tanky Gargoyle that draws enemy attacks | Greater minion: 1 Gargoyle however many copies. Extra copies add +25% to its stats each (additive) |

## EPIC (20)
| Item | Type | Status | Effect | Stacking |
|---|---|---|---|---|
| Quick Gloves | stat | BUILT | +18% attack speed, 5% per attack to hit twice | Attack speed adds up. Each copy rolls its own double-hit chance |
| Bulwark Plate | special | BUILT | +30 defense, reflects 25% of melee damage taken (reviewed, kept) | Defense and thorns % both add up. Defense uses the diminishing curve |
| Siege Cannon | special | BUILT | +40% attack, skills +30% damage, 5% skill splash | Attack, skill damage and splash chance all add up |
| Static Crystal | on-hit | BUILT | 10% per attack: chain lightning, 300% electric, jumps to 2 more enemies | Each copy rolls its own 10% separately |
| Magma Core | special | NEW | burning enemies take +25% damage from the holder, burn ticks 30% faster | Damage bonus adds up (+25% each). Burn speed bonus adds up but is capped (suggest +100% total) |
| Shatter Hammer | special | NEW | hits on a frozen enemy deal +60% damage and break the freeze | Damage bonus adds up per copy (+60% each). The freeze breaks once per hit |
| Blood Chalice | special | NEW | bleeding enemies take +20% damage from the holder, killing one heals the holder 3% | Both add up per copy (+20% damage, +3% heal) |
| Plague Flask | special | NEW | when a poisoned enemy dies, its poison spreads to another enemy | +1 enemy it spreads to per copy. If there are no fresh enemies left, extra spread goes to enemies already poisoned and adds a poison STACK on them (an exception to the refresh rule) |
| Exploiter's Lens | special | NEW | +20% damage to enemies with 3 or more different debuffs (raised from 2) | Additive (+20% each), no cap |
| Hunter's Sigil | special | NEW | first hit on each enemy Marks it; marked enemies take +10% damage from the whole squad | Mark is unique (one mark per enemy). Squad damage bonus adds up per copy (+10% each) AND each extra copy makes the mark last longer |
| Spiked Aegis | special | NEW | when the holder's shield breaks it explodes, damaging all enemies | Explosion damage adds up per copy |
| Spite Mail | special | NEW | while the holder is taunting: +30 defense and reflect damage | Both add up per copy (+30 defense and reflect %); total defense is still capped at 75% damage cut |
| Echo Rune | skill | NEW | 15% chance a skill casts twice | Chance adds up (+15% per copy), capped at 60% total. The echo cast deals only 60% of the original; each extra copy raises that toward 100% |
| Metronome | skill | NEW | empowered 4th-beat hits (Rhythm, Spellweaver, Cleric heal) deal +50% | Bonus adds up per copy (+50% each) |
| Knife Fan (working name) | on-hit | NEW | melee seldom applies Bleed, up to 3 stacking bleeds; an enemy dying while bleeding bursts knives into nearby enemies | Max 3 stacking bleeds on one enemy (fixed, extra copies do not raise it). Extra copies raise bleed chance and the knife burst damage |
| Martyr's Shield | special | NEW | fixed 8% chance to take an ally's hit; extra copies shorten the block cooldown and reduce the health cost | Chance fixed at 8%, does not stack. Each extra copy shortens the block cooldown and lowers the health cost |
| Grave Dust | minion | NEW | weak minions explode when they die | Explosion damage adds up per copy |
| Fire Imp Brazier | minion | NEW | every 10s an Imp (weak minion, ranged fire, applies Burn) | Spawn in bursts: each extra copy adds one more Imp to every spawn. One shared timer. Weak minion cap is shared |
| Mimic Chest | minion | NEW | when the holder is hit, 10% chance a Mimic (weak minion) pops out and explodes when it dies | Chance stays 10% (does not stack). Each extra copy makes the Mimic stronger and its explosion bigger |
| Spirit Knight Banner | minion | NEW | greater minion: a Spirit Knight, balanced melee fighter that grows each floor it survives | Greater minion: 1 Spirit Knight however many copies. Extra copies add +25% to its stats each (additive) |

## LEGENDARY (10)
| Item | Type | Status | Effect | Stacking |
|---|---|---|---|---|
| Bloodlust Mask | special | BUILT | +30% attack speed, lifesteal 5%, 10% chance the heal is shared (3s cooldown) | Attack speed and lifesteal add up. Share chance adds up; the 3s share cooldown is shared |
| Gambler's Dice | special | BUILT | +20 crit, crits +50% damage and add a random debuff (slow, poison or stun) | Crit is capped (cap in the item JSON). Crit damage adds up. One random debuff per crit however many copies |
| Shared Potion | potion | BUILT | reward only: heals every living hero 25% | Not a hero item. One-use reward |
| Lost Cleric's Grimoire | special | NEW | % chance on every heal the holder RECEIVES to launch a green fire projectile at a random enemy | Chance adds up per copy, capped (suggest 50% total). Fireball damage adds up per copy |
| Excalibur | on-hit | NEW | 8% chance on a melee attack to spawn a tornado (5s, drifts between enemies, ticks damage), max 3 at once | Chance adds up per copy (8% each), capped (suggest 30% total). The tornado cap stays 3 at once |
| Jolly Banner | squad | NEW | 5% per attack: holder + 1 random ally get great regen, guaranteed crits and attack speed for 2s | Chance stays 5%. Each extra copy extends the buff duration (+0.5s). The buff refreshes, it does not stack |
| Frozen Thunderbolt | on-hit | NEW | every electric hit causes an ice burst around the enemy hit (ice damage and freeze) | Ice burst damage adds up per copy. Freeze chance is unique (does not stack) |
| Fire Heart | special | NEW | at the start of each floor a fire shield (a % of max health, bigger per copy) that slowly regenerates, blocks damage and burns attackers | Extra copies make the shield bigger (one shield per hero per floor) |
| Necro Crown | minion | NEW | weak minion cap +2, and every enemy kill by anyone raises a weak minion | +2 weak minion cap per copy, capped at +6 total. The kill-spawn effect is unique (one minion per kill, no stacking) |
| Phoenix Hatchling | minion | NEW | greater minion: a flying fire Phoenix that heals the squad a little when it is hit | Greater minion: 1 Phoenix however many copies. Extra copies add +25% to its stats and the squad heal each (additive) |

## Minion item rules (summary)
- Weak minions: many, vanish at floor end. Greater minions: max 1 per item, persist across floors, extra copies only stack its stats, no healing after a win (skills can heal it, buffs affect it), when dead the party clears 2 floors before it can be summoned again.
- Upkeep: while the holder's minion is alive the holder loses attack speed and defense (suggest -12% each per minion item), so the cheapest holders are Cleric, Bard, Alchemist, Necromancer.
- Minions vanish if the holder dies.

## Systems the NEW items need (all in the plan doc)
Burn, bleed (with stacking exception), armor break, mark, taunt, shield (absorb), block cooldown, minions (weak and greater), floor-start shield, heal-received hooks, kill hooks, first-hit-per-enemy tracking, per-floor once-only triggers, tornado objects, consecutive-hit counter.

## Still to do
- DONE: the 5 old items were reviewed and kept as they were (Padded Vest, Sharp Edge, Eagle Eye, Feather Boots, Bulwark Plate).
- Decide which of the 66 to build first. Idea: build in groups, with the systems each group needs.
- Rarity weights and Shared Potion stay as they are (`rarities.json`, `rewards.json`).
