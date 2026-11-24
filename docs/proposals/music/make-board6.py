# MUSIC BOARD ROUND 6 (session 52; user: 'go 16-bit again, ditch gothic and dark, Risk-of-Rain energy but dungeon
# crawler / general RPG, at least 4 per category'). Code songs only: 17 from the round-6 BUILDER (songs-real.js build6 /
# ROUND6) + the code songs still liked (Muster love; Hero's Dawn, Hearthfire maybe). Every new song: render-real.py ->
# ffmpeg '16-bit' (aresample=20000:filter_size=4, back to 32 kHz, short echo) -> MASTER (bass + treble boost).
# Usage: python3 make-board6.py <sources dir (unused)> <mastered songs dir> <out dir>
import sys, os, subprocess, json, base64, glob
SRC, REALDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
SP = 'superpowers-asset-packs/'; JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
KM_ = 'minstrel/assets/audio/'; AN_ = 'SomeTroglodyte_Additional-Music-Various/music/'
CC0 = ('CC0', 'free, no credit needed'); KM = ('CC BY', 'free, credit "Kevin MacLeod (incompetech.com)" in the game')
FM = ('CREDIT', 'free (filmmusic.io licence), credit the composer in the game')
# id, file, title, by, licence, screen, tag ('pick' = your round-1 love/maybe, 'r1' = round 1 unmarked, 'new'), description
MASTER = 'bass=g=6:f=80:w=0.7,treble=g=5:f=6000:w=0.7,acompressor=threshold=0.125:ratio=2.5:attack=15:release=200,alimiter=limit=0.89'
FREE = []
ROUND6 = json.loads(subprocess.run(['node', '--input-type=module', '-e', "import {ROUND6} from './songs-real.js'; console.log(JSON.stringify(ROUND6))"],
                                   cwd=HERE, capture_output=True, text=True, check=True).stdout)
REAL = [('heros_dawn', 'title', 'pick'), ('hearthfire', 'title', 'pick'), ('muster_real', 'squad', 'pick')] + [(i, scr, 'ours') for i, scr in ROUND6]
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
    m = real_meta[sid]; opts.append({'id': 'real:' + sid, 'file': 'm/real_' + sid + '.mp3', 'screen': scr, 'tag': rtag, 'title': m['title'] + '', 'desc': (('Your pick from before. ' + m['desc']) if rtag == 'pick' else m['desc']),
                                     'by': 'Written by Claude, played on real instrument recordings', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
INTRO_OLD = '<p class="lede">Your NO songs are gone. New: <b>real-instrument songs</b> I wrote (lute, recorder, harp, strings, horns, choir, timpani: real recordings, no synth), and <b>41 new free tracks</b> by Kevin MacLeod and Alexander Nakarada, both famous for medieval / Nordic fantasy music. Your round-1 loves and maybes are still here (gold <b>YOUR PICK</b>). Tap <b>PLAY</b> (a song may take a second to load), then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
INTRO_NEW = '<p class="lede">Round 6: <b>16-bit, no gothic, no dark</b>. 17 new songs of mine, at least 4 per screen, aiming for <b>Risk-of-Rain energy in a dungeon-crawler / general RPG world</b>: syncopated driving bass, racing arpeggios, punchy drums, bright brass, flute, violin and xylophone hooks, all given a 16-bit console sound, with the round-5 bass and treble boost. Your liked code songs stay (gold <b>YOUR PICK</b>); your free-track loves are saved for later. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = "const SCREENS = [\n  ['title', 'Title + Base camp', 'General RPG openings: proud, heroic, a little magical. Not sleepy, not town music.'],\n  ['squad', 'Squad / hero select', 'Getting ready: steady grooves with a bright tune.'],\n  ['battle', 'Battle floors', 'Risk-of-Rain drive in a dungeon: fast, syncopated, full energy from beat 1.'],\n  ['boss', 'Boss fights', 'Bigger and heavier, still bright and heroic (no gothic organ or choir).'],\n];"
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
