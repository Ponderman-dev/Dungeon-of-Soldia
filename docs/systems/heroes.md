# Heroes

Counters (D3), hero passives, Hero kits v2.
Moved out of CLAUDE.md (2026-10-17). Keep this file up to date when the system changes.

- **"Every Nth attack" counters (D3):** a hero def can have a `counter` (`id, label, color, every` (4), `scope` 'self' | 'squad', `effect` 'empower' | 'heal', `firedLabel`, `strike {damageMultiplier, damageType}`, `apply` [status specs], `forceProcs`, `heal {percentMaxHp, attackMultiplier}`); handled in `BattleState.countBeats()` / `landAttack()`. It counts BASIC attacks that land (not skills, not item hits, not minions): scope 'self' = the holder's own attacks (Mage Spellweaver, Cleric), 'squad' = the attacks of every living hero together (Bard Rhythm). A dead holder counts nothing; the count is kept for the whole run (not reset between floors). On the 4th: EMPOWER = that attack also gets a free extra hit (`strike`) and debuffs (`apply`) on its target, `forceProcs` makes every on-hit item proc of the attacker go off for sure (the Mage); HEAL = the attack heals the lowest-health-% ally instead of hitting (percent of THEIR max health + attackMultiplier x the Cleric's attack), triggers no on-hit items, and if nobody is hurt it hits normally and the counter stays charged until somebody is. Shown ON THE HERO, no text: after the (N-1)th attack the holder's weapon shines with a pulsing orb in the counter colour (`Character.setGlow()`, set in `drawChips()` from `counterCount`), and when the Nth goes off (`beat` event with `fired` and `target`) the attacker flashes in that colour and a big burst (two rings, 8 rays, sparks, small shake) hits the target (around the attacker for a heal beat). No popup text for beats. No hero has a counter yet (they come in phase E). Tests: `counters.test.mjs`.
- **Heroes, one by one (phase E).** A hero def can have `passive: { name, description, procs: [...] }` (procs roll like item procs on his own attacks; `BattleState.refreshStats()` adds them with itemId `passive_<id>`), `counter` (D3) and `spawner` (D4). Skill targets: `enemy`, `allEnemies`, `self`, `squad` (every living hero AND minion); a skill can `cleanse: N` (each target loses N debuffs, a whole kind each, oldest first; debuffs = `debuff: true` in statuses.json). Old test skills Shield Bash and Guard stay in skills.json; mechanic tests use them through `noPerks()` in `scripts/tests/util.mjs` (which also strips perks and passives), real heroes are tested in their own file.
  - **HERO KITS v2 (user approved the proposal, built):** the first kits (E1-E10) are frozen in `scripts/tests/fixtures/heroes-v1-kits.json`; old mechanic tests use them via `kitsV1()` (util.mjs); the old skills (Ground Pound, Rally Cry, Fan of Knives, Rain of Arrows, War Cry, Crescendo, Ballad of Rest...) stay in skills.json for those tests. The real heroes now (tests `heroes-v2.test.mjs`; every number in the hero's `passive` / the skill in JSON):
    - **Knight** INTERCEPT (`passive.intercept`): an ally dropping under 35% is GUARDED for 3s (status `guarded`), the Knight takes 50% of every enemy hit on them (his thorns/Spite Mail reflect those), 8s cooldown (`tryIntercept()/interceptHit()`). SHIELD BASH (`knight_bash`: 140% + 1.5s stun). CHALLENGE (support, target allEnemies with `area` circle at the CASTER 150px: taunt 3s + `selfApply` +30 defense).
    - **Berserker** RAGE (`passive.rage`): his basic hits (+8, crits x2, lifesteal heals +8) and hits taken (+10) fill a 100 bar; full = FRENZY (buff +50% attack speed, 15% lifesteal, 6s; `gainRage()/frenzied()`), Bloodrage stays; during Frenzy every hit counts as the same target for Brawler's Streak. SAVAGE LEAP + `landSplash` (60% to enemies within 80px). BLOOD PACT (`selfCostPercent` 15, squad buff `special: lifesteal` 12% 6s; minions ignore special mods).
    - **Rogue** COMBO (`passive.combo` max 5, `hero.combo {uid, points}`, `addCombo()`): his landed basic hits on the SAME enemy, Quick Gloves double hits and debuff ITEM procs add points; Opportunist kept without the debuff-chance bonus. EVISCERATE (`finisher`: 60% + 60%/point; at 5: sure crit, `applyAtMax` Bleed, all on-hit items forced). SMOKE BOMB kept.
    - **Archer** STEADY AIM (not hit for 1.5s, was 3s) + `pierce` (`everyShot`: EVERY basic shot also hits the closest other enemy within 140px for 60%; was Marked enemies only). HEADSHOT (300% ranged, `ignoresArmor`, `bonusVs` mark x2, `triggersOnHit` = on-hit items + Fire Arrows go off). HUNTER'S MARK kept.
    - **Samurai** IAIDO (`passive.iaido`): every 3rd enemy hit on him is parried; any parried / blocked / dodged hit (not a Blind miss) is answered with a 120% counter-cut if the attacker is in reach (`counterCut()`, on-hit items roll). No more bleed proc. WIND CUTTER + FOCUS STANCE kept.
    - **Mage** REACTIONS (`passive.reactions`, while the Mage lives): any hero-side fire/ice/electric hit (items too) leaves an `element` status (4s); a different element reacts and uses it up: fire+ice STEAM (Blind 3s), ice+electric SHATTER (+50% on that hit), fire+electric OVERLOAD (60% fire to enemies within 110px) (`reaction()`, `reaction` event). Spellweaver counter removed. Rotation + Arcane Ward kept.
    - **Cleric** unchanged. **Necromancer**: a skeleton every 5-6s, cap 5, 2 at floor start (was 8-10s, cap 4, 1). **Alchemist**: Flask Barrage flasks splash 50% within 70px (`random.splash`); Mystery Brew throws 3 flasks (was 2) and healing flasks go to the most hurt heroes (`random.healsMostHurt`).
    - **Bard** SONGS (`passive.songs`, `hero.song` 'march' | 'ballad'): MARCH = squad +15% attack speed (`statUpkeep()`), BALLAD = squad +0.6% health/s (`songRegen()`); Conductor's Baton scales them. DISCORD (area circle 120 at the target: 40% + CHARM 2.5s = the enemy attacks the nearest OTHER enemy, `pickTarget()`; status `charm`, control + debuff). CHANGE SONG (`songSwitch`: toggles, burst = Ballad heal 8% / March +30% attack speed 3s). Rhythm counter removed.
    - Scene: `drawHeroHud()` = Rage bar under the Berserker's health bar (gold in Frenzy), combo pips under the Rogue's target, a note right of the Bard's bar (gold March / green Ballad); popups Intercept!, Steam!/Shatter!/Overload!, March!/Ballad!, Counter!, Frenzy!, Pierce!. Cast effects `shieldBash`, `challenge`, `bloodPact`, `eviscerate`, `changeSong` in skillFx.js. New status icons: guarded, charm, element.
  - New skill pieces (all data-driven in skills.json): `channel`, `random`, `rotation`, `debuffedMultiplier`, `bonusVs`, `doubleIf`, `healShare`, `heal`, `splash`, `chain`, `onKill`, `leap`, `projectile` kinds (knife, rain, note, crescent, fireball, darkbolt, holybolt), `target` 'lowestAlly', support skills can target an `enemy`.
  - **HERO KITS v3 (docs/hero-kits-v3.md, being built one hero at a time; tests `heroes-v3.test.mjs`, real data):**
    - **Alchemist** MAD BOMBER (built session 6): LOBBED SHOTS (`passive.lobbed`, replaces Catalyst): his basic attack is a
      flask (`lobbedShot()`): poisons the target (`apply`, poison only) and splashes `splashMultiplier` 40% on enemies within
      `splashRadius` 70px, poisoning them too; `attackSpeedPercent` -25 via `statUpkeep()`. Scene `lobFlask()` draws the
      green flask lob instead of an arrow. Skills `alch_barrage` (Flask Barrage, 5 POISON flasks only, 90% + poison each; user: no random debuffs) and `alch_brew` (Mystery Brew,
      4 flasks, 9s, heal 30%); the old `flask_barrage` / `mystery_brew` / `catalyst()` stay for the v1 fixture tests. FLASKS ONE BY ONE (user): `random.intervalMs` 250 = the first flask flies at once, the next every 0.25s (`hero.casting.flasks`, `tickCasting()` -> `throwFlask()`); the hero is busy until the last one, a stun stops the rest (like a channel), no Echo. Without `intervalMs` all flasks go at once (old skills). Sound cue `flaskBreak` (Kenney glass, pitch 1.6) when a flask lands, skill flasks and his basic lobs.
      review.mjs 3 all: avg floor 24.3 (last) -> 28.8 (5th of 10); after poison-only Barrage 27.1 (7th, within noise).
    - **Bard** BATTLE HYMN (built session 6): `passive.hymn.squadItemMultiplier` 1.35 = squad items (items.json `type: 'squad'`:
      War Banner, Jolly Banner, Spotter's Lens, Last Stand Banner) x1.35 while he lives (`squadItemMult()` -> 7th arg of
      `computeHeroStats()`, which multiplies those items' effect factor: proc chances, specials, Last Stand shield/attack).
      LUTE (`passive.lute`): every `everyMs` 10s of a floor's fight (`hero.floor.lute`, `tickLute()`) a random boost for the
      squad for 5s: Attack +20% / Speed +20% / Defense+Resist +30% / Regen 1.5%/s (`lute` event: name popup + ring per hero).
      SONGS v3 (`songs.first` + `durationMs` 5000): no song at the start; Change Song plays March, then Ballad, in turn, each
      for 5s (`hero.nextSong`, `songLeft`, `tickSong()`; `song` event with song null when it stops). MARCH also makes squad
      ITEM procs `procChancePercent` 25% likelier (`marchProcs()` in `rollProcs`, not passive procs); BALLAD makes item heals
      `healPercent` 25% stronger (`balladHeal()` inside `regenAura().factor`, the same factor the Cleric's aura uses).
      DISCORD cooldown 13 -> 8s. review.mjs 3 all (x2): avg floor ~25 -> 27.1 / 25.8.
    - **Archer** VOLLEY GUNNER (built session 6): Steady Aim + pierce REMOVED from her (the `steadyAim` code stays, unused by
      real heroes). VOLLEY (`passive.volley`, `volley()` at the end of landAttack): every `every` 4th basic shot also fires at
      `arrows`-1 = 2 other enemies (nearest to her target), +`perQuiver` 1 per Quiver of Plenty; each arrow is a full strike
      that rolls her on-hit items + Fire Arrows; count `hero.volleyCount` kept for the run. ARROW RAIN (`arrow_rain`, replaces
      Headshot; `headshot` stays in skills.json): channel 6 waves of 60% every 333ms on a circle 110 that follows her target,
      cooldown 10s, `waveOnHit` = every wave rolls her on-hit items + Fire Arrows on each enemy hit (in `fireWave()`).
      Balance: review.mjs 3 all avg floor ~25 (old kit) -> ~24.3, still LAST; her share of squad damage 46% -> ~29% (lost
      the 60% pierce on every shot and Steady Aim). Tried: volley 4 arrows, every 3rd, rain 70%: little change in review
      (runs end at the floor-20 boss, where volley has no 2nd target). User: leave her as is for now (try in game first). Then user: attack speed a bit higher -> base attackEfficiency 100 -> 115: avg floor ~24.3 -> ~25.3.
    - **Mage** ELEMENTALIST (built session 6): ELEMENT CYCLE (`passive.elementCycle` ['fire','ice','electric'],
      `cycleElement()` after each basic strike): `hero.hitType` = the element of her NEXT basic shot (landAttack + the
      scene's arrow look read it), so her own attacks react every 2nd shot; REACTIONS kept as they were (`passive.reactions`).
      ROTATION + CHARMS (`mage_rotation`; old `elemental_rotation` stays): `charm: { item, damagePercent, splashPercent,
      radiusPercent, jumps }` per copy the MAGE holds (`charmed()` inside `currentSpell()`): Kindling = Fireball +30% (and
      splash), Frost Charm = Nova +25% damage and radius, Storm Charm = +2 Chain jumps; Chain Lightning now has
      `chainJumps` 4 (was: through ALL enemies). ARCANE WARD + TEAM ELEMENTS (`mage_ward`, `teamElements.durationMs` 5000):
      `state.teamElementsMs`; while it runs every squad hit without an element leaves a random one (in `reaction()`).
      review.mjs 3 all (x2): avg floor ~26 -> 26.8 / 26.9 (mid-pack).
    - **Knight** IRON WALL (built session 6): INTERCEPT REMOVED from him (code stays). GRUDGE (`passive.grudge`,
      `addGrudge()` on every thorns / Spite Mail / Mirror Buckler reflect): +1 charge per reflected hit up to `maxStacks` 20;
      his next skill with `grudgeCharged` is +`perReflectPercent` 10% per charge, then charges reset (`grudge` events; scene:
      orange bar under his health bar, gold when full). DEFENSE BASH (`defense_bash`, old `knight_bash` stays): damage
      multiplier 1 + `defenseMultiplier` 3 x defense / attack (in `skillHit()`), 1.5s stun, 9s. CHALLENGE unchanged.
      review.mjs 3 all (x2): avg floor ~29 -> 29.4 / 29.2 (unchanged, 3rd-4th).
    - **Berserker** BRAWLER (built session 6): RAGE / Frenzy / Bloodrage REMOVED from him (code stays). BLOODTHIRST
      (`passive.bloodthirst`, `tickBloodthirst()`): below `belowPercent` 50% health `hero.thirst` = +`attackPercent` 40% attack
      (statUpkeep) and lifesteal x`lifestealMultiplier` 2 (afterHit); LINGERS `lingerMs` 3s after he heals back above.
      SAVAGE LEAP v3 (`brawl_leap`, old `savage_leap` stays): 350% to the target + `landSplash` 350% within 90px,
      `procBoost` 2 = every enemy hit rolls his on-hit items at x2 chance (`rollProcs` ctx.chanceMult). BLOOD FEAST
      (`blood_feast`, replaces Blood Pact): himself +50% lifesteal for 4s, 12s cooldown. Cast effects: skillFx.json maps the
      new ids (defense_bash, mage_rotation:FN, mage_ward, brawl_leap, blood_feast) to the old recipes.
      review.mjs 3 all (x2): avg floor ~30 (2nd-3rd) -> 27.9 / 27.9 (mid-pack).
    - **Rogue** COMBO STRIKER (built session 6): COMBO + Opportunist REMOVED from him (code stays, `eviscerate` stays).
      DIRTY FIGHTING: `passive.procs` 15% onAttack Bleed (silent) + `passive.dirtyFighting.missPercent` 20: an enemy he
      has debuffed (`enemy.debuffedBy` Set of hero uids, filled in `applyStatus` for any debuff from a hero) misses 20% of
      its attacks on HIM only (`extraMissPercent` opt -> computeDamage's blind roll). MULTISTRIKE (`multistrike`): a
      ONE-ENEMY channel (skill `target: 'enemy'` + `channel` = every wave hits `ch.aimUid`, the next target if it died):
      5 waves of 50% every 120ms, `waveApply` Bleed, `waveOnHit` = on-hit items each hit; 7s cooldown. Smoke Bomb kept.
      review.mjs 3 all (x2): avg floor ~30 -> 28.9 / 31.7 (still 2nd).
    - **Samurai** ONE-STRIKE MASTER (built session 6; USER KEPT the wide Wind Cutter slash instead of the design's one perfect
      cut): IAIDO v3 (`passive.iaido`): every 3rd hit parried; parried/blocked/dodged hits get a 120% counter-cut with
      `counterCrit` = sure crit (his crit damage), on-hit items roll once (not twice); `evasionFlat` +10 (statUpkeep).
      WIND CUTTER v3 (`wind_cutter3`, old `wind_cutter` stays): band slash 250%, `sureCrit` (skillHit +100 crit), no Armor
      Break, `killCooldownCutPercent` 60 = a kill cuts the cooldown (popup 'Perfect Cut!'). COUNTER STANCE (`counter_stance`,
      replaces Focus Stance): 4s `parry` only (no next-attack crit); while it is on, counterCut() ignores reach and throws
      the hit back (crescent projectile when far). review.mjs 3 all (x2): avg floor ~27 -> 30.0 / 29.8 (3rd-4th).
