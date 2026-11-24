# MUSIC ROUND 9 (session 53): REARRANGE the user's loved songs into a game soundtrack (cut on bar lines, reorder,
# join, match tempo / key with ffmpeg's rubberband filter). Each MIX = an INTRO (plays once) + a LOOP BODY (repeats).
# Writes <out>/<id>_intro.wav + <id>_loop.wav (what the game would use) and <out>/<id>_preview.wav (intro + body x2,
# so you hear the loop seam). All the Pixel-boy files are exact bar counts that start on beat 1 (measured: grid.py),
# so bar k starts at k * duration / bars.
# Usage: python3 make-mixes.py <sources dir> <out dir> [only,these,ids]      (sources = the clones listed in docs/systems/sound.md)
import sys, os, subprocess, numpy as np
SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SR = 44100; XF = 0.02   # 20 ms crossfade centred on every cut
RB = 'superpowers-asset-packs/rpg-battle-system/music/'; NA = 'superpowers-asset-packs/ninja-adventure/musics/'
X16 = 'xd16/'
# song key -> (file, bars in the file)   (bpm: rb8 130, rb10 140, rb12 80, rb14 85, na6 83.33)
SONGS = {'rb8': (RB + 'theme-8.ogg', 28), 'rb10': (RB + 'theme-10.ogg', 36), 'rb12': (RB + 'theme-12.ogg', 10),
         'rb14': (RB + 'theme-14.ogg', 8), 'na6': (NA + 'theme-6.ogg', 30)}
ST = 2 ** (1 / 12)
# a piece = (song, first bar, end bar (exclusive), {tempo, pitch}); a mix = intro pieces + loop pieces
MIXES = {
  # CAMP: Ninja Adventure 6 without its fading last 6 bars, so it loops at full warmth.
  'camp_loop': ([], [('na6', 0, 24, {})]),
  # CAMP AT NIGHT: the same, 12% slower (same pitch), softer top.
  'camp_night': ([], [('na6', 0, 24, {'tempo': 0.88})]),
  # SQUAD MEDLEY: RPG 12 then the middle of Ninja Adventure 6 (same key family, Ab / Eb) slowed 4% to RPG 12's 80 bpm.
  'squad_medley': ([], [('rb12', 0, 10, {}), ('na6', 8, 24, {'tempo': 80 / 83.333})]),
  # BATTLE 8 FULL ENERGY: RPG 8 without its soft first phrase and its quiet break (bars 0-3, 12-15).
  'battle8_energy': ([('rb8', 0, 4, {})], [('rb8', 4, 12, {}), ('rb8', 16, 28, {})]),
  # BATTLE SUITE: RPG 8 (energy cut) sped up to RPG 10's 140 bpm (same pitch), then all of RPG 10: one long loop.
  'battle_suite': ([], [('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 28, {'tempo': 140 / 130}), ('rb10', 0, 36, {})]),
  # LONG BATTLE SONGS (round 10; user loved battle8_energy + battle_suite: 'more parts / variations, longer, more
  # exciting in places, like a Pokemon battle song'). Tricks: KEY-UP (+2 semitones) climax, high-pass BUILD-UP
  # (sweep), the two themes taking turns. Every cut follows the song's own order (bar k -> what followed it in the
  # original, or the loop seams the user already loved); the drum-roll 'roll' mod sounded like a GLITCH: don't use it.
  'battle_suite_long': ([('rb8', 0, 4, {'tempo': 140 / 130})], [
      ('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 28, {'tempo': 140 / 130}),        # A: RPG 8 (as battle8_energy)
      ('rb10', 0, 32, {}), ('rb10', 32, 36, {'sweep': (2500, 30)}),                       # B: all of RPG 10, last 4 bars = build-up
      ('rb8', 4, 12, {'tempo': 140 / 130, 'pitch': ST ** 2}),                             # CLIMAX: A two steps higher
      ('rb8', 16, 28, {'tempo': 140 / 130, 'pitch': ST ** 2})]),                          # then back to A (normal key)
  'battle8_long': ([('rb8', 0, 4, {})], [
      ('rb8', 4, 12, {}), ('rb8', 16, 24, {}), ('rb8', 24, 28, {'sweep': (2500, 30)}),
      ('rb8', 4, 12, {'pitch': ST ** 2}), ('rb8', 16, 28, {'pitch': ST ** 2})]),
  'battle10_long': ([], [
      ('rb10', 0, 32, {}), ('rb10', 32, 36, {'sweep': (2500, 30)}), ('rb10', 0, 36, {'pitch': ST ** 2})]),
  # BOSS RISING: RPG 14 twice, then twice one semitone higher and 6% faster (the fight heats up), then round again.
  'boss_rising': ([], [('rb14', 0, 8, {}), ('rb14', 0, 8, {}), ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06}),
                       ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06})]),
  # BOSS RAGE: RPG 14 two semitones up and 10% faster: a 'boss below half HP' version.
  'boss_rage': ([], [('rb14', 0, 8, {'pitch': ST ** 2, 'tempo': 1.10})]),
}
# STINGS (one-shots, no loop): (id, file, start, end, fade-out seconds)
STINGS = [('sting_victory', X16 + '06 - Victory!.ogg', 0, 10.0, 1.5),   # the part before Victory!'s loop point (8.5 s)
          ('sting_defeat', X16 + '18 - Never Give Up.ogg', 0, None, 0.3),
          ('sting_rest', X16 + '15 - Peaceful Night.ogg', 0, None, 0.3)]

