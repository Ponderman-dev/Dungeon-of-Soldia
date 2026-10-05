# Hand-off notes (read after CLAUDE.md)

Start of a new session: read `CLAUDE.md` (all decided rules), `docs/game-design-recap.md` (the design) and this file.

## The user
Total beginner, fully vibe coding. Explain simply, small steps, ask before big decisions.
**Credits are limited**: batch changes (the user will send a list), avoid unnecessary screenshots,
keep replies short, republish the preview page once per batch or when asked, not after every tweak.

## What is built (work branch: `claude/quick-gloves-item-changes-ofzyqe`, PR https://github.com/Ponderman-dev/Dungeon-of-Soldia/pull/1 already exists; pushing to the branch updates it)
- Phaser 3 project (npm installed Phaser v4.x in practice), 390x844 portrait, placeholder block characters made from parts.
- Battle: 3 heroes (Knight, Rogue, Archer; Berserker on the bench) with party perks and morale debuffs, enemies (Slime, Goblin, Bat), auto-attacks, tap-to-focus,
  damage types, defense/resist/evasion/crit, XP + per-hero levelling, floors with scaling in `src/data/*.json`.
- Floor flow: door, heroes walk in a line, camera slide, entry from the bottom (see CLAUDE.md "Floor flow").
- Skills (2 per hero) + cooldowns (mana removed in step A1) + statuses (stun, slow, poison, buff). One-tap casting.
- Reward screen (pick 1 of 3 items, then choose a hero), 14+ items with dots above heroes, Shared Potion, TEST auto-reward button.
- Items already reworked with the user: Lucky Coin (diminishing crit), Heart Charm (+regen), War Banner (Battle Cry proc),
  Shield Totem (block + 2.5s recharge), special items (Bulwark Plate, Siege Cannon, Bloodlust Mask, Gambler's Dice).
- Preview page: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (private, republish with `npm run build:page`, see CLAUDE.md).

## Tests and tuning (in the repo)
- `npm test` runs `scripts/tests/*.test.mjs` (rules of skills, statuses, items, rewards, each reworked item).
- `npm run sim` = average death floor for a bot that casts every ready skill and gets random rewards (about floor 18-19).
  `node scripts/tests/sim.mjs noskills` is the baseline (about floor 10; the user tuned enemy growth for that). Enemy growth lives in `combat.json` `floorScaling` (now per-floor, see CLAUDE.md "Difficulty curve"); `node scripts/tests/difficulty.mjs` prints a per-floor report.
- `node scripts/tests/tune-enemies.mjs <hpPerStep list> <attackPerStep list>` searches enemy growth numbers.
- Browser checks were done with `playwright-core` (not in the project; `npm i playwright-core` in a scratch folder), Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, with `page.clock.install()` + `clock.runFor()` to fast-forward time.
  Always revert temporary test builds (e.g. forced reward choices) and grep to be sure.

- Hero buff (after the item batch 2 session): Rogue 100 hp / 6 def / 25 evasion, Archer 95 hp / 6 def / 15 evasion (more evasion per level too). The bot's average death floor went from about 24.7 to 32.5, so enemy growth may need retuning.

- Squad/perks/morale step done (steps a-c). Next in that plan: (d) redo the skills (user to decide: 1 or 2 tappable skills per hero, attack vs team-support focus). Enemy growth was retuned for 3 heroes (+35% hp / +52.5% attack per 3 floors, mean death floor about 26; it was retuned again after heroes switched to random targeting). Knight-only item stacking no longer beats spreading items (about 26 vs 27).

## Gotchas learned
- Never pass the `apply` function in items.js straight to `forEach` (index becomes the multiplier). That once silently disabled skill buffs.
- A hero's stats come from `refreshStats()` (level + items + buffs); call it after anything that changes them.
- Dead heroes: items stop working; the figure freezes and disappears after the survivors descend.

## BIG UPDATE (current work)
All planning is done and approved: `docs/big-update-plan.md` (mechanics, 10 heroes, debuffs, minions, BUILD ORDER) and `docs/item-list.md` (72 items, stacking, drop weights, rules). `docs/item-review.md` = the approved item review.
Progress: A1 (remove mana), A2 (attack/support skill slots), A3 (defense/resist curve, evasion 70%, crit 100%), A4 (new drop roll), A5 (damage types: category weak/resist, DoT bonus, data check) DONE. A6 in 3 parts: A6a (stacking bleed/burn/poison) and A6b (chill>freeze, shock, fear, knockback, taunt, silence; slow removed) DONE; next A6c (weaken, armor break, curse, blind, mark). NOTE: the sim bot jumped to ~54 mean death floor because deeper floors now give more epics/legendaries (flat odds give ~32): retune in phase H. Ask the user before each step. The user wants the preview page REPUBLISHED AFTER EVERY CHANGE (for now).

## Older next-steps list (superseded by the build order)
0. **IN PROGRESS: redo the skills (step d of the squad plan).** Open questions for the user: (1) 2 tappable skills per hero, or 1 tappable skill + the passive perk? (2) should skills be mostly attack, or mostly team support (heals, shields, rally)? Ask these first. Done already in this plan: 3-hero squad, hero perks, morale debuffs (INCOMPLETE / ALL ALONE), random default targeting, Chill Band rework (stackable ice hit + non-stacking 50% freeze). An 8-items-per-hero slot limit was tried and reverted (user did not want it); Knight-only item stacking is now already worse than spreading because of perks and morale.
1. More item edits: the user is going through the item list one by one (batch 2 done: Whetstone, Quick Gloves, Siege Cannon, Bloodlust Mask, Gambler's Dice + new Fire Bombs, Chill Band, Static Crystal, Aid Kit; still to review: Padded Vest, Sharp Edge, Eagle Eye, Feather Boots, Bulwark Plate). Numbers to tune are all in items.json.
2. Build the rest of the draft items (`docs/item-ideas.md`): on-hit effects (burn, poison, slow, stun), skill/mana items, Phoenix Feather.
3. Skill books in the reward pool (new skill replaces one; upgrade book strengthens one).
4. Bosses every 10 floors (stun/slow scale 0.5), floor 100 super boss.
5. Other screens: main menu, squad select (9 heroes, pick 3), game over, pause; saving unlocks in localStorage.
6. More heroes (Mage, Cleric, Necromancer, Bard, Alchemist) and magic damage (needed for fire/ice/electric/dark items).
7. Retune enemy growth once the item and skill pool is final; remove the TEST auto-reward button when rewards go live.
8. Later: wrap with Capacitor for Android (Solana Seeker).
