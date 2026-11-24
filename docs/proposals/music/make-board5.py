# MUSIC BOARD ROUND 5 (session 52; user: 'round 4 too cheery / town; while I look for my own free music, more CODE music
# only, with MORE BASS AND TREBLE'). Same page / db / files. ONLY our songs: 6 new (songs-real.js ROUND 5: sine sub under
# the bass, string basses, bright octave-up doubles, 16th hats) + the code songs the user loved / maybe'd, REMASTERED.
# Every song here is rendered by render-real.py then mastered with ffmpeg MASTER below (bass + treble boost).
# Usage: python3 make-board5.py <sources dir (unused)> <mastered real songs dir> <out dir>
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
REAL = [('ember_watch', 'title', 'ours'), ('hearthfire', 'title', 'pick'), ('lair_gate', 'squad', 'ours'), ('muster_real', 'squad', 'pick'),
        ('night_gate', 'squad', 'pick'), ('deepdelve', 'battle', 'ours'), ('rattling_bones', 'battle', 'ours'), ('torchlight_run', 'battle', 'ours'),
        ('crimson_gallery', 'battle', 'pick'), ('warden_of_chains', 'boss', 'ours'), ('bell_tower_duel', 'boss', 'pick')]
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
    m = real_meta[sid]; opts.append({'id': 'real:' + sid, 'file': 'm/real_' + sid + '.mp3', 'screen': scr, 'tag': rtag, 'title': m['title'] + (' (remaster)' if rtag == 'pick' else ''), 'desc': (('Your pick from before, REMASTERED with more bass and treble. ' + m['desc']) if rtag == 'pick' else m['desc']),
                                     'by': 'Written by Claude, played on real instrument recordings', 'lic': 'OURS', 'licText': 'our own song'})
for fid, f, title, by, lic, scr, tag, desc in FREE:
    enc(os.path.join(SRC, f), os.path.join(OUT, 'm', fid + '.mp3'), 120, False)
    opts.append({'id': 'free:' + fid, 'file': 'm/' + fid + '.mp3', 'screen': scr, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
INTRO_OLD = '<p class="lede">Your NO songs are gone. New: <b>real-instrument songs</b> I wrote (lute, recorder, harp, strings, horns, choir, timpani: real recordings, no synth), and <b>41 new free tracks</b> by Kevin MacLeod and Alexander Nakarada, both famous for medieval / Nordic fantasy music. Your round-1 loves and maybes are still here (gold <b>YOUR PICK</b>). Tap <b>PLAY</b> (a song may take a second to load), then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>. Free tracks play their first 2 minutes here.</p>'
INTRO_NEW = '<p class="lede">Round 5: CODE MUSIC ONLY, while you hunt for your own free tracks (your earlier free picks are still saved). <b>6 new songs of mine</b>: darker dungeon action (no town / open-field mood), with <b>much more bass</b> (a deep sub under every bass note + string basses) and <b>much more treble</b> (glockenspiel, xylophone, harpsichord sparkle, quick hi-hats), plus the code songs you liked before, <b>remastered</b> the same way. Use headphones or good speakers to hear the bass (phone speakers cut most of it). Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
SCREENS_OLD = "const SCREENS = [\n  ['title', 'Title + Base camp', 'The opening title and the camp. You asked for something slow with a lute, like Skyrim. Try Hearthfire (mine), Suonatore di Liuto (a real solo lute) and the Nordic ones by Nakarada.'],\n  ['squad', 'Squad / hero select', 'Choosing your 3 heroes. You liked RPG Theme 12 (warm, medium pace). New: medieval feast, minstrel and tavern tunes.'],\n  ['battle', 'Battle floors', 'The song you will hear MOST. Loving 2-3 lets the game rotate them.'],\n  ['boss', 'Boss fights', 'Every 20 floors: bigger and scarier.'],\n];"
SCREENS_NEW = "const SCREENS = [\n  ['title', 'Title + Base camp', 'New: Ember Watch (dark and calm). Your Hearthfire, remastered.'],\n  ['squad', 'Squad / hero select', 'New: Lair Gate (tense, steady). Your Muster and Night Gate, remastered.'],\n  ['battle', 'Battle floors', 'New: Deepdelve, Rattling Bones (skeleton fight), Torchlight Run. All start at full energy.'],\n  ['boss', 'Boss fights', 'New: Warden of Chains (heavy, stomping). Your Bell Tower Duel, remastered.'],\n];"
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board2-template.html')).read().replace(INTRO_OLD, INTRO_NEW).replace(SCREENS_OLD, SCREENS_NEW).replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
