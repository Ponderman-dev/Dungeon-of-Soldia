# ROUND 7 (user: 'real instruments too trebly, too much reverb: back to CHIPTUNE'). Renders any songs-real.js song as
# pure chiptune (old-console style): pulse-wave leads (anti-aliased polyBLEP), a stepped triangle bass, noise drums.
# NO reverb, gentle top-end roll-off (no treble boost), a little bass shelf. Seamless loop.
# Usage: python3 chip-render.py <songId> <out.mp3>
import sys, os, json, subprocess, numpy as np
SONG, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100
song = json.loads(subprocess.run(['node', os.path.join(HERE, 'export-events.mjs'), SONG], capture_output=True, text=True, check=True).stdout)
loop = song['loop']; TAIL = 1.0; N = int((loop + TAIL) * SR)
mix = np.zeros((2, N), np.float32)
rng = np.random.default_rng(3)
NOISE = rng.uniform(-1, 1, SR * 3).astype(np.float32)

def blep(t, dt):
    out = np.zeros_like(t)
    a = t < dt; x = t[a] / dt[a]; out[a] = x + x - x * x - 1
    b = t > 1 - dt; x = (t[b] - 1) / dt[b]; out[b] = x * x + x + x + 1
    return out
def pulse(freq, n, duty, vib=0.0):
    f = np.full(n, freq, np.float64)
    if vib:  # delayed vibrato, like a chip tracker
        tt = np.arange(n) / SR; f *= 2 ** (vib / 1200 * np.sin(2 * np.pi * 5.5 * tt) * np.clip((tt - 0.18) / 0.2, 0, 1))
    dt = f / SR; ph = np.cumsum(dt) % 1.0
    saw = lambda p: 2 * p - 1 - blep(p, dt)
    return (saw(ph) - saw((ph + duty) % 1.0)).astype(np.float32) * 0.5
def tri(freq, n):  # NES-style 16-step triangle
    ph = (np.arange(n) * freq / SR) % 1.0
    return (np.round(np.abs(2 * ph - 1) * 15) / 15 * 2 - 1).astype(np.float32)
def env(n, att, dec, sus, rel_from, rel):
    e = np.ones(n, np.float32); tt = np.arange(n) / SR
    e *= np.clip(tt / max(att, 1e-4), 0, 1)
    e *= sus + (1 - sus) * np.exp(-tt / max(dec, 1e-4))
    r0 = int(rel_from * SR)
    if r0 < n: e[r0:] *= np.clip(1 - (tt[r0:] - rel_from) / rel, 0, 1)
    return e
F = lambda m: 440 * 2 ** ((m - 69) / 12)
PLUCK = {'harp', 'lute', 'xylo', 'glock', 'stacc', 'folkharp', 'harpsichord', 'bells'}
BASS = {'pizz', 'basses', 'trombones'}
LEADS = {'flute', 'horns', 'trumpets', 'violins', 'recorder', 'celli', 'hornstc', 'trumpets'}
PADS = {'strings', 'violas', 'choir', 'organ', 'organ4'}

def voice(e):
    cfg = song['inst'][e['inst']]; smp = cfg['sample']; name = e['inst']; m = e['midi']; d = e['dur']; v = e['vel']
    if smp in PADS: return None, 0  # chip music has no pads: the arps and bass carry the chords
    if name == 'dbl': return None, 0  # the round-5/6 glock doubling = too much treble
    if smp in BASS or (smp == 'celli' and m < 55) or name in ('bass', 'low', 'tbn', 'riff'):
        while m > 52: m -= 12
        n = int((d * 0.9 + 0.02) * SR); g = 0.06 if name in ('tbn', 'low') else 0.13  # a second bass line: quieter
        return tri(F(m), n) * env(n, 0.002, 1, 1, d * 0.9, 0.02) * g * v, 0.0
    if name in ('leadA', 'leadB') or smp in LEADS:
        duty = 0.5 if name != 'leadB' else 0.25
        n = int((d * 0.92 + 0.04) * SR); return pulse(F(m), n, duty, vib=12) * env(n, 0.004, 0.18, 0.72, d * 0.92, 0.04) * 0.36 * v, (0.12 if name == 'leadB' else -0.08)
    if smp in PLUCK:
        while m > 88: m -= 12
        n = int(min(d + 0.15, 0.45) * SR); return pulse(F(m), n, 0.125) * env(n, 0.002, 0.09, 0.0, 9, 1) * 0.14 * v, -0.2
    n = int((d * 0.9 + 0.03) * SR); return pulse(F(m), n, 0.25) * env(n, 0.004, 0.2, 0.6, d * 0.9, 0.03) * 0.12 * v, 0.0

def drum(name, v):
    tt = lambda s: np.arange(int(s * SR)) / SR
    if name in ('kick', 'rkick', 'boom'):
        t = tt(0.18); f = 50 + 120 * np.exp(-t / 0.03); ph = np.cumsum(f / SR) % 1
        return (np.abs(2 * ph - 1) * 2 - 1).astype(np.float32) * np.exp(-t / 0.08).astype(np.float32) * 0.24 * v
    if name in ('snare', 'rsnare'):
        t = tt(0.16); nz = NOISE[:len(t)] * np.exp(-t / 0.05); t2 = tri(190, len(t)) * np.exp(-t / 0.03)
        return (nz * 0.28 + t2 * 0.18).astype(np.float32) * v
    if name in ('hat', 'rhat', 'shaker', 'tamb', 'wood'):
        t = tt(0.04); nz = np.diff(NOISE[:len(t) + 1]) * 0.5
        return (nz * np.exp(-t / 0.012)).astype(np.float32) * 0.12 * v
    if name in ('ohat', 'rohat'):
        t = tt(0.15); nz = np.diff(NOISE[:len(t) + 1]) * 0.5
        return (nz * np.exp(-t / 0.05)).astype(np.float32) * 0.1 * v
    if name in ('crash', 'rcrash', 'tamtam'):
        t = tt(0.9); nz = np.diff(NOISE[:len(t) + 1]) * 0.5
        return (nz * np.exp(-t / 0.3)).astype(np.float32) * 0.12 * v
    if name in ('timp', 'tom', 'frame'):
        t = tt(0.3); f = 70 + 60 * np.exp(-t / 0.05)
        return (np.abs(2 * (np.cumsum(f / SR) % 1) - 1) * 2 - 1).astype(np.float32) * np.exp(-t / 0.12).astype(np.float32) * 0.4 * v
    return None

for e in song['events']:
    s0 = int(e['t'] * SR)
    if e.get('drum'): x, pan = drum(e['drum'], e['vel']), 0.0
    else: x, pan = voice(e)
    if x is None: continue
    n = min(len(x), N - s0)
    if n <= 0: continue
    L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[0, s0:s0 + n] += x[:n] * L; mix[1, s0:s0 + n] += x[:n] * R
L0 = int(loop * SR); out = mix[:, :L0].copy(); out[:, : N - L0] += mix[:, L0:]
out /= np.abs(out).max() + 1e-9; out *= 0.89
pcm = (out.T * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
                '-af', 'lowpass=f=7000:p=1,alimiter=limit=0.89', '-b:a', '160k', OUT], input=pcm, check=True)
print(f'{SONG}: {loop:.1f}s chip loop')
