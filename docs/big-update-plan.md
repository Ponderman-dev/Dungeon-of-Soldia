# Big update plan (DRAFT, agreed in chat, nothing built yet)

Goal: add lots of features first (mechanics, heroes, items), balance and tune afterwards.
Order: Part 1 mechanics > Part 2 heroes > Part 3 items > Part 4 tests + one tuning pass.

## DECISION: no mana for now
Mana is skipped until there is a meaningful use for it. Skills run on COOLDOWN ONLY.
- Hero mana stat, mana bar, mana regen, mana top-up after a win, and mana items (Mana Crystal, Focus Lens, Mana Siphon, Archmage Crown, Hollow Core's mana part) are out of the pool/UI for now.
- Mana fields can stay dormant in the JSON so it can come back later; nothing new should depend on mana (no mana refunds in passives or items).
- Skill balance now comes from cooldown length and effect strength.

## Part 1: Mechanics (decided)

### 1.1 Melee runs, ranged shoots
- Melee heroes (Knight, Rogue, Berserker) run up to their target, hit, run back to their slot. Flying targets too (the 40% miss rule stays).
- Several melee heroes on one enemy stand at different offsets so they don't overlap.
- Ranged heroes (Archer, Mage) stay in their slot and fire projectiles.
- Enemies run too: a melee enemy runs to a hero, hits, runs back. Ranged enemies shoot.
- Damage lands at the HIT moment of the animation, not when the attack starts.
  `BattleState` needs "start attack" and "hit lands" as separate steps; the scene tells it when the hit connects.
- If the target dies while the attacker is running, the attacker retargets mid-run (heroes: tapped focus > random living enemy).
- Open detail for later: what happens to a runner if it is stunned/frozen mid-run (suggest: it returns to its slot).

### 1.2 Skill slots: 1 attack + 1 support per hero
- `heroes.json`: `skills: { attack: "id", support: "id" }`. Both slots tappable.
- Attack skill = damage (single, all, splash, with statuses). Support skill = self/team buff, heal, shield, cleanse.
- Skill books (built later) come as a pair: attack skill book / support skill book. Each one swaps or upgrades the matching slot.
- Existing skills sorted: Shield Bash, Cleave, Venom Strike, Power Shot, Ensnare Shot = attack. Guard, Rage, Smoke = support.

### 1.3 Debuffs (REDONE: element signatures, data in `statuses.json`)
Every damage type has a signature. Same list works on heroes later (enemy skills).

**Damage over time (DoT): stacks with NO limit.** Every application adds a stack; each stack has its OWN timer and falls off on its own (so the number of stacks is limited by how fast you apply them). Damage = per-stack tick x number of stacks.
- Bleed (physical): damage per tick, ignores defense.
- Burn (fire): strongest tick, short duration.
- Poison (dark): weaker tick, long duration.

**Element signatures (not damage):**
- Chill (ice): slows attack speed. STACKS; at 5 stacks the enemy FREEZES and all chill clears. Plain "Slow" no longer exists (slowing is ice only).
- Shock (electric): "jitter": the enemy attacks slower and has a small chance to fumble each attack (a 0.3s stun). Refreshes (does not stack).
- Armor Break (physical): -defense.
- Curse (dark): -resist.

**Hard control** (bosses get half length via `statusDurationScale`; DoTs are NOT shortened on bosses):
- Stun: can't act (physical and electric sources).
- Freeze: can't act (ice; reached through Chill or directly). Shatter Hammer cashes it in.
- Fear: stops attacking and backs away to its spot (dark / Bard style sources).
- Knockback: resets the attack timer.
- Taunt: must attack the taunter.
- Silence: can't use skills. Kept for later, when enemies get skills.

**Weakening:**
- Weaken: -attack. Blind: misses a % of attacks. Mark: takes +% damage from everyone (marks from different sources add up).

**Default rule for everything that is not a DoT or Chill:** the same debuff refreshes its timer (no stacking).

**Updated to these rules:** Rain of Arrows = chance to Armor Break; Frost Nova adds 2 Chill to all; Chain Lightning and Static Crystal apply Shock; Chill Band adds 1 Chill per attack; Frozen Thunderbolt adds 2 Chill; Gambler's Dice list = Chill/Poison/Stun/Shock; Thousand Cuts = +1 extra Bleed stack; Plague Flask spreads half the stacks. Alchemist flasks = Burn / Chill / Poison.

**Damage types:** physical (melee, ranged), fire, ice, electric, dark. No holy type: the Cleric's Smite is PHYSICAL (ranged).

### 1.4 Morale: overlay instead of text
- Remove the morale text tag and popup.
- Living heroes get a very low-opacity tinted overlay on their body parts, so they look depressed/frustrated.
  INCOMPLETE = light cool-grey/blue overlay. ALL ALONE = darker, heavier overlay. Maybe a tiny slump or slower idle bob.
- Overlay values (colour, opacity) live in combat.json `morale`.

### 1.5 Skill visuals and timing
- A skill must look clearly different from a normal hit:
  - Caster flashes in the skill's colour, ring burst on cast.
  - Skill-name banner flashes briefly.
  - Skill damage numbers bigger, in the skill/damage-type colour.
  - Each damage type has its own effect colour. Support skills show a rising glow on the targets.
  - Screen shake or short hit-stop on big casts (on by default, value in JSON).
- Animation side: skills take LONGER than a normal attack (wind-up, a pose, then the hit). Per-skill `castMs`/timing in skills.json, with a default in combat.json.
- The cast time also needs a rule: can the caster be interrupted by stun/freeze during wind-up? (decide when building)

## Part 2: Heroes (in progress, one hero at a time)
Each hero: 1 passive (reacts to states/events), 1 attack skill, 1 support skill. No mana. Numbers are placeholders, tuned last.

### Knight (melee, frontline leader) DECIDED
- Passive "Taunt Wall": 10% chance on each of his attacks to TAUNT the enemies hit for 3s (they must attack the Knight); the Knight gains some armor (defense) for 3s. New status: `taunt` (enemy side) + defense buff on the Knight.
- Attack "Ground Pound": slams the floor, damages ALL enemies and knocks them back (resets their attack timers). Uses the knockback debuff.
- Support "Rally Cry": squad gets +defense and each hero loses one debuff; (taunt-all idea was not picked, keep it simple).
- DECIDED: the armor from the passive goes only to the Knight himself (taunt still pulls enemy attacks off the squad). No squad-wide stat part.

### Berserker (melee, lifesteal bruiser) DECIDED
- Passive "Bloodrage": gains attack speed for each % of health he is missing (the more hurt, the faster). Self only. Feeds lifesteal/regen items.
- Attack "Savage Leap": jumps to one enemy for big damage; deals double to enemies already bleeding or below 50% health.
- Support "War Cry": squad gets +attack for 5s AND enemies get Weaken (-attack) for the same time.
- Style: medium health, stays alive by hitting (works with Bloodlust Mask style items).
- Open: Savage Leap's "bleeding" bonus needs a bleed source (new debuff from Part 1, or items); say if the bonus should only use the 50% health part until then.

### Rogue (melee, debuff enabler) DECIDED
- Passive "Opportunist": deals +damage and +crit to any enemy that has a debuff (poison, slow, stun, bleed, burn...). PLUS debuffs are a bit easier to apply (his chance-based debuffs get a bonus).
- Attack "Fan of Knives": throws knives at ALL enemies from his slot (no run-up). It counts as a RANGED attack, so ranged-attack-boost items feed it. Each knife can crit separately; (idea) a crit applies bleed.
- Support "Smoke Bomb": squad gets +evasion for 4s, enemies get Blind (miss more attacks).
- Style: debuff enabler; low health, high crit potential.
- DECIDED: "easier to apply debuffs" = ONLY his own chance-based debuffs get a bonus (e.g. +25%, tuned later). Not squad-wide. His normal attacks are melee, only Fan of Knives is ranged.

### Archer (ranged, crowd shooter) DECIDED
- Passive "Steady Aim": while he has not been hit for 3s he gains attack speed and crit; being hit resets it. Self only. Pairs with the Knight's taunt (enemies hit the Knight instead).
- Attack "Rain of Arrows": arrows fall on ALL enemies for about 2 seconds (several waves of moderate damage, each hit has a chance to Armor Break; UPDATED, slow no longer exists). Needs its own strong visual: a shower of arrows from above landing on each enemy for the whole 2s. Ranged damage, so ranged-boost items feed it.
- Support "Hunter's Mark": marks an enemy: it takes +% damage from everyone for a few seconds (squad-wide payoff, pairs with the Rogue and tap-to-focus).
- Style: crowd shooter, strongest against 3-4 enemies.
- Open: is Rain of Arrows one long cast (Archer is busy for 2s) or does he keep attacking while arrows fall? Suggest: he is busy for the 2s (skills take longer than normal attacks).

### Mage (ranged, elemental combo hero) DECIDED
- Passive "Spellweaver": every 4th basic attack he makes is a free empowered spell (bonus magic damage, applies his element's debuff). Feeds on-hit items. Self only.
- Attack "Elemental Rotation": ONE skill that rotates each cast: 1st cast Fireball (big fire hit on one enemy, splash to neighbours, sets Burn), 2nd cast Frost Nova (ice burst on ALL enemies, small damage, adds 2 Chill stacks), 3rd cast Chain Lightning (electric bolt jumping through all enemies, applies Shock, stronger against burning/frozen ones), then back to Fireball. The skill square shows which spell is next. Each spell needs its own visual.
- Support "Arcane Ward": squad gets a magic shield (absorbs damage, +resist), lasts 4 seconds.
- Style: elemental combo hero (fire, ice, electric all in one hero; best for elemental item builds).
- Needs: magic damage types become real (fire/ice/electric), burn status, shield status, and the "next spell in rotation" state on the hero.
- DECIDED: the rotation advances every time he casts the skill (Fireball > Frost Nova > Chain Lightning > Fireball...).
- DECIDED: the 4th-attack Spellweaver spell triggers ALL of the Mage's elemental on-hit item effects at once (every fire, ice/chill and lightning item he holds applies its debuff or proc on that hit, guaranteed). So the more elemental items he holds, the better the 4th attack. Not tied to the rotation.

### Cleric (ranged, battle cleric) DECIDED
- Passive (two parts): (1) while she is alive, every hero's regen/healing from items scales up a bit (a small base regen for every hero from the start, AND a % multiplier on regen/heal from items like Heart Charm, so it keeps scaling into late game); (2) every 4th attack, instead of hitting an enemy, she HEALS the lowest-health ally. Feeds regen/heal items.
- Attack "Smite": holy hit on one enemy; bonus damage to debuffed/cursed enemies; heals the lowest-health ally for a share of the damage.
- Support "Divine Shield": the lowest-health ally becomes invulnerable for 2s, and heals when it ends. New status: `invulnerable`.
- Style: battle cleric (heals by fighting, steady damage).
- DECIDED: the regen part has TWO layers: a small base regen for every hero from the start (works with no items), and a multiplier on regen/heal the heroes get from items (grows with stacking so it stays useful late). Exact numbers tuned later. The 4th-attack heal does not trigger on-hit items.

### Necromancer (ranged, summoner) DECIDED
- Passive "Skeleton Summoner": spawns a weak skeleton minion every 8-10 seconds during a fight. Needs a clear animation cue (rises from the ground with a dark puff). Minions fight on the hero side (attack a random enemy, can be hit/taunt-pulled). 
- Attack "Death Coil": dark bolt on one enemy; extra damage to cursed/poisoned/debuffed enemies. When the bolt KILLS an enemy, a new skeleton rises (on top of the timed ones).
- Support "Bone Ward": squad gets a bone shield that absorbs damage; when it breaks, bone shards damage enemies. (Same shield system as Mage's Arcane Ward and Knight ideas.)
- Style: summoner (minions fight alongside the squad; ally/minion items can help).
- New systems needed: minions as units on the hero side (not part of the squad of 3: no XP, no perks, no morale, don't count as living heroes), minion stats in JSON, minion spawn animation.
- DECIDED: max 4 skeletons at once (the oldest is removed when a new one rises). Skeletons vanish at the end of each floor. At the START of every floor he summons one skeleton right away, then the 8-10s timer runs. Squad-wide buffs and effects (War Cry, Rally Cry, shields...) also affect skeletons.

### Bard (ranged, combo conductor) DECIDED
- Passive "Rhythm": every 4th attack of ANY hero in the squad is empowered (bonus damage). A shared squad beat counter with a visible cue (e.g. a beat pulse on the hero whose attack lands the beat). Pairs with every attacker and on-hit items.
- Attack "Crescendo": a song that builds: damage to all enemies grows each second for 3 seconds, then a final big hit. Needs a build-up visual (rising music notes / growing glow).
- Support "Ballad of Rest": a BIG regen boost for the squad for 4 seconds (heal over time, much stronger per second than normal regen; scales with the Cleric's regen scaling and regen items).
- Style: combo conductor.
- DECIDED: the beat counts only the basic attacks of the 3 heroes (not skeletons, not skills). The counter resets after every 4th attack (beat 1, 2, 3, then the empowered 4th, then back to 1). Assumed: it does not also reset at floor changes (say if it should).

### Alchemist (ranged, wildcard mixer) DECIDED
- Passive "Catalyst": while he is alive, status effects on ENEMIES (burn, poison, freeze, slow, bleed, weaken...) last longer and tick/hit harder. Squad-wide payoff, pairs with every debuffer and DoT item (Rogue, Mage, Cleric Smite debuffs, Necromancer curses).
- Attack "Flask Barrage": throws 3 random flasks (fire, ice or poison cloud) at random enemies; each flask applies its element's debuff. Flask-in-the-air visual per flask.
- Support "Mystery Brew": throws 2 random flasks at random teammates; each flask is a random one of: heal, speed boost (attack speed), or shield. (Can hit the same hero twice.) Flask visuals coloured per effect.
- Style: wildcard mixer (high variety, some randomness).
- Open: does the support flask target skeletons too? (suggest: heroes only, living). Is it OK that the same hero can get both flasks?

## Stats (DECIDED for now, tuned last)
Base stats level 1 (health / attack / defense / resist / evasion / crit / attack speed), no mana:
Knight 120/20/10/5/3/5/100, Berserker 105/26/4/2/3/8/110, Rogue 100/19/6/3/25/20/140, Archer 95/17/6/4/15/12/100,
Mage 80/22/2/10/5/8/90, Cleric 100/14/5/12/4/5/95, Necromancer 85/15/3/10/5/6/90, Bard 90/13/4/8/10/8/100, Alchemist 90/15/4/8/8/6/95.
Growth: Mage atk +5% hp +3% resist +0.5; Cleric hp +4% atk +3% resist +0.5; Necromancer atk +4% hp +3% resist +0.4; Bard hp +3% atk +3% speed +0.3; Alchemist atk +4% hp +3% crit +0.2. (Existing four keep their growth in heroes.json.)
Skeleton minion (starting idea): about 25 health, 6 attack, 100 attack speed, no defense.
Start squad: Knight, Rogue, Archer; the others unlock by going deeper. Squad select (pick 3) is part of this big update.
The roster is now 10 heroes: 4 melee (Knight, Berserker, Rogue, Samurai) + 6 ranged.

### Samurai (melee, pure physical, crit executioner) DECIDED (10th hero, replaces the Spearman idea)
- Passive "Focused Strike": his attacks are SLOWER (longer time between attacks) but each hit deals MORE damage, with a big chance to apply Bleed (physical damage over time, ignores defense), and his debuffs are a bit easier to apply. Self only.
- Attack "Wind Cutter": sends a crescent slash across the field: hits ALL enemies for ranged-type physical damage (so ranged-attack-boost items feed it) and applies Armor Break. Needs a crescent-wave visual. He stays in his slot for this (no run-up).
- Support "Focus Stance": 4s of stance: he blocks/parries hits against him and his next attack is a guaranteed crit.
- Style: crit executioner (big crit hits, strongest vs single high-health enemies; bleed from his hits).
- Stats (starting idea): melee, 100 health / 30 attack / 5 def / 3 resist / 5 evasion / 12 crit / 70 attack speed (slow, hits hard). Growth: attack +5%, health +3%, crit +0.4.
- DECIDED: "easier to apply debuffs" = only his own chance-based debuffs (same rule as the Rogue). Bleed is physical (ignores defense). Samurai + Berserker's Savage Leap (double damage on bleeding) now has a real bleed source.

## Roster status: all 9 heroes designed: Knight, Berserker, Rogue, Archer, Mage, Cleric, Necromancer, Bard, Alchemist.
## Still open for Part 2: base stats and growth per hero (melee/ranged, health, attack, defense, resist, evasion, crit, attack speed), squad select/unlock order, which 3 start unlocked, passives' exact numbers (tuned last).
- Final roster of 9 (3 per run), role, stats, growth, perk, one attack + one support skill, melee or ranged.
- Redo the existing four, add the rest.

## Part 3: Items (master list now in `docs/item-list.md`, 66 items)
- Remaining draft items (`docs/item-ideas.md`): burn/poison/slow/stun on-hit, skill and mana items, Phoenix Feather, Prism, damage-type items.
- New items the user wants. Items that use the new debuffs.
- Magic damage becomes real here (fire/ice/electric/dark heroes and items).

### Minion system (DECIDED, shared by the Necromancer and items; data in a new `minions.json`)
- Minions are units on the hero side. Not heroes: no XP, perks or morale effects, never count as living heroes. Squad buffs and heals can affect them.
- WEAK minion: many at once (cap per source, boosters raise it; Necromancer's skeleton cap is 4), vanish when the floor ends. A new one just spawns on its timer.
- GREATER minion: max 1 per item; extra copies of the item only stack its STATS (no second minion). It persists across floors (walks with the squad through the door). It does NOT heal after a win; only skills/healing can heal it, buffs affect it. If it dies, the party must clear 2 floors before it can be summoned again (comes back at the start of the next floor).
- Minions vanish if the hero holding their item dies (items on dead heroes stop working).
- Design goal: minion items should NOT always go to the toughest hero.
- UPDATED in the item review: weak spawners -6%, greater spawners -12%, boosters free and squad-wide (see docs/item-list.md).
- DECIDED rule: UPKEEP COST. While any minion from the holder's items is alive, the holder pays an upkeep in ATTACK SPEED and DEFENSE (bigger than the first idea; suggest -12% attack speed and -12% defense per minion item, exact numbers tuned last). Hurts damage dealers (speed) and tanks (defense), so the cheapest holders are skill/support heroes: Cleric, Bard, Alchemist, Necromancer. Minion stats do not scale off the holder.

### Draft new items (Part 3, in progress, numbers are placeholders)
Burn: Kindling (common, +15% fire dmg), Ember Charm (rare, 8% burn on hit), Magma Core (epic, +25% dmg to burning, burn ticks 30% faster).
Freeze: Frost Charm (common, +15% ice dmg), Shatter Hammer (epic, +60% dmg on frozen enemies, breaks the freeze).
Bleed: Serrated Edge (rare, 10% bleed on hit), Blood Chalice (epic, +20% dmg to bleeding, kill heals 3%).
Poison: Venom Fang (rare, 10% poison on hit), Plague Flask (epic, poison spreads on death).
Armor break: Rusty Nails (rare, 8% armor break on hit), Exploiter's Lens (epic, +20% dmg vs 2+ different debuffs).
Mark: Executioner's Mark (rare, +30% vs enemies under 25%), Hunter's Sigil (epic, first hit marks, marked take +10% from squad).
Shield: Bulwark Charm (rare, +30% shields), Spiked Aegis (epic, shield break explodes), Overheal Ring (rare, overheal becomes shield).
Taunt: Provoker's Horn (rare, +10% taunt chance, taunted take +15%), Spite Mail (epic, taunting gives +30 defense and reflect).
Skills (no mana): Hourglass (rare, cooldowns -12%, diminishing), Conductor's Baton (rare, support skills +25% strength/length), Echo Rune (epic, 15% skill casts twice), Metronome (epic, empowered 4th-beat hits +50%).
Minion boosters: Bone Charm (rare, all minions +30% hp/attack), Overseer's Whistle (rare, weak cap +1, weak attack 15% faster), Grave Dust (epic, weak minions explode on death), Necro Crown (legendary, weak cap +2, every enemy kill raises a weak minion).
Weak spawners: Rat Cage (common, rat every 12s), Wisp Lantern (rare, flying ranged wisp every 15s), Fire Imp Brazier (epic, imp every 10s, applies burn), Mimic Chest (epic, 10% when holder is hit, mimic pops out and explodes).
Greater spawners: Gargoyle Idol (rare, slow tanky, draws attacks), Spirit Knight Banner (epic, balanced fighter that grows each floor survived), Phoenix Hatchling (legendary, flying fire minion, heals squad a little when hit).

### User item ideas (batch 1) DECIDED, numbers are placeholders
- Lost Cleric's Grimoire (Legendary): a % chance on every heal the HOLDER RECEIVES (from anyone: skills, regen, lifesteal) to launch a green fire projectile at a random enemy for big damage. Healing combo: the more heals the holder gets, the more fireballs. Pairs with the Cleric, Bard Ballad of Rest, Heart Charm regen and the Cleric regen scaling.
- Excalibur (Legendary): 8% chance on a melee attack to spawn a tornado for 5s that DRIFTS between enemies, ticking damage on every enemy it touches. Max 3 tornadoes at a time. Tick damage = a % of the holder's attack (suggest).
- Knife Fan (Epic; working name, the old name clashes with the Rogue skill, change if you like): melee attacks seldom apply Bleed, and this item lets an enemy hold up to 3 STACKING bleeds (an exception to the no-stack rule, each ticks on its own); when an enemy dies while bleeding, knives burst out of it and damage nearby enemies.
- Martyr's Shield (Epic): FIXED 8% chance when an enemy hits another hero to take the hit instead (holder's defense/evasion apply), at the holder's own health cost. Extra copies do not raise the chance; each extra copy REDUCES the block cooldown and REDUCES the health cost. Needs: a block cooldown (like the Shield Totem) and a health-cost rule.
- Jolly Banner (Legendary): 5% chance per attack: the holder and 1 random other living hero get great regen, guaranteed crits and an attack speed buff for 2s.
- Frozen Thunderbolt (Legendary): every electric hit (Static Crystal, Mage's Chain Lightning, any electric damage) causes an ice burst around the enemy that was hit, dealing ice damage and freezing nearby enemies. A chain of 3 enemies makes bursts on each? (decided: on the HIT enemy; chain targets count as hit enemies, tune if too strong).
- Fire Heart (Legendary): at the start of every floor the holder gets a fire shield worth a % of max health. Extra copies make the shield bigger. The shield slowly regenerates (until broken), blocks damage and burns the attacker.
- Fire Arrows (Rare): each ranged attack has a 50% chance (does NOT stack) to add an extra fire hit (a % of attack); extra copies raise the fire hit damage (stacks). Counts rangers and ranged-type skills (Rogue Fan of Knives, Samurai Wind Cutter, Archer arrows).

### Rule changes decided during item review
- Defense: replace the hard 75% cap with a diminishing curve (never reaches 100%; low values stay close to today, formula tuned last). Resist uses the same curve (decided).
- Evasion cap: 60% > 70%.
- CLAUDE.md fight rules must be updated when these are built.

## Part 4: Tests and one tuning pass
- Update tests for the new content, then balance once at the end.

## BUILD ORDER (approved plan, one step at a time)
Rules for every step: keep the game working, run `npm test`, commit with a clear message, push.
Republish the preview page after EVERY change (the user asked for this, for now).
Update CLAUDE.md / HANDOFF.md when a rule in them changes. Data stays in JSON. Placeholder art only.

### Phase A: Foundations (rules and data, little to see)
- A1. DONE. Remove mana: mana bar, regen, win top-up and skill mana costs go; skills run on cooldown only.
- A2. DONE. Skill slots: `skills: { attack, support }` in heroes.json; the two squares show which is which. Existing heroes keep their current skills for now.
- A3. DONE. Stat rules: defense and resist use the diminishing curve (no 75% cap), evasion cap 70%, crit cap 100%. Update tests and CLAUDE.md.
- A4. DONE. New drop roll: rarity first (floor bands), then item `dropWeight`, `needs` soft gating x0.25. Tests.
- A5. DONE. Damage types made real: fire, ice, electric, dark (+ physical). Damage-type bonuses also boost DoTs of that type. Enemy weak/resist works for all.
- A6. DONE. Debuff engine: Bleed/Burn/Poison with unlimited stacks (own timers), Chill (5 = Freeze), Shock, Armor Break, Curse, Weaken, Blind, Mark, Fear, Knockback, Taunt, Silence (data only). Boss rule: control halved, DoTs full. Status tags show stack counts. Tests for each.

### Phase B: Movement (the big visible change)
- B1. DONE. Split an attack into "start" and "hit lands" in BattleState (no visual change yet). Tests.
- B2. DONE. Hero melee run-up (hit, run back, offsets when several melee share a target) and ranged projectiles.
- B3. Enemies run up / shoot the same way.
- B4. Edge cases: target dies mid-run (retarget), stunned/frozen mid-run (go back), flying targets.

### Phase C: Feel
- C1. Skill wind-up (`castMs`), longer than a normal attack; stun/freeze during wind-up cancels the cast (to confirm).
- C2. Skill cast visuals: colour flash, ring burst, name banner, bigger coloured numbers, screen shake / hit-stop.
- C3. Morale overlay instead of text.

### Phase D: Shared systems the heroes need
- D1. Shields (absorb, broken vs expired) and Invulnerable.
- D2. Taunt behaviour on enemies (and the Knight's armor buff).
- D3. "Every 4th attack" counters (Spellweaver, Cleric heal, Bard Rhythm beat) with visible cues.
- D4. Minion system: weak and greater minions, caps, upkeep, floor transitions (greater minions walk through the door), 2-floor revival wait, minions vanish when the holder dies.

### Phase E: Heroes (one per step: stats, growth, passive, attack skill, support skill, placeholder look)
- E1 Knight, E2 Rogue, E3 Archer (the start squad first), E4 Berserker, E5 Samurai, E6 Mage, E7 Cleric, E8 Necromancer, E9 Bard, E10 Alchemist.
- Until squad select exists, the test squad can be switched in squad.json.

### Phase F: Squad select and unlocks
- F1. Squad select screen: pick 3 of the unlocked heroes.
- F2. Unlocks saved in localStorage (which floors unlock which hero: to decide with the user).

### Phase G: Items (in groups, each with its tests)
- G1. Update the 19 built items to the new rules (renames, rarities, weights, Chill Band, Static Crystal, Gambler's Dice, Bulwark Plate/Feather Boots stacks, Siege Cannon legendary).
- G2. Simple commons: Sucker Punch Glove, Bandage Roll, Second Wind Flask, Full Vigor, Brawler's Streak, Tough Skin, Kindling, Frost Charm, Storm Charm, Shadow Charm, Mage Cloak, Hourglass.
- G3. Debuff appliers: Ember Charm, Venom Fang, Serrated Edge, Rusty Nails, Hex Doll, Dread Bell, Gag Rune, Fire Arrows.
- G4. Debuff payoffs: Magma Core, Shatter Hammer, Blood Chalice, Plague Flask, Exploiter's Lens, Executioner's Axe, Hunter's Sigil, Thousand Cuts, Frozen Thunderbolt.
- G5. Shield / heal / taunt items: Warding Charm, Overheal Ring, Spiked Aegis, Provoker's Horn, Spite Mail, Martyr's Shield, Fire Heart, Lost Cleric's Grimoire.
- G6. Skill items: Conductor's Baton, Echo Rune, Metronome.
- G7. Minion items: Rat Cage, Wisp Lantern, Fire Imp Brazier, Mimic Chest, Gargoyle Idol, Spirit Knight Banner, Phoenix Hatchling, Bone Charm, Overseer's Whistle, Grave Dust, Necro Crown.
- G8. Last legendaries: Excalibur (tornadoes), Jolly Banner.

### Phase H: Tests and ONE tuning pass
- H1. Update the sim bot (skills, all heroes, all items) and the difficulty report.
- H2. Tune: hero numbers, item numbers, drop odds, enemy growth. Then decide what is next (bosses, skill books, enemy skills).

Total: about 40 steps. The user sees something new on the preview page after each phase.