_cache = {}
def load(path):
    if path not in _cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout
        _cache[path] = np.frombuffer(raw, np.float32).reshape(-1, 2)
    return _cache[path]
def ff(x, af):
    """run stereo float audio through an ffmpeg filter chain"""
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', af, '-f', 'f32le', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).reshape(-1, 2)
def piece(song, b0, b1, mod):
    """bars b0..b1 of a song + half a crossfade on each side (wraps around the file end).
    mod: tempo / pitch (rubberband), 'sweep': (f0, f1) = high-pass cutoff glides f0 -> f1 Hz over the piece (a BUILD-UP:
    thin at first, the bass comes back at the end), 'roll': True = the last bar ends in a drum-roll style repeat
    (beat 3 as two 8ths, beat 4 as four 16ths, getting louder) that throws into the next part"""
    path, bars = SONGS[song]; x = load(path); n = len(x); bar = n / bars
    s, e = int(b0 * bar - XF / 2 * SR), int(b1 * bar + XF / 2 * SR)
    idx = np.arange(s, e) % n; y = x[idx]
    t, p = mod.get('tempo', 1.0), mod.get('pitch', 1.0)
    if t != 1.0 or p != 1.0:
        y = ff(y, f'rubberband=tempo={t}:pitch={p}:transients=crisp:detector=compound:pitchq=quality:channels=together')
    if 'sweep' in mod: y = hp_sweep(y, *mod['sweep'])
    if mod.get('roll'): y = roll(y, (len(y) - XF * SR) / (b1 - b0))
    return y
