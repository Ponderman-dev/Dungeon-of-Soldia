# Handoff: phase H (tuning). Newest notes first (START HERE), older sessions below.

Read `CLAUDE.md` first, then this file. Every item decision of this phase is in `docs/item-decisions.md`
(it overrides older item numbers in CLAUDE.md and docs/item-list.md).

## START HERE (session 11): SKILL LOOKS, demo page hero by hero. NEXT = Samurai (Bard in the demo, waiting for the user)
Demo page: https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (source docs/proposals/skill-fx/, build
`node docs/proposals/skill-fx/make.mjs <scratchpad>/soldia-skill-fx.html`, republish to the SAME url, omit capabilities).
User's notes: ArtifactData `list` collection `notes`, docs `look:<skillId>` = {verdict ok/change, text}.
WORKFLOW (user's rule): demo ONLY, one hero at a time; when EVERY hero is approved, build them all into the game in one go.
STATUS: approved = Knight, Rogue, Berserker, Cleric, Archer, Mage (all), bone_sacrifice. Waiting for the user's look: death_coil3
(round 2 hit; its note still says the round 1 CHANGE), Bard: discord, change_song:march, change_song:ballad (a song = a
variant row 'skill:variant', spec `song` -> c.song). Rotation spells are rows 'skill:SHORT' (`skillDef()` in demo.js). Spec tools added session 11: move `recoil`, `rain` (per-wave
jitter/shake/numbers), `text` (+ `self`), `hit.jitterPx/jitterMs/jitterAll/jitterStagger`, `squadShield`, `number2`/`number2At`, `charmed` (enemies turn
round (`flip`) and bump each other);
demo-only name colours NAME_COLORS (archer, mage, bard) in heroes.js until combat.json gets them. TODO:
Samurai, Alchemist (read each kit in skills.json first).
HOW TO ADD A HERO: recipes in docs/proposals/skill-fx/heroes.js (RECIPES, same format as src/systems/skillFx.js, +
CAST_MS_NEW) and a SPECS entry (now = today's game look; new = charge, recipe, move dash/leap/hop, hit shake/stop,
number/heal, ally/minions/squadTargets); a row in template.html's list + its hero prefix; check frames with
`check-frames.mjs` (contact sheet) and LOOK at it before publishing.
USER'S STYLE RULES (learned): calm, never interrupt the flow (no screen flash / speed lines over everything); REAL things,
never abstract geometric rings/squares/diamonds; skill name = CAPITALS floating over the hero (done in game); attack
skills want aggressive movement + a small shake; hits must be BRIGHT and BIG enough to read; beams short; enemies jitter
when hit hard. Hero colours: combat.json skillFx.name.heroColors.
IN THE GAME ALREADY: Knight + Rogue looks (Rogue's stronger enemy shake and Knight's 3x shield print are in the code but
the game page was not rebuilt after them). When building the rest: move recipes into skillFx.js, wire charge/dash/wave in
combat.json (+ new: leap slam/land point, tremble, ally/minion recipes), tests, build:page, republish the game.

## START HERE (session 10d): DEMO-ONLY mode, hero by hero (user: 'once all demo approved then we implement to the game')
Demo page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN: Knight (in game), Rogue (in game; user wants MORE enemy
shake on Multistrike: combat.json skillFx.wave.multistrike targetShake* raised, game page not rebuilt yet), Berserker
(demo only). New heroes go in `docs/proposals/skill-fx/heroes.js` (RECIPES in the game's skillFx.js format + SPECS =
how the demo plays NOW vs NEW: charge, move dash/leap/hop, hit shake/stop, waves). demo.js `specLook()` plays them.
Notes round 1 (read with ArtifactData list `notes`): OK = challenge, multistrike, smoke_bomb, blood_feast; CHANGE done =
defense_bash (shield print 3x, also in src/systems/skillFx.js), brawl_leap round 2 (c.land fixed spot, more energy: slam leap,
streaks, more cracks/rubble/dust, knockback) -> waiting for a re-check. Cleric demo added (ally = the hurt Knight near the enemies, spec `ally`), Necromancer added (spec `minions` = 2 skeletons, `squadTargets`). Notes round 2: OK = defense_bash, brawl_leap, bone_sacrifice (+ round 1 OKs); death_coil3 CHANGE done (bright big skull burst hit); holy_nova / sanctuary not marked yet. Order left: Archer, Mage, Bard, Samurai, Alchemist. When ALL are approved: move the recipes
into src/systems/skillFx.js (+ CAST_MS, skillFx.json, combat.json charge/dash/wave), tremble = new (needs a small
jitter in the scene), then build + test + republish the game.

## START HERE (session 10c): Knight + Rogue skill looks IN THE GAME
Rogue done in the game (docs/systems/effects.md 'ROGUE 3-BEAT'), then (user: 'where's the demo?') added to the demo page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (it plays the GAME's rogue recipes; notes in db `notes` `look:multistrike` / `look:smoke_bomb`). ALWAYS demo page FIRST for the next heroes, then build; tools for the next heroes: `skillFx.charge`
(wind-up look), `skillFx.dash` (aggressive dash + knockback/shake), `skillFx.wave` (per-hit look of a channel),
skillFx.json (cast/impact recipe). NEXT heroes (ideas): Berserker red splatter, Cleric gold light, Necro green smoke,
Archer, Mage (element colour), Bard, Samurai, Alchemist. Also done this session: item gain popup = icon + 8px name that
follow the hero (rewards.md), tap sound = Organic press (sound.md).

## START HERE (session 10b): Knight look + name style B are IN THE GAME
Done (session 9): skill name B (capitals, fixed size, over the hero, colour per hero: combat.json skillFx.name), the
Knight's calm 3-beat look (docs/systems/effects.md 'KNIGHT 3-BEAT'). NEXT: the other heroes' looks, 2-3 per session,
each with a demo page first (copy docs/proposals/skill-fx: add the hero's recipes, NOW vs NEW scenes, OK/CHANGE).
Watch: in the game enemies stand ABOVE the heroes, so the name over a melee hero can cover the enemy he hits for ~1s.

## START HERE (session 10): SKILL EFFECTS DEMO waiting for the user's picks
Demo page (session 9): https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (source `docs/proposals/skill-fx/`, see
docs/proposals/README.md). USER PICKED (session 9): name style B FLOATING NAME (no cut-in bar); the charge -> release -> impact sequence is good,
but impact was 'too super flashy, don't interrupt the flow' -> page v2 is the CALM version (no screen flash, no speed
lines, camera nudge 3%, hit-stop 80ms, small square ring + diamond r~16, 6 chips, floor mark fades in ~1s). Read any
later notes with ArtifactData `list` collection `notes` (`look:defense_bash`, `look:challenge` ok/change + text,
`general`). v3 (user: 'all cap the text', 'I don't understand the geometric effects'): name in CAPITALS; no abstract
squares/diamonds any more, every shape is a real thing: Bash = his shield's pixel print flashes on the enemy + chips +
dust as it skids back; Challenge = hop + dust, SHOUT sound waves, red '!', a blue shield pops up beside him (+30 DEF
text after the shout). NEXT: build name style B in
BattleScene.skillBurst (and drop the castStart name popText), then the Knight's 3-beat look in the game (recipes in
demo.js are in character pixels like skillFx.js: charge aura/particles, release flash/camera kick/speed lines/hit-stop,
impact square shockwaves/debris/floor mark), then 2-3 heroes per session with a showcase page each.

## START HERE (session 9): SKILL EFFECTS + SKILL NAME TEXT (user's answers are in)
User: skills 'still not visually powerful / eye catchy, not different enough from other visuals'; 'text messy and too stretchy'.
ANSWERS: the text = ONLY the SKILL NAMES (other popups are fine). Cut-in bar or floating name: user wants to SEE it first.
PLAN (agreed direction): 1) a small DEMO first (proposal page, like the puzzle/icon pages, review notes in db `notes`): the
Knight's two skills played on dummies with (A) a skill CUT-IN BAR (dark band slides across, skill icon from skillIcons.json +
name in the hero colour, no scaling) vs (B) a cleaner floating name (fixed pixel size, slide/fade, never scaled), AND the new
3-beat skill look on the Knight: CHARGE (aura + particles gather in the wind-up), RELEASE (colour flash, camera kick/zoom, speed
lines, longer hit-stop), IMPACT (2-3x bigger unique shape + a floor mark that lingers), hero colour/shape language (Knight
steel-blue square shockwaves; ideas: Berserker red splatter, Rogue cyan streaks, Cleric gold light columns, Necro green-purple
smoke). The Studio's shared effect stage (src/studio/fxStage.js) can drive the demo. 2) after the user picks: build the
name style in the game (BattleScene.skillBurst: today a 24px banner scaled 0.5->1 = the 'stretchy' look) and do the 3-beat
look hero by hero (2-3 per session), each with a showcase page for OK/CHANGE.
Code today: skill look = BattleScene.skillBurst() + playSkillFx() (src/systems/skillFx.js recipes, src/data/skillFx.json),
docs/systems/skills.md + effects.md.

