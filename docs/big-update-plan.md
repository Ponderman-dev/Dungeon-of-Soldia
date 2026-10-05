# Big update plan (DRAFT, agreed in chat, nothing built yet)

Goal: add lots of features first (mechanics, heroes, items), balance and tune afterwards.
Order: Part 1 mechanics > Part 2 heroes > Part 3 items > Part 4 tests + one tuning pass.

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

## Part 2: Heroes (to plan next)
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
