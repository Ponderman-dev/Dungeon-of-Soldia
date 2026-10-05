# Hand-off notes (read after CLAUDE.md)

Start of a new session: read `CLAUDE.md` (all decided rules), then this file, then `docs/big-update-plan.md` (the plan and the BUILD ORDER) and `docs/item-list.md` (72 items). `docs/game-design-recap.md` is the original design.

## The user
Total beginner, fully vibe coding. Explain simply, small steps, ask before big decisions (CLAUDE.md "About the user").
Wants: **the preview page republished after EVERY change** (for now), short replies, one step at a time, "yes start X" before each step.
They review by LOOKING at the preview page, so always check the game in the browser before publishing, and tell them what to look for.
Preview page: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (private; publish the SAME url with the Artifact tool, see CLAUDE.md "Preview page").

## Branch
Work branch: `claude/quick-gloves-item-changes-ofzyqe` (PR https://github.com/Ponderman-dev/Dungeon-of-Soldia/pull/1 exists; pushing updates it). Commit + push after every step. Do not open new PRs unless asked. Commit messages end with the attribution lines the session gives you.

## WHERE WE ARE: the BIG UPDATE (docs/big-update-plan.md "BUILD ORDER")
DONE: all of Phase A (A1 no mana, A2 attack/support skill slots, A3 defense/resist curve + caps, A4 new drop roll, A5 damage types, A6 debuff engine) and all of Phase B (B1 attack start/hit split, B2-B4 heroes/enemies walk + arrows, B5 melee movement rework).
NEXT: **Phase C (feel)**:
- C1 skill wind-up (`castMs`, longer than a normal attack). OPEN QUESTION the user has not answered yet: if a hero is stunned/frozen during a skill's wind-up, is the skill (a) lost + goes on cooldown, (b) lost + cooldown refunded (my suggestion), or (c) always cast?
- C2 skill cast visuals (colour flash, ring burst, name banner, bigger coloured numbers, screen shake / hit-stop; skills must look clearly different from normal hits).
- C3 morale overlay instead of text (very faint tint on living heroes: light = INCOMPLETE, darker = ALL ALONE; remove the tag/popup).
Then Phase D (shields, taunt on enemies, "every 4th attack" counters, minion system), E (10 heroes one by one), F (squad select + unlock saving), G (72 items in groups), H (update test bot + ONE tuning pass).

## How the fight works now (so you do not break it)
- BattleState (no Phaser) is the rules; BattleScene draws events. Events: attackStart (attacker, target, hitInMs, approach), attackRetarget, attackCancel (reason), attack (result, basic flag), status, dot, proc, heal, death...
- A basic attack has a start and a hit (`hitDelay`, combat.json `attackTiming` per side: melee walk-over 600ms, swing 220ms, arrows 260ms). Melee fighters walk STRAIGHT to their target and STAY next to it (`engagedUid`, `foe`); enemies pick the NEAREST hero (`nearest()`, by lane) and keep it; ranged heroes pick random targets. Movement is constant speed with a hop per step (Character.chase). Projectiles aim at `center(view)` (where the target is NOW). The red focus circle follows the enemy. See CLAUDE.md "MELEE MOVEMENT".
- Statuses live in `statuses.json` (+ `statusDefs` passed to BattleState). Bleed/burn/poison stack with no limit (each stack its own timer); chill stacks, 5 = freeze; shock, fear, knockback, taunt, silence, weaken, armor break, curse, blind, mark all work (tests in dots / control / stat-debuffs). Only the Rogue's poison and Gambler's Dice use them in the game yet; heroes/items come in phases E/G.
- Skills: `skills: { attack, support }` per hero, skills.json has `kind`. The Archer's support is a PLACEHOLDER (Eagle Focus) until his redo. Hero stats still have a dormant `mana` field (nothing reads it).

## Tests and tuning
- `npm test` runs `scripts/tests/*.test.mjs` (18 files, all must pass before every commit). `node scripts/tests/sim.mjs skills rewards` = average death floor of a bot (now ~94: far too high, see below).
- KNOWN BALANCE DRIFT (leave until phase H): the bot went from ~28 (start of the update) to ~94 because of better late rarity odds, enemies attacking whoever is nearest, and stun/freeze cancelling attacks in flight. Tune in phase H (enemy `floorScaling`, `rarityOdds`, attack timings).
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
