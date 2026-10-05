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

Totals: 72 items. Common 22, Rare 23, Epic 17, Legendary 10 (Shared Potion included). Updated after the full item review (docs/item-review.md), all changes approved except Phoenix Feather.

## Rules decided in the item review
- Drops: each card first rolls a RARITY (odds by floor: 1-10 = 62/29/7.5/1.5, 11-30 = 52/32/13/3, 31+ = 42/34/19/5 for common/rare/epic/legendary), then picks an item of that rarity by its Drop weight (100 = normal). No duplicate cards on one screen. Shared Potion keeps its separate 5% rule.
- Soft gating: an item with a "Needs" tag has its drop weight x0.25 while the squad has no source for it (sources listed in docs/item-review.md section 5b).
- Proc depth 1: damage made BY an item effect (bombs, chains, bursts, fireballs, knife bursts, tornado ticks, minion explosions) never triggers other item effects, lifesteal or on-hit items. Only exception: Frozen Thunderbolt reacts to Static Crystal / Chain Lightning (its bursts trigger nothing).
- Heals: regen counts as ONE heal per second for "heal received" items; heals that restore 0 health do not count.
- "Per attack" = the holder's BASIC attacks only (not skills, minions or proc damage). Quick Gloves' double hit counts as the same attack.
- The Rogue's and Samurai's "easier debuffs" bonus also applies to item debuffs on their attacks.
- Only a shield broken by damage counts as "broken". Timed shields that run out do not.
- The Knight has NO shield in his kit (shield items do not pair with him).
- Lucky Coin and crit: total crit is capped at 100%.
- Debuffs follow the redone list in docs/big-update-plan.md 1.3: Bleed/Burn/Poison stack with no limit (each stack own timer), Chill stacks to Freeze at 5, Shock = jitter, plain Slow no longer exists.

## COMMON (22)
| Item | Type | Status | Effect | Stacking | Drop weight | Needs |
|---|---|---|---|---|---|---|
| Whetstone | stat | BUILT | +12% attack and +3 attack | Fully additive, no cap | 100 | - |
| Padded Vest | stat | BUILT | +12 defense (reviewed, kept) | Flat points add up with no item cap. Defense now uses a diminishing curve instead of the hard 75% cap (see rule changes) | 100 | - |
| Lucky Coin | stat | BUILT | +10 crit, diminishing, max 10 coins = +75 | Diminishing: each extra coin adds 0.934x the last. Max 10 coins (+75 total) | 100 | - |
| Sharp Edge | stat | BUILT | +15% melee damage (reviewed, kept) | Fully additive, no cap | 100 | melee |
| Eagle Eye | stat | BUILT | +15% ranged damage (reviewed, kept) | Fully additive, no cap | 100 | ranged |
| Aid Kit | special | BUILT | heal 5% max health when a floor is cleared, falloff per extra kit | Diminishing: each extra kit adds 0.85x the last | 100 | - |
| Sucker Punch Glove | on-hit | NEW | first BASIC attack on each enemy deals +50% damage (skills do not count) | Bonus adds up per copy (+50% each). First-attack tracking is shared | 100 | - |
| Bandage Roll | special | NEW | holder heals 3% max health on each kill | Heal adds up per copy (3% each), no cap | 100 | - |
| Second Wind Flask | special | NEW | CONSUMABLE: when the holder drops below 40% health, one flask is used up and heals 30% max health (raised from 15%) | CONSUMABLE: each copy is one use (like potions in an inventory). A trigger uses up one copy and the rest wait. At most ONE trigger per floor per holder. Stacking = more uses over the run, not a bigger heal | 110 | - |
| Full Vigor | special | NEW | +15% damage while the holder is at full health | Bonus adds up per copy (+15% each) | 90 | - |
| Brawler's Streak | on-hit | NEW | each consecutive hit on the same target adds +2% damage (max +10%), resets on a new target | Per-hit bonus stays +2%. Each extra copy raises the MAX (+10%, +20%, +30%...), so the streak takes longer to build but gets bigger | 80 | - |
| Tough Skin | special | NEW | the first hit the holder takes each floor deals 60% less damage | One protected hit per floor. Each extra copy makes the cut bigger (60%, 70%, 78%... capped at 90%) | 80 | - |
| Kindling | stat | NEW | +15% fire damage (also boosts Burn damage) | Additive (+15% each), no cap | 100 | fire |
| Frost Charm | stat | NEW | +15% ice damage (also boosts Chill Band ice hits and Frozen Thunderbolt bursts) | Additive (+15% each), no cap | 100 | ice |
| Rat Cage | minion | NEW | every 12s a Rat (weak minion) bites a random enemy | Spawn in bursts: each extra copy adds one more minion to every spawn (1 rat, then 2 rats at once...). One shared timer. Weak minion cap is shared | 80 | - |
| Ember Charm | on-hit | NEW | 6% chance per attack to Burn the target (fire damage over time, 3s) | Chance adds up per copy (6% each) AND burn damage adds up per copy. Each proc adds a Burn STACK (DoTs stack with no limit) | 100 | - |
| Venom Fang | on-hit | NEW | 8% chance per attack to Poison the target | Chance adds up normally (8% per copy). Each proc adds a Poison STACK | 100 | - |
| Rusty Nails | on-hit | NEW | 8% chance per attack to Armor Break the target (-defense) | Chance adds up normally (8% per copy). Armor Break refreshes, it does not stack | 90 | - |
| Hourglass | skill | NEW | skill cooldowns 5% shorter (lowered from 12%, so it needs several copies) | Additive (-5% per copy). Cap not stated: suggest 50% shorter total | 100 | - |
| Storm Charm | stat | NEW | +15% electric damage | Additive (+15% each), no cap | 100 | electric |
| Shadow Charm | stat | NEW | +15% dark damage (poison and Death Coil are dark) | Additive (+15% each), no cap | 100 | dark |
| Mage Cloak | stat | NEW | +10 resist | Flat points add up; resist uses the diminishing curve | 100 | - |

