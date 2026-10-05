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

### 1.3 Debuffs (all of them, data in `statuses.json`)
- Have: stun, slow, freeze, poison.
- Control: silence (no skills), knockback/delay (resets attack timer), fear (skips attacks briefly).
- Damage over time: burn (fire, stronger/shorter than poison), bleed (physical, ignores defense).
- Stat debuffs: weaken (-attack), armor break (-defense), curse (-resist), blind (misses a % of attacks), mark (takes +% damage).
- Same rules as today: same status from the same source refreshes (no stacking), bosses use `statusDurationScale`.
- Enemies need ways to receive them (skills and items apply them); enemy skills that debuff heroes can come with the enemy pass.

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
- Open: "easier to apply debuffs" is not fixed yet. Options: only his own chances +25%, or the whole squad's chance-based debuffs +10% while he lives. Also: his normal attacks are melee, only the skill is ranged.

### Archer (ranged, crowd shooter) DECIDED
- Passive "Steady Aim": while he has not been hit for 3s he gains attack speed and crit; being hit resets it. Self only. Pairs with the Knight's taunt (enemies hit the Knight instead).
- Attack "Rain of Arrows": arrows fall on ALL enemies for about 2 seconds (several waves of moderate damage, a chance to slow each hit). Needs its own strong visual: a shower of arrows from above landing on each enemy for the whole 2s. Ranged damage, so ranged-boost items feed it.
- Support "Hunter's Mark": marks an enemy: it takes +% damage from everyone for a few seconds (squad-wide payoff, pairs with the Rogue and tap-to-focus).
- Style: crowd shooter, strongest against 3-4 enemies.
- Open: is Rain of Arrows one long cast (Archer is busy for 2s) or does he keep attacking while arrows fall? Suggest: he is busy for the 2s (skills take longer than normal attacks).

### Still to do: Mage, Cleric, Necromancer, Bard, Alchemist (user may replace these concepts)
- Final roster of 9 (3 per run), role, stats, growth, perk, one attack + one support skill, melee or ranged.
- Redo the existing four, add the rest.

## Part 3: Items (to plan next)
- Remaining draft items (`docs/item-ideas.md`): burn/poison/slow/stun on-hit, skill and mana items, Phoenix Feather, Prism, damage-type items.
- New items the user wants. Items that use the new debuffs.
- Magic damage becomes real here (fire/ice/electric/dark heroes and items).

## Part 4: Tests and one tuning pass
- Update tests for the new content, then balance once at the end.

## Suggested build order inside Part 1 (one step at a time, commit each)
1. Skill slots (attack/support) in data and UI. Small, no animation yet.
2. New debuffs in `statuses.json` + `BattleState`, with tests.
3. Run-up melee and projectile ranged, hit moment, retargeting (the big one), for heroes and enemies.
4. Skill timing and cast visuals.
5. Morale overlay.
