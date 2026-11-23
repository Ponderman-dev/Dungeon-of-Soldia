# MUSIC BOARD ROUND 3 (session 52; user: 'too much tavern / atmospheric / slow; try video-gamey, arcadey RPG music like
# Castlevania, Risk of Rain 2'). Same page, db and file layout as round 2 (make-board2.py). Keeps every LOVE / MAYBE
# of rounds 1-2, drops the rest, adds 4 'gothic action' songs of ours (songs-real.js ROUND 3) + energetic free tracks.
# Usage: python3 make-board3.py <sources dir> <real songs dir> <out dir>
import sys, os, subprocess, json, base64, glob
SRC, REALDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
SP = 'superpowers-asset-packs/'; JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
KM_ = 'minstrel/assets/audio/'; AN_ = 'SomeTroglodyte_Additional-Music-Various/music/'
CC0 = ('CC0', 'free, no credit needed'); KM = ('CC BY', 'free, credit "Kevin MacLeod (incompetech.com)" in the game')
FM = ('CREDIT', 'free (filmmusic.io licence), credit the composer in the game')
# id, file, title, by, licence, screen, tag ('pick' = your round-1 love/maybe, 'r1' = round 1 unmarked, 'new'), description
XD, UN, CD = 'benesmartin_necromancers-mystery/audio/soundtrack/', 'AlexNisnevich_untrusted/music/', 'cxong_cdogs-sdl/music/'
XDL = ('CC BY-SA', 'free, credit "xDeviruchi" (CC BY-SA 4.0)'); BY = ('CC BY', 'free, credit the composer (CC BY)')
BYSA = ('CC BY-SA', 'free, credit the composer (CC BY-SA)'); FREEU = ('CREDIT', 'free to use (OpenGameArt), credit the composer')
FREE = [
  # ---- kept from rounds 1-2 (your LOVE / MAYBE) ----
  ('haven', AN_ + 'Haven - Ambient.ogg', 'Haven', 'Alexander Nakarada', FM, 'title', 'pick', 'Your LOVE (round 2).'),
  ('lord_land', KM_ + 'lord-of-the-land.ogg', 'Lord of the Land', 'Kevin MacLeod', KM, 'title', 'pick', 'Your LOVE (round 2).'),
  ('fjeld', AN_ + 'Fjeld - Ambient.ogg', 'Fjeld', 'Alexander Nakarada', FM, 'title', 'pick', 'Your MAYBE (round 2).'),
  ('mf4', SP + 'medieval-fantasy/music/theme-4.ogg', 'Medieval Fantasy: Theme 4', 'Pixel-boy', CC0, 'title', 'pick', 'Your MAYBE (round 2).'),
  ('rb12', SP + 'rpg-battle-system/music/theme-12.ogg', 'RPG Battle: Theme 12', 'Pixel-boy', CC0, 'squad', 'pick', 'Your LOVE (round 1).'),
  ('rb8', SP + 'rpg-battle-system/music/theme-8.ogg', 'RPG Battle: Theme 8', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE (round 1).'),
  ('rb10', SP + 'rpg-battle-system/music/theme-10.ogg', 'RPG Battle: Theme 10', 'Pixel-boy', CC0, 'battle', 'pick', 'Your MAYBE (round 1).'),
  ('crossing_chasm', KM_ + 'crossing-the-chasm.ogg', 'Crossing the Chasm', 'Kevin MacLeod', KM, 'battle', 'pick', 'Your MAYBE (round 2).'),
  ('rb14', SP + 'rpg-battle-system/music/theme-14.ogg', 'RPG Battle: Theme 14', 'Pixel-boy', CC0, 'boss', 'pick', 'Your MAYBE (round 1).'),
  ('unholy_knight', KM_ + 'unholy-knight.ogg', 'Unholy Knight', 'Kevin MacLeod', KM, 'boss', 'pick', 'Your MAYBE (round 2).'),
  # ---- NEW: energetic game music ----
  ('xd_title', XD + 'title.mp3', 'Title Theme', 'xDeviruchi', XDL, 'title', 'new', '8-bit fantasy RPG title theme: catchy, upbeat retro game sound.'),
  ('xd_journey', XD + 'journey.mp3', 'And The Journey Begins', 'xDeviruchi', XDL, 'squad', 'new', '8-bit fantasy RPG: setting off on an adventure, upbeat.'),
  ('skiff_search', UN + 'Eric_Skiff_-_06_-_Searching.mp3', 'Searching', 'Eric Skiff', BY, 'squad', 'new', 'Classic indie chiptune, steady and catchy.'),
  ('skiff_find', UN + 'Eric_Skiff_-_09_-_Come_and_Find_Me_-_B_mix.mp3', 'Come and Find Me', 'Eric Skiff', BY, 'squad', 'new', 'Classic indie chiptune, bouncy and bright.'),
  ('xd_battle', XD + 'battle.mp3', 'Prepare for Battle!', 'xDeviruchi', XDL, 'battle', 'new', '8-bit fantasy RPG battle theme: fast, very busy.'),
  ('xd_dungeon', XD + 'obsidiantower.mp3', 'Mysterious Dungeon', 'xDeviruchi', XDL, 'battle', 'new', '8-bit fantasy RPG dungeon theme: busy, a bit eerie.'),
  ('xd_explore', XD + 'exploring.mp3', 'Exploring The Unknown', 'xDeviruchi', XDL, 'battle', 'new', '8-bit fantasy RPG: adventurous, very busy.'),
  ('xd_icy', XD + 'mysteryforest.mp3', 'The Icy Cave', 'xDeviruchi', XDL, 'battle', 'new', '8-bit fantasy RPG cave theme: busy, cold feel.'),
  ('zander_fight', 'Selulox_BrotatoMagic/Assets/audio/music/Zander Noriega - Fight Them Until We Cant.mp3', 'Fight Them Until We Can\'t', 'Zander Noriega', BY, 'battle', 'new', 'Heavy game rock: loud, fast, very busy. The most "action game" here.'),
  ('zander_tension', 'jaaslen_IsometricMining/Audio/Music/Zander Noriega - Perpetual Tension.mp3', 'Perpetual Tension', 'Zander Noriega', BY, 'battle', 'new', 'Tense and steady, building pressure.'),
  ('zander_recon', 'ValyriaTear_ValyriaTear/data/music/the_recon_mission.ogg', 'The Recon Mission', 'Zander Noriega', BY, 'battle', 'new', 'Fast, busy action theme.'),
  ('hero_immortal', 'Gr1moire_Versus-Quest/assets/Music/Hero Immortal.mp3', 'Hero Immortal', 'Trevor Lentz', BYSA, 'battle', 'new', 'Heroic retro action, the closest here to a classic castle-crawler sound.'),
  ('battle_a', 'clear-code-projects_UltimateGodotIntro2D/resources/audio/battleThemeA.mp3', 'Battle Theme A', 'cynicmusic', CC0, 'battle', 'new', 'A popular indie battle loop: driving and catchy. CC0.'),
  ('accion', 'ValyriaTear_ValyriaTear/data/music/accion-OGA-djsaryon.ogg', 'Accion', 'djsaryon', BYSA, 'battle', 'new', 'Retro RPG battle tune, busy.'),
  ('red_doors', CD + 'game/red_doors2.ogg', 'Red Doors', 'Matthew Pablo', BY, 'battle', 'new', 'Intense action, very busy.'),
  ('tense_moment', CD + 'briefing/A Really Tense Moment FULL.ogg', 'A Really Tense Moment', 'ViRiX', BY, 'battle', 'new', 'Loud, tense action.'),
  ('xd_final', XD + 'finalbattle.mp3', 'Decisive Battle', 'xDeviruchi', XDL, 'boss', 'new', '8-bit fantasy RPG FINAL battle: fast and intense.'),
  ('zander_hellfire', 'rmanley_retro-3d-fps/music/Zander Noriega - Dragged Through Hellfire.ogg', 'Dragged Through Hellfire', 'Zander Noriega', BY, 'boss', 'new', 'Heavy metal boss fight: loud, fast, aggressive.'),
  ('ninth_circle', CD + 'end/The 9th Circle V2.ogg', 'The 9th Circle', 'Joth', CC0, 'boss', 'new', 'Dark and heavy, very busy. CC0.'),
  ('boss_loop', UN + 'Boss Loop 1.mp3', 'Boss Loop 1', 'Essa', FREEU, 'boss', 'new', 'A made-to-loop boss track: loud and busy.'),
  ('adversity', UN + 'Adversity.mp3', 'Adversity', 'Seropard', FREEU, 'boss', 'new', 'Loud and driving.'),
  ('epic_fall', CD + 'lose/Epic Fall.ogg', 'Epic Fall', 'Alexandr Zhelanov', BY, 'boss', 'new', 'Epic and dramatic, busy.'),
]
REAL = [('hearthfire', 'title', 'pick'), ('hearth_real', 'title', 'pick'), ('muster_real', 'squad', 'pick'), ('night_gate', 'squad', 'ours'),
        ('blood_moon_stair', 'battle', 'ours'), ('crimson_gallery', 'battle', 'ours'), ('bell_tower_duel', 'boss', 'ours')]
real_meta = json.loads(subprocess.run(['node', '-e', "import('./songs-real.js').then(m=>console.log(JSON.stringify(Object.fromEntries(Object.entries(m.REAL).map(([k,s])=>[k,{title:s.title,desc:s.desc}])))))"],
                                      cwd=HERE, capture_output=True, text=True, check=True).stdout)
def enc(src, dst, cap, stereo):
    af = 'loudnorm=I=-16:TP=-1.5:LRA=11'
    if cap: af += f',afade=t=out:st={cap - 3}:d=3'
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src] + (['-t', str(cap)] if cap else []) + ['-af', af, '-ar', '44100', '-ac', '2' if stereo else '1', '-b:a', '96k' if stereo else '56k', dst]
    if not os.path.exists(dst): subprocess.run(cmd, check=True)