## RARE (23)
| Item | Type | Status | Effect | Stacking | Drop weight | Needs |
|---|---|---|---|---|---|---|
| Feather Boots | stat | BUILT | +8 evasion (reviewed, kept) | Flat points add up, max 8 boots (was 7). Evasion cap raised to 70% for everyone (was 60%) | 100 | - |
| Heart Charm | stat | BUILT | +22% max health and regen 0.5% max health per second in fights | Health % and regen both add up per charm, no cap | 100 | - |
| War Banner | squad | BUILT | 8% per attack: Battle Cry, squad +25% attack speed 2s | Each copy rolls its own 8% separately. The buff refreshes, it does not stack | 100 | - |
| Shield Totem | special | BUILT | 10% block chance, 2.5s recharge, max 6 | +10% block chance per totem, max 6. Any block recharges ALL totems together | 90 | - |
| Fire Bombs | on-hit | BUILT | 5% per attack: bomb, 250% fire damage (ranged) | Each copy rolls its own 5% separately | 100 | - |
| Chill Band | on-hit | BUILT | every attack adds a 10% ice hit per band AND 1 Chill stack (5 Chill = Freeze) | Ice hit adds per band (+10% each). Chill: 1 stack per attack (does not grow with more bands) | 80 | - |
| Fire Arrows | on-hit | NEW | ranged attacks 50% chance (no stack) for an extra fire hit; extra copies raise fire damage | Chance does NOT stack (stays 50%). Extra copies add to the fire hit damage (stacks) | 100 | ranged |
| Serrated Edge | on-hit | NEW | 10% chance per attack to make the target Bleed | Chance adds up with diminishing returns (suggest 0.8x the last: 10%, 8%, 6.4%...). Each proc adds a Bleed STACK | 100 | - |
| Executioner's Axe | special | NEW | +30% damage to enemies under 25% health | Diminishing with a very small gap (suggest 0.95x the last: +30%, +28.5%, +27%...) | 100 | - |
| Warding Charm | stat | NEW | shields the holder receives are 30% bigger | Additive (+30% each), no cap | 80 | shield |
| Overheal Ring | special | NEW | a % of healing above full health becomes a shield, capped at 25% of max health | A % of the healing above 100% health is converted to shield (suggest 40% per copy). Each extra copy adds more %, up to 100% | 80 | heal |
| Provoker's Horn | special | NEW | ANY holder gets a 10% taunt chance on attack (the Knight adds it to his own); taunted enemies take +15% damage | Both add up per copy (+10% taunt chance and +15% damage vs taunted), no cap | 90 | - |
| Conductor's Baton | skill | NEW | support skill effects 25% stronger and 25% longer | Diminishing: each extra copy adds less to both strength and length (suggest 0.85x the last) | 100 | - |
| Bone Charm | minion | NEW | all minions (weak and greater) +20% health and attack (lowered from 30%) | Additive (+20% each), no cap | 80 | minion |
| Overseer's Whistle | minion | NEW | weak minion cap +1, weak minions attack 15% faster | +1 weak minion cap per copy, max +4 total. Attack speed bonus adds up (+15% each) | 70 | minion |
| Wisp Lantern | minion | NEW | every 15s a flying Wisp (weak minion, ranged magic) | Spawn in bursts: each extra copy adds one more Wisp to every spawn. One shared timer. Weak minion cap is shared | 90 | - |
| Gargoyle Idol | minion | NEW | greater minion: a slow, tanky Gargoyle that TAUNTS enemies (real taunt status, so taunt items work with it) | Greater minion: 1 Gargoyle however many copies. Extra copies add +25% to its stats each (additive) | 80 | - |
| Metronome | skill | NEW | empowered 4th-beat hits the HOLDER causes deal +50% (on the Bard: every squad Rhythm beat) | Bonus adds up per copy (+50% each) | 80 | beat |
| Grave Dust | minion | NEW | weak minions explode when they die | Explosion damage adds up per copy | 70 | minion |
| Mimic Chest | minion | NEW | when the holder is hit, 10% chance a Mimic (weak minion) pops out and explodes when it dies | Chance stays 10% (does not stack). Each extra copy makes the Mimic stronger and its explosion bigger | 80 | - |
| Hex Doll | on-hit | NEW | 8% chance per attack to Curse the target (-resist) | Chance adds up per copy. Curse refreshes | 100 | - |
| Dread Bell | on-hit | NEW | 5% chance per attack to Fear the target (it skips its next attack) | Chance adds up per copy. Fear refreshes | 90 | - |
| Gag Rune | special | NEW | a stun or freeze the holder causes also Silences the enemy for 2s (useful once enemies have skills) | Silence length adds +1s per extra copy | 80 | stun/freeze |