## START HERE (session 8): SKILL ICONS proposal waiting for the user's notes
Screen review (session 7 list) is ALL DONE (steps 1-6, see below). User then asked for SKILL ICONS: a 16x16 pixel icon for
every hero skill (20) and passive (10) to replace the 2 letters on the fight buttons, and the skill book RECOLOURED per page
type (stat blue, Debuff purple, Heal green, Defense steel, Team teal, Tempo yellow, Risk red, Area orange, Self pink).
Review page: https://claude.ai/artifact/66p6zRjp6S78Gg9rAk6YSs (ArtifactData `list` collection `notes`; ids `icon:<skillId>`,
`icon:passive_<heroId>`, `book:<tag>`). Icons: `src/data/skillIcons.json`, drawn by `scripts/art/skill-icons.mjs` (pixel pen,
one recipe per icon: edit the recipe, re-run, rebuild the page with `node docs/proposals/skill-icons/make.mjs <out.html>`).
BUILT into the game (session 8, docs/systems/skills.md 'SKILL ICONS'): fight buttons, passive icon + tap tooltip, hero card,
book colours; the user's one note (Mage rotation border = next element) done. NEXT: ask the user what's next (ideas: hero balance
pass, drop odds, bosses rework).
USER'S NEXT ASK (session 8 end): skill effects 'still not visually powerful / eye catchy, skills not different enough' + 'text is
messy and too stretchy'. Proposed plan (waiting on 2 answers: which text exactly, and whether a skill CUT-IN BAR is wanted):
1 clean text: never scale pixel text (no 0.5->1 banner pop, no 1.5x damage-number pop; slide/fade, 8px grid sizes); skill name
  as a short cut-in band (icon + name, hero colour) instead of the floating banner. 2 every skill gets 3 beats in its hero's
  colour/shape language: CHARGE (aura + particles gather in the wind-up), RELEASE (colour flash, camera kick/zoom, speed lines,
  longer hit-stop), IMPACT (2-3x bigger unique shape + a floor mark that lingers). 3 a skill SHOWCASE review page (each skill
  looping on dummies, OK/CHANGE notes), 2-3 heroes per session; start with step 1 + the Knight as a sample.
