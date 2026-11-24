# THE GAME'S MUSIC FILES (session 53). Takes the user's final picks and writes src/assets/music/<track>.mp3 (intro + one
# loop body in ONE file, mono 56k: the page packs every file) and the loop points into src/data/music.json `tracks`
# (loopStart = seconds where the repeating part starts; it repeats to the end of the file). Each file is levelled to
# the same loudness (-16 LUFS, measured with ffmpeg ebur128) and peak-limited.
# Usage: python3 make-game-music.py <sources dir> <mixes dir>      (mixes = make-mixes.py output: *_intro.wav, *_loop.wav)
import sys, os, json, re, subprocess
SRC, MIX = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '../../..')
OUT = os.path.join(ROOT, 'src/assets/music'); os.makedirs(OUT, exist_ok=True)
TARGET = -16.0
# track id -> (intro file or None, loop file)
TRACKS = {
  'title': (None, os.path.join(SRC, 'xd_title_loop.wav')),   # xDeviruchi 'Title Theme (Loop).wav' (8-bit pack)
  'squad': (None, os.path.join(SRC, 'superpowers-asset-packs/rpg-battle-system/music/theme-12.ogg')),
  'battle_suite_long': (os.path.join(MIX, 'battle_suite_long_intro.wav'), os.path.join(MIX, 'battle_suite_long_loop.wav')),
  'battle8_long': (os.path.join(MIX, 'battle8_long_intro.wav'), os.path.join(MIX, 'battle8_long_loop.wav')),
  'battle10_long': (None, os.path.join(MIX, 'battle10_long_loop.wav')),
  'boss_final': (None, os.path.join(MIX, 'boss_final_loop.wav')),
}
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
