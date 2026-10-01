# Dungeon of Soldia: Design Recap (v1)

Target: Solana Seeker dApp Store (signed Android release build)
Genre: Top-down auto-battler roguelike, portrait mobile
Engine: Phaser 3 + plain JS, wrapped for Android with Capacitor later. Fully vibe coded with Claude Code.

## Battle
- Enemies at the top, 4 heroes at the bottom. Everyone auto-attacks about once per second.
- Each fight has 2-4 enemies, sometimes 1 if it is tougher. Bosses appear at set floors.
- Heroes auto-target by default. The player can tap an enemy to focus it.
- Each hero has 2 active skills (blue squares) that the player taps to cast. Skills cost mana.
- Items show as dots above each hero's head.

## Heroes
- 9 heroes in total; the player brings 4 per run.
- Stats: health, mana, attack, defense (physical), resist (magical), evasion, crit, attack efficiency.
- Damage types: physical (melee, ranged) and magical (fire, ice, electric, dark). Enemies can be weak or resistant to types. Melee attacks can hit flying enemies but miss 40% of the time; ranged has no penalty.
- Levelling is automatic and only raises stats.
- Placeholder roster (to be redone): Knight, Berserker, Rogue, Archer, Mage, Cleric, Necromancer, Bard, Alchemist.
- Each hero has one fixed weapon in v1 (no swappable weapons).

## Rewards (after every win)
- Pick 1 of 3 choices, then choose which hero receives it.
- Choices are items or skill books.
- Skill books come in two kinds: new skill (player picks which old skill to replace) and upgrade book (strengthens an existing skill).

## Items
- 4 rarities, colour coded.
- Same item stacks (Risk of Rain style).
- Effect kinds: plain stats, on-hit effects, skill modifiers, squad-wide effects, trade-off items.

## Run structure
- Endless until the squad dies, then restart from floor 1.
- About 30 seconds per floor.
- Boss every 10 floors.
- Floor 100 is the super boss of Dungeon A. Floor 101 would start a new dungeon.
- v1 ships with Dungeon A only. Clearing it is a win and more dungeons come later.

## Meta progression
- Unlocks only: new heroes and items join the pool as the player goes deeper. No currency and no permanent stat upgrades.

## Art
- Pixel art, drawn by Pondy. Chunky characters, limited palette.
- Sprites about 32x32 for heroes and normal enemies, 64x64 or bigger for bosses, scaled up with crisp pixels.
- Cutout animation: each character is separate parts (body, head, weapon) joined in-game and animated by moving the parts. Mix in a few hand-drawn frames for key moves if rotation looks rough.
- Start with simple placeholder blocks built from the same parts, then swap in real art.

## UI
- Draft wireframes exist for squad select, battle, pick 1 of 3, and assign to hero.

## Still open
- Real hero concepts (Pondy's own ideas)
- Number of items and skills for v1
- More screens: main menu, game over, pause
- Claude Code setup (next, slowly)
