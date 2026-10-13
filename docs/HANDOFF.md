# Hand-off notes (read after CLAUDE.md)

Start of a new session: read `CLAUDE.md` (all decided rules), then this file, then `docs/big-update-plan.md` (the plan and the BUILD ORDER) and `docs/item-list.md` (72 items). `docs/game-design-recap.md` is the original design.

## The user
Total beginner, fully vibe coding. Explain simply, small steps, ask before big decisions (CLAUDE.md "About the user").
Wants: **the preview page republished after EVERY change** (for now), short replies, one step at a time, "yes start X" before each step.
They review by LOOKING at the preview page, so always check the game in the browser before publishing, and tell them what to look for.
Preview page: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (private; publish the SAME url with the Artifact tool, see CLAUDE.md "Preview page").

## Branch
Current work branch: `claude/phase-h-tuning` (made from `claude/quick-gloves-item-changes-ofzyqe` at commit 7b4e45b; the old branch holds all of Phases A-G and PR https://github.com/Ponderman-dev/Dungeon-of-Soldia/pull/1, which is still open and was NOT merged). Commit + push after every step (`git push -u origin <branch>`; never force push). Do not open new PRs unless asked. Commit messages end with the attribution lines the session gives you. Another session also pushes to the old branch (the Character Studio commits), so `git fetch` and fast-forward before pushing, and the preview page may have been republished by that session (the Artifact tool then asks you to publish again; that is fine when the game content is the same).

## Character Studio (side tool)
A design page for the colored-block characters: https://claude.ai/artifact/1azV1LBUimRkeavNpQBgc7 . See CLAUDE.md "Character Studio" for building it and applying saved designs.

## WHERE WE ARE: the BIG UPDATE (docs/big-update-plan.md "BUILD ORDER")
DONE: all of Phase A (A1 no mana, A2 attack/support skill slots, A3 defense/resist curve + caps, A4 new drop roll, A5 damage types, A6 debuff engine) and all of Phase B (B1 attack start/hit split, B2-B4 heroes/enemies walk + arrows, B5 melee movement rework).
MOVEMENT REBUILD done (see below). NEXT: **Phase D (D1 shields/invulnerable DONE, D2 taunt DONE, D3 counters DONE, D4 minions DONE) = PHASE D FINISHED. PHASE E (heroes): E1 Knight DONE, E2 Rogue DONE, E3-E10 ALL DONE (see CLAUDE.md), Phase F DONE (squad select, RANDOM, saved unlocks), PHASE G DONE (all 72 items, see CLAUDE.md), Phase H: H1 DONE (new balance bot `scripts/tests/balance.mjs`), H2 (the ONE tuning pass) is PAUSED on purpose: the user said there is not enough data yet. Do NOT tune numbers until the user has play-tested or asks. Other options the user was offered next: bosses, skill books, enemy skills, turning the reward screen on (remove the TEST auto-reward)**. (Phase C below is done):
- DONE: C1 skill wind-up (`castMs`, longer than a normal attack). DECIDED by the user: stunned/frozen during a wind-up = the skill is LOST and GOES ON COOLDOWN.
- DONE: C2 skill cast visuals (colour flash, ring burst, name banner, bigger coloured numbers, screen shake / hit-stop; skills must look clearly different from normal hits).
- DONE: C3 morale wash (Phase C is finished; NEXT is Phase D) instead of text (very faint tint on living heroes: light = INCOMPLETE, darker = ALL ALONE; remove the tag/popup).
Then Phase D (shields, taunt on enemies, "every 4th attack" counters, minion system), E (10 heroes one by one), F (squad select + unlock saving), G (72 items in groups), H (update test bot + ONE tuning pass).

## How the fight works now (so you do not break it)
- BattleState (no Phaser) is the rules; BattleScene draws events. Events: attackStart (attacker, target, hitInMs, approach), attackRetarget, attackCancel (reason), attack (result, basic flag), status, dot, proc, heal, death...
- MOVEMENT was rebuilt (after the user drew how it should look): positions live in BattleState (`place()`, `move()`, combat.json `movement`). Melee fighters walk at a steady speed to their target and swing once in reach; both sides meet in the middle face to face; ranged stay put; fighters push apart. The scene only draws positions (`followPositions()`). A basic attack: start, then hit after `swingMs` (melee) or `rangedHitMs` (arrow). See CLAUDE.md "MOVEMENT". The user disliked earlier tries (stand-beside spots, scene-side tweens): do not go back to faking walks in the scene.
- Statuses live in `statuses.json` (+ `statusDefs` passed to BattleState). Bleed/burn/poison stack with no limit (each stack its own timer); chill stacks, 5 = freeze; shock, fear, knockback, taunt, silence, weaken, armor break, curse, blind, mark all work (tests in dots / control / stat-debuffs). Only the Rogue's poison and Gambler's Dice use them in the game yet; heroes/items come in phases E/G.
- Skills: `skills: { attack, support }` per hero, skills.json has `kind`. The Archer's support is a PLACEHOLDER (Eagle Focus) until his redo. Hero stats still have a dormant `mana` field (nothing reads it).

## Tests and tuning
- `npm test` runs every `scripts/tests/*.test.mjs` (about 40 files, all must pass before every commit). `node scripts/tests/balance.mjs 30 all` plays whole runs with 6 squads (skills, minions, random rewards) and prints mean/median/range of the death floor (about 60-108 mean per squad, runs are VERY swingy: 10-20 up to the 150 cap; Cleric/Necromancer/Bard squads are weakest). Item-by-item results are confounded (runs that live longer collect more items), so do not tune from them. The old `sim.mjs` does not know minions or the new heroes.
- KNOWN BALANCE DRIFT (Phase H, paused): the bot went from ~28 (start of the update) to ~94 because of better late rarity odds, enemies attacking whoever is nearest, and stun/freeze cancelling attacks in flight. Tune in phase H (enemy `floorScaling`, `rarityOdds`, attack timings).
- `node scripts/tests/difficulty.mjs`, `tune-enemies.mjs` also exist (see CLAUDE.md "Difficulty curve").

## Browser checks (do this before every publish)
1. `npm run build:page` (makes `dist-page.html`; also `dist/` via `npm run build`), copy `dist-page.html` to your scratchpad as `dungeon-of-soldia.html`, publish it to the artifact URL.
2. To SEE the game: `npm i playwright-core` in a scratch folder, copy `scripts/dev/browser-frames.mjs` there, run `npx vite preview --port 4173` in the project (in the background), then `node browser-frames.mjs 2600 4 150` and Read the `frameN.png` files. Add `tapX tapY` to tap an enemy (e.g. 130 318 = the slime on floor 1).
3. NEVER run `pkill -f "vite preview"` in the same shell command as the thing that started it (it kills its own shell and aborts the command). Start the server with `&`, remember `$!`, and `kill` that.
4. Floor 2 has a bat (flying), floor 3 two bats; the fight starts about 1.5s after load with the fake clock.

## Gotchas learned
- Never pass the `apply` function in items.js straight to `forEach` (index becomes the multiplier). That once silently disabled skill buffs.
- A hero's stats come from `refreshStats()` (level + items + buffs); call it after anything that changes them.
- Dead heroes: items stop working; the figure freezes and disappears after the survivors descend.
- Python replace scripts: check the exact old text exists (they raise if not) and re-run the tests after every edit.
- Phaser: `Character.hopOffset` is the walking hop; bars/popups/the focus circle use `ch.y + ch.hopOffset`. `Character.stopMove()` stops walks and jabs.

## Other open decisions (from the plan doc)
- Squad select / which heroes unlock when (phase F). Start squad stays Knight, Rogue, Archer.
- Phoenix Feather item was NOT added (user said no). Hex Doll / Dread Bell / Gag Rune etc. are in the item list for phase G.
- Skill books (attack book / support book), bosses every 10 floors, floor 100 super boss, enemy skills (Silence needs them), main menu / game over / pause screens: all LATER, after the big update.
- Remove the TEST auto-reward button (DebugScene) only when rewards go live (user does not want to play the reward screen yet).
- Later: wrap with Capacitor for Android (Solana Seeker).

## Decisions made at the end of this session (all in CLAUDE.md too)
- Counters (Mage, Cleric, Bard) show NO text: the weapon glows after the (N-1)th attack, the Nth attack flashes the attacker and bursts on the target. The Mage's 4th attack cycles fire (Burn), ice (2 Chill), electric (Shock); the glow shows the NEXT element's colour.
- All 10 hero perks were chosen by the user one by one (see CLAUDE.md "Hero perks"); perks can now use specials (skillDamage, regen, dotDamage). Cleric regen is 0.4%/s (1% was too strong).
- Item descriptions must NOT mention stacking or diminishing returns; keep them short (card text overflows otherwise).
- Open small things: some long descriptions may still be tight on the reward card; Archer/others are fine. The reward screen still auto-picks (DebugScene TEST button).
