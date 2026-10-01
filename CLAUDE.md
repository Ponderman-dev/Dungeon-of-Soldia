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
- **Melee vs ranged:** ranged attacks can hit flying enemies, melee can't. No formation rules yet.
- **Every fight must contain at least one enemy that melee can hit** (not flying). Enforce this in the floor/encounter data.
- **Evasion:** % chance to fully dodge a hit of any type, capped at 60%.
- **Crit:** % chance to deal 2x damage.
- **Attack efficiency:** attack speed. 100 = 1 attack per second.
- **Mana:** regens slowly during a fight; carries over between floors with a small top-up.
- **Healing:** each hero heals 25% of max health after a win (bigger after bosses).
- **Dead heroes:** stay dead for the rest of the run. Run ends when all 4 are dead.
- **Tap-to-focus:** all heroes attack the tapped enemy until it dies, then go back to auto-target.
- **Item numbers:** defense, resist, evasion, crit items add FLAT points (+8 defense = 8% less physical damage). Attack, health, mana items add a % of the hero's base stat.
- **Items on dead heroes:** ALL items on a dead hero stop working (squad-wide ones too). Dead heroes lose their gear for the run.
- **Boss stun/slow:** bosses take half-length stun and slow (value lives in the boss JSON).
- **Items are passive only:** never tappable or activatable. The player only taps skills and enemies.
- **Stacking:** items stack with no cap, except dodge/crit-type items, whose cap is set in the item JSON.
- **Dungeons:** floors, enemies and bosses are grouped by dungeon id ("A") so Dungeon B is data-only.
- **Saving:** unlocks saved in browser localStorage (works in Capacitor too).
- **Git workflow:** work on one branch (`claude/dungeon-soldia-scaffold-4utyba`). Do not open PRs unless asked.

## Commands
- `npm install`  install dependencies
- `npm run dev`  start dev server (http://localhost:5173)
- `npm run build`  production build into `dist/`

## Layout
- `index.html`  page shell
- `src/main.js`  Phaser game config
- `src/config.js`  size/colour constants
- `src/scenes/`  one file per scene
- `src/entities/`  reusable game objects (e.g. Character built from parts)
- `src/systems/`  fight logic with no Phaser in it (BattleState, combat maths, data checks)
- `src/data/`  JSON game data
- `public/`  static assets
- `docs/`  design docs