## EPIC (17)
| Item | Type | Status | Effect | Stacking | Drop weight | Needs |
|---|---|---|---|---|---|---|
| Quick Gloves | stat | BUILT | +18% attack speed, 5% per attack to hit twice | Attack speed adds up. Each copy rolls its own double-hit chance | 100 | - |
| Bulwark Plate | special | BUILT | +30 defense, reflects 25% of melee damage taken (reviewed, kept) | Defense and thorns % both add up. No max stacks any more (was 3); defense uses the diminishing curve | 100 | - |
| Static Crystal | on-hit | BUILT | 10% per attack: chain lightning, 300% electric, jumps to 2 more enemies, applies Shock to every enemy hit | Each copy rolls its own 10% separately | 100 | - |
| Magma Core | special | NEW | burning enemies take +25% damage from the holder, burn ticks 30% faster | Damage bonus adds up (+25% each). Burn speed bonus adds up but is capped (suggest +100% total) | 90 | burn |
| Shatter Hammer | special | NEW | hits on a frozen enemy deal +60% damage and break the freeze | Damage bonus adds up per copy (+60% each). The freeze breaks once per hit | 90 | freeze (Chill sources count) |
| Blood Chalice | special | NEW | bleeding enemies take +20% damage from the holder, killing one heals the holder 3% | Both add up per copy (+20% damage, +3% heal) | 90 | bleed |
| Plague Flask | special | NEW | when a poisoned enemy dies, HALF its poison stacks spread to another enemy | +1 enemy it spreads to per copy (each gets half the stacks). If there are no other enemies, nothing happens | 80 | poison |
| Exploiter's Lens | special | NEW | +30% damage to enemies with 3 or more different debuffs | Additive (+30% each), no cap | 80 | - |
| Hunter's Sigil | special | NEW | first hit on each enemy Marks it; marked enemies take +10% damage from the whole squad | Mark is unique (one mark per enemy). Squad damage bonus adds up per copy (+10% each) AND each extra copy makes the mark last longer | 100 | - |
| Spiked Aegis | special | NEW | when the holder's shield is BROKEN by damage it explodes, damaging all enemies (shields that just run out do not) | Explosion damage adds up per copy | 80 | shield |
| Spite Mail | special | NEW | while the holder is taunting: +30 defense and reflect damage | Both add up per copy (+30 defense and reflect %); defense uses the diminishing curve | 80 | taunt |
| Echo Rune | skill | NEW | 15% chance a skill casts twice. An echo cannot echo; the Mage rotation moves forward once | Chance adds up (+15% per copy), capped at 60% total. The echo cast deals only 60% of the original; each extra copy raises that toward 100% | 90 | - |
| Thousand Cuts | on-hit | NEW | melee hits seldom apply Bleed; whenever the holder applies Bleed it adds 1 EXTRA Bleed stack; an enemy dying while bleeding bursts knives into nearby enemies | Extra copies raise the bleed chance and the knife burst damage (still +1 extra stack per bleed, does not grow) | 100 | - |
| Martyr's Shield | special | NEW | fixed 8% chance to take an ally's hit; extra copies shorten the block cooldown and reduce the health cost | Chance fixed at 8%, does not stack. Each extra copy shortens the block cooldown and lowers the health cost | 90 | - |
| Fire Imp Brazier | minion | NEW | every 10s an Imp (weak minion, ranged fire, applies Burn) | Spawn in bursts: each extra copy adds one more Imp to every spawn. One shared timer. Weak minion cap is shared | 90 | - |
| Spirit Knight Banner | minion | NEW | greater minion: a Spirit Knight, balanced melee fighter that grows +5% each floor it survives (max +100%) | Greater minion: 1 Spirit Knight however many copies. Extra copies add +25% to its stats each (additive) | 90 | - |
| Jolly Banner | squad | NEW | 5% per attack: holder + 1 random ally get great regen, guaranteed crits and attack speed for 2s | Chance stays 5%. Each extra copy extends the buff duration (+0.5s). The buff refreshes, it does not stack | 100 | - |

