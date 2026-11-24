# MUSIC BOARD ROUND 8 (session 52; user: 'copy how my loved songs sound, our chiptune is so different'). Analysis of the
# 6 loves (Pixel-boy RPG / Ninja Adventure, xDeviruchi): 16-bit CONSOLE style, not chiptune: dense (14-38 notes at once),
# warm, top cut ~8-10 kHz, moderate stereo, sustained pads, short echo, no hall. So: render-real.py with STYLE=snes
# (samples at 16 kHz, small room) + pads in every style + POST chain below. Ids 'snes:<songId>'.
# Usage: python3 make-board8.py <sources dir> <unused> <out dir>   (snes mp3s: <sources dir>/../snes)
import sys, os, subprocess, json, base64, glob
SRC, REALDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
SP = 'superpowers-asset-packs/'; JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
KM_ = 'minstrel/assets/audio/'; AN_ = 'SomeTroglodyte_Additional-Music-Various/music/'
CC0 = ('CC0', 'free, no credit needed'); KM = ('CC BY', 'free, credit "Kevin MacLeod (incompetech.com)" in the game')
FM = ('CREDIT', 'free (filmmusic.io licence), credit the composer in the game')
# id, file, title, by, licence, screen, tag ('pick' = your round-1 love/maybe, 'r1' = round 1 unmarked, 'new'), description
MASTER = 'bass=g=6:f=80:w=0.7,treble=g=5:f=6000:w=0.7,acompressor=threshold=0.125:ratio=2.5:attack=15:release=200,alimiter=limit=0.89'
XD = 'benesmartin_necromancers-mystery/audio/soundtrack/'; RB = SP + 'rpg-battle-system/music/'; NA = SP + 'ninja-adventure/musics/'
ST = 'KelvinShadewing_supertux-advance/res/mus/'
XDL = ('CC BY-SA', 'free, credit "xDeviruchi" (CC BY-SA 4.0)'); OGA = ('CREDIT', 'free on OpenGameArt; exact licence to confirm before shipping')
POST = 'equalizer=f=420:t=q:w=1:g=4,equalizer=f=55:t=q:w=1:g=-3,aecho=0.85:0.6:120|240:0.24|0.12,lowpass=f=8000:p=2,alimiter=limit=0.89'
FREE = [
  ('xd_title', XD + 'title.mp3', 'Title Theme', 'xDeviruchi', XDL, 'title', 'pick', 'Your LOVE.'),
  ('na6', NA + 'theme-6.ogg', 'Ninja Adventure: Theme 6', 'Pixel-boy', CC0, 'title', 'pick', 'Your LOVE.'),
  ('rb12', RB + 'theme-12.ogg', 'RPG Battle: Theme 12', 'Pixel-boy', CC0, 'squad', 'pick', 'Your LOVE.'),
  ('rb8', RB + 'theme-8.ogg', 'RPG Battle: Theme 8', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE.'),
  ('rb10', RB + 'theme-10.ogg', 'RPG Battle: Theme 10', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE.'),
  ('rb14', RB + 'theme-14.ogg', 'RPG Battle: Theme 14', 'Pixel-boy', CC0, 'boss', 'pick', 'Your LOVE.'),
]
ROUND6 = json.loads(subprocess.run(['node', '--input-type=module', '-e', "import {ROUND6} from './songs-real.js'; console.log(JSON.stringify(ROUND6))"],
                                   cwd=HERE, capture_output=True, text=True, check=True).stdout)
REAL = []
CHIP = [tuple(r) for r in ROUND6]
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
    m = real_meta[sid]; opts.append({'id': 'real:' + sid, 'file': 'm/real_' + sid + '.mp3', 'screen': scr, 'tag': rtag, 'title': m['title'] + ' (as you heard it)', 'desc': 'Your pick, the version you voted on. Its chiptune version is further down. ' + m['desc'],
                                     'by': 'Written by Claude, played on real instrument recordings', 'lic': 'OURS', 'licText': 'our own song'})
CHIPDIR = os.path.join(os.path.dirname(os.path.abspath(SRC)), 'snes')
for sid, scr in CHIP:
    enc(os.path.join(CHIPDIR, sid + '.mp3'), os.path.join(OUT, 'm', 'snes_' + sid + '.mp3'), None, True)
    m = real_meta[sid]; t = m['title'].replace(' (real instruments)', '')
    opts.append({'id': 'snes:' + sid, 'file': 'm/snes_' + sid + '.mp3', 'screen': scr, 'tag': 'new', 'title': t,
                 'desc': '16-BIT CONSOLE version, made to sound like your loves. ' + m['desc'].replace('NEW (round 6, 16-bit). ', ''),
                 'by': 'Written by Claude, 16-bit console style', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
INTRO_OLD = '<p class="lede">Your NO songs are gone. New: <b>real-instrument songs</b> I wrote (lute, recorder, harp, strings, horns, choir, timpani: real recordings, no synth), and <b>41 new free tracks</b> by Kevin MacLeod and Alexander Nakarada, both famous for medieval / Nordic fantasy music. Your round-1 loves and maybes are still here (gold <b>YOUR PICK</b>). Tap <b>PLAY</b> (a song may take a second to load), then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
INTRO_NEW = '<p class="lede">Round 8: <b>made to sound like your loves</b>. I measured your 6 loved songs: they are 16-bit console music (like Super Nintendo games), not chiptune. They are full (many notes at once), warm and soft on top, with smooth background chords, a warm middle and a short console echo. My 17 songs are re-made the same way. Your loves are at the top of each screen to compare. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = "const SCREENS = [\n  ['title', 'Title + Base camp', 'Your 2 loves, then my RPG openings in the same 16-bit console sound.'],\n  ['squad', 'Squad / hero select', 'Your love, then my getting-ready songs.'],\n  ['battle', 'Battle floors', 'Your 2 loves, then my fights (full energy from beat 1).'],\n  ['boss', 'Boss fights', 'Your love, then my boss songs.'],\n];"
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
