# Renders a REAL song (songs-real.js) on recorded instrument samples into a seamless loop (mp3).
# Samples (not in the repo, clone them): VCSL (github sgossner/VCSL, CC0) and Sonatina Symphonic Orchestra
# (github peastman/sso, CC Sampling Plus 1.0). Usage: python3 render-real.py <samples dir> <songId> <out.mp3>
import sys, os, re, glob, json, subprocess, functools, numpy as np
LIB, SONG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100
SSO = os.path.join(LIB, 'sso/Sonatina Symphonic Orchestra/Samples/'); VC = os.path.join(LIB, 'VCSL/')
NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
def note_of(path):  # last 'a#2' / 'D2' / 'A#1' style token in the file name
    m = re.findall(r'(?:^|[-_ ])([A-Ga-g])(#?)(\d)(?=[-_.])', os.path.basename(path))
    if not m: return None
    l, s, o = m[-1]; return 12 * (int(o) + 1) + NOTE[l.lower()] + (1 if s else 0)
def sset(*globs, keep=None):
    out = {}
    for g in globs:
        for f in sorted(glob.glob(g)):
            if keep and not re.search(keep, os.path.basename(f)): continue
            n = note_of(f)
            if n is not None: out.setdefault(n, f)
    assert out, globs; return out
# kind: 'sus' (held, released at note end) or 'pluck' (rings on); att = fade-in seconds; rel = release seconds
INST = {
  'lute': (sset(VC + 'Chordophones/Composite Chordophones/Strumstick/Finger/*.wav', keep=r'_vl2_rr1'), 'pluck', 0.002, 0.25, 2.2),
  'folkharp': (sset(VC + 'Chordophones/Composite Chordophones/Folk Harp/*.wav', keep=r'_v2_RR1'), 'pluck', 0.002, 0.3, 2.5),
  'harp': (sset(SSO + 'Harp/*.wav'), 'pluck', 0.002, 0.3, 2.5),
  'recorder': (sset(VC + 'Aerophones/Edge-blown Aerophones/Baroque Alto Recorder/SusVib/*.wav', keep=r'rr1'), 'sus', 0.04, 0.18, 0),
  'flute': (sset(SSO + 'Flute/*.wav'), 'sus', 0.05, 0.2, 0),
  'violins': (sset(SSO + '1st Violins/*sus*'), 'sus', 0.12, 0.35, 0),
  'violas': (sset(SSO + 'Violas/*sus*'), 'sus', 0.15, 0.4, 0),
  'celli': (sset(SSO + 'Celli/*sus*'), 'sus', 0.12, 0.4, 0),
  'strings': (sset(SSO + 'Celli/*sus*', SSO + 'Violas/*sus*', SSO + '1st Violins/*sus*'), 'sus', 0.2, 0.5, 0),
  'pizz': (sset(SSO + 'Basses/*piz-rr1*', SSO + 'Celli/*piz-rr1*', SSO + '1st Violins/*piz-rr1*'), 'pluck', 0.002, 0.15, 0.9),
  'stacc': (sset(SSO + '1st Violins/*stc-rr1*'), 'pluck', 0.002, 0.08, 0.35),
  'horns': (sset(SSO + 'Horns/*sus-mp*'), 'sus', 0.06, 0.3, 0),
  'hornstc': (sset(SSO + 'Horns/*stc-rr1*'), 'pluck', 0.002, 0.15, 0.6),
  'trombones': (sset(SSO + 'Trombones/*sus*'), 'sus', 0.05, 0.3, 0),
  'trumpets': (sset(SSO + 'Trumpets/*stc-rr1*'), 'pluck', 0.002, 0.15, 0.6),
  'choir': (sset(SSO + 'Chorus/*male*', SSO + 'Chorus/*female*'), 'sus', 0.25, 0.6, 0),
}
P = SSO + 'Percussion/'
DRUM = {  # name: (file, gain)
  'kick': (P + 'bass_drum-p.wav', 0.9), 'boom': (P + 'bass_drum-f.wav', 1.0), 'snare': (P + 'snare-rh-mf.wav', 0.45),
  'timp': (P + 'timpani-f-rh-a1.wav', 0.8), 'crash': (P + 'piatti.wav', 0.45), 'tamtam': (P + 'tamtam-a.wav', 0.6),
  'tom': (P + 'timpani-p-rh-c2.wav', 0.7), 'tamb': (P + 'tambourine-hit-mf.wav', 0.3), 'shaker': (P + 'shaker-hi-a.wav', 0.3),
  'hat': (P + 'shaker-hi-a.wav', 0.25), 'ohat': (P + 'tambourine-shake.wav', 0.25),
  'frame': (glob.glob(VC + 'Membranophones/Struck Membranophones/Frame Drum/HDrumL_Hit_v2_rr1*')[0], 0.8),
}
@functools.lru_cache(None)
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    i = np.argmax(np.abs(x) > 0.01 * (np.abs(x).max() + 1e-9)); x = x[max(0, i - 40):]  # cut leading silence
    w = SR // 4; fr = x[: len(x) // w * w].reshape(-1, w) if len(x) >= w else x[None, :]
    return x / (np.sqrt((fr ** 2).mean(1)).max() + 1e-6) * 0.1  # level the samples by their loudest quarter second
