# Sound

sfx.js, cues, sound board and picks.
Moved out of CLAUDE.md (2026-10-17). Keep this file up to date when the system changes.

- `src/audio/sfx.js` (Web Audio, no Phaser): `sfx.play(cue)` plays a cue from `src/data/sounds.json` (cue -> file, volume, pitchJitter; `pack` = folder; `masterVolume`; `minGapMs`). Files are packed INTO the code with Vite `import.meta.glob(..., { query: '?inline' })` so the one-file preview page has them. Current pack: `src/assets/sounds/organic/` (uisfx 'organic', CC0, user's pick; licence in `src/assets/sounds/LICENSE-uisfx.txt`). Hooked: squad screen (tap, hero pick/back, card open/close, scroll, descend, unlock), reward sheet (up, each card, tap, item given, potion), battle (hero skill cast, interrupted, level up, floor cleared, defeat). A '♪ on/off' button on the squad screen (top right, under the test button) mutes; saved in progress `settings.muted`. A sound can never throw. Sound files are unpacked from their data: URLs with atob (`bytesOf()`), NEVER fetch(): the claude.ai preview frame blocks fetch, even of data: URLs (that made the game silent there).
- FIGHT SOUNDS (Kenney, CC0, user uploaded the packs; licence `src/assets/sounds/LICENSE-kenney.txt`): the chosen files are converted to small mono mp3 in `src/assets/sounds/kenney/` (a cue file name with a folder, `kenney/impactPunch_medium_000`, is read from that folder). A cue can list several `files` (a random take each time), a base `pitch`, `pitchJitter`, its own `minGapMs`; `maxVoices` 8 = most BUSY sounds at once (cues with their own minGapMs: hits, procs, steps); one-off cues (no minGapMs: floor clear, level up, rewards, boss roar) and `always: true` cues (every skill_* sound) always play (session 25, user: sounds went missing at high floors because busy fights filled all 8 slots). Hooked in BattleScene: a hit sound per damage type (`hitSound()`: hitMelee / hitRanged / hitFire / hitIce / hitElectric / hitDark / hitHoly) + crit, miss, block (also immune), shield soak / break, stun, freeze, enemy death, hero fall, minion summon, item proc (with the icon pop), boss intro (boss floor starts), boss wind-up warning, boss move, door opens on a win, footsteps on the door walks (`walkPath`), item given = coins. SOUND BOARD (round 2, user: 'too toyish, give 4-5 options each'): https://claude.ai/artifact/2pLgb918eNpVWUy2ePTSw8 = 5 options A-E per cue (A = game now; B-E layered / deeper / stone-room echo, built by `docs/proposals/sounds/make-options.py <kenney dir> <out>` with ffmpeg, peak-normalised), 'Try my own file' per cue and a MUSIC tester (local files, nothing uploaded; the user sends chosen files in chat), Kenney jingles, tips for the user's 7 GB GDC bundle. The user's PICKS are saved in the page's db (collection `picks`, doc = cue id, `{pick: 'A'..'E' | 'mine', file}`): read them with ArtifactData `list`, then copy the picked option mp3 into `src/assets/sounds/kenney/` and point the cue at it. Page built by `make-board.py <options dir> <jingles dir> <out.html>` from `board-template.html` (declares `db`). The USER'S OWN files (round 3: 23 Mixkit wavs from `sfx_1st.zip`; Mixkit free licence = OK in a game, no credit, but never ship them as a sound pack) are added as extra options F, G... (green letters) under the moments they fit by `add-yours.py <their files dir> <options dir>` (trim, length cap, fade, peak -1 dB; its MAP says which cues each file suits); it also adds rows for levelUp / potion / defeat (A = the Organic sound). Rebuild order: make-options.py, add-yours.py, make-board.py. APPLYING PICKS: `apply-picks.py <picks.json> <options dir>` copies each picked option to `src/assets/sounds/picked/<cue>.mp3` and points the cue at `picked/<cue>` (`source` = the option file; pitch is baked in). First picks applied (round 3): block E, bossIntro B, crit = Mixkit sword cutting flesh, enemyDeath = body falls in sand, heroFall = fall on gravel, hitDark = bass hit, hitElectric = spring metal hit, hitFire = wizard fire woosh, hitIce = warehouse metal hit, itemGiven = page chime, hitHoly = light spell, hitMelee = sword strikes armor, hitRanged C, itemProc = fast magic spell, miss A (unchanged), shieldSoak E, stun = boxing punch. Round 4 picks applied (2026-10-16): miss = Mixkit fall on gravel, hitHoly = fast magic spell (same file as itemProc), bossMove = bass hit, doorOpen E, step E, potion = potion drink, defeat = losing/failing; levelUp, shieldBreak, freeze, minionSummon, bossWarn stay A. The option files are NOT in the repo: to apply new picks, extract them from the board page (Artifact read, then decode its `DATA` + `BLOBS` into an options dir with options.json) and run apply-picks.py. ROUND 5 (user: 'need more sounds', sound sites are blocked here, GitHub works): `docs/proposals/sounds/add-packs.py <packs dir> <options dir>` adds ~180 free CC0 sounds from GitHub clones (lavenderdotpet/CC0-Public-Domain-Sounds, PanderMusubi/sound-effects-library-weapons; its MAP = glob, max seconds, cues) as green 'New: ...' options, plus new board rows: skillCast, interrupted, tap, rewardUp, rewardCard and the NEW game cues chestOpen, fountain, puzzleSlide, puzzleSolved (roomMethods.js / PuzzleScene; they start with the old sounds). Rebuild: extract the board's DATA/BLOBS/JINGLES (options.json + mp3s + jingles dir), add-packs.py, make-board.py; every option is renumbered in board order (A..Z, then AA, AB...), so re-running add-packs.py never gives two sounds the same letter (it once did: all new sounds of a moment shared one letter, picking one lit up all). Licence note: `src/assets/sounds/picked/LICENSE.txt`. Every card also has ALL MY SOUNDS: arrows flip through every one of the user's own sounds (`DATA.library`), Pick saves `{pick: 'lib', file}` (apply-picks.py takes that shape too). Test: `sounds.test.mjs` (every cue has its files, every cue the scenes play exists).
- ROUND 5 picks applied (2026-10-17): hitMelee = New: Slash (organic wooshes), hitRanged = New: Wood hit 03, hitIce = New: Glass hit 02, hitFire stays Wizard fire woosh. Melee re-pick done (the old 'T' letter-bug pick is gone).
- `flaskBreak` (2026-10-17, user asked): small glass break (Kenney impactGlass_heavy, pitch 1.6) when an Alchemist flask lands (`showFlask()` / `lobFlask()` in BattleScene).
- `bossRoar` (2026-10-18, screen review): CC0 `80-CC0-creature-sfx-2/roar_04.ogg` (lavenderdotpet pack) pitched to 0.75 with a stone-room echo (ffmpeg), plays when a boss floor starts (before the 2s wait).
- `gateSlam` (2026-10-18, user: 'a very THUMPP sound for the entrance door'): CC0 wood hit (bfh1_wood_hit_02, pitch 0.62) + a sub-bass boom + brown-noise rumble + stone echo, made with ffmpeg; played by `Door.slam()` for the big entrance only.
- SCREEN REVIEW sound notes applied (2026-10-18; CC0 files from the GitHub clones, trimmed / faded / peak -1 dB with ffmpeg, several takes per cue): tap = water bubbles ('more bubbly'), cardOpen = Kenney casino card slides, rewardUp = card shove ('card sliding'), rewardCard = card place ('card stacks'), miss = Organic Wooshes swishes at pitch 1.25 ('more fast whoosh'), shieldSoak = short glass breaks, skillCast = the itemProc file ('like the item proc sound'), flaskBreak = real glass breaking. Files `picked/<cue>_N.mp3`; sources in each cue's `source`.
- TAP changed back (2026-10-18, user: bubbly 'does not fit for general tap', it clashed with the card sounds on the reward sheet): tap = Organic `press`. If the user wants options, make a small sound board.
- ROUND 6 BOARD (2026-10-19, user: 'every skill sounds different' + 'a page 2 listing all 205 sounds, a drop-down beside each to choose what it is for'): same url. `add-skills.py <options dir>` adds a row per hero skill, cue `skill_<skillId>` (A = the shared skillCast sound, then 15 library sounds matched by words in their names, MAP in the script, taken in turn so each row is a mix); `make-board.py` puts them in a 'Hero skills' group from heroes.json/skills.json. PAGE 2 ('All sounds' tab) = the 205 library sounds (`DATA.library`), each with play, 'In the game now' (cues whose `source` is that file) and a drop-down of every moment; one sound can go to several moments and one moment can get several sounds (= random takes). Saved in db collection `assign` (doc id = the file name, `{file, cues: [...]}`); page 2 choices WIN over page-1 `picks`. Rebuild: extract the board (DATA/BLOBS/JINGLES -> options dir + options.json + jingles dir), add-skills.py, make-board.py. NOT in the game yet: applying needs a `skill_<id>` cue per skill in sounds.json, BattleScene playing it on cast (falling back to skillCast), and apply-picks.py taking `assign` (several files -> `files`).
- ROUND 7 BOARD (2026-10-19): the user's PIXABAY batch (`Soldia_New_Sound_Effect.zip`, 42 files = 40 + 2 duplicate '(1)' downloads) added by `add-pixabay.py <zip dir> <options dir>` (MAP by Pixabay id = name, max seconds, cues incl. `skill_<id>` rows; cleaned: silence cut, length cap, fade, mono 64k, peak -1 dB; trailing silence is cut on the REVERSED sound, ffmpeg stop_periods cut the guitar at its first gap). Board name `PIXABAY <name>` (user asked), file `pixabay_<title>-<id>.mp3`; the music loop has no moment (options.json `_library` = page 2 only). CREDITS: `docs/credits-sounds.md` (+ `docs/proposals/sounds/pixabay-credits.json`); Pixabay licence = free in a game, no credit needed, never ship the files as a pack. Rebuild order now: extract, add-skills.py, add-pixabay.py (needs the zip again), make-board.py.
- 'All my sounds' strip (2026-10-19, user: the arrows took too many clicks): now a drop-down of every library sound grouped Pixabay / Mixkit / free CC0; choosing one plays it, Pick saves it, the arrows and a ♫ replay button stay.
- Letter fix (2026-10-19): re-running add-pixabay.py lettered by count after removing its old options one by one, so two sounds shared a letter (Puzzle solved P+P, Tap M x3, two skill rows; picking one lit up both). Now it strips every pixabay_ option first, add-skills.py ignores pixabay_ files, and a page-1 pick also saves the option's `file` (apply-picks.py already prefers `file`), so a renumbered board can't mix sounds up.
- APPLIED (2026-10-19, round 6/7 picks): 41 picks from the board's db `picks` (doc `file` wins over the letter; skipped = A or already the game's sound) via apply-picks.py, which now also CREATES new cues (skill_<id>: skillCast's volume/jitter, minGapMs 120). EACH HERO SKILL HAS ITS OWN SOUND: the cast event carries `skillId` (BattleState.releaseSkill), BattleScene plays `skill_<id>` when sounds.json has it (`sfx.has()`), else the shared `skillCast`. 19 of 20 skills have one (Mystery Brew `alch_brew` not picked = shared sound; sounds.test.mjs prints it as INFO). Also changed: block, bossMove, enemyDeath, hitDark/Electric/Fire/Ice/Melee, interrupted, itemProc (retro click; skillCast no longer shares its file), minionSummon, miss, rewardCard, rewardUp, shieldBreak, shieldSoak, skillCast, step, tap (PIXABAY Button), and the room cues chestOpen / puzzleSolved (PIXABAY Game bonus), fountain (bubble). Old picked/miss|rewardCard|tap_1-3 + shieldSoak_1-2 deleted (unused). Page-2 `assign` was empty. Music loop NOT in the game (no music system yet).
- heroDeath (2026-10-20): a low bell toll when a hero falls (kenney impactBell_heavy_001, pitch 0.6, volume 0.9), on top of heroFall.
- ROUND 8 BOARD (2026-10-20, user: put the death bell and the Begin descent sound on the board): `add-rows.py <saved board.html> <out.html> <work dir>` adds rows STRAIGHT INTO the saved board page (no full extract/rebuild; db picks untouched): Fighters > Hero death knell (`heroDeath`: A = game now, B-E bell/gong variations made with ffmpeg, then board sounds: gongs, bells, Videogame death, Game over, Losing, Low monster roar) and a new Squad screen group: `descend` (the BEGIN DESCENT tap, Organic start now) and `gateSlam` (the entrance door bursting open right after). make-board.py GROUPS has the rows too (a full rebuild needs their options in options.json: extract them from the board). Apply picks as usual (apply-picks.py).
- 2026-10-20 (user asked): Mystery Brew (`skill_alch_brew`) has its own sound = a rising bubbly pop (3 pops of the bubble file at pitch 1.0 / 1.3 / 1.7, made with ffmpeg); the fountain went back to its old sound (`picked/potion`, the potion drink); the old `picked/fountain.mp3` bubble was removed (the brew is made from it).
- 2026-10-21 (user: title/camp were silent): TAP TO START and TO DUNGEON play `tap`; the camp's walk-in and walk-out play `step` on each landing (BaseScene.walkPath); every 'Coming soon' window (uiKit `comingSoonWindow`: NPCs, profile, settings) plays `cardOpen` / `cardClose`.
- ROUND 9 BOARD (2026-10-21, user: 'update the menu sounds and opening menu on the soundboard'): `add-menus.py <saved board.html> <out.html> <work dir>` edits the saved board in place (db picks untouched): Menus option A of tap / rewardUp / rewardCard re-made from the game's CURRENT files, and new Menus rows cardOpen ('Menu window opens': hero cards, camp NPCs, Profile, Settings), cardClose, heroPick, heroBack, scroll (A = now, B-E ffmpeg variations, then UI sounds already on the board). Apply picks as usual (apply-picks.py).
- ROUND 9 picks applied (2026-10-21): tap = New: Select 002 (Kenney interface), cardOpen = New: Page turn 2, cardClose = New: Cardplace1, scroll = New: Page turn 1, descend (BEGIN DESCENT) = New: Gong 01; heroPick / heroBack stay. Old picked/cardOpen_1-3 deleted. The old fountain pick in the db is NOT applied (the user moved the fountain back to the potion sound on 2026-10-20).
- Page-2 picks applied (2026-10-21, db `assign`): tap = 3 random takes (picked/tap_1-3: New: Door 05, PIXABAY Button, Yours: Retro click), skill_alch_barrage (Flask Barrage) = New: Glass breaking 06, descend (BEGIN DESCENT) = PIXABAY Appear magic (replaces the gong). Applied by hand (apply-picks.py still takes page-1 picks only).
- TAP = ONE sound again (2026-10-21, user picked on the review page: remove take 1 Door 05 and take 3 Retro click): tap = PIXABAY Button only (`picked/tap.mp3`, was tap_2); tap_1 / tap_3 deleted.
- hitHoly = THUMP + SPARKLE (session 39, user: the Cleric's attack sound must change; the bell chime 'doesn't feel good', 4 batches of options sent as mp3 files, user picked S): a soft low thump + a faint high sparkle, made with ffmpeg (aevalsrc), 0.4s; same cue for every holy hit.
- ROUND 10 BOARD (session 40, user: 'put the Cleric's attack sound and skill sound on the sound board'): a CLERIC group
  at the top: hitHoly, skill_holy_nova, skill_sanctuary and a NEW moment `grace` (her Grace heal + bless motion every
  7s; NO cue in sounds.json yet, so the game plays nothing there). `add-cleric.py` makes the new options with ffmpeg
  (peak -1 dB, mean <= -19 dB like the game files) into `docs/proposals/sounds/round10/` (kept in the repo: apply the
  picks from there) and `round10/cleric-rows.js`, which is pasted into the live page right before
  `// ---------- audio` (the board is 4.4 MB: the Artifact tool's `read` with `path: index.html` saves it to a file).
  At runtime it moves those rows out of Hits / Hero skills into the Cleric group, sets A to the game's CURRENT sound
  (`cleric_now_<cue>.mp3`), keeps the old options (same letters, saved picks stay right) and adds the NEW ones after.
  Applying a pick of a NEW option: copy `round10/<file>` to `src/assets/sounds/picked/<cue>.mp3`; for `grace` also add
  the cue (volume 0.3, minGapMs 120) and play it in BattleScene where `e.grace` calls `ch.bless()`.
- Picks applied (session 40, board db `picks`): chestOpen = New: RPG lock 03 (`new_80-cc0-rpg-sfx-lock-03`),
  puzzleSlide = New: RPG stones 01 (was the Organic `press`); files taken from the saved board's BLOBS. No Cleric
  picks yet (hitHoly / holy_nova / sanctuary picks in the db are the old, already-applied ones; `grace` has none).
- REMOVED (session 40, user: 'remove the pixabay dramatic music loop entirely'): `PIXABAY Dramatic music loop`
  (291244) is gone from the board (page 2 library, every 'All my sounds' drop-down, its blob), from add-pixabay.py's
  MAP and from both credit lists. It was never in the game.
- CLERIC picks applied (session 40, round 10 board): hitHoly = New: RPG spell 02 (`new_80-cc0-rpg-sfx-spell-02`,
  replaces session 39's thump + sparkle); NEW cue `grace` = Yours: Fast magic game spell (volume 0.3, minGapMs 120),
  played by BattleScene when Grace heals (with `ch.bless()`). Holy Nova / Sanctuary not re-picked (unchanged).
  Page-2 `assign` fountain = potion drink = already the game's sound.
- UNUSED FILES REMOVED (session 51): 31 sound files no cue used (146 KB) were deleted (git history has them); `sounds.test.mjs` now fails if a packed file is not used by a cue. To try an old sound again, restore it from git (`git log --diff-filter=D --name-only -- src/assets/sounds`).

## MUSIC (sessions 52-53; NOT in the game yet)
- No music system in the game yet; Settings already has a MUSIC bar (`settings.json` `music`, 0-10) waiting for it.
- MUSIC BOARD = the reused Skill Effects page https://claude.ai/artifact/NySVH2UUozwNNSYuky9xBN (CLAUDE.md: reuse it).
  4 screens: title + camp, squad, battle, boss. Each = 2 CODE SONGS + free CC0 tracks. The user marks each LOVE /
  MAYBE / NO + a note per screen; saved in the page's db, collection `music` (doc id = option key with ':' -> '_',
  `{key: 'code:<songId>' | 'free:<id>', verdict, screen, title}`; notes `note_<screen>` / `note_general` `{key, text}`).
- CODE SONGS: `docs/proposals/music/synth.js` = a tiny Web Audio music engine (no files: pad, choir, pluck, bell,
  lead, bass, drums; stone-room reverb; schedules bars ahead with a 50ms timer; `renderAll()` for offline checks).
  `songs.js` = the songs as DATA (bpm, sections of chords + parts: chord / arp / bass / mel / drums, order).
  Ember Gate + Hearth (title/camp), Muster + Roll Call (squad), Descent + Steel and Stone (battle), The Brood +
  The Twentieth Floor (boss). Loops are 26-56s; the battle ones (~28s) may need more sections if picked.
- FREE TRACKS (CC0, free in a game, no credit needed): Superpowers asset packs by Pixel-boy / Sparklin Labs
  (github sparklinlabs/superpowers-asset-packs: medieval-fantasy, rpg-battle-system, ninja-adventure music) and
  Juhani Junkala's Retro Game Music Pack (copy in github skillmoph/academe-play-assets). Not in the repo: clone
  them (`git clone --depth 1 --filter=blob:none --no-checkout` + checkout the music folders). Their board text is a
  GUESS from measuring loudness / busyness / brightness / key (I cannot listen).
- Rebuild: `python3 docs/proposals/music/make-board.py <sources dir> <out.html>` (mp3 mono 48k packed in, ~12 MB).
- NEXT: read the db picks, then build the real music system (`src/audio/music.js`: code songs via synth.js and/or
  looping files; crossfade between screens; MUSIC volume from settings; respect mute) and hook the scenes.
- ROUND 1 PICKS (db `music`): LOVE squad = RPG Battle Theme 12, battle = RPG Battle Theme 8; MAYBE Ember Gate (code),
  RPG 10 (battle), RPG 14 (boss); 23 NO incl. 7 of 8 synth code songs. User: 'code songs feel cyber, not western RPG,
  find another sound bank'; title: 'slow music with a lute, like Skyrim'.
- ROUND 2 BOARD (same url, same db; `make-board2.py <sources> <real mp3 dir> <out dir>` + `board2-template.html`):
  NOs removed. Audio is NOT packed in any more: each song is a FILE beside the page (`m/<id>.mp3`, published with the
  Artifact `files` list, played by one looping `<audio>`; free previews capped 120s, loudnorm -16 LUFS, mono 56k).
  REAL-INSTRUMENT SONGS ('OUR SONG'): `songs-real.js` (Hearthfire = slow lute/recorder 3/4, Road to the Gate = folk
  jig, Iron Stair = orchestral battle, Crown of Bones = choir/brass boss; + Ember Gate / Hearth / Muster re-played),
  rendered by `render-real.py <samples dir> <songId> <out.mp3>` (node `export-events.mjs` gives the notes; numpy plays
  them on recorded samples, hall reverb, seamless loop, prints each instrument's share of the mix). Samples: VCSL
  (sgossner/VCSL, CC0: strumstick = lute, folk harp, alto recorder, frame drum) + Sonatina Symphonic Orchestra
  (peastman/sso, CC Sampling Plus 1.0: strings, horns, trombones, choir, flute, harp, percussion). Rendered music
  made with them is ours to ship.
  NEW FREE TRACKS (credit needed, not CC0): Kevin MacLeod (CC BY 4.0; github Sayshal/minstrel-packs-music-01) and
  Alexander Nakarada / Rafael Krux / KM on the filmmusic.io licence (github SomeTroglodyte/Additional-Music-Various,
  its credits.md). If any is picked: add a credits screen line + `docs/credits-music.md`.
- ROUND 2 PICKS (db `music`): LOVE title = Haven + Lord of the Land (free, CREDIT), squad = Muster (real
  instruments, ours); MAYBE title = Fjeld, Hearthfire (ours), Hearth (real, ours), Medieval Fantasy Theme 4; battle =
  Crossing the Chasm; boss = Unholy Knight. Everything else NO (incl. Suonatore, Iron Stair, Crown of Bones).
  Still kept from round 1: squad RPG 12 (love), battle RPG 8 (love) / RPG 10 (maybe), boss RPG 14 (maybe).
  User (general note): 'remove every NO, more options; too much tavern / atmospheric / slow. Try video-gamey,
  arcadey RPG music like Castlevania, Risk of Rain 2'. NEXT = round 3 in that direction (energetic, driving,
  melodic; our own songs only INSPIRED by that style, never copies).
- ROUND 3 BOARD (same url/db; `make-board3.py <sources> <real mp3 dir> <out dir>`, reuses board2-template.html with
  round-3 texts): keeps every round 1-2 LOVE/MAYBE, drops the rest. OURS: 4 'gothic action' songs in songs-real.js
  (Blood Moon Stair + Crimson Gallery = battle, Bell Tower Duel = boss, Night Gate = squad): harpsichord / organ
  (SSO, organ files named by MIDI number) + tubular bells + VCSL rock kit (rkick / rsnare / rhat / rohat / rcrash).
  NEW FREE (energetic, all CREDIT unless CC0): xDeviruchi 8-Bit Fantasy & Adventure pack (CC BY-SA 4.0; github
  benesmartin/necromancers-mystery audio/soundtrack), Zander Noriega (CC BY; Selulox/BrotatoMagic, rmanley/retro-3d-fps,
  jaaslen/IsometricMining, ValyriaTear), Trevor Lentz 'Hero Immortal' (CC BY-SA; Gr1moire/Versus-Quest), cynicmusic
  'battleThemeA' (CC0), djsaryon 'Accion' (CC BY-SA), Eric Skiff + Essa + Seropard (AlexNisnevich/untrusted
  music/tracks.txt), Matthew Pablo / ViRiX / Joth (CC0) / Zhelanov (cxong/cdogs-sdl music/*.txt). Before shipping any
  pick: re-check its exact licence page and add the credit line. CC BY-SA: an edited (trimmed/looped) file must stay
  CC BY-SA.
- ROUND 3 PICKS -> STANDING LIST after 3 rounds (db `music`, latest verdict wins):
  TITLE: LOVE Haven, Lord of the Land, xDeviruchi Title Theme; MAYBE Hearthfire (ours).
  SQUAD: LOVE Muster (ours, real), RPG Battle 12, Eric Skiff 'Come and Find Me'; MAYBE Night Gate (ours).
  BATTLE: LOVE RPG Battle 8; MAYBE RPG 10, Crossing the Chasm, cynicmusic Battle Theme A, Hero Immortal,
  xDeviruchi Exploring The Unknown; Crimson Gallery (ours) UNMARKED. BOSS: MAYBE RPG 14, Unholy Knight,
  xDeviruchi Decisive Battle, Bell Tower Duel (ours). All else NO.
  User notes: 'remove every NO, more options; simpler music, add 16-BIT music; more ZELDA-ish, less gothic';
  battle: 'no slow-start songs'; boss: 'too many cyberpunk aesthetics'; title / squad: 'more new options'.
  Pattern: the loves lean RETRO (Pixel-boy RPG pack, xDeviruchi, Eric Skiff chiptune). ROUND 4 IDEA: our own
  16-bit (SNES-like) adventure songs: bright heroic major / mixolydian tunes, march snare, harp, flute, brass,
  rendered with the real samples then made 16-bit (32 kHz, lowpass, light bit-crush); every battle song starts
  at full energy on beat 1; + more retro / 16-bit free tracks (no synthwave / cyber).
- ROUND 4 BOARD (same url/db; `make-board4.py <sources> <real mp3 dir> <out dir>`; the real dir = render-real.py
  output with the round-4 songs replaced by their 16-bit versions, see the script header). OURS: 5 '16-bit adventure'
  songs (songs-real.js ROUND 4: Hero's Dawn = title, Into the Wilds = squad march, Sword and Spark + Moss Cavern Clash
  = battle, Guardian of the Deep = boss; new 'glock' instrument = SSO glockenspiel; MARCH / FIGHT drum helpers; every
  battle/boss song is full energy on beat 1). NEW FREE: SuperTux Advance music folder (github
  KelvinShadewing/supertux-advance res/mus + docs/CREDITS.md: SubspaceAudio, Trex0n, jkfite01, bart, Spring, Snabisch,
  Hitctrl, migfus20, Joth; most licences NOT in the credits file = confirm on OpenGameArt before shipping), Eric Skiff
  (DAKSie/Synk), more xDeviruchi (home, minigame, epilogue) and the Pixel-boy themes not shown before. All fight
  tracks were checked for slow starts (first 4s within 4 dB of the whole song).
- AFTER ROUND 4 (user): 'too cheery and relaxed, town / big-open-land vibes'. The user will now FIND THEIR OWN music
  (I gave them a guide: OpenGameArt, itch.io free packs, Pixabay Music, FreePD, Free Music Archive; licence rules:
  CC0 / CC BY / CC BY-SA / Pixabay OK, NonCommercial (NC) and NoDerivatives (ND) NOT OK for a paid store game).
  They send the files (zip in chat) with the screen each is for; then: put them on the board (make-board4.py pattern,
  tag 'yours') or straight into the game. Round 4 picks were not marked on the board.
- ROUND 5 BOARD (same url/db; `make-board5.py`; user: 'more code music only, more bass and treble'): 6 new songs
  (songs-real.js ROUND 5: Ember Watch = title, Lair Gate = squad, Deepdelve / Rattling Bones / Torchlight Run =
  battle, Warden of Chains = boss) + REMASTERS of the liked code songs (Hearthfire, Muster, Night Gate, Crimson
  Gallery, Bell Tower Duel). render-real.py: inst option `sub` (a sine under the note, folded into 40-110 Hz), new
  samples 'basses' (SSO string basses sus), 'xylo', drum 'wood'. Every song is mastered with make-board5.py MASTER
  (bass +6 dB @80 Hz, treble +5 dB @6 kHz, gentle compressor, limiter -1 dB). Measured: bass share up from ~-7.5 to
  -2..-4.5 dB, treble share from ~-28 to -12..-16 dB of the mix.
- ROUND 4 PICKS (marked late): free LOVE RPG 14 (boss); MAYBE Castle (boss), Ninja Adventure 6 (title), RPG 2 (squad);
  code MAYBE Hero's Dawn; everything else of round 4 NO (incl. Haven, Lord of the Land, Come and Find Me, Crimson
  Gallery, Bell Tower Duel, Night Gate). Still LOVE from before: xD Title Theme, RPG 12, RPG 8, Muster. Round 5 unmarked.
- ROUND 6 BOARD (same url/db; `make-board6.py`; user: '16-bit again, ditch gothic + dark, Risk-of-Rain energy but
  dungeon crawler / general RPG, at least 4 per category'): CODE ONLY, 17 new songs from a SONG BUILDER in
  songs-real.js (`build6(spec)`, list `ROUND6`): a spec = chords A/B, bpm, two lead instruments, a melody MOTIF per
  section (rhythm + chord-tone contour); `genMel` sequences it over the chords (bars 2/6 reversed, 5-6 lifted, cadences
  on bars 4 and 8) and the screen style lays out the parts (title: harp + pad + sub drone; squad: harp / arp + groove;
  battle: syncopated 3-3-2 bass + string and xylo/glock arps + rock kit with 16th hats; boss: + trombones, timpani,
  double-time kick). No organ / harpsichord / choir. Fight leads x1.35. Post: 16-bit chain + MASTER (render6 chain in
  the make-board6 header). Kept: Muster, Hero's Dawn, Hearthfire.
- ROUND 7 BOARD (same url/db; `make-board7.py`; user: 'what about my loves / maybes? real instruments too trebly,
  too much reverb, back to CHIPTUNE'): shows every CURRENT love/maybe (free: xD Title Theme, RPG 12, RPG 8, RPG 14
  LOVE; NA 6, RPG 2, RPG 10, Castle, Unholy Knight MAYBE; code: Muster LOVE, Hero's Dawn + Hearthfire MAYBE, as they
  were) + CHIPTUNE versions (ids 'chip:<songId>') of all 17 round-6 songs and the 3 liked code songs.
  `chip-render.py <songId> <out.mp3>`: plays any songs-real.js song as chiptune (numpy): leads = polyBLEP pulse 50% /
  25% with delayed vibrato, plucked parts = short 12.5% pulse, bass = NES-style 16-step triangle (a second bass line
  quieter), pads dropped, the glock 'dbl' doubling dropped, drums = triangle-sweep kick, noise snare / hats / crash.
  NO reverb, lowpass 7 kHz, limiter. Balance matched to the user's LOVED tracks (measured: tune 300-3k Hz about
  -1.5..-3 dB, bass < 150 Hz -6..-9 dB, treble > 5 kHz about -19 dB; boss songs a bit heavier).
- ROUND 7 RESULT = FINAL LOVES (db `music`, 2026-11-24): title = xDeviruchi 'Title Theme' (CC BY-SA 4.0, credit) +
  Ninja Adventure Theme 6 (Pixel-boy, CC0); squad = RPG Battle Theme 12; battle = RPG Battle Theme 8 + Theme 10;
  boss = RPG Battle Theme 14 (all Pixel-boy superpowers-asset-packs, CC0). Every code song (chip + real) was NO.
  The board page now shows only these 6 ('your loves'). NEXT (fresh session): the in-game music player
  (src/audio/music.js: loop per screen, crossfade, MUSIC volume from settings, mute), files from the sources above.
- ROUND 8 BOARD (same url/db; `make-board8.py`; user: 'copy how my loved songs sound'). ANALYSIS of the 6 loves
  (spectrograms + numbers): they are 16-BIT CONSOLE (SNES-like) music, NOT chiptune: dense (14-38 partial peaks per
  frame vs our chip 9-11), top cut ~8-10 kHz, stereo width -9..-15 dB (our chip ~-22 = near mono; our real ~-4 = too
  wide), sustained (pads), warm 200-700 Hz middle, short echo, no hall. Fix: `STYLE=snes python3 render-real.py ...`
  (every sample resampled to 16 kHz, 0.9 s small room instead of the 2.6 s hall) + a soft pad in EVERY build6 style +
  POST chain (make-board8.py `POST`: +4 dB @420 Hz, -3 dB @55 Hz, console echo 120/240 ms, lowpass 8 kHz, limiter).
  Result measured inside the loves' range on every number. Ids 'snes:<songId>'; board = 6 loves + 17 songs.
- ROUND 9 (session 53; user: 'rearrange my songs into a soundtrack + more xDeviruchi'). No zip came, so 'my songs' =
  the 6 loves. MIXES by `make-mixes.py <sources> <out>`: each = intro (once) + loop body; pieces cut on BAR LINES
  (every Pixel-boy file is an exact bar count starting on beat 1: rb8 28 bars @130 bpm, rb10 36 @140, rb12 10 @80,
  rb14 8 @85, na6 30 @83.3), 20 ms equal-power crossfades, other songs level-matched, tempo / key via ffmpeg
  `rubberband`. Mixes: camp_loop (NA6 minus its fading last 6 bars), camp_night (that, 12% slower, softer top),
  squad_medley (RPG 12 + NA6 bars 8-24 slowed to 80 bpm; same key family), battle8_energy (RPG 8 minus bars 0-3
  and the quiet break 12-15), battle_suite (that at 140 bpm + all of RPG 10 = 96 s loop), boss_rising (RPG 14 x2,
  then x2 +1 semitone +6%), boss_rage (+2 semitones +10%: boss below half HP idea); title = xDeviruchi's OWN
  'Title Theme (Loop).wav' (8-bit pack separated files, e.g. github Krinowa/gameHub_assignment). Stings: victory =
  xD16 Victory! first 10 s (its loop starts at 8.5 s) with fade, defeat = Never Give Up, rest = Peaceful Night.
  Seam check (scratch tool): cuts inside one song measure like the song's own phrase changes; the medley song
  changes are bigger (flagged on the board). Tools to find structure: tempo / bar grid, phrase similarity, loop finder
  (numpy, kept in the scratchpad; easy to rewrite).
  NEW SOURCE: xDeviruchi '16-bit Fantasy & Adventure (2025)', 22 SNES-style songs (copies in github
  The-Rogues/RoguesProject common/music/placeholder/... and XabierMatute/AssetsSurvivors, with its
  'DOCUMENTATION & LICENSE.pdf'). LICENCE (own, not CC): commercial games OK, modify / remix OK, credit
  'Original music by Marllon Silva (xDeviruchi)' (+ link to their YouTube when possible); NOT allowed: redistributing
  the originals or minor edits as music (no OST / sound pack), claiming authorship. 'Loopable' oggs = intro + one loop
  body (loop start / length in the PDF table and in LOOPSTART / LOOPLENGTH tags); one-shots: 01, 02, 15, 18, 20.
  Victory! (06) and Never Give Up (18, 8 s) and Peaceful Night (15, 11 s) suit stings.
  BOARD 9 (same url/db; `make-board9.py <sources> <mixes> <out>`): screens title / camp / squad / battle / boss /
  sting; tags pick (loves), mix (blue MIX badge), new (xD16); ids free:*, mix:*, x16:NN. Previews: intro + loop x2.
- ROUND 9 picks so far: LOVE mix battle8_energy + battle_suite. User: 'more parts / variations, longer, more exciting
  in places, like a Pokemon battle song'. ROUND 9b mixes (make-mixes.py, last arg = only these ids): piece mods
  'sweep' (high-pass glide = BUILD-UP, bass returns at the end), 'roll' (last bar's beats 3-4 become 8th / 16th
  repeats = drum FILL), pitch ST**2 = KEY-UP climax; level match by whole-file loudness; peak safety -1 dB.
  battle_suite_long (116 s loop: RPG 8 A / A' / fill, RPG 10, build-up, RPG 8 +2 st climax + fill, RPG 10 ending),
  battle8_long (67 s), battle10_long (82 s). On the board as 'NEW: ...' MIX cards (preview cap 250 s).
- ROUND 9c: user: the transitions in the long mixes 'felt like a GLITCH'. Cause = the 'roll' drum fill (chopped
  repeats): removed from every mix (the mod stays in the code, unused). Rule now: only cut where the music already
  went that way (original order, or a loop seam the user loved); song changes only at the seams of the loved
  battle_suite. New lengths: battle_suite_long 130 s (A, all of RPG 10 with a build-up on its last 4 bars, A +2 st),
  battle8_long 74 s, battle10_long 123 s (RPG 10, then all of it +2 st). BOARD TIMELINE: a seek bar in the sticky
  bar + every 'm:ss' in a card's text is a jump button (make-board9.py; songs load as blobs so seeking works).
- ROUND 9d: user: the RPG 8 -> RPG 10 cut (suite_long 0:41) is 'too jarring, sudden drop of theme, how to blend?'.
  Beats DO line up (checked: both files start on the beat; rubberband adds no delay), so the jar is musical. make-mixes.py
  now takes ('~', bars, mode) between two pieces = a LONG BLEND: both pieces get the song's own extra music before /
  after ('pre' / 'post'), overlapped with an equal-power crossfade; mode 'filter' = old song low-passed 9k -> 250 Hz,
  new song high-passed 1.5k -> 30 Hz (DJ style). Board screen 'blend' = 5 test clips (tr_cut, tr_blend2, tr_blend4,
  tr_filter4, tr_bridge = RPG 8's quiet break then a 2-bar blend); the user's pick goes into every song change.
