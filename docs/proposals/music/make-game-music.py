# THE GAME'S MUSIC FILES (session 53). Takes the user's final picks and writes src/assets/music/<track>.mp3 (intro + one
# loop body in ONE file, mono 56k: the page packs every file) and the loop points into src/data/music.json `tracks`
# (loopStart = seconds where the repeating part starts; it repeats to the end of the file). Each file is levelled to
# the same loudness (-16 LUFS, measured with ffmpeg ebur128) and peak-limited.
# Usage: python3 make-game-music.py <sources dir> <mixes dir> [only,these,ids]      (mixes = make-mixes.py output: *_intro.wav, *_loop.wav)
import sys, os, json, re, subprocess
SRC, MIX = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '../../..')
OUT = os.path.join(ROOT, 'src/assets/music'); os.makedirs(OUT, exist_ok=True)
TARGET = -16.0
# track id -> (intro file or None, loop file)
# (battle_suite_long / battle8_long / battle10_long were here; the user removed them. Session 57: battle floors = the
# ORIGINAL RPG 8 + RPG 10 files, whole-file loops, taking turns with random repeats + a pause: music.json)
TRACKS = {
  'title': (None, os.path.join(SRC, 'xd_title_loop.wav')),   # xDeviruchi 'Title Theme (Loop).wav' (8-bit pack)
  'squad': (None, os.path.join(SRC, 'superpowers-asset-packs/rpg-battle-system/music/theme-12.ogg')),
  'boss_final': (None, os.path.join(MIX, 'boss_final_loop.wav')),
  'rb8': (None, os.path.join(SRC, 'superpowers-asset-packs/rpg-battle-system/music/theme-8.ogg')),
  'rb10': (None, os.path.join(SRC, 'superpowers-asset-packs/rpg-battle-system/music/theme-10.ogg')),
}
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None   # optional: rebuild only these track ids
if ONLY: TRACKS = {k: v for k, v in TRACKS.items() if k in ONLY}
def run(cmd): return subprocess.run(cmd, capture_output=True, text=True, check=True)
def lufs(f):
    err = subprocess.run(['ffmpeg', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])
tracks = {}
for tid, (intro, loop) in TRACKS.items():
    tmp = os.path.join(OUT, tid + '.tmp.wav')
    ins = (['-i', intro] if intro else []) + ['-i', loop]
    fc = ('[0][1]concat=n=2:v=0:a=1,' if intro else '[0]') + 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a]'
    run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', '[a]', tmp])
    gain = TARGET - lufs(tmp)
    mp3 = os.path.join(OUT, tid + '.mp3')
    run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=false', '-ac', '1', '-b:a', '56k', mp3])
    intro_s = 0.0
    if intro:
        p = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', intro]).stdout)
        intro_s = float(p['format']['duration'])
    dur = float(json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', tmp]).stdout)['format']['duration'])
    os.remove(tmp)
    tracks[tid] = {'file': tid, 'loopStart': round(intro_s, 4), 'seconds': round(dur, 3)}
    print(f'{tid}: {dur:.1f}s, loop from {intro_s:.2f}s, gain {gain:+.1f} dB, {os.path.getsize(mp3) // 1024} KB')
mj = os.path.join(ROOT, 'src/data/music.json'); data = json.load(open(mj))
for tid, t in tracks.items(): data['tracks'][tid] = {**data['tracks'].get(tid, {}), **t}
json.dump(data, open(mj, 'w'), indent=2); open(mj, 'a').write('\n')
print('total', sum(os.path.getsize(os.path.join(OUT, t + '.mp3')) for t in tracks) // 1024, 'KB')