def shifted(f, semis):
    x = load(f)
    if semis == 0: return x
    r = 2 ** (semis / 12); idx = np.arange(0, len(x) - 1, r)
    return np.interp(idx, np.arange(len(x)), x).astype(np.float32)
song = json.loads(subprocess.run(['node', os.path.join(HERE, 'export-events.mjs'), SONG], capture_output=True, text=True, check=True).stdout)
loop = song['loop']; TAIL = 5.0; N = int((loop + TAIL) * SR)
mix = np.zeros((2, N), np.float32); send = np.zeros((2, N), np.float32)
rng = np.random.default_rng(7); ENERGY = {}
for e in song['events']:
    s0 = int(e['t'] * SR)
    if e.get('drum'):
        f, g = DRUM.get(e['drum'], (None, 0))
        if not f: continue
        x = load(f) * g * e['vel'] * (1 + rng.uniform(-0.08, 0.08)); pan, rev = 0.0, 0.35
    else:
        cfg = song['inst'][e['inst']]; ss, kind, att, rel, ring = INST[cfg['sample']]
        near = min(ss, key=lambda n: abs(n - e['midi']))
        x = shifted(ss[near], e['midi'] - near) * cfg.get('vol', 1) * e['vel'] * (1 + rng.uniform(-0.06, 0.06))
        dur = e['dur'] * 0.98 if kind == 'sus' else e['dur'] + ring
        n = min(len(x), int((dur + rel) * SR)); x = x[:n].copy()
        a = int(att * SR)
        if a > 1: x[:a] *= np.linspace(0, 1, a)
        r0 = int(dur * SR)
        if r0 < n: x[r0:] *= np.linspace(1, 0, n - r0) ** 2
        pan, rev = cfg.get('pan', 0.0), 0.45
    n = min(len(x), N - s0)
    k = e.get('drum') or e['inst']; ENERGY[k] = ENERGY.get(k, 0) + float((x[:max(n,0)] ** 2).sum())
    if n <= 0: continue
    L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[0, s0:s0 + n] += x[:n] * L; mix[1, s0:s0 + n] += x[:n] * R
    send[0, s0:s0 + n] += x[:n] * L * rev; send[1, s0:s0 + n] += x[:n] * R * rev
# hall reverb: convolve the send with a decaying noise tail (FFT)
irn = int(2.6 * SR); t = np.arange(irn) / SR
for ch in range(2):
    ir = rng.standard_normal(irn).astype(np.float32) * np.exp(-t * 2.6) * 0.03
    ir[: int(0.02 * SR)] = 0  # small pre-delay
    m = 1 << int(np.ceil(np.log2(N + irn)))
    wet = np.fft.irfft(np.fft.rfft(send[ch], m) * np.fft.rfft(ir, m), m)[:N]
    mix[ch] += wet.astype(np.float32)
# seamless loop: fold the tail back onto the start
L0 = int(loop * SR); out = mix[:, :L0].copy(); out[:, : N - L0] += mix[:, L0:]
out /= np.abs(out).max() + 1e-9; out *= 0.89  # peak -1 dB
pcm = (out.T * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '128k', OUT], input=pcm, check=True)
tot = sum(ENERGY.values()); print('  balance:', ', '.join(f'{k} {10*np.log10(v/tot):.0f}dB' for k, v in sorted(ENERGY.items(), key=lambda kv: -kv[1])))
print(f'{SONG}: {loop:.1f}s loop, rms {20*np.log10(np.sqrt((out**2).mean())):.1f} dB')
