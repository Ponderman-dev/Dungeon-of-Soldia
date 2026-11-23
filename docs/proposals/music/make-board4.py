# MUSIC BOARD ROUND 4 (session 52; user: 'simpler, add 16-BIT music, more ZELDA-ish, less gothic; battle: no slow
# starts; boss: not cyber; more options for title + squad'). Same page / db / files as rounds 2-3. Keeps every LOVE / MAYBE
# (+ unmarked Crimson Gallery), drops the NOs, adds 5 16-bit adventure songs of ours (songs-real.js ROUND 4, rendered by
# render-real.py then made 16-bit: ffmpeg 'aresample=20000:filter_size=4,aresample=32000,aecho=0.85:0.6:110:0.22')
# and retro / chiptune free tracks. Usage: python3 make-board4.py <sources dir> <real songs dir> <out dir>
import sys, os, subprocess, json, base64, glob
SRC, REALDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
SP = 'superpowers-asset-packs/'; JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
KM_ = 'minstrel/assets/audio/'; AN_ = 'SomeTroglodyte_Additional-Music-Various/music/'
CC0 = ('CC0', 'free, no credit needed'); KM = ('CC BY', 'free, credit "Kevin MacLeod (incompetech.com)" in the game')
FM = ('CREDIT', 'free (filmmusic.io licence), credit the composer in the game')
# id, file, title, by, licence, screen, tag ('pick' = your round-1 love/maybe, 'r1' = round 1 unmarked, 'new'), description
XD, UN, CD = 'benesmartin_necromancers-mystery/audio/soundtrack/', 'AlexNisnevich_untrusted/music/', 'cxong_cdogs-sdl/music/'
ST = 'KelvinShadewing_supertux-advance/res/mus/'; RB = SP + 'rpg-battle-system/music/'; NA = SP + 'ninja-adventure/musics/'
XDL = ('CC BY-SA', 'free, credit "xDeviruchi" (CC BY-SA 4.0)'); BY = ('CC BY', 'free, credit the composer (CC BY)')
BYSA = ('CC BY-SA', 'free, credit the composer (CC BY-SA)'); OGA = ('CREDIT', 'free on OpenGameArt; exact licence to confirm before shipping')
FREE = [
  # ---- kept (your LOVE / MAYBE so far) ----
  ('haven', AN_ + 'Haven - Ambient.ogg', 'Haven', 'Alexander Nakarada', FM, 'title', 'pick', 'Your LOVE.'),
  ('lord_land', KM_ + 'lord-of-the-land.ogg', 'Lord of the Land', 'Kevin MacLeod', KM, 'title', 'pick', 'Your LOVE.'),
  ('xd_title', XD + 'title.mp3', 'Title Theme', 'xDeviruchi', XDL, 'title', 'pick', 'Your LOVE.'),
  ('rb12', RB + 'theme-12.ogg', 'RPG Battle: Theme 12', 'Pixel-boy', CC0, 'squad', 'pick', 'Your LOVE.'),
  ('skiff_find', UN + 'Eric_Skiff_-_09_-_Come_and_Find_Me_-_B_mix.mp3', 'Come and Find Me', 'Eric Skiff', BY, 'squad', 'pick', 'Your LOVE.'),
  ('rb8', RB + 'theme-8.ogg', 'RPG Battle: Theme 8', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE.'),
  ('rb10', RB + 'theme-10.ogg', 'RPG Battle: Theme 10', 'Pixel-boy', CC0, 'battle', 'pick', 'Your MAYBE.'),
  ('crossing_chasm', KM_ + 'crossing-the-chasm.ogg', 'Crossing the Chasm', 'Kevin MacLeod', KM, 'battle', 'pick', 'Your MAYBE.'),
  ('battle_a', 'clear-code-projects_UltimateGodotIntro2D/resources/audio/battleThemeA.mp3', 'Battle Theme A', 'cynicmusic', CC0, 'battle', 'pick', 'Your MAYBE.'),
  ('hero_immortal', 'Gr1moire_Versus-Quest/assets/Music/Hero Immortal.mp3', 'Hero Immortal', 'Trevor Lentz', BYSA, 'battle', 'pick', 'Your MAYBE.'),
  ('xd_explore', XD + 'exploring.mp3', 'Exploring The Unknown', 'xDeviruchi', XDL, 'battle', 'pick', 'Your MAYBE.'),
  ('rb14', RB + 'theme-14.ogg', 'RPG Battle: Theme 14', 'Pixel-boy', CC0, 'boss', 'pick', 'Your MAYBE.'),
  ('unholy_knight', KM_ + 'unholy-knight.ogg', 'Unholy Knight', 'Kevin MacLeod', KM, 'boss', 'pick', 'Your MAYBE.'),
  ('xd_final', XD + 'finalbattle.mp3', 'Decisive Battle', 'xDeviruchi', XDL, 'boss', 'pick', 'Your MAYBE.'),
  # ---- NEW: retro / 16-bit / chiptune ----
  ('overworld', ST + 'overworld.ogg', 'Peace At Last (Overworld)', 'Trex0n', OGA, 'title', 'new', 'A calm retro overworld theme. Gentle start.'),
  ('peaceful_village', ST + 'peaceful-village.ogg', 'Peaceful Village', 'jkfite01', OGA, 'title', 'new', 'A slow, sweet retro village tune: camp feeling.'),
  ('xd_home', XD + 'home.mp3', 'Take Some Rest and Eat Some Food!', 'xDeviruchi', XDL, 'title', 'new', 'Same pack as your loved Title Theme: the cosy home / inn tune.'),
  ('xd_epilogue', XD + 'epilogue.mp3', 'The Final of The Fantasy', 'xDeviruchi', XDL, 'title', 'new', 'Same pack: the calmer, emotional ending theme.'),
  ('na1', NA + 'theme-1.ogg', 'Ninja Adventure: Theme 1', 'Pixel-boy', CC0, 'title', 'new', 'Bright and cheerful adventure, same artist as your loved RPG themes.'),
  ('na6', NA + 'theme-6.ogg', 'Ninja Adventure: Theme 6', 'Pixel-boy', CC0, 'title', 'new', 'Bright, busy, happy adventure.'),
  ('sa_grass', ST + 'sa-grasslands.ogg', 'Grasslands', 'SubspaceAudio', OGA, 'squad', 'new', 'Retro chiptune, upbeat and catchy.'),
  ('sa_island', ST + 'sa-island.ogg', 'Island', 'SubspaceAudio', OGA, 'squad', 'new', 'Retro chiptune, sunny and bouncy.'),
  ('sa_prairie', ST + 'sa-prairie.ogg', 'Prairie', 'SubspaceAudio', OGA, 'squad', 'new', 'Retro chiptune, adventurous.'),
  ('airship2', ST + 'airship-2.ogg', 'Airship Song (short)', 'bart', OGA, 'squad', 'new', 'Retro adventure, setting off by air.'),
  ('skiff_under', 'DAKSie_Synk/Assets/music/songs/Eric Skiff - Underclocked.mp3', 'Underclocked', 'Eric Skiff', BY, 'squad', 'new', 'Same artist as your loved Come and Find Me: catchy chiptune.'),
  ('xd_minigame', XD + 'minigame.mp3', 'Minigame', 'xDeviruchi', XDL, 'squad', 'new', 'Same pack as your loved Title Theme: playful and quick.'),
  ('rb2', RB + 'theme-2.ogg', 'RPG Battle: Theme 2', 'Pixel-boy', CC0, 'squad', 'new', 'Same pack as your loves, not shown before. Busy, bright.'),
  ('rb3', RB + 'theme-3.ogg', 'RPG Battle: Theme 3', 'Pixel-boy', CC0, 'squad', 'new', 'Same pack as your loves, not shown before. Medium pace, major key.'),
  ('na3', NA + 'theme-3.ogg', 'Ninja Adventure: Theme 3', 'Pixel-boy', CC0, 'squad', 'new', 'Bright, upbeat and loud.'),
  ('sa_adventure', ST + 'sa-adventure.ogg', 'Adventure', 'SubspaceAudio', OGA, 'battle', 'new', 'Retro chiptune action, very busy, full energy from the start.'),
  ('forest_top', ST + 'forest-top.ogg', 'Forest Top', 'Spring', BYSA, 'battle', 'new', 'Fast, bright retro adventure.'),
  ('snab_forest', ST + 'snab-forest.ogg', 'In The Forest', 'Snabisch', OGA, 'battle', 'new', 'Busy retro forest action.'),
  ('skiff_dizzy', 'DAKSie_Synk/Assets/music/songs/Eric Skiff - A Night Of Dizzy Spells.mp3', 'A Night Of Dizzy Spells', 'Eric Skiff', BY, 'battle', 'new', 'Fast, catchy chiptune.'),
  ('airship', ST + 'airship.ogg', 'Airship Song', 'bart', OGA, 'battle', 'new', 'Retro adventure, busy and catchy.'),
  ('close_yet', ST + 'RPG_Close_Yet_So_Far.ogg', 'Close Yet So Far', 'Hitctrl', OGA, 'battle', 'new', 'A retro RPG theme, steady and heroic.'),
  ('rb7', RB + 'theme-7.ogg', 'RPG Battle: Theme 7', 'Pixel-boy', CC0, 'battle', 'new', 'Same pack as your loved Theme 8, not shown before: the busiest of the pack.'),
  ('black_diamond', ST + 'blackdiamond.ogg', 'Black Diamond', 'Joth', CC0, 'battle', 'new', 'Busy chiptune action. CC0.'),
  ('boss_theme', ST + 'boss.ogg', 'Boss Theme', 'migfus20', OGA, 'boss', 'new', 'A retro boss loop: very busy, no slow start.'),
  ('castle', ST + 'castle.ogg', 'Castle', 'SuperTux Advance', OGA, 'boss', 'new', 'A retro castle theme, medium pace, long.'),
  ('sa_mines', ST + 'sa-mines.ogg', 'Mines', 'SubspaceAudio', OGA, 'boss', 'new', 'Retro chiptune, driving and tense.'),
  ('retro23', ST + 'retro-23.ogg', 'Retro 23', 'SubspaceAudio', OGA, 'boss', 'new', 'The loudest and busiest chiptune here.'),
]
REAL = [('hearthfire', 'title', 'pick'), ('heros_dawn', 'title', 'ours'), ('muster_real', 'squad', 'pick'), ('night_gate', 'squad', 'pick'),
        ('into_the_wilds', 'squad', 'ours'), ('crimson_gallery', 'battle', 'pick'), ('sword_and_spark', 'battle', 'ours'), ('moss_cavern', 'battle', 'ours'),
        ('bell_tower_duel', 'boss', 'pick'), ('guardian_deep', 'boss', 'ours')]
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
INTRO_NEW = '<p class="lede">Round 4: the 16-BIT ADVENTURE round. Every NO is gone; your LOVEs and MAYBEs stay (gold <b>YOUR PICK</b>). New: <b>5 songs of mine in a bright, Zelda-like 16-bit adventure style</b> (harp, flute, trumpets, glockenspiel, march snare, given a 16-bit console sound) and <b>retro / chiptune free tracks</b>, many from the same artists as your loves. Battle and boss songs all start at full energy. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = 'const SCREENS = [\n  [\'title\', \'Title + Base camp\', "New: Hero\'s Dawn (mine), retro overworld and village tunes, and more from xDeviruchi (your loved Title Theme)."],\n  [\'squad\', \'Squad / hero select\', \'New: Into the Wilds (mine, a march) and many upbeat retro tracks.\'],\n  [\'battle\', \'Battle floors\', \'Heard the MOST. Every new one starts at full energy. Loving 2-3 lets the game rotate them.\'],\n  [\'boss\', \'Boss fights\', \'New: Guardian of the Deep (mine, big but not cyber) and retro boss themes.\'],\n];'
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
