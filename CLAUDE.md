# Dungeon of Soldia

Mobile auto-battler roguelike. Phaser 3 + Vite + plain JavaScript (ES modules, no TypeScript).
Will be wrapped for Android later (Solana Seeker dApp Store).
Full design: `docs/game-design-recap.md`. Read it before designing features.
BIG UPDATE in progress: `docs/big-update-plan.md` (plan + BUILD ORDER, phases A-H) and `docs/item-list.md` (all 72 items). Follow the build order one step at a time.

## About the user
Total beginner, fully vibe coding. Explain simply, work in small steps,
and ask before big decisions (new libraries, big refactors, design changes).

## Rules
- **Screen:** portrait 390x844 (see `src/config.js`). Crisp pixel scaling:
  `pixelArt: true`, `roundPixels: true`, Scale.FIT. Never use smoothing/antialiasing on art.
- **Data in JSON:** heroes, items, skills, enemies etc. live in `src/data/*.json`.
  Never hard-code that data inside scene code; scenes only read it.
- **Placeholder art only:** characters are colored blocks built from separate parts
  (body, head, weapon) so real pixel-art parts can replace each one later. No real art yet.
- **Git:** commit after every working step, with a clear message. Don't commit broken code.
- **Small steps:** do one step at a time, then stop and tell the user how to see it.

