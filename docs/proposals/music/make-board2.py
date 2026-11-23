# MUSIC BOARD ROUND 2 (session 52; user: 'remove every NO, more options, the code songs feel cyber, want western RPG,
# a slow lute song like Skyrim for the title'). Same page + db collection `music` as round 1 (make-board.py; ids
# 'free:<id>' / 'real:<songId>'; round-1 verdicts stay). Audio is NOT packed in: each song is a file beside the page
# (m/<id>.mp3, previews capped at 120s, loudness-levelled) so the phone loads only what it plays.
# Usage: python3 make-board2.py <sources dir> <real songs dir (render-real.py mp3s)> <out dir>  -> <out dir>/index.html + m/
import sys, os, subprocess, json, base64, glob
SRC, REALDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
SP = 'superpowers-asset-packs/'; JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
KM_ = 'minstrel/assets/audio/'; AN_ = 'SomeTroglodyte_Additional-Music-Various/music/'
CC0 = ('CC0', 'free, no credit needed'); KM = ('CC BY', 'free, credit "Kevin MacLeod (incompetech.com)" in the game')
FM = ('CREDIT', 'free (filmmusic.io licence), credit the composer in the game')
# id, file, title, by, licence, screen, tag ('pick' = your round-1 love/maybe, 'r1' = round 1 unmarked, 'new'), description
FREE = [
  # ---- title + camp ----
  ('suonatore', AN_ + 'Suonatore di Liuto - Ambient.ogg', 'Suonatore di Liuto', 'Kevin MacLeod', FM, 'title', 'new', 'A solo LUTE, slow and gentle, old Renaissance style. The closest to your "lute" wish. (A very quiet recording, made louder here.)'),
  ('teller', KM_ + 'teller-of-the-tales.ogg', 'Teller of the Tales', 'Kevin MacLeod', KM, 'title', 'new', 'Very calm and slow, soft and warm. A storyteller by the fire.'),
  ('northern_path', AN_ + 'The Northern Path - Ambient.ogg', 'The Northern Path', 'Alexander Nakarada', FM, 'title', 'new', 'Nordic folk (Skyrim-like world), medium pace, minor key, full sound.'),
  ('fjeld', AN_ + 'Fjeld - Ambient.ogg', 'Fjeld', 'Alexander Nakarada', FM, 'title', 'new', 'Nordic mountains: calm to medium, minor key.'),
  ('landskab', AN_ + 'Landskab - Ambient.ogg', 'Landskab', 'Alexander Nakarada', FM, 'title', 'new', 'Nordic landscape, medium pace, brighter, major key.'),
  ('efter_storm', AN_ + 'Efter Storm - Ambient.ogg', 'Efter Storm', 'Alexander Nakarada', FM, 'title', 'new', 'Nordic "after the storm": medium pace, hopeful, major key.'),
  ('daudir', AN_ + 'Daudir - Ambient.ogg', 'Daudir', 'Alexander Nakarada', FM, 'title', 'new', 'Dark Nordic, medium pace, minor key, big and full.'),
  ('lord_land', KM_ + 'lord-of-the-land.ogg', 'Lord of the Land', 'Kevin MacLeod', KM, 'title', 'new', 'Slow, dignified medieval, quiet, minor key. A king\'s hall.'),
  ('achaidh', KM_ + 'achaidh-cheide.ogg', 'Achaidh Cheide', 'Kevin MacLeod', KM, 'title', 'new', 'Celtic, medium pace, minor key. Hills and old roads.'),
  ('magic_forest', KM_ + 'magic-forest.ogg', 'Magic Forest', 'Kevin MacLeod', KM, 'title', 'new', 'Slow and mystical, quiet, minor key.'),
  ('enchanted_valley', KM_ + 'enchanted-valley.ogg', 'Enchanted Valley', 'Kevin MacLeod', KM, 'title', 'new', 'Slow, soft and dreamy, major key.'),
  ('greenlands', AN_ + 'Greenlands - Ambient.ogg', 'Greenlands', 'Alexander Nakarada', FM, 'title', 'new', 'Calm, warm low sound, major key. Peaceful camp.'),
  ('haven', AN_ + 'Haven - Ambient.ogg', 'Haven', 'Alexander Nakarada', FM, 'title', 'new', 'Calm to medium, warm, major key. A safe place.'),
  ('night_mystery', AN_ + 'Night of Mystery - Ambient.ogg', 'Night of Mystery', 'Alexander Nakarada', FM, 'title', 'new', 'Slow and mysterious, minor key, warm low sound.'),
  ('mf2', SP + 'medieval-fantasy/music/theme-2.ogg', 'Medieval Fantasy: Theme 2', 'Pixel-boy', CC0, 'title', 'r1', 'Very soft and quiet, calm, gentle major key.'),
  ('mf4', SP + 'medieval-fantasy/music/theme-4.ogg', 'Medieval Fantasy: Theme 4', 'Pixel-boy', CC0, 'title', 'r1', 'Slow, dark (minor key), warm low sound. Short loop (27s).'),
  ('na15', SP + 'ninja-adventure/musics/theme-15.ogg', 'Ninja Adventure: Theme 15', 'Pixel-boy', CC0, 'title', 'r1', 'Calm, a bit sad (minor key).'),
  ('na5', SP + 'ninja-adventure/musics/theme-5.ogg', 'Ninja Adventure: Theme 5', 'Pixel-boy', CC0, 'title', 'r1', 'Calm, minor key, thoughtful.'),
  ('na12', SP + 'ninja-adventure/musics/theme-12.ogg', 'Ninja Adventure: Theme 12', 'Pixel-boy', CC0, 'title', 'r1', 'Calm, soft, warm, major key.'),
  ('na18', SP + 'ninja-adventure/musics/theme-18.ogg', 'Ninja Adventure: Theme 18', 'Pixel-boy', CC0, 'title', 'r1', 'Quiet and gentle, major key.'),
  ('jjend', JJ + 'Ending.wav', 'Retro Pack: Ending', 'Juhani Junkala', CC0, 'title', 'r1', 'Retro chiptune, slow and calm.'),
  ('jjtitle', JJ + 'Title Screen.wav', 'Retro Pack: Title Screen', 'Juhani Junkala', CC0, 'title', 'r1', 'Retro chiptune jingle, very short (11s).'),
  # ---- squad ----
  ('rb12', SP + 'rpg-battle-system/music/theme-12.ogg', 'RPG Battle: Theme 12', 'Pixel-boy', CC0, 'squad', 'pick', 'Your LOVE from round 1 (option H).'),
  ('master_feast', AN_ + 'Master of the Feast - Ambient.ogg', 'Master of the Feast', 'Kevin MacLeod', FM, 'squad', 'new', 'A lively medieval feast: busy, bright, major key.'),
  ('minstrel_guild', KM_ + 'minstrel-guild.ogg', 'Minstrel Guild', 'Kevin MacLeod', KM, 'squad', 'new', 'Medieval minstrels: medium pace, cheerful, major key.'),
  ('folk_round', KM_ + 'folk-round.ogg', 'Folk Round', 'Kevin MacLeod', KM, 'squad', 'new', 'A folk dance, medium pace, minor key, light.'),
  ('fiddles', KM_ + 'fiddles-mcginty.ogg', 'Fiddles McGinty', 'Kevin MacLeod', KM, 'squad', 'new', 'A fast Irish fiddle tune, loud and happy.'),
  ('angevin', KM_ + 'angevin.ogg', 'Angevin', 'Kevin MacLeod', KM, 'squad', 'new', 'An old Renaissance piece, slow to medium, minor key, warm.'),
  ('tavern_brawl', AN_ + 'Tavern Brawl - Ambient.ogg', 'Tavern Brawl', 'Alexander Nakarada & Kevin MacLeod', FM, 'squad', 'new', 'A tavern song, busy, minor key.'),
  ('celtic_impulse', KM_ + 'celtic-impulse.ogg', 'Celtic Impulse', 'Kevin MacLeod', KM, 'squad', 'new', 'Celtic, medium pace, minor key.'),
  ('call_adventure', AN_ + 'Call to Adventure - Ambient.ogg', 'Call to Adventure', 'Kevin MacLeod', FM, 'squad', 'new', 'Setting off: busy, bright, major key.'),
  ('tam_lin', AN_ + 'Tam Lin - Ambient.ogg', 'Tam Lin', 'Alexander Nakarada', FM, 'squad', 'new', 'A folk ballad, medium pace, minor key, warm.'),
  # ---- battle ----
  ('rb8', SP + 'rpg-battle-system/music/theme-8.ogg', 'RPG Battle: Theme 8', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE from round 1.'),
  ('rb10', SP + 'rpg-battle-system/music/theme-10.ogg', 'RPG Battle: Theme 10', 'Pixel-boy', CC0, 'battle', 'pick', 'Your MAYBE from round 1.'),
  ('heroic_age', KM_ + 'heroic-age.ogg', 'Heroic Age', 'Kevin MacLeod', KM, 'battle', 'new', 'Epic orchestral fight, busy, major key.'),
  ('crossing_chasm', KM_ + 'crossing-the-chasm.ogg', 'Crossing the Chasm', 'Kevin MacLeod', KM, 'battle', 'new', 'Tense orchestral action, busy, minor key.'),
  ('horsemen', AN_ + 'Horsemen Approach - Ambient.ogg', 'Horsemen Approach', 'Alexander Nakarada & Kevin MacLeod', FM, 'battle', 'new', 'Nordic war, heavy and steady, minor key.'),
  ('cold_battle', AN_ + 'The Cold Battle - Ambient.ogg', 'The Cold Battle', 'Alexander Nakarada', FM, 'battle', 'new', 'A battle, medium pace, full sound.'),
  ('unforgettable', AN_ + 'Unforgettable Journey - Ambient.ogg', 'Unforgettable Journey', 'Alexander Nakarada', FM, 'battle', 'new', 'Epic adventure, busy, minor key, loud.'),
  ('the_descent', KM_ + 'the-descent.ogg', 'The Descent', 'Kevin MacLeod', KM, 'battle', 'new', 'Going down into dwarven depths: medium pace, warm low sound.'),
  ('fantasy_motion', AN_ + 'Fantasy Motion - Ambient.ogg', 'Fantasy Motion', 'Alexander Nakarada', FM, 'battle', 'new', 'Fantasy, MADE TO LOOP, medium pace, warm and low.'),
  ('killers', KM_ + 'killers.ogg', 'Killers', 'Kevin MacLeod', KM, 'battle', 'new', 'Busy and driving, bright. May sound a bit modern.'),
  ('dark_times', KM_ + 'dark-times.ogg', 'Dark Times', 'Kevin MacLeod', KM, 'battle', 'new', 'Slow, dark and quiet: a creepy floor rather than a hot fight.'),
  # ---- boss ----
  ('rb14', SP + 'rpg-battle-system/music/theme-14.ogg', 'RPG Battle: Theme 14', 'Pixel-boy', CC0, 'boss', 'pick', 'Your MAYBE from round 1.'),
  ('clash_defiant', KM_ + 'clash-defiant.ogg', 'Clash Defiant', 'Kevin MacLeod', KM, 'boss', 'new', 'Epic heavy action, very busy and loud.'),
  ('volatile', KM_ + 'volatile-reaction.ogg', 'Volatile Reaction', 'Kevin MacLeod', KM, 'boss', 'new', 'The loudest one: intense, fast action.'),
  ('failing_defense', KM_ + 'failing-defense.ogg', 'Failing Defense', 'Kevin MacLeod', KM, 'boss', 'new', 'Dramatic orchestral, the last stand, busy.'),
  ('unholy_knight', KM_ + 'unholy-knight.ogg', 'Unholy Knight', 'Kevin MacLeod', KM, 'boss', 'new', 'A dark knight: busy, minor key.'),
  ('grim_idol', KM_ + 'grim-idol.ogg', 'Grim Idol', 'Kevin MacLeod', KM, 'boss', 'new', 'Crypt mood, very busy, bright sound.'),
  ('lazarus', KM_ + 'return-of-lazarus.ogg', 'Return of Lazarus', 'Kevin MacLeod', KM, 'boss', 'new', 'The dead rise: dark, medium pace, minor key.'),
  ('drums_deep', KM_ + 'drums-of-the-deep.ogg', 'Drums of the Deep', 'Kevin MacLeod', KM, 'boss', 'new', 'Deep, dark drums, very low sound, slow and heavy.'),
  ('voyager', AN_ + 'Voyager - Ambient.ogg', 'Voyager', 'Rafael Krux', FM, 'boss', 'new', 'Epic orchestral, medium pace, major key.'),
]
REAL = [('hearthfire', 'title'), ('ember_gate_real', 'title'), ('hearth_real', 'title'), ('road_to_the_gate', 'squad'),
        ('muster_real', 'squad'), ('iron_stair', 'battle'), ('crown_of_bones', 'boss')]
real_meta = json.loads(subprocess.run(['node', '-e', "import('./songs-real.js').then(m=>console.log(JSON.stringify(Object.fromEntries(Object.entries(m.REAL).map(([k,s])=>[k,{title:s.title,desc:s.desc}])))))"],
                                      cwd=HERE, capture_output=True, text=True, check=True).stdout)
def enc(src, dst, cap, stereo):
    af = 'loudnorm=I=-16:TP=-1.5:LRA=11'
    if cap: af += f',afade=t=out:st={cap - 3}:d=3'
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src] + (['-t', str(cap)] if cap else []) + ['-af', af, '-ar', '44100', '-ac', '2' if stereo else '1', '-b:a', '96k' if stereo else '56k', dst]
    if not os.path.exists(dst): subprocess.run(cmd, check=True)
opts = []
for sid, scr in REAL:
    enc(os.path.join(REALDIR, sid + '.mp3'), os.path.join(OUT, 'm', 'real_' + sid + '.mp3'), None, True)
    m = real_meta[sid]; opts.append({'id': 'real:' + sid, 'file': 'm/real_' + sid + '.mp3', 'screen': scr, 'tag': 'ours', 'title': m['title'], 'desc': m['desc'],
                                     'by': 'Written by Claude, played on real instrument recordings', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
