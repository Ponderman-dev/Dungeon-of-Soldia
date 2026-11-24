# Dungeon of Soldia: Design Recap (v2, updated session 51)

The big picture only. Exact numbers live in `src/data/*.json`; the details of each system live in `docs/systems/*.md`.

Target: Solana Seeker dApp Store (signed Android release build)
Genre: Top-down auto-battler roguelike, portrait mobile (390x844)
Engine: Phaser 3 + Vite + plain JS, to be wrapped for Android with Capacitor later. Fully vibe coded with Claude Code.

## Battle
- Enemies at the top, 3 heroes at the bottom. Everyone auto-attacks on a timer; heroes walk into reach and can be pushed.
- The floor director picks the enemies each floor from a threat budget that grows with the floor (fodder / normal /
  strong enemies, 2 to 6+ enemies). Some floors are elite fights or a Monster House (many enemies).
- Heroes pick targets by themselves. Tap an enemy = the squad focuses it. Drag a hero onto an enemy = an order for that hero.
- Each hero has 2 skills: one attack skill and one support skill. No mana: skills run on cooldown only. The player taps
  them to cast. Some skills have a wind-up or hit an area.
- Statuses: stun, slow, poison and other damage over time, shields, taunt and more (`statuses.md`).
- Items are passive only and show as icons on the hero.

## Heroes
- 10 heroes; the player brings 3 per run. Knight, Rogue and Archer are open from the start. The other 7 unlock by
  reaching a goal (best floor, total kills, floors cleared or runs played; `unlocks.json`).
- Roster: Knight, Berserker, Rogue, Archer, Samurai, Mage, Cleric, Necromage, Bard, Alchemist.
- Each hero has an attack skill, a support skill, a party perk (a buff for the whole squad while that hero is alive)
  and a passive. Some heroes have an "every 4th attack" counter (Mage, Cleric, Bard).
- Some heroes bring minions (summons that fight for the squad, e.g. the Necromage's skeletons, the Shield Totem).
- Dead heroes stay dead for the run. A fallen hero's perk is lost and the rest get a morale debuff: INCOMPLETE (one
  down), ALL ALONE (one left). The run ends when all 3 are dead.
- Stats: health, attack, defense (cuts physical), resist (cuts magical), attack speed, evasion, crit and more.
- Damage types: physical (melee, ranged) and magical (fire, ice, electric, dark, holy). Enemies can be weak or resistant.
  Melee can hit flying enemies but misses some of the time (15%); ranged has no penalty.
- Levelling is automatic and only raises stats. Heroes gain XP from kills; dead heroes gain none. Levels reset every run.

## Rewards (after every cleared floor)
- Pick 1 of 3 cards, then "Who gets it?" (pick the hero).
- Cards are items, skill books or (rarely, 5%) a Shared Potion that heals the whole squad.
- Skill books hold pages: stat pages and modifier pages that change a skill. Blue books are normal; a golden book comes
  after each boss. Strong pages are rare on purpose (legendary and hero-only pages only from golden books).
- Boss floors give one epic, one epic and one legendary card, then the golden book.
- Rarer cards get more common deeper in the dungeon (`rewards.json`).

## Items
- 118 items in 4 rarities: common, rare, epic, legendary (colour-coded frames).
- Kinds: stat, squad, on-hit, skill, minion, special and trade-off items.
- The same item stacks (Risk of Rain style). `docs/item-decisions.md` holds the current item numbers.

## Run structure
- Endless until the squad dies, then restart from floor 1. About 30 seconds per floor.
- Between floors: the door at the top opens, the heroes walk through it, the camera slides up to the next floor.
- Special rooms (from floor 4, about 1 floor in 4, never next to a boss): Treasure Room (one chest can be a Mimic),
  Rest Fountain, Skill Dealer, Puzzle Room.
- A boss every 20 floors, 8 bosses in Dungeon A: 20 Grukk + War Drum, 40 Brood Mother, 60 Frost Warden,
  80 Rask and Vesh, 100 Morthul, 120 Ignatius, 140 Sela, 160 Vharox. A boss fight that drags past 3 minutes enrages.
- v1 ships with Dungeon A only.

## Outside the dungeon (camp)
- Title page (forest from above, Tap to start), then the Base camp hub: campfire, heroes and NPCs, and buttons for
  To dungeon, Heroes, Profile, Leaderboard, Shop and Settings.
- Squad select screen: pick 3 open heroes; locked heroes show their goal and a progress bar.
- Profile: name, profile hero, banner, lifetime stats, achievements.
- Game Over screen with run stats, then Camp or Try again.

## Meta progression and money
- Unlocks: heroes (by goals), banners and achievements. No permanent stat upgrades.
- Gems = a premium currency (real money / crypto later). The Shop sells LOOKS only (cosmetics), with daily deals.
  No gold from runs. The Shop works as a look only today: no payments yet.
- The save lives on the phone (localStorage). Anyone can edit it, which is fine while it is offline. A server or
  wallet must re-check gems, unlocks and best floor once they matter.

## Art and sound
- Pixel art, drawn by Pondy. Crisp scaling, no smoothing.
- Characters are separate parts (head, body, weapon...) joined in the game and animated by moving the parts
  (keyframe clips). Drawn and animated in the Character Studio (`studio.md`).
- Interface look: "DUSK" (square windows, flat salmon / maroon buttons; `ui.md`).
- Sound: `sfx.js` with cues exists, but sound work is ON HOLD.

## Builds
- `build:page` = the claude.ai preview page (has TEST buttons). `build:itch` = a playtest build for itch.io.
  `build:release` = the store / Android build (no TEST buttons, no dev url flags).

## Still open
- BOSS PLAN (user, session 51, KIV = keep in view, not started): Dungeon A goes to floor 200 (boss floors 20, 40 ...
  200 = 10 boss floors; today there are 8, up to 160). Every boss floor should have 1-2 random boss choices (e.g.
  floor 20 = Grukk OR another boss), so runs differ. Every 40 floors the dungeon looks a bit different (new floor
  look / theme). Still to decide: the floor 180 and 200 bosses, the extra bosses per floor, the 5 looks, and what
  happens after floor 200 (win screen? endless?).
- More dungeons after Dungeon A.
- Android wrap (Capacitor) and the Solana / dApp Store side (wallet, gem payments, server checks). Wrap note: allow sound
  without a tap in the web view (setMediaPlaybackRequiresUserGesture(false)) so the title music plays at launch (sound.md MUSIC).
  Settings > HELP will then explain the crypto side (wallet, Solana, Seeker, payments) (user, session 53).
- Sound (on hold), skins, hero lore, online leaderboard (today a sample board).
- Playtests with real players.
