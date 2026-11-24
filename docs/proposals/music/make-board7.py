# MUSIC BOARD ROUND 7 (session 52; user: 'what about my previous loves / maybes? real instruments too trebly, too much
# reverb: back to CHIPTUNE'). Shows EVERY current LOVE / MAYBE (free + code, latest verdict wins) + CHIPTUNE versions of
# all round-6 songs and the liked code songs (chip-render.py: pulse leads, triangle bass, noise drums, no reverb,
# soft top end; balance matched to the user's loved tracks). Chip songs use ids 'chip:<songId>'.
# Usage: python3 make-board7.py <sources dir> <real dir (liked originals)> <out dir>   (chip mp3s: <real dir>/../chip)
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
FREE = [
  ('xd_title', XD + 'title.mp3', 'Title Theme', 'xDeviruchi', XDL, 'title', 'pick', 'Your LOVE.'),
  ('na6', NA + 'theme-6.ogg', 'Ninja Adventure: Theme 6', 'Pixel-boy', CC0, 'title', 'pick', 'Your MAYBE.'),
  ('rb12', RB + 'theme-12.ogg', 'RPG Battle: Theme 12', 'Pixel-boy', CC0, 'squad', 'pick', 'Your LOVE.'),
  ('rb2', RB + 'theme-2.ogg', 'RPG Battle: Theme 2', 'Pixel-boy', CC0, 'squad', 'pick', 'Your MAYBE.'),
  ('rb8', RB + 'theme-8.ogg', 'RPG Battle: Theme 8', 'Pixel-boy', CC0, 'battle', 'pick', 'Your LOVE.'),
  ('rb10', RB + 'theme-10.ogg', 'RPG Battle: Theme 10', 'Pixel-boy', CC0, 'battle', 'pick', 'Your MAYBE.'),
  ('rb14', RB + 'theme-14.ogg', 'RPG Battle: Theme 14', 'Pixel-boy', CC0, 'boss', 'pick', 'Your LOVE.'),
  ('castle', ST + 'castle.ogg', 'Castle', 'SuperTux Advance', OGA, 'boss', 'pick', 'Your MAYBE.'),
  ('unholy_knight', KM_ + 'unholy-knight.ogg', 'Unholy Knight', 'Kevin MacLeod', KM, 'boss', 'pick', 'Your MAYBE.'),
]
ROUND6 = json.loads(subprocess.run(['node', '--input-type=module', '-e', "import {ROUND6} from './songs-real.js'; console.log(JSON.stringify(ROUND6))"],
                                   cwd=HERE, capture_output=True, text=True, check=True).stdout)
REAL = [('muster_real', 'squad', 'pick'), ('heros_dawn', 'title', 'pick'), ('hearthfire', 'title', 'pick')]  # the liked versions, as they were
CHIP = [('muster_real', 'squad'), ('heros_dawn', 'title'), ('hearthfire', 'title')] + [tuple(r) for r in ROUND6]
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
CHIPDIR = os.path.join(os.path.dirname(os.path.abspath(REALDIR)), 'chip')
for sid, scr in CHIP:
    enc(os.path.join(CHIPDIR, sid + '.mp3'), os.path.join(OUT, 'm', 'chip_' + sid + '.mp3'), None, True)
    m = real_meta[sid]; t = m['title'].replace(' (real instruments)', '')
    opts.append({'id': 'chip:' + sid, 'file': 'm/chip_' + sid + '.mp3', 'screen': scr, 'tag': 'ours', 'title': t + ' (chiptune)',
                 'desc': 'CHIPTUNE version: square-wave leads, triangle bass, noise drums, no reverb. ' + m['desc'].replace('NEW (round 6, 16-bit). ', ''),
                 'by': 'Written by Claude, chiptune', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
INTRO_OLD = '<p class="lede">Your NO songs are gone. New: <b>real-instrument songs</b> I wrote (lute, recorder, harp, strings, horns, choir, timpani: real recordings, no synth), and <b>41 new free tracks</b> by Kevin MacLeod and Alexander Nakarada, both famous for medieval / Nordic fantasy music. Your round-1 loves and maybes are still here (gold <b>YOUR PICK</b>). Tap <b>PLAY</b> (a song may take a second to load), then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
INTRO_NEW = '<p class="lede">Round 7: <b>back to CHIPTUNE</b>, plus <b>all your current LOVEs and MAYBEs</b> (gold <b>YOUR PICK</b>, free tracks and code songs; your latest vote counts). My songs are now pure old-console sound: square-wave tunes, a triangle-wave bass, noise drums, <b>no reverb</b> and a soft top end (no treble boost), balanced like your loved tracks. Every round-6 song is here in chiptune, plus chiptune versions of Muster, Hero&#39;s Dawn and Hearthfire. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = "const SCREENS = [\n  ['title', 'Title + Base camp', 'Your picks first, then chiptune RPG openings.'],\n  ['squad', 'Squad / hero select', 'Your picks first, then chiptune grooves for getting ready.'],\n  ['battle', 'Battle floors', 'Your picks first, then fast chiptune fights (full energy from beat 1).'],\n  ['boss', 'Boss fights', 'Your picks first, then heavier chiptune boss songs.'],\n];"
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