## LEGENDARY (10)
| Item | Type | Status | Effect | Stacking | Drop weight | Needs |
|---|---|---|---|---|---|---|
| Bloodlust Mask | special | BUILT | +30% attack speed, lifesteal 5%, 10% chance the heal is shared (3s cooldown) | Attack speed and lifesteal add up. Share chance adds up; the 3s share cooldown is shared | 100 | - |
| Gambler's Dice | special | BUILT | +20 crit, crits +50% damage and add a random debuff (Chill, Poison, Stun or Shock) | Crit is capped (cap in the item JSON). Crit damage adds up. One random debuff per crit however many copies | 100 | - |
| Shared Potion | potion | BUILT | reward only: heals every living hero 25% | Not a hero item. One-use reward | - | - |
| Lost Cleric's Grimoire | special | NEW | % chance on every heal the holder RECEIVES to launch a green fire projectile at a random enemy (regen counts once per second; heals at full health do not count; fireballs do not lifesteal) | Chance adds up per copy, capped (suggest 50% total). Fireball damage adds up per copy | 80 | heal |
| Excalibur | on-hit | NEW | 8% chance on a melee attack to spawn a tornado (5s, drifts between enemies, ticks damage), max 3 at once | Chance adds up per copy (8% each), capped (suggest 30% total). The tornado cap stays 3 at once | 100 | melee |
| Frozen Thunderbolt | on-hit | NEW | every electric hit causes an ice burst around the enemy hit: ice damage and 2 Chill stacks on nearby enemies | Ice burst damage adds up per copy. Chill stays 2 stacks per burst | 70 | electric |
| Fire Heart | special | NEW | at the start of each floor a fire shield (a % of max health, bigger per copy) that slowly regenerates, blocks damage and burns attackers | Extra copies make the shield bigger (one shield per hero per floor) | 100 | - |
| Necro Crown | minion | NEW | weak minion cap +2, and every enemy kill by anyone raises a weak minion | +2 weak minion cap per copy, capped at +6 total. The kill-spawn effect is unique (one minion per kill, no stacking) | 80 | - |
| Phoenix Hatchling | minion | NEW | greater minion: a flying fire Phoenix that heals the squad a little when it is hit | Greater minion: 1 Phoenix however many copies. Extra copies add +25% to its stats and the squad heal each (additive) | 90 | - |
| Siege Cannon | special | BUILT | +40% attack, skills +30% damage, 5% skill splash | Attack, skill damage and splash chance all add up | 100 | - |

## Minion item rules (summary)
- Weak minions: many, vanish at floor end. Greater minions: max 1 per item, persist across floors, extra copies only stack its stats, no healing after a win (skills can heal it, buffs affect it), when dead the party clears 2 floors before it can be summoned again.
- Upkeep (DECIDED): while the holder's minion is alive the holder loses attack speed and defense: weak spawners (Rat Cage, Wisp Lantern, Fire Imp Brazier, Mimic Chest, Necro Crown) -6% each, greater spawners (Gargoyle, Spirit Knight, Phoenix) -12% each. Boosters (Bone Charm, Overseer's Whistle, Grave Dust) cost nothing and boost EVERY minion on the hero side, whoever holds them. The Necromancer's own skeletons cost nothing.
- Minions vanish if the holder dies.

## Systems the NEW items need (all in the plan doc)
Burn, bleed (with stacking exception), armor break, mark, taunt, shield (absorb), block cooldown, minions (weak and greater), floor-start shield, heal-received hooks, kill hooks, first-hit-per-enemy tracking, per-floor once-only triggers, tornado objects, consecutive-hit counter.

## Still to do
- DONE: the 5 old items were reviewed and kept as they were (Padded Vest, Sharp Edge, Eagle Eye, Feather Boots, Bulwark Plate).
- Decide which of the 66 to build first. Idea: build in groups, with the systems each group needs.
- Rarity weights and Shared Potion stay as they are (`rarities.json`, `rewards.json`).
