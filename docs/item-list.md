# Item list (master list, recompiled for the big update)

Status: `BUILT` = already in `src/data/items.json`. `NEW` = designed in chat, not built yet. Numbers are placeholders, tuned last.
No mana items. Items are passive only. Items on a dead hero stop working. Details of how new systems work are in `docs/big-update-plan.md`.

Totals: 66 items. Common 15, Rare 21, Epic 20, Legendary 10.

## COMMON (15)
| Item | Type | Status | Effect |
|---|---|---|---|
| Whetstone | stat | BUILT | +12% attack and +3 attack |
| Padded Vest | stat | BUILT | +12 defense (not reviewed yet) |
| Lucky Coin | stat | BUILT | +10 crit, diminishing, max 10 coins = +75 |
| Sharp Edge | stat | BUILT | +15% melee damage (not reviewed yet) |
| Eagle Eye | stat | BUILT | +15% ranged damage (not reviewed yet) |
| Aid Kit | special | BUILT | heal 5% max health when a floor is cleared, falloff per extra kit |
| Sucker Punch Glove | on-hit | NEW | first attack on each enemy deals +50% damage |
| Bandage Roll | special | NEW | holder heals 3% max health on each kill |
| Second Wind Flask | special | NEW | first time each floor the holder drops below 40% health, heal 15% max health |
| Full Vigor | special | NEW | +15% damage while the holder is at full health |
| Brawler's Streak | on-hit | NEW | each consecutive hit on the same target adds +2% damage (max +10%), resets on a new target |
| Tough Skin | special | NEW | the first hit the holder takes each floor deals 50% less damage |
| Kindling | stat | NEW | +15% fire damage |
| Frost Charm | stat | NEW | +15% ice damage |
| Rat Cage | minion | NEW | every 12s a Rat (weak minion) bites a random enemy |

## RARE (21)
| Item | Type | Status | Effect |
|---|---|---|---|
| Feather Boots | stat | BUILT | +8 evasion (not reviewed yet) |
| Heart Charm | stat | BUILT | +22% max health and regen 0.5% max health per second in fights |
| War Banner | squad | BUILT | 8% per attack: Battle Cry, squad +25% attack speed 2s |
| Shield Totem | special | BUILT | 10% block chance, 2.5s recharge, max 6 |
| Fire Bombs | on-hit | BUILT | 5% per attack: bomb, 250% fire damage (ranged) |
| Chill Band | on-hit | BUILT | every attack adds a 10% ice hit per band, 50% chance to freeze 0.7s (no stack) |
| Fire Arrows | on-hit | NEW | ranged attacks 50% chance (no stack) for an extra fire hit; extra copies raise fire damage |
| Ember Charm | on-hit | NEW | 8% chance per attack to Burn the target (fire damage over time, 3s) |
| Serrated Edge | on-hit | NEW | 10% chance per attack to make the target Bleed |
| Venom Fang | on-hit | NEW | 10% chance per attack to Poison the target |
| Rusty Nails | on-hit | NEW | 8% chance per attack to Armor Break the target (-defense) |
| Executioner's Mark | special | NEW | +30% damage to enemies under 25% health |
| Bulwark Charm | stat | NEW | shields the holder receives are 30% bigger |
| Overheal Ring | special | NEW | healing above full health becomes a shield |
| Provoker's Horn | special | NEW | taunt chance +10%, taunted enemies take +15% damage |
| Hourglass | skill | NEW | skill cooldowns 12% shorter (diminishing per copy) |
| Conductor's Baton | skill | NEW | support skill effects 25% stronger and 25% longer |
| Bone Charm | minion | NEW | all minions (weak and greater) +30% health and attack |
| Overseer's Whistle | minion | NEW | weak minion cap +1, weak minions attack 15% faster |
| Wisp Lantern | minion | NEW | every 15s a flying Wisp (weak minion, ranged magic) |
| Gargoyle Idol | minion | NEW | greater minion: a slow, tanky Gargoyle that draws enemy attacks |