opts = []
for sid, scr, rtag in REAL:
    enc(os.path.join(REALDIR, sid + '.mp3'), os.path.join(OUT, 'm', 'real_' + sid + '.mp3'), None, True)
    m = real_meta[sid]; opts.append({'id': 'real:' + sid, 'file': 'm/real_' + sid + '.mp3', 'screen': scr, 'tag': rtag, 'title': m['title'], 'desc': m['desc'],
                                     'by': 'Written by Claude, played on real instrument recordings', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
INTRO_OLD = '<p class="lede">Your NO songs are gone. New: <b>real-instrument songs</b> I wrote (lute, recorder, harp, strings, horns, choir, timpani: real recordings, no synth), and <b>41 new free tracks</b> by Kevin MacLeod and Alexander Nakarada, both famous for medieval / Nordic fantasy music. Your round-1 loves and maybes are still here (gold <b>YOUR PICK</b>). Tap <b>PLAY</b> (a song may take a second to load), then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
INTRO_NEW = '<p class="lede">Round 3: the GAME-MUSIC round. Every NO is gone; your LOVEs and MAYBEs from rounds 1-2 stay (gold <b>YOUR PICK</b>). New: <b>4 songs of mine in a dark, fast "gothic action" style</b> (harpsichord and church-organ riffs, rushing strings, a real rock drum kit) and <b>energetic free game tracks</b>: 8-bit fantasy RPG themes, heavy game rock, retro action. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = "const SCREENS = [\n  ['title', 'Title + Base camp', 'You already love Haven and Lord of the Land here. One new option: an 8-bit RPG title theme.'],\n  ['squad', 'Squad / hero select', 'You love Muster and RPG Theme 12. New: Night Gate (mine) and retro RPG / chiptune tracks.'],\n  ['battle', 'Battle floors', 'The main event this round: the song you hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: the biggest, fastest music.'],\n];"
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