def hp_sweep(y, f0, f1, blk=256):
    """2nd-order high-pass whose cutoff glides exponentially from f0 to f1 (numpy, block-wise coefficients)"""
    y = y.astype(np.float64); out = np.zeros_like(y); z = np.zeros((2, 2)); nb = (len(y) + blk - 1) // blk
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(nb - 1, 1)); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * 0.707); c = np.cos(w)
        b0_, b1_, b2_, a0, a1, a2 = (1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al
        b0_, b1_, b2_, a1, a2 = b0_ / a0, b1_ / a0, b2_ / a0, a1 / a0, a2 / a0
        for i in range(b * blk, min((b + 1) * blk, len(y))):   # transposed direct form II, both channels at once
            xi = y[i]; yi = b0_ * xi + z[0]; z[0] = b1_ * xi - a1 * yi + z[1]; z[1] = b2_ * xi - a2 * yi; out[i] = yi
    return out.astype(np.float32)
def roll(y, bar):
    """replace the last bar's beats 3-4 with repeats of their first 8th / 16th (short fades, rising level)"""
    y = y.copy(); end = len(y) - int(XF / 2 * SR); beat = bar / 4; b3 = int(end - 2 * beat)
    def chunk(start, ln, gain):
        c = y[start:start + ln].copy(); f = min(int(0.004 * SR), ln // 4)
        c[:f] *= np.linspace(0, 1, f)[:, None]; c[-f:] *= np.linspace(1, 0, f)[:, None]; return c * gain
    parts = []; e8 = int(beat / 2); e16 = int(beat / 4)
    parts += [chunk(b3, e8, 1.0)] * 2
    b4 = int(end - beat); parts += [chunk(b4, e16, g) for g in (0.8, 0.9, 1.0, 1.1)]
    r = np.concatenate(parts); r = np.concatenate([r, np.zeros((end - b3 - len(r), 2), np.float32)])[:end - b3]
    y[b3:end] = r; return y
def rms(x): return float(np.sqrt((x ** 2).mean()))
def join(parts):
    """overlap-add with equal-power crossfades of XF seconds"""
    k = int(XF * SR); fin = np.sin(np.linspace(0, np.pi / 2, k))[:, None]; fout = np.cos(np.linspace(0, np.pi / 2, k))[:, None]
    out = parts[0].copy()
    for p in parts[1:]:
        p = p.copy(); out[-k:] = out[-k:] * fout + p[:k] * fin; out = np.concatenate([out, p[k:]])
    return out
def build(pieces):
    """level-match every song to the first one by WHOLE-file loudness (so a quiet build-up stays quiet)"""
    ref = rms(load(SONGS[pieces[0][0]][0]))
    return [piece(*pc) * (ref / rms(load(SONGS[pc[0]][0]))) for pc in pieces]
def trim(x):  # drop the half crossfade at both ends (game files)
    k = int(XF / 2 * SR); return x[k:len(x) - k]
def wav(path, x):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path],
                   input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
for mid, (intro, loop) in MIXES.items():
    if ONLY and mid not in ONLY: continue
    ip, lp = build(intro) if intro else [], build(loop)
    body = join(lp)
    # preview: intro, body, body again, joined with the same crossfade (the body's own wrap = the real loop seam)
    prev = join(ip + [body, body]) if ip else join([body, body])
    pk = max(np.abs(prev).max(), 1e-6); g = min(1.0, 0.89 / pk)   # same safety gain for preview + game files (peak -1 dB)
    prev, body, ip = prev * g, body * g, [q * g for q in ip]
    if mid == 'camp_night': prev = ff(prev, 'lowpass=f=5500,volume=-2dB'); body = ff(body, 'lowpass=f=5500,volume=-2dB')
    wav(os.path.join(OUT, mid + '_preview.wav'), prev)
    wav(os.path.join(OUT, mid + '_loop.wav'), trim(body))
    if ip: wav(os.path.join(OUT, mid + '_intro.wav'), trim(join(ip)))
    print(f'{mid}: intro {len(join(ip)) / SR if ip else 0:.1f}s, loop {len(body) / SR:.1f}s, preview {len(prev) / SR:.1f}s')
for sid, f, s, e, fade in ([] if ONLY else STINGS):
    x = load(f); x = x[int(s * SR): int(e * SR) if e else len(x)]
    x = ff(x, f'afade=t=out:st={len(x) / SR - fade:.3f}:d={fade}')
    wav(os.path.join(OUT, sid + '_preview.wav'), x); print(f'{sid}: {len(x) / SR:.1f}s')
