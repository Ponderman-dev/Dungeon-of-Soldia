# MUSIC BOARD ROUND 10 (session 57; user: battle floors are silent -> find BATTLE-FLOOR music; answers: 'driving 16-bit
# RPG', 'you search, I pick', RPG 8 / RPG 10 may come back as options). Small board, battle only:
#   your loves RPG 8 + RPG 10 (originals, NOT blended), + 5 never-judged tracks measured close to them:
#   xDeviruchi 16-bit 'Battle 1' / 'Battle 2' (unmarked in round 9), Pixel-boy RPG Battle 5 / 6 / 11 (never shown).
# Every one starts at full energy (first 4 s within 4 dB of the whole song). Measurements: session-57 handoff note.
# Reuses the page section of make-board9.py (template + timeline). Ids: free:rb5/rb6/rb8/rb10/rb11, x16:05/09.
# Usage: python3 make-board10.py <sources dir> <out dir>   (sources = superpowers-asset-packs clone + 'xd16' ogg folder)
import sys, os, re, subprocess, json, base64, glob
SRC, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
RB = SRC + '/superpowers-asset-packs/rpg-battle-system/music/'
CC0 = ('CC0', 'free, no credit needed')
X16L = ('CREDIT', 'free in a paid game, edits OK; credit "Original music by Marllon Silva (xDeviruchi)"')
AF = 'loudnorm=I=-16:TP=-1.5:LRA=11'
def run(c): subprocess.run(c, check=True)
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
opts = []
def add(oid, mp3, title, desc, by, lic, tag):
    opts.append({'id': oid.replace('_', ':', 1), 'file': 'm/' + oid + '.mp3', 'screen': 'battle', 'tag': tag, 'title': title,
                 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
def loop_file(oid, f, reps):   # a whole-file loop played `reps` times, as the game would loop it
    dst = os.path.join(OUT, 'm', oid + '.mp3')
    if not os.path.exists(dst): run(['ffmpeg', '-v', 'error', '-y', '-stream_loop', str(reps - 1), '-i', f, '-af', AF, '-ar', '44100', '-ac', '1', '-b:a', '64k', dst])
def intro_loop(oid, f, a, L):  # intro + loop body twice (loop points from the pack's PDF)
    dst = os.path.join(OUT, 'm', oid + '.mp3')
    if not os.path.exists(dst):
        run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-i', f, '-filter_complex',
             f'[0]atrim=0:{a + L}[p];[1]atrim={a}:{a + L},asetpts=PTS-STARTPTS[q];[p][q]concat=n=2:v=0:a=1,{AF}',
             '-ar', '44100', '-ac', '1', '-b:a', '64k', dst])
# 1. YOUR LOVES, the original files on their own
for n, note in [(8, 'Your LOVE. The original song on its own, not mixed into anything.'),
                (10, 'Your LOVE. The original song on its own, not mixed into anything.')]:
    loop_file(f'free_rb{n}', RB + f'theme-{n}.ogg', 2); add(f'free_rb{n}', None, f'RPG Battle: Theme {n}', f'{note} {dur(RB + f"theme-{n}.ogg"):.0f} s loop, played twice here.', 'Pixel-boy', CC0, 'pick')
# 2. NEW: xDeviruchi 16-bit battle songs (same 16-bit console sound as your loves)
X = {5: ('Battle 1', 10.760, 62.608, 'Their main battle song. Busy drums and bass, about the same energy as RPG 8.'),
     9: ('Battle 2', 0.63, 63.278, 'Their second battle song. Punchy from the very first beat, with the brightest drums of this set.')}
xf = {int(os.path.basename(f)[:2]): f for f in glob.glob(os.path.join(SRC, 'xd16', '*.ogg'))}
for n, (t, a, L, note) in X.items():
    intro_loop(f'x16_{n:02d}', xf[n], a, L)
    il = f'{a:.0f} s intro, then a {L:.0f} s loop' if a > 1 else f'{L:.0f} s loop'
    add(f'x16_{n:02d}', None, t, f'NEW, 16-bit. {note} {il}. Full energy from the start.', 'xDeviruchi (16-bit Fantasy & Adventure, 2025)', X16L, 'new')
# 3. NEW: Pixel-boy RPG Battle themes you have never judged (same pack as RPG 8 / 10 / 12 / 14)
for n, reps, note in [(6, 2, 'The closest to RPG 8: drums and a steady beat, a 60 s loop.'),
                      (11, 3, 'The closest to RPG 10: heavy bass and a busy tune. Short 29 s loop.'),
                      (5, 3, 'Dense and bassy, the most constant energy of this set. Very short 24 s loop.')]:
    loop_file(f'free_rb{n}', RB + f'theme-{n}.ogg', reps)
    add(f'free_rb{n}', None, f'RPG Battle: Theme {n}', f'NEW, same pack as your loves. {note} Played {reps} times here.', 'Pixel-boy', CC0, 'new')
# ---------- page: reuse make-board9.py's page section (template, credit key, timeline) ----------
src9 = open(os.path.join(HERE, 'make-board9.py')).read()
page = src9[src9.index('# ---------- page ----------'):src9.index('# ARRANGER')]
ns = {'os': os, 're': re, 'json': json, 'HERE': HERE}; exec(page, ns); T = ns['T']
INTRO = ('<p class="lede">Round 10: <b>battle floor music</b>. Battle floors are silent now. Here are <b>5 new driving 16-bit '
         'battle songs</b> plus your two loves (RPG 8 and RPG 10) on their own, not blended. Every one starts at full energy. '
         'Mark each <b>LOVE / MAYBE / NO</b>. Songs you LOVE will take turns on battle floors.</p>')
T = re.sub(r'<p class="lede">.*?</p>', lambda m: INTRO, T, count=1, flags=re.S)
T = T.replace('Soldia Music Board · Round 9', 'Soldia Music Board · Round 10').replace('Soldia Music Board · Round 2', 'Soldia Music Board · Round 10')
T = re.sub(r'const SCREENS = \[.*?\n\];', lambda m: "const SCREENS = [\n  ['battle', 'Battle floors', 'Pick the songs that play during normal fights. Your LOVES take turns.'],\n];", T, count=1, flags=re.S)
T = T.replace('placeholder="e.g. Battle suite but without the speed-up…"', 'placeholder="e.g. Battle 2 but less bright…"')
T = T.replace('<head>', '<head>\n<meta charset="utf-8">', 1) if '<head>' in T else '<meta charset="utf-8">\n' + T
T = re.sub(r'<p>Ideas: a rage version.*?</p>', '<p>Ideas: a different song deeper in the dungeon (for example floors 50+), or a song you already have that you want on battle floors.</p>', T, count=1, flags=re.S)
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = T.replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
for must in ['Round 10', "['battle'", 'id="seek"', 'blobUrl(o).then']: assert must in html, must
open(os.path.join(OUT, 'index.html'), 'w').write('<!DOCTYPE html>\n' + html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', round(tot / 1048576, 1), 'MB audio')