Also new this session: TEST tools panel (gold 'TEST: tools' button), floorArt.js, room decorations (roomProps.json decor).

## START HERE (session 7): SCREEN REVIEW NOTES, working through them
The user marked the SCREEN REVIEW page https://claude.ai/artifact/UR98Jn7UBts1xrvEZw97qP (ArtifactData `list`,
collection `notes`; ids like `clip:reward-up`, `still:fight`, `sound:miss`). Page source + recorder:
`docs/proposals/screen-review/` (record.mjs, make.mjs; clips are NOT in git, re-record to republish).
Agreed order (user OK'd it): 1 reward layout, 2 quick dungeon fixes, 3 boss start, 4 defeat screen, 5 new art, 6 sounds.
DONE: step 1 (two-line "Floor N / cleared!" banner, big Give / Write-it-in button `BTN_H` 76, "Who gets it?" rows
show EVERY item icon on up to 3 lines then shrink, no "+N" (`drawIconGrid()`), book page icons x4 / x3, roomier
"Which skill?" rows). Step 2 (mimic room shows the treasure room's name + hint, elite name tag follows the elite,
puzzle tablet drawScale 8, squad slots 30px lower).
NEXT, still to do (user's words in quotes):
- 3 BOSS START: DONE (session 8): `bossRoar()` = roar sound, violent shake, white flash, action lines over the whole screen, huge ROAR!!; fight starts 2s after (combat.json `transition.bossIntro`).
- 4 DEFEAT: DONE (session 8): screen dims first, then SQUAD DEFEATED pops, then "The squad reached floor N, before <random line>" (names the enemy that landed the last blow; death events now carry `killer`), then a BACK button (no more auto-return). Data: src/data/defeat.json; `BattleScene.showDefeat()`.
- TEST TOOLS panel added (user asked): gold "TEST: tools" button = jump to any floor / pick its room / give any item / level up / heal (docs/systems/balance-tools.md).
- 5 ART: hero select door (DONE session 8: big entrance Door { big: true }) "very big door, like an entrance to a dungeon, very intimidating"; between floors (DONE session 8: stone arch + wooden door, black when open, rattle/swing/bounce/dust open animation) "the door
  opens should have better animation and the door open it should look black"; fight floor (DONE session 8: floorArt.js flagstones/dirt/grass/pillars, docs/systems/floors-rooms.md) "more natural looking floor,
  dirt and grass, an old dungeon, pillars on the wall"; fountain room (DONE session 8: decorateRoom, roomProps.json decor) "more decorations"; Skill Dealer room (DONE session 8) "shelves of
  book visuals, stack of books, a rug, other decorations; the merchant moves to the left just a bit (not to the edge)
  so the heroes go straight to the door without being blocked by anything".
- 6 SOUNDS: DONE session 8 (docs/systems/sound.md, waiting on the user's ears). (sound was ON HOLD; workflow in docs/systems/sound.md; sound sites blocked, GitHub CC0 packs worked):
  tap "more bubbly"; cardOpen "card slide"; rewardUp "card sliding" (the reward sheet transition too); rewardCard
  "card stacks"; miss "more fast whoosh"; shieldSoak "more glass break"; skillCast "more whoosh / magical cast, like the
  item proc sound"; flaskBreak "more glass break, this is not glass break". Ideas: skillCast = the itemProc file;
  glass = picked/hitIce "glass hit 02".
Browser checks: shot scripts in the scratchpad were throwaway; pattern = Playwright from scratchpad/pw, dev server run
from the scratchpad (see CLAUDE.md), `window.__game` + scene methods (e.g. `rw.showAssign()`, `sc.tapProp(...)`).

## START HERE (session 6): INTERFACE LOOK BUILT
User picked look D 'Classic RPG Window' + Press Start 2P; built on every screen (docs/systems/ui.md). NEXT: discuss
per-screen changes with the user: reward, battle, hero select, and THE PUZZLE (user was very excited about it).
PUZZLE: user wants the 1-8 slide puzzle GONE. Demo page with 6 playable ideas (Mimic Shuffle, Rune Lock, Light the
Braziers, Mirror Beam, Ice Slide, Picture Puzzle = swap pieces): https://claude.ai/artifact/HdFydkPMrAzb2W2um8mWrn.
DONE (session 6): user kept Mimic, Runes, Beam, Ice, Picture (not Braziers); all 5 built (docs/systems/floors-rooms.md).
Puzzles centred (user). NEXT: the user reviews every screen on the SCREEN REVIEW page
https://claude.ai/artifact/UR98Jn7UBts1xrvEZw97qP (84 items: layout, animations, sounds); read the notes with ArtifactData
`list` collection `notes` and work through the CHANGE ones, screen by screen.

## START HERE (session 6): INTERFACE STYLE
User: 'let's do interfaces', picked 'ONE LOOK FOR EVERYTHING' (a shared pixel-art UI style for all screens). Proposal page
https://claude.ai/artifact/PBDU3qq4XzyMV43ujcfUkC (source docs/proposals/ui-style/): looks A Torchlit Stone / B Old Parchment
/ C Arcane Night, fonts Pixelify Sans / Silkscreen / Jersey 10 / VT323 / Press Start 2P (all OFL: bundle the font file in
the game, no Google Fonts at runtime). Read the picks with ArtifactData `list` collection `picks`, then build it step by
step (shared UI kit first: colours + panel/button drawing in one module, then screen by screen). Today: squad + reward
use a smooth sans font with rounded cards, battle uses monospace, skill buttons show 2 letters (icons proposed).

## START HERE (session 6): HERO KITS v3, Alchemist + Bard + Archer + Mage + Knight + Berserker + Rogue + Samurai + Cleric + Necromancer done = ALL 10
DONE: Alchemist (Mad Bomber: poison-only flasks, thrown one by one, glass sound), Bard (Battle Hymn), Archer (Volley
Gunner, still LAST in review; user: 'leave her as is', will try her in game first), Mage (Elementalist), Knight (Iron Wall), Berserker (Brawler), Rogue (Combo Striker), Samurai (kept the wide Wind Cutter, user), Cleric (Holy Battle-Healer, 'Light' tone-down + fragile stats: mid-pack), Necromancer (Legion Master); details in docs/systems/heroes.md 'HERO KITS v3'.
NEXT: ask the user. Ideas: hero balance pass (Rogue now top ~31, Archer bottom ~23.5; overall mean floor fell
~29 -> ~27 after the Cleric nerfs), then the old agreed order: drop odds, bosses rework. CHECK `npm test` by its EXIT CODE (a test file
that crashes stops run-all without a FAIL line; that hid a broken test for 4 steps in session 6). A NEW skill id needs its cast effect in
src/data/skillFx.json (copy the old id's entry). Archer buff ideas if asked: volley every 3rd, volley arrows hit the target again
when alone (bosses), or give Steady Aim back.
New hero tests go in `scripts/tests/heroes-v3.test.mjs`; move that hero's old block out of heroes-v2.test.mjs.
Pattern: NEW skill ids for changed skills (e.g. `alch_barrage`) so the v1-fixture tests keep the old ones.
Check: `node scripts/tests/review.mjs 3 all` (~1 min) 'hero avg floor' line, before vs after.

## START HERE (session 5): build HERO KITS v3
NEXT JOB: build the new hero kits the user picked in `docs/hero-kits-v3.md` (all 10 decided, open questions
answered). One hero per step (kit + tests + review/dmgshare check + show the user), bottom four first:
Alchemist, Bard, Archer, Mage; 2-3 heroes per session. Old v2 hero tests (heroes-v2.test.mjs) get replaced.
Done in session 5: CLAUDE.md slimmed (notes in docs/systems/), round 5 sound picks applied, Moonlight +30%,
rare item buffs (docs/item-decisions.md 'Session 5'), dmgshare.mjs, item tests on a frozen fixture.

## START HERE (session 4): item looks + item damage buff
Latest branch: `ccr-a59eab7b-wefaf5` (everything pushed). Start a new session from it.

DONE (session 5, 2026-10-17): CLAUDE.md slimmed from ~93 KB to ~6 KB. The long per-feature notes moved
word for word into `docs/systems/*.md` (index in CLAUDE.md). Update those files, not CLAUDE.md, when a system changes.
Old note kept for history:
FIRST JOB NEXT SESSION (user: 'sessions are getting more expensive, need to solve that before continuing'):
CLAUDE.md is ~93 KB (~23k tokens) and is loaded into EVERY turn, so it is the main cost. Agreed direction (ask the
user before doing it): shrink CLAUDE.md to the essentials (about the user, rules, commands, preview urls, layout,
a 1-line pointer per system) and move the long per-feature notes into `docs/systems/*.md` (read only when that
system is worked on). Also: start fresh sessions per task instead of one long one.

Done in session 4 (after session 3 below):
- ITEM NOTES round 1 applied (the user's 12 notes on the item review page; see CLAUDE.md "ITEM NOTES round 1").
  Review page, Studio and game republished. The new-item-fx proposal page picks are NOT applied yet (its Flame
  Spirit / Soul Lantern / Ghastly Fire options are mostly replaced by the notes).
- EPIC + LEGENDARY DAMAGE BUFF (user: 'legendaries lack firepower', approved list, ~+40%): Flame Spirit 300 -> 500%,
  Moonlight hits 60 -> 85% (proc `hitMultiplier` in items.json), Excalibur tornado 0.6 -> 0.85, Grimoire 250 -> 350%,
  Frozen Thunderbolt 50 -> 70, Fire Heart nova 50 -> 70, Siege Cannon +80 -> +110% skills, Gambler's Dice crit dmg
  +50 -> +70, Bloodlust Mask +30 -> +42% attack speed; epics Static Crystal 300 -> 420%, Spirit Axe 35 -> 50%
  (`spiritAxeDamage` special), Spiked Aegis 80 -> 110, Thousand Cuts bleed 0.3 -> 0.42 + knives 60 -> 85, Shatter
  Hammer 60/10 -> 85/14, Magma Core 25 -> 35, Blood Chalice 20(+10) -> 28(+14), Exploiter 30 -> 42, Hunter's Sigil
  10 -> 14 (copies now counted from hero.items), Giantslayer 30 -> 42, Catalyst 15 -> 21, Ghastly 20 -> 28.
  Smart player 4/squad, same dice: mean 32.6 -> 32.9, median 30 -> 30, alive at 50: 9 -> 11%, Brood Mother win
  80 -> 87%, fights at floors 41-60 25-40% shorter. User: 'we can stick with this'.
- NOT buffed (no damage): defense/heal/minion/utility items. Commons and rares NOT looked at yet (user: 'start
  with epic and legendary'). Possible next: the same for rares/commons, and a per-item bench (itemruns.mjs).
- Then the old agreed order: hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds,
  bosses rework.

## Session 3: enemies and difficulty
Status: steps 1-4 DONE (ELITES and MONSTER HOUSE, see CLAUDE.md). User: keep elites as they are; Monster House 'good for now' (fodder mix 2/1.4/0.25, legendary 4%). Step 5 BATCH 1 done (Sapper, Shaman, Shieldbearer, Golem, Hound; see CLAUDE.md). BATCH 2 done too (Worm, Acolyte, Blink Imp, Banshee, Sentinel): the enemy plan (steps 1-5) is COMPLETE. Next (agreed order): hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds, bosses rework.

### Branch, preview, tools
- Latest branch: `ccr-a59eab7b-wefaf5` (session 3, elites; all pushed). A new session gets its own branch name from the
  system prompt: start it from `origin/ccr-a59eab7b-wefaf5` (it has everything), never from the old
  `claude/phase-h-tuning` (behind). CLAUDE.md's git line just says "the branch the session names".
- Game preview: https://claude.ai/artifact/XFmqyv3GvFfw5731nv6eqr (build:page + republish after each step).
- Session 3 late: user lowered meleeVsFlyingMissPercent 40 -> 15 (fights felt draggy). Bot check: fight length barely changed (it was not the main drag in the bot); floors 25-45: only-flying-left 5% of fight time, ONE enemy left 24%; tanky last enemies Orc Brute / Shieldbearer (~5.5s alone), Beetle (4.3s), Frost Wisp most often last (3.1s).
- ITEM REVIEW page (user: review the new items' look, a note box per item): https://claude.ai/artifact/S7cbuLJoStsdi5hpg2SBef (same url as the old icon page). Notes = ArtifactData `list` collection `notes`. Builder: docs/proposals/item-review/make-item-review.mjs.
- NEW ITEM EFFECTS proposal (user asked): https://claude.ai/artifact/FHrVb3J4nFuJjm1oYqyyqU, picks in db collection `picks` (see docs/proposals/README.md). Item review cards now also PLAY each item's fight effects (shared effect stage src/studio/fxStage.js; what each item shows: docs/proposals/item-review/item-fx-show.json).
- Monster House demo: https://claude.ai/artifact/4vMvwYLs9sUHr5KcxZ75aH (`npm run build:house-demo`, copy house-demo-page.html to the scratchpad as monster-house-demo.html, republish).
- Enemy proposal page (sprites + picks): https://claude.ai/artifact/AkX6DWTeCsYzU6oXb3QWFS
  (source `docs/proposals/enemy-proposal.src.html`, built by `node docs/proposals/make-enemy-page.mjs <src> <out>`).
- Difficulty check: `node scripts/tests/curve.mjs 3 smart` (~40s, all cores). Last result: median 34, mean 37,
  p90 59; walls at 16-20 (Grukk) and 36-40 (Brood Mother); a few runs still go 100-400.
- Browser checks: run vite from the SCRATCHPAD dir (it writes vite.log; the repo has a tracked vite.log, do not
  dirty it), dev-only `?floor=N` (start on floor N) and `?room=<kind>`; playwright script pattern in the
  scratchpad `crowd.mjs` (Squad > start Battle > wait for mode 'fighting' > screenshot).

### What the user decided (all of it)
- 2-10 enemies per floor, more deeper; FODDER that scale way lower; a random but DELICATE floor mix; difficulty
  must scale properly but endless runs stay possible.
- ELITES from FLOOR 10, rare at first (about 1 fight in 20 at 10, 1 in 3 by 40, ~60% at 60, 80% at 100+;
  a 2nd elite in a fight: 15% from 60, 35% at 100+; never on boss floors or in rooms).
- MONSTER HOUSE after floor 60: 5% chance per floor (about 1 in 20, sometimes 2 close together), never a boss floor
  or the one before; huge banner "IT'S A MONSTER HOUSE!", 11-15 enemies ALL AT ONCE; prize = an epic reward pool
  with a small legendary chance.
- Enemy page picks: ALL 14 new enemies KEEP; all 5 elemental powers KEEP; traits KEEP Vampiric, Shielded, Thorny,
  Splitting, Regenerating, Unstoppable, Explosive; DROP Hasted and Berserk. Elite rule + elite reward had no pick
  = build them as written on the page.

### Done
1. FLOOR DIRECTOR (CLAUDE.md "FLOOR DIRECTOR"): threat budget per floor, tiers fodder 0.4 / normal 1 / strong 2,
   shapes swarm/squad/heavy/mixed, swing, maxCount up to 10, enemy rows (`formation.js`), fodder scaling
   (combat.json `enemyTiers`), `bigFightEase` removed. Tests `director.test.mjs`.
2. NEW FODDER: Imp Swarmling 13+, Mushling 22+, Bone Rat 25+, Shade Wisp 35+ (`scripts/art/add-enemies.mjs <ids>`:
   sprite from `docs/proposals/enemy-designs.mjs`, rules in its RULES table, adds the roster entry).

3. ELITES (built, session 3): user picked normal + strong enemies only. Everything else as written on the page
   (see CLAUDE.md ELITES). Smart player 3/squad: with elites median 29, mean 31.8, p90 50, max 135; same code with
   elites off median 34, mean 37.1, p90 59, max 400. So elites cost ~5 floors and stop the 100-400 snowball runs
   (0% reach 100, was 2%). Brood Mother win rate 78% (was 87%). NOT tuned yet: ask the user if that is the wanted
   feel (knobs: director.elites chance points, combat.json elites multipliers / element chances).

4. MONSTER HOUSE (built, session 3; user after the demo: legendary 10% -> 4%, fodder weights 2/1.4/0.25 -> 1/1.6/0.4; with that only 38% of 74 real squads at floor 61 survive one (was ~90%), user to judge in the demo): as written in the user's plan (see CLAUDE.md MONSTER HOUSE). The 5% rolls
   on fight floors only (rooms are decided first). Smart player 3/squad: median 29, mean 31.7 (same as elites only);
   the Monster House killed 7 of the ~18 runs that got past floor 60 (3rd top killer). Not tuned.

### Step 3 ELITES spec (as approved, built)
- Which enemies can be elite is NOT decided: suggest normal + strong only (never bosses, boss helpers, objects;
  fodder probably not). Ask the user.
- Stats x2 health, x1.35 attack, +10 defense and resist; drawn 1 pixel size bigger (drawScale +1), a glow in its
  element colour, a small gold crown over its health bar; name like "Burning Vampiric Bandit"; x3 XP; after a
  fight with an elite ONE of the 3 reward cards goes up a rarity.
- ELEMENT (one): Burning = hits Burn, resists fire, weak ice; Frozen = Chill, resists ice, weak fire; Storm =
  Shock + every 4th hit jumps to a 2nd hero, resists electric, weak ice; Cursed = Curse + heals 10% of damage,
  resists dark, weak holy; Toxic = Poison + poison cloud on death, resists dark, weak fire. Its basic attack takes
  the element's damage type (poison = dark).
- TRAIT (one): Vampiric (heals 20% of damage dealt), Shielded (shield 30% max health, regrows after 6s unhit),
  Thorny (reflects 20% melee), Splitting (dies into 2 small non-elite copies at 25% health), Regenerating (2%/s),
  Unstoppable (control statuses half as long), Explosive (death burst of its element on nearby heroes).
- Suggested build: odds + picks in dungeons.json `director.elites`; the director marks ids (e.g. returns
  `{id, elite:{element, trait}}` or a parallel `ids.elites` list) so `spawnEnemies` can apply `makeElite()`;
  reuse existing pieces: onHit status specs, onDeath bursts (Puffshroom), shields (`shield` status), thorns,
  lifesteal, `statusDurationScale`, regen. Tests + smartbot (it must handle split spawns) + curve check.
- Then step 4 MONSTER HOUSE, step 5 the 10 new enemies (rules on the proposal page; some need new code:
  Shaman heal, Shieldbearer ally shield, Worm burrow, Acolyte raise, Golem enrage, Blink Imp teleport, Hound
  howl, Banshee silence wind-up, Sentinel adaptive resist; Sapper bomb on death).
- Later (agreed order): hero balance round 2 (Alchemist, Archer, Bard, Mage at the bottom), drop odds, bosses
  rework. Sound is ON HOLD (see below).

## How we work with this user (phase H)
- Item by item, 4 ideas each via the question tool; the user picks, often writes their own twist. Ask before design changes.
- User rule for stacking: every extra copy adds a real chunk, no ceiling that wastes copies.
- The user said "write code after we sorted all items": decide first, then build in one go, then test.
- After every change: `npm test`, a full-run check, commit, push, `npm run build:page`, republish.

## Done in the last session
- ALL 72 old items reviewed one by one and rebuilt (stacking rework). Shared engine pieces: `perExtra`, `chancePerExtra`
  (one roll whose chance grows), `falloffRatio` used to creep towards a limit, `stackEach` debuffs, `damagePerExtraPercent`,
  `jumpsPerExtra`, upkeep once per minion item. Round 2 fixed the weak defensive items (Shield Totem no recharge, Aid Kit =
  Triage, Martyr's Shield, Bandage Roll = bandage toss, Second Wind 80% below 20%), Siege Cannon +80% skill damage.
- 10 proposal items built (items 73-82) and 5 of the USER'S OWN items (Flame Spirit, Spirit Axe, Heart of the Beast,
  Moonlight Twinblade, Ghastly Fire). Phoenix Feather: 1s invulnerable + heal to 70%. Soul Lantern: legendary, once per
  run (`oncePerRun`, rewards `offered` Set), no limit. Now 87 items: 23 common, 26 rare, 23 epic, 15 legendary.
- New check tools:
  - `node scripts/tests/itemruns.mjs [runsPerSquad] [ids] [copies]`: full runs with the SAME dice, the front hero holds
    0/1/3/8 copies of an item; mean floor reached. Use it for any item change (defensive items too). Caveat: the front
    hero is always melee in its 4 squads and the bot only taps boss objects.
  - `node scripts/tests/nominions.mjs [runsPerSquad] [squads]`: every squad, runs with vs without summoning items.
    Result: summoning items add ~+1.6 floors, matter most for the Necromancer and the Brood Mother (86% vs 53% wins).
- `scripts/art/new-item-icons.mjs` draws the new item icons (rough; the user may polish them in the Studio).

## Open right now
1. Moonlight Twinblade is weak for a legendary (+1.5 / +2.0 floors). Proposed: 3 hits of 150% each. Waiting for the user.
2. Watch list: Aid Kit (Triage) is very strong for a common (+15 floors at 8 kits); Soul Lantern and Heart of the Beast
   are strong. A normal run in the bot reaches about floor 27-30.
3. docs/item-list.md is the OLD master list (72 items, old numbers); item-decisions.md is the current truth.

## Next (agreed order)
1. Hero balance: run `node scripts/tests/review.mjs 4 all` (~10 min), show strongest/weakest heroes and squads, then fix
   weak heroes with 4 ideas each.
2. Enemy growth / difficulty curve (how deep a normal run should go).
3. Drop odds (rarities, skill books, potion) with 87 items.
4. Bosses rework (user: "later"); Morthul can stall weak squads forever (enrage timer suggested, not decided).

## Session 2 (hero balance, round 1)
- Moonlight Twinblade 18% per copy (user: higher chance). Same-dice runs x12: 1 copy +0, 3 copies +8.5 floors.
- Review before (4 runs/squad): cleric 34.2, berserker 28.4, knight 27.5, rogue 27.2, samurai 24.9, mage 23.0,
  bard 22.7, necromancer 22.2, archer 21.8, alchemist 20.1 (mean floor 25.2).
- User picks: Alchemist = better Mystery Brew (3 flasks, heals go to the most hurt); Archer = easier Steady Aim
  (1.5s, pierce on every shot); Necromancer = faster raising only (5-6s, cap 5, 2 at start); Cleric left alone.
- Review after: cleric 36.2, rogue 32.2, berserker 31.0, knight 30.9, samurai 26.5, necromancer 25.3, mage 25.2,
  bard 24.3, archer 24.2, alchemist 23.0 (mean 27.9). The weak three rose but stay at the bottom.

## Session 2: special rooms (user's idea, built)
- From floor 4 about 1 floor in 4 is a room instead of a fight: Treasure (1-2 chests), Mimic (own room, fight, rare/epic
  prize), Rest Fountain (heal 50% + regen for the next 3 fights), Skill Dealer (1 of 5 pages), Puzzle (3x3 slide puzzle,
  no fail, Give up = nothing). Details in CLAUDE.md "SPECIAL ROOMS". User picked: random and counts as a floor; Mimic as
  its own room; puzzle 3x3 no fail; dealer free.
- Open: the balance bots don't play rooms yet (runs in the game are now a bit easier than the bot says: ~1 floor in 4
  has no fight and gives a reward). Room weights / chance not tuned. Prop art is rough (Studio can't edit props yet).

## Session 2 (later): UI, items, sounds
- Reward "Who gets it?" = hero rows (stat items show 'DEF 12 → 24', nothing else); all 87 item texts rewritten
  short + 'Per stack' line. Rooms: chests smaller and vanish, dealer steps aside, fountain at the side, puzzle easy.
- Fire Arrows = a real burning arrow; noPop (no icon pop / proc sound) for Fire Arrows, Quiver, Metronome and the
  8 debuff procs.
- SOUND = ON HOLD (user: KIV). Board round 5 has ~180 CC0 sounds from GitHub (add-packs.py). DONE session 5: Melee re-picked and round 5 picks applied. Was: the user must
  re-pick Melee hit (its saved pick 'T' came from the letter bug), then 'apply the sound picks'. Item pop sound is
  still the Fast magic spell (same as Holy hit).
- Next (agreed order): hero balance round 2 (Alchemist/Archer/Bard/Mage still bottom), enemy difficulty curve,
  drop odds, bosses. The balance bots still don't play special rooms.

## Session 2: difficulty curve (smart player)
- New tools: scripts/tests/smartbot.mjs (smart drafting player) + curve.mjs (all cores). Runs go to floor 400.
- Today (smart, 5/squad): median floor 31, mean 36; almost no deaths before 15, wall at 16-20 (Grukk), steady
  losses 21-40, squads past ~50 snowball.
- Tested: enemies +30% hp / +45% atk per 3 floors (instead of +35 / +52.5) = median 38 (user's target ~40), BUT
  strong squads never die (fights at floor 300 last 3.6s). User: DON'T change growth yet; instead add NEW ENEMIES
  and maybe ELITE enemies to keep deep floors interesting. Endless runs should stay possible.
- Enemy proposal page (10 new enemies + elites): https://claude.ai/artifact/AkX6DWTeCsYzU6oXb3QWFS (picks in START HERE).
- USER'S PLAN (after the page): 2-10 enemies per floor (more deeper), FODDER enemies that scale way lower, a
  random floor mix (true roguelike, but delicate), elites from floor 10 (rare at first), MONSTER HOUSE after
  floor 60 (5% per floor = about 1 in 20; "IT'S A MONSTER HOUSE!", 11-15 enemies ALL AT ONCE, prize = epic pool +
  small legendary chance). Fodder: Slime/Bat/Rat become fodder AND new fodder enemies.
- Build order: 1 floor director (DONE: budget, tiers, shapes, rows; see CLAUDE.md FLOOR DIRECTOR),
  2 new fodder enemies (DONE: Imp Swarmling, Mushling, Bone Rat, Shade Wisp), 3 elites (element + 1 random trait), 4 Monster House, 5 the 10 new enemies (after picks).
- User's picks on the enemy page: ALL 14 enemies KEEP (4 fodder + 10), all 5 elemental powers KEEP, traits KEEP
  Vampiric, Shielded, Thorny, Splitting, Regenerating, Unstoppable, Explosive; DROP Hasted and Berserk. Odds table
  kept, but elites start at FLOOR 10 (user's earlier answer). Elite rule/reward: no pick = build as written.