## EPIC (20)
| Item | Type | Status | Effect |
|---|---|---|---|
| Quick Gloves | stat | BUILT | +18% attack speed, 5% per attack to hit twice |
| Bulwark Plate | special | BUILT | +30 defense, reflects 25% of melee damage taken (not reviewed yet) |
| Siege Cannon | special | BUILT | +40% attack, skills +30% damage, 5% skill splash |
| Static Crystal | on-hit | BUILT | 10% per attack: chain lightning, 300% electric, jumps to 2 more enemies |
| Magma Core | special | NEW | burning enemies take +25% damage from the holder, burn ticks 30% faster |
| Shatter Hammer | special | NEW | hits on a frozen enemy deal +60% damage and break the freeze |
| Blood Chalice | special | NEW | bleeding enemies take +20% damage from the holder, killing one heals the holder 3% |
| Plague Flask | special | NEW | when a poisoned enemy dies, its poison spreads to another enemy |
| Exploiter's Lens | special | NEW | +20% damage to enemies with 2 or more different debuffs |
| Hunter's Sigil | special | NEW | first hit on each enemy Marks it; marked enemies take +10% damage from the whole squad |
| Spiked Aegis | special | NEW | when the holder's shield breaks it explodes, damaging all enemies |
| Spite Mail | special | NEW | while the holder is taunting: +30 defense and reflect damage |
| Echo Rune | skill | NEW | 15% chance a skill casts twice |
| Metronome | skill | NEW | empowered 4th-beat hits (Rhythm, Spellweaver, Cleric heal) deal +50% |
| Knife Fan (working name) | on-hit | NEW | melee seldom applies Bleed, up to 3 stacking bleeds; an enemy dying while bleeding bursts knives into nearby enemies |
| Martyr's Shield | special | NEW | fixed 8% chance to take an ally's hit; extra copies shorten the block cooldown and reduce the health cost |
| Grave Dust | minion | NEW | weak minions explode when they die |
| Fire Imp Brazier | minion | NEW | every 10s an Imp (weak minion, ranged fire, applies Burn) |
| Mimic Chest | minion | NEW | when the holder is hit, 10% chance a Mimic (weak minion) pops out and explodes when it dies |
| Spirit Knight Banner | minion | NEW | greater minion: a Spirit Knight, balanced melee fighter that grows each floor it survives |

## LEGENDARY (10)
| Item | Type | Status | Effect |
|---|---|---|---|
| Bloodlust Mask | special | BUILT | +30% attack speed, lifesteal 5%, 10% chance the heal is shared (3s cooldown) |
| Gambler's Dice | special | BUILT | +20 crit, crits +50% damage and add a random debuff (slow, poison or stun) |
| Shared Potion | potion | BUILT | reward only: heals every living hero 25% |
| Lost Cleric's Grimoire | special | NEW | % chance on every heal the holder RECEIVES to launch a green fire projectile at a random enemy |
| Excalibur | on-hit | NEW | 8% chance on a melee attack to spawn a tornado (5s, drifts between enemies, ticks damage), max 3 at once |
| Jolly Banner | squad | NEW | 5% per attack: holder + 1 random ally get great regen, guaranteed crits and attack speed for 2s |
| Frozen Thunderbolt | on-hit | NEW | every electric hit causes an ice burst around the enemy hit (ice damage and freeze) |
| Fire Heart | special | NEW | at the start of each floor a fire shield (a % of max health, bigger per copy) that slowly regenerates, blocks damage and burns attackers |
| Necro Crown | minion | NEW | weak minion cap +2, and every enemy kill by anyone raises a weak minion |
| Phoenix Hatchling | minion | NEW | greater minion: a flying fire Phoenix that heals the squad a little when it is hit |

## Minion item rules (summary)
- Weak minions: many, vanish at floor end. Greater minions: max 1 per item, persist across floors, extra copies only stack its stats, no healing after a win (skills can heal it, buffs affect it), when dead the party clears 2 floors before it can be summoned again.
- Upkeep: while the holder's minion is alive the holder loses attack speed and defense (suggest -12% each per minion item), so the cheapest holders are Cleric, Bard, Alchemist, Necromancer.
- Minions vanish if the holder dies.

## Systems the NEW items need (all in the plan doc)
Burn, bleed (with stacking exception), armor break, mark, taunt, shield (absorb), block cooldown, minions (weak and greater), floor-start shield, heal-received hooks, kill hooks, first-hit-per-enemy tracking, per-floor once-only triggers, tornado objects, consecutive-hit counter.

## Still to do
- Review the old unreviewed items: Padded Vest, Sharp Edge, Eagle Eye, Feather Boots, Bulwark Plate.
- Decide which of the 66 to build first. Idea: build in groups, with the systems each group needs.
- Rarity weights and Shared Potion stay as they are (`rarities.json`, `rewards.json`).