## Fight rules (decided)
All numbers below go in JSON/config so they are easy to tune.
- **Damage types:** physical (melee, ranged) and magical (fire, ice, electric, dark). Every attack and skill has one type.
- **Defense:** % cut of PHYSICAL damage. No hard cap: a curve (`armorPercent()` in combat.js, `armorCurve.linearUpTo` 50 in combat.json): up to 50 points 1 point = 1% (10 defense = 10% less), above that each point is worth less and the cut never reaches 100% (75 def = about 70%, 100 = about 82%).
- **Resist:** same curve as defense, for MAGICAL damage. Heroes have 7 stats in use (mana is off).
- **Weak/resist per enemy:** each enemy lists `weak` and `resists` damage types in JSON (weak = +50% damage, resists = -50%).
- **Melee vs ranged:** melee attacks CAN hit flying enemies but miss 40% of the time (`meleeVsFlyingMissPercent` in combat.json). Ranged has no penalty. No formation rules yet.
- **Evasion:** % chance to fully dodge a hit of any type, capped at 70% (`caps.evasion`).
- **Crit:** % chance to deal 2x damage, capped at 100% (`caps.crit`).
- **Attack efficiency:** attack speed. 100 = 1 attack per second.
- **No mana (for now):** mana is switched off. Skills run on COOLDOWN ONLY. The `mana` stat/growth in heroes.json, `manaCost` in skills.json and the mana rules in combat.json are dormant (nothing reads them).
- **Healing:** each hero heals 25% of max health after a win (bigger after bosses).
- **Squad of 3:** a run has 3 heroes (`squad.json`: Knight, Rogue, Archer; Berserker and later heroes stay in `heroes.json` as the bench; `pickSquad()` in `src/systems/party.js`). No boxes behind the hero slots any more; name, perk line and skill squares sit under each hero.
- **Hero perks (party buffs):** each hero has a `perk` in heroes.json (`mods` shaped like item effects, plus `growth` per level). While that hero is ALIVE the whole party gets it (the hero too). Knight Stalwart +10% max health (+0.4%/level), Rogue Keen Eyes +6 crit (+0.15/level), Archer Marksman +10% attack (+0.4%/level), Berserker (bench) Battle Fury +8% attack speed. A dead hero's perk is lost. Shown as "Team +10% HP" under the hero name ("perk lost" when dead).
- **Morale:** when heroes fall the living ones get a permanent (for the run) debuff, in combat.json `morale`: INCOMPLETE (one hero down, 3 of 3 becomes 2 alive): -10% attack, -10% attack speed, -3 defense, -3 resist. ALL ALONE (one hero left): -25% attack, -25% attack speed, -8 defense, -8 resist. Shown as a tag by every living hero's health bar plus a popup; `morale` event from `BattleState.killUnit`. Tests: `party.test.mjs`.
- **Dead heroes:** stay dead for the rest of the run. Run ends when all 3 are dead.
- **Tap-to-focus:** all heroes attack the tapped enemy until it dies, then go back to auto-target. Auto-target = a RANDOM living enemy on every attack (not the leftmost); single-target skills with no tapped enemy also pick randomly.
- **Levelling:** heroes gain XP from kills (`xp` per enemy in enemies.json). An enemy's XP is SPLIT between living heroes; dead heroes are frozen. Needed XP: `xpBase * xpGrowth^(level-1)` (leveling.json). Each hero has its own `growthPercent` (% of base per level: health, attack, mana) and `growthFlat` (points per level: defense, resist, evasion, crit, attackEfficiency) in heroes.json. On level-up, max health rises and current health rises by the same amount. Levels reset every run.
- **Skills:** each hero has ONE attack skill and ONE support skill (`skills: { attack, support }` in heroes.json; every skill in skills.json has `kind` attack/support; `validateHeroSkills()` checks it). Slot 0 = attack (left square, red), slot 1 = support (right square, green); colours in `SKILL_COLORS` (config.js). The Archer's support is a PLACEHOLDER (Eagle Focus) until his redo (Hunter's Mark). Tap a skill square under the hero to cast. One tap: single-target skills hit the focused enemy, else the hero's usual target. Each skill has a cooldown (cooldowns only run during fights). No mana cost. Skill damage = attack x `damageMultiplier`, uses the skill's `damageType` or the hero's. Targets: `enemy`, `allEnemies`, `self`. Skills can `apply` statuses.
- **Statuses:** stun (can't attack or cast), slow (`attackSpeedPercent`), poison (dark damage over time; `damageMultiplier` x caster attack per tick, ignores dodge/crit), buff (temporary stat `mods`, same shape as item effects). Same status from the same skill refreshes instead of stacking. Enemy `statusDurationScale` (e.g. 0.5 for bosses) shortens statuses on them. Hero statuses are cleared when a floor is cleared. Status tags (STUN/SLOW/PSN/BUFF) show by the health bar (`statuses.json`).
- **Rewards:** after every floor clear a full-screen reward scene (RewardScene, layout from the user's wireframes) shows 3 items. Drop roll (`rollChoices()` in rewards.js): each card first rolls a RARITY with odds by floor (`rewards.json` `rarityOdds`: floors 1-10 62/29/7.5/1.5, 11-30 52/32/13/3, 31+ 42/34/19/5 common/rare/epic/legendary), then an item of that rarity by its `dropWeight` (default 100). An item with `needs` (e.g. Eagle Eye needs "ranged") gets x0.25 weight while no living hero/item provides it (`squadSources()`: hero damageType, hero `provides`, item `provides`). `rarities.json` only holds labels and colours, then a "Who gets it?" screen (hero cards, 2 per row with the third centred, with before > after stats, then a Give button). Only items for now; skill books come next. Rarities: common (grey), rare (blue), epic (purple), legendary (gold). Items: `items.json` (effects: `stat` + `percent` or `flat`; `damageBonus` + `percent`; or `special` + `percent`; `scope` self or squad; optional `maxStacks`). Items show as dots above the hero's health bar: dot colour = type (`itemTypes.json`), ring = rarity. Only items whose effects work today are in the pool (no magic/mana items yet).
- **Special items (no negatives, epic/legendary):** Bulwark Plate (+defense, `thorns`: reflects % of melee damage taken), Siege Cannon (+attack, `skillDamage`), Bloodlust Mask (+attack speed, `lifesteal`), Gambler's Dice (+crit, `critDamage`). Trade-off items with negatives no longer exist.
- **Shield Totem (Block):** `block` special: 10% per totem (max 6) that a hit on the holder is stopped completely (rolled after evasion; no damage, no thorns/lifesteal). After a successful block ALL the holder's totems recharge for 2.5s (`cooldownMs` in the item; shown as a BLOCK CD tag, a `blockCooldown` status). Self scope, type special.
- **Proc items:** an effect can be `proc` (`proc`: trigger, so far only `onAttack` = each basic attack of the holder; `chance` %; `label`; `targets` self or squad; `apply` status specs). Every copy rolls separately. A proc buff from the same item refreshes instead of stacking. War Banner: 8% per attack of its holder, Battle Cry = whole squad +25% attack speed for 2s (replaced the old +8% attack).
- **Item batch 2 (procs and specials):** Whetstone +12% attack AND +3 flat attack. Quick Gloves +18% attack speed, 5% `doubleHit` proc (hits the same target again). Fire Bombs (rare, onhit): 5% per attack, `strike` proc = 250% FIRE damage with a bomb projectile. Chill Band (rare, onhit, stackable): every attack adds an ICE hit worth 10% of attack per band (a silent 100% `strike` proc), AND a `unique` proc (counts once however many bands): 50% chance to FREEZE the enemy for 0.7s (`freeze` status = can't act, FREEZE tag; needs the attack to have connected; `targets: "target"`). Static Crystal (epic, onhit): 10% per attack, `chain` proc = 300% ELECTRIC bolt on the target then jumps to the 2 closest other enemies (up to 3 hit), lightning drawn. Siege Cannon also has `skillSplash` 5% (a single-target damaging skill also hits the enemies next to its target, same damage and statuses). Bloodlust Mask also has `lifestealShare` 10% (a lifesteal heal is also given to the other living heroes, then 3s cooldown, `cooldownMs` in JSON). Gambler's Dice also has `critDebuff`: every crit puts one random debuff from its `debuffs` list (slow, poison, 0.8s stun) on the enemy. Aid Kit (common, special): `clearHeal` 5% max health when a floor is cleared, `falloffRatio` 0.85 per extra kit; `BattleState.winHeal()` adds it to the normal win heal. All of these live in `BattleState.strike()/rollProcs()/chainHit()/afterHit()`; tests in `batch-items.test.mjs`.
- **Heart Charm:** +22% max health AND `regen` special: 0.5% of max health per second per charm, during fights only (silent, the bar creeps up).
- **Shared Potion:** very rare (`potionChance` 5% per reward screen, only if a living hero is hurt) replaces one of the 3 cards; picking it heals every living hero by `healPercent` (25%) and skips the hero-choice step.
- **TEST auto-reward:** `DebugScene` draws a TEST button (top right) that toggles the registry flag `autoRewards` (default ON). When ON the reward scene waits 2s, picks a random card, then gives it to a random living hero. The user does NOT want to play the reward screen yet, but it is a definite game feature. Remove DebugScene and the auto code when rewards go live.
- **Item numbers:** defense, resist, evasion, crit items add FLAT points (+8 defense = 8% less physical damage). Attack and health items add a % of the hero's base stat.
- **Items on dead heroes:** ALL items on a dead hero stop working (squad-wide ones too). Dead heroes lose their gear for the run.
- **Boss stun/slow:** bosses take half-length stun and slow (value lives in the boss JSON).
- **Items are passive only:** never tappable or activatable. The player only taps skills and enemies.
- **Stacking:** items stack with no cap, except dodge/crit-type items, whose cap is set in the item JSON. An effect can have `falloffRatio`: each extra copy of that item adds ratio^(copies-1) of the effect (diminishing returns). Lucky Coin: +10 crit, ratio 0.934099, max 10 stacks = +75 total crit from coins.
- **Floor flow:** each floor has a door in the back wall (top of screen). After a clear: door opens and glows, living heroes heal, they gather into a single-file line at the centre of the map and walk up it into the door (steady pace, hopping each step, smaller with distance, NO fading: the door's inside is drawn in front of them), the camera slides up (old floor drops away, new floor with its enemies comes down from the top), then the living heroes come up from the bottom centre in a line and fan out to their slots, and the fight starts. A dead hero freezes (idle animation stops) and stays dimmed in their slot during the fight; when the survivors go through the door the dead hero's figure disappears (the slot box stays dim, no skill squares). Skill squares are hidden together with the slot boxes during transitions. Health bars are hidden while walking. The hero slot boxes and name labels are hidden for the whole transition (also at game start) and fade back in when the fight starts. Timings and speeds are in combat.json `transition`.
- **Difficulty curve:** enemies attack 35% slower (`enemyAttackSpeedMultiplier` 0.65 in combat.json). Enemy stats rise every 3 floors: +35% health and +52.5% attack of base per step (`floorScaling`, step floors = 3; linear, not compounding; floors 1-3 are base). The 4th enemy used to be a cliff, so fights with 4+ enemies start at 87% health/attack and ramp to 100% over 8 floors (`bigFightEase`). Check the curve with `node scripts/tests/difficulty.mjs [speed] [hpPerStep] [attackPerStep]` (per-floor death %, health lost, fight length).
- **Enemies per fight:** 1-3 enemies; four-enemy fights start at floor 32 and are rare after that: every 5th floor (32, 37, 42...), the floors in between have 3 (`every` / `otherwise` in dungeons.json, looked up with `enemiesForFloor()` in `src/systems/dungeon.js`). A floor entry applies until the next listed floor. `bigFightEase` (combat.json) starts at floor 32 too.
- **Dungeons:** floors, enemies and bosses are grouped by dungeon id ("A") so Dungeon B is data-only.
- **Saving:** unlocks saved in browser localStorage (works in Capacitor too).
- **Git workflow:** work on one branch (`claude/dungeon-soldia-scaffold-4utyba`). Do not open PRs unless asked.

## Commands
- `npm install`  install dependencies
- `npm run dev`  start dev server (http://localhost:5173)
- `npm run build`  production build into `dist/`
- `npm run build:page`  build + pack into ONE file `dist-page.html` (for the claude.ai preview page)

## Preview page
The user previews the game on a claude.ai page (not by running it locally).
After each working step: `npm run build:page`, copy `dist-page.html` to the scratchpad as
`dungeon-of-soldia.html`, and republish it with the Artifact tool to the SAME url
(https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr). Ignore the "download link" warning; it is a false alarm from Phaser's code.

## Layout
- `index.html`  page shell
- `src/main.js`  Phaser game config
- `src/config.js`  size/colour constants
- `src/scenes/`  one file per scene
- `src/entities/`  reusable game objects (e.g. Character built from parts)
- `src/systems/`  logic with no Phaser in it (BattleState, combat maths, items, rewards, data checks)
- `src/data/`  JSON game data
- `public/`  static assets
- `docs/`  design docs
- `scripts/`  helper scripts (make-page.mjs)
