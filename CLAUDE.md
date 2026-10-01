# Dungeon of Soldia

Mobile auto-battler roguelike. Phaser 3 + Vite + plain JavaScript (ES modules, no TypeScript).
Will be wrapped for Android later (Solana Seeker dApp Store).
Full design: `docs/game-design-recap.md`. Read it before designing features.

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
- **Defense:** % cut of PHYSICAL damage (10 defense = 10% less), capped at 75%.
- **Resist:** new stat, same idea but for MAGICAL damage (cap 75%). Heroes now have 8 stats.
- **Weak/resist per enemy:** each enemy lists `weak` and `resists` damage types in JSON (weak = +50% damage, resists = -50%).
- **Melee vs ranged:** melee attacks CAN hit flying enemies but miss 40% of the time (`meleeVsFlyingMissPercent` in combat.json). Ranged has no penalty. No formation rules yet.
- **Evasion:** % chance to fully dodge a hit of any type, capped at 60%.
- **Crit:** % chance to deal 2x damage.
- **Attack efficiency:** attack speed. 100 = 1 attack per second.
- **Mana:** regens slowly during a fight; carries over between floors with a small top-up.
- **Healing:** each hero heals 25% of max health after a win (bigger after bosses).
- **Dead heroes:** stay dead for the rest of the run. Run ends when all 4 are dead.
- **Tap-to-focus:** all heroes attack the tapped enemy until it dies, then go back to auto-target.
- **Levelling:** heroes gain XP from kills (`xp` per enemy in enemies.json). An enemy's XP is SPLIT between living heroes; dead heroes are frozen. Needed XP: `xpBase * xpGrowth^(level-1)` (leveling.json). Each hero has its own `growthPercent` (% of base per level: health, attack, mana) and `growthFlat` (points per level: defense, resist, evasion, crit, attackEfficiency) in heroes.json. On level-up, max health rises and current health rises by the same amount. Levels reset every run.
- **Skills & mana:** each hero has 2 skills (`skills` in heroes.json, defined in skills.json). Tap a skill square under the hero to cast. One tap: single-target skills hit the focused enemy, else the hero's usual target. Cost mana (pool 60, regen 2/sec in fights, +20% after a win) AND have a per-skill cooldown (cooldowns/mana only run during fights). Skill damage = attack x `damageMultiplier`, uses the skill's `damageType` or the hero's. Targets: `enemy`, `allEnemies`, `self`. Skills can `apply` statuses.
- **Statuses:** stun (can't attack or cast), slow (`attackSpeedPercent`), poison (dark damage over time; `damageMultiplier` x caster attack per tick, ignores dodge/crit), buff (temporary stat `mods`, same shape as item effects). Same status from the same skill refreshes instead of stacking. Enemy `statusDurationScale` (e.g. 0.5 for bosses) shortens statuses on them. Hero statuses are cleared when a floor is cleared. Status tags (STUN/SLOW/PSN/BUFF) show by the health bar (`statuses.json`).
- **Rewards:** after every floor clear a full-screen reward scene (RewardScene, layout from the user's wireframes) shows 3 items (rarity-weighted, `rewards.json` / `rarities.json`), then a "Who gets it?" screen (2x2 hero cards with before > after stats, then a Give button). Only items for now; skill books come next. Rarities: common (grey), rare (blue), epic (purple), legendary (gold). Items: `items.json` (effects: `stat` + `percent` or `flat`; `damageBonus` + `percent`; or `special` + `percent`; `scope` self or squad; optional `maxStacks`). Items show as dots above the hero's health bar: dot colour = type (`itemTypes.json`), ring = rarity. Only items whose effects work today are in the pool (no magic/mana items yet).
- **Special items (no negatives, epic/legendary):** Bulwark Plate (+defense, `thorns`: reflects % of melee damage taken), Siege Cannon (+attack, `skillDamage`), Bloodlust Mask (+attack speed, `lifesteal`), Gambler's Dice (+crit, `critDamage`). Trade-off items with negatives no longer exist.
- **Shield Totem (Block):** `block` special: 10% per totem (max 6) that a hit on the holder is stopped completely (rolled after evasion; no damage, no thorns/lifesteal). After a successful block ALL the holder's totems recharge for 2.5s (`cooldownMs` in the item; shown as a BLOCK CD tag, a `blockCooldown` status). Self scope, type special.
- **Proc items:** an effect can be `proc` (`proc`: trigger, so far only `onAttack` = each basic attack of the holder; `chance` %; `label`; `targets` self or squad; `apply` status specs). Every copy rolls separately. A proc buff from the same item refreshes instead of stacking. War Banner: 8% per attack of its holder, Battle Cry = whole squad +25% attack speed for 2s (replaced the old +8% attack).
- **Item batch 2 (procs and specials):** Whetstone +12% attack AND +3 flat attack. Quick Gloves +18% attack speed, 5% `doubleHit` proc (hits the same target again). Fire Bombs (rare, onhit): 5% per attack, `strike` proc = 250% FIRE damage with a bomb projectile. Chill Band (rare, onhit, max 1): 50% per attack, extra ICE hit (10% of attack) + slow -25% for 2s on the enemy (`targets: "target"`; same item refreshes, no stacking). Static Crystal (epic, onhit): 10% per attack, `chain` proc = 300% ELECTRIC bolt on the target then jumps to the 2 closest other enemies (up to 3 hit), lightning drawn. Siege Cannon also has `skillSplash` 5% (a single-target damaging skill also hits the enemies next to its target, same damage and statuses). Bloodlust Mask also has `lifestealShare` 10% (a lifesteal heal is also given to the other living heroes, then 3s cooldown, `cooldownMs` in JSON). Gambler's Dice also has `critDebuff`: every crit puts one random debuff from its `debuffs` list (slow, poison, 0.8s stun) on the enemy. Aid Kit (common, special): `clearHeal` 5% max health when a floor is cleared, `falloffRatio` 0.85 per extra kit; `BattleState.winHeal()` adds it to the normal win heal. All of these live in `BattleState.strike()/rollProcs()/chainHit()/afterHit()`; tests in `batch-items.test.mjs`.
- **Heart Charm:** +22% max health AND `regen` special: 0.5% of max health per second per charm, during fights only (silent, the bar creeps up).
- **Shared Potion:** very rare (`potionChance` 5% per reward screen, only if a living hero is hurt) replaces one of the 3 cards; picking it heals every living hero by `healPercent` (25%) and skips the hero-choice step.
- **TEST auto-reward:** `DebugScene` draws a TEST button (top right) that toggles the registry flag `autoRewards` (default ON). When ON the reward scene waits 2s, picks a random card, then gives it to a random living hero. The user does NOT want to play the reward screen yet, but it is a definite game feature. Remove DebugScene and the auto code when rewards go live.
- **Item numbers:** defense, resist, evasion, crit items add FLAT points (+8 defense = 8% less physical damage). Attack, health, mana items add a % of the hero's base stat.
- **Items on dead heroes:** ALL items on a dead hero stop working (squad-wide ones too). Dead heroes lose their gear for the run.
- **Boss stun/slow:** bosses take half-length stun and slow (value lives in the boss JSON).
- **Items are passive only:** never tappable or activatable. The player only taps skills and enemies.
- **Stacking:** items stack with no cap, except dodge/crit-type items, whose cap is set in the item JSON. An effect can have `falloffRatio`: each extra copy of that item adds ratio^(copies-1) of the effect (diminishing returns). Lucky Coin: +10 crit, ratio 0.934099, max 10 stacks = +75 total crit from coins.
- **Floor flow:** each floor has a door in the back wall (top of screen). After a clear: door opens and glows, living heroes heal, they gather into a single-file line at the centre of the map and walk up it into the door (steady pace, hopping each step, smaller with distance, NO fading: the door's inside is drawn in front of them), the camera slides up (old floor drops away, new floor with its enemies comes down from the top), then the living heroes come up from the bottom centre in a line and fan out to their slots, and the fight starts. A dead hero freezes (idle animation stops) and stays dimmed in their slot during the fight; when the survivors go through the door the dead hero's figure disappears (the slot box stays dim, no skill squares). Skill squares are hidden together with the slot boxes during transitions. Health bars are hidden while walking. The hero slot boxes and name labels are hidden for the whole transition (also at game start) and fade back in when the fight starts. Timings and speeds are in combat.json `transition`.
- **Difficulty curve:** enemies attack 35% slower (`enemyAttackSpeedMultiplier` 0.65 in combat.json). Enemy stats rise every 3 floors: +36% health and +54% attack of base per step (`floorScaling`, step floors = 3; linear, not compounding; floors 1-3 are base). The 4th enemy at floor 21 used to be a cliff, so fights with 4+ enemies start at 87% health/attack and ramp to 100% over 8 floors (`bigFightEase`). Check the curve with `node scripts/tests/difficulty.mjs [speed] [hpPerStep] [attackPerStep]` (per-floor death %, health lost, fight length).
- **Enemies per fight:** 1-3 enemies up to floor 20; four-enemy fights only from floor 21 (set in dungeons.json). A floor entry applies until the next listed floor.
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
