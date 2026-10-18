# Hero kits v3 (session 5 brainstorm, NOT built yet)

Goal (user): every hero's gimmick must feel truly different, and skills must keep up with progression by
SYNERGISING WITH ITEMS (each hero = the best home for one item family). Measured with `scripts/tests/dmgshare.mjs`:
most skills fall from 15-25% of a hero's damage early to 5-13% after floor 45 (items take over).
Decided by the user one hero at a time (feel, passive, attack, support). Numbers are first guesses, tuned when built.

## Knight: IRON WALL
- Feel: the squad's shield; enemies crash into him and hurt themselves. Loves defense, shield and thorns items.
- Passive GRUDGE (replaces Intercept): 25% of his defense is added to his attack. Every hit he reflects (thorns
  items) charges his next Shield Bash (+10% per reflect).
- Attack DEFENSE BASH (changes Shield Bash): 100% attack + 300% of his defense (+ the stun). Defense items become
  damage items for him.
- Support CHALLENGE: unchanged (taunt nearby 3s + 30 defense).

## Berserker: BRAWLER
- Feel: wades into crowds and hits everything around him. Loves splash and area items.
- Passive BLOODTHIRST (replaces Rage): below 50% health +40% attack and his lifesteal is doubled. Lifesteal items
  keep him alive down there.
- Attack SAVAGE LEAP (user's version): 350% AREA attack where he lands, with a higher chance for his on-hit items
  to go off on every enemy it hits.
- Support (user's version): SUPER LIFESTEAL for 4s (number to set when built, e.g. 50% lifesteal for him).

## Rogue: COMBO STRIKER
- Feel: fast hits, many procs, bleeding enemies. Loves attack speed, double-hit and on-hit items.
- Passive (user's version, replaces Combo): 15% chance on hit to make the enemy BLEED; enemies he has debuffed
  miss some of their attacks ON HIM ONLY (e.g. 20% miss vs him; number set when built).
- Attack MULTISTRIKE (user's version, replaces Eviscerate): 5 quick hits at 50% on one enemy; every hit applies
  Bleed and rolls his on-hit items (more hits = more procs). 5s cooldown.
- Support SMOKE BOMB: unchanged (squad +30 evasion 4s, all enemies Blinded).

## Archer: VOLLEY GUNNER (BUILT session 6, needs a buff, see docs/systems/heroes.md)
- Feel: many arrows at many enemies, every arrow rolls her items. Loves on-hit, arrow and attack speed items
  (Quiver of Plenty, Fire Arrows, Static Crystal).
- Passive VOLLEY (replaces Steady Aim): every 5th shot fires at 3 enemies; each arrow rolls her on-hit items.
  Arrow items make volleys bigger.
- Attack ARROW RAIN (replaces Headshot): arrows fall on an area for 2s (6 waves of 50%); every wave rolls her
  on-hit items on each enemy hit.
- Support HUNTER'S MARK: unchanged (+25% damage taken 6s).

## Samurai: ONE-STRIKE MASTER
- Feel: few, perfect, deadly cuts. Loves crit, crit damage and evasion items.
- Passive IAIDO + CRIT COUNTERS (user's version): every 3rd hit on him is parried; parried / blocked / dodged hits
  get a counter-cut that uses his CRIT DAMAGE and rolls on-hit items twice; PLUS extra evasion built in
  (e.g. +10 evasion; number set when built).
- Attack THOUSAND CUTS (replaces Wind Cutter): dashes through up to 5 enemies, one 120% cut each; every cut can
  crit and proc items. NOTE: an item is already called Thousand Cuts: rename one of them when built.
- Support COUNTER STANCE (changes Focus Stance): 4s stance, hits on him are parried and thrown back with his crit
  damage.

## Mage: ELEMENTALIST
- Feel: mixes fire, ice and lightning into chain reactions. Loves elemental items (the 4 charms, Chill Band,
  Fire Bombs, Static Crystal).
- Passive ELEMENT CYCLE: her basic attacks go fire > ice > electric in turn, so her own attacks set off the
  Reactions (Steam / Shatter / Overload stay as the mechanic) all the time.
- Attack ROTATION + CHARMS: Fireball > Frost Nova > Chain Lightning, each spell grows with its element items
  (Kindling Charm = bigger Fireball, Frost Charm = bigger Nova, Storm Charm = more Chain jumps).
- Support ARCANE WARD + TEAM ELEMENTS: squad shield + resist, and for 5s the squad's hits leave a random element so
  the whole team sets off reactions.

## Cleric: HOLY BATTLE-HEALER
- Feel: her healing turns into holy damage. Loves heal, regen and shield items.
- Passive (user's version, replaces Mending): she gets more out of heal items; every 5s she heals one party
  member; healing SOMEONE ELSE gives them (or her? set when built: user said "healing other people give attack
  buff, and speed for 4s") +attack and +attack speed for 4s.
- Attack HOLY NOVA (user's version, replaces Smite): heals a party member AND damages every enemy around that
  healed ally; can proc items.
- Support (user's version, replaces Divine Shield): a SHIELD plus strong REGEN for 5s.

## Necromancer: LEGION MASTER
- Feel: commands an army of the dead; more minions = more power. Loves minion items (Bone Charm, Grave Dust,
  Rat Cage, Necro Crown).
- Passive LEGION (user's version): keeps the skeletons; every minion that dies gives a Soul (for his skills) and
  minion items count double for him; his skeletons LEVEL UP with him, a tiny bit per level (e.g. +3% health and
  attack per Necromancer level; number set when built).
- Attack DEATH COIL (user's version): same idea, much stronger; a killing blow raises a skeleton.
- Support BONE SACRIFICE (replaces Bone Ward): sacrifices skeletons to shield the squad (bigger per skeleton);
  with Grave Dust they explode on the way.

## Bard: BATTLE HYMN (BUILT session 6, see docs/systems/heroes.md)
- Feel: pure support; his songs and buffs make the squad stronger, little damage of his own. Loves squad items.
- Passive (user's version, replaces Songs): SQUAD ITEM MULTIPLIER x1.35 (squad-wide item effects are 35% stronger
  while he lives); and every 10s from the start of a floor he plays the lute: a RANDOM boost for the whole team
  (attack / regen / defense / speed).
- Attack DISCORD: unchanged effect (40% + charm 2.5s in an area) with a shorter cooldown (13s -> e.g. 8s).
- Support CHANGE SONG + ITEMS: switches March/Ballad with a burst; March also raises item proc chances +25%,
  Ballad boosts healing items +25%. (Note: the passive no longer plays a song all the time; how March/Ballad
  last is decided when built, e.g. the chosen song stays until switched.)

## Alchemist: MAD BOMBER (BUILT session 6, see docs/systems/heroes.md)
- Feel: explosions everywhere, big area flasks, splash on everything. Loves area and fire items.
- Passive LOBBED SHOTS (user's version, replaces Catalyst): his basic attacks are flasks that splash 40% on
  enemies nearby and apply POISON only; in exchange he attacks slower (e.g. -25% attack speed; set when built).
- Attack BIG BARRAGE: Flask Barrage throws 5 flasks instead of 3; each splashes and applies its effect.
- Support BETTER BREW: Mystery Brew throws 4 flasks, cooldown 12s -> 9s, healing flasks heal 30%.

## Open questions for the build
- ANSWERED: the Cleric's +attack/+speed buff (after she heals someone else) goes to HERSELF.
- ANSWERED: Bard: a song (March/Ballad from Change Song) plays only 5s.
- ANSWERED: Samurai: rename the SKILL (the Thousand Cuts item keeps its name).
- Every hero's numbers are first guesses; check each with review.mjs / dmgshare.mjs after building.
- Build order suggestion: one hero per step (kit + tests + bot check), weakest first.

## Guardrails round (session 5, user's answers; these OVERRIDE the hero sections above)
- ON-HIT HOOK only for ARCHER, ROGUE and BERSERKER (their skills/passives roll on-hit items). SAMURAI leans on
  CRIT DAMAGE instead: his counter-cuts use his crit damage but do NOT roll items twice. CLERIC leans on HEAL
  items: Holy Nova does NOT proc on-hit items; it grows with her healing (heal items).
- BARD x1.35 boosts SQUAD-WIDE items only (War Banner, Spotter's Lens, Jolly Banner, Last Stand Banner...).
- CLERIC Holy Nova: MODEST damage (e.g. 60% around the healed ally); her power stays in healing. Aim: equal to the
  other heroes, not above.
- KNIGHT: keeps DEFENSE BASH (100% attack + 300% defense + stun). Grudge loses the '25% of defense to attack'
  part and keeps only 'reflected hits charge the next Shield Bash (+10% each)'.
- ALCHEMIST: basic flasks stay POISON only (splash 40%, slower attacks), as the user wrote.
- SAMURAI attack = ONE PERFECT CUT on one enemy (e.g. 500%, sure crit); if the cut KILLS, the cooldown is cut by
  60%. Needs a new name (the Thousand Cuts item keeps its name).
- ROGUE Multistrike cooldown starts at 7s (tune later).
- BERSERKER Bloodthirst LINGERS 3s after he heals above 50%, so lifesteal does not switch it off at once.
