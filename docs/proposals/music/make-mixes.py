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
  # TRANSITION TESTS (user: 'the cut to RPG 10 at 0:41 is too jarring, how can we blend it?'): the same 40 s around
  # the RPG 8 -> RPG 10 change, joined 5 ways.
  'tr_cut': ([], [('rb8', 16, 28, {'tempo': 140 / 130}), ('rb10', 0, 12, {})]),
  'tr_blend2': ([], [('rb8', 16, 28, {'tempo': 140 / 130}), ('~', 2, 'blend'), ('rb10', 0, 12, {})]),
  'tr_blend4': ([], [('rb8', 16, 28, {'tempo': 140 / 130}), ('~', 4, 'blend'), ('rb10', 0, 12, {})]),
  'tr_filter4': ([], [('rb8', 16, 28, {'tempo': 140 / 130}), ('~', 4, 'filter'), ('rb10', 0, 12, {})]),
  'tr_bridge': ([], [('rb8', 4, 16, {'tempo': 140 / 130}), ('~', 2, 'blend'), ('rb10', 0, 12, {})]),
  # TRANSITION TESTS 2 (user: 'you didn't cut at the right place: RPG 8 is getting hype, then RPG 10 starts').
  # Bar map (per-bar loudness / busyness): RPG 8 = build 0-3, main 4-11 (winds down 10-11), quiet break 12-15,
  # build 16-19, main 20-25, wind-down 26-27. RPG 10 = 4-bar phrases (bar 0 a soft pickup), every 4th bar
  # (3, 7, 11 ...) a drum-hit FILL bar; quieter part 16-22. So: RPG 8's BUILD lands on RPG 10's phrase start.
  'tr_land': ([], [('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 20, {'tempo': 140 / 130}), ('rb10', 4, 16, {})]),
  'tr_land_fill': ([], [('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 19, {'tempo': 140 / 130}), ('rb10', 3, 16, {})]),
  'tr_land_soft': ([], [('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 20, {'tempo': 140 / 130}), ('~', 0.5, 'blend'), ('rb10', 4, 16, {})]),
  # user: 'C (tr_land_soft) is the best, add another bar of the drum at 0:20': C + RPG 10's drum-hit fill bar (3) at the
  # landing, then RPG 10's phrase.
  # ...that landed 1 bar LATE ('ruined, cut a bit later'): now the drum bar REPLACES RPG 8's last build bar, so RPG 10's
  # loud part lands exactly where C lands.
  'tr_land_drum': ([], [('rb8', 4, 12, {'tempo': 140 / 130}), ('rb8', 16, 19, {'tempo': 140 / 130}), ('~', 0.5, 'blend'), ('rb10', 3, 16, {})]),
  # BOSS RISING: RPG 14 twice, then twice one semitone higher and 6% faster (the fight heats up), then round again.
  'boss_rising': ([], [('rb14', 0, 8, {}), ('rb14', 0, 8, {}), ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06}),
                       ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06})]),
  # BOSS FINAL (user pick: 'the mix of B and C'): normal x2, rising (+1 st, +6%) x2, rage (+2 st, +10%) x2, round again.
  'boss_final': ([], [('rb14', 0, 8, {}), ('rb14', 0, 8, {}), ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06}),
                      ('rb14', 0, 8, {'pitch': ST, 'tempo': 1.06}), ('rb14', 0, 8, {'pitch': ST ** 2, 'tempo': 1.10}),
                      ('rb14', 0, 8, {'pitch': ST ** 2, 'tempo': 1.10})]),
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
    t, p = mod.get('tempo', 1.0), mod.get('pitch', 1.0)
    # 'pre' / 'post' (seconds, after tempo) = extra music before / after for a long BLEND (the song's own music,
    # wrapping around the file, so it is what really came before / after)
    s = int(b0 * bar - (XF / 2 + mod.get('pre', 0) * t) * SR); e = int(b1 * bar + (XF / 2 + mod.get('post', 0) * t) * SR)
    idx = np.arange(s, e) % n; y = x[idx]
    if t != 1.0 or p != 1.0:
        y = ff(y, f'rubberband=tempo={t}:pitch={p}:transients=crisp:detector=compound:pitchq=quality:channels=together')
    if 'sweep' in mod: y = hp_sweep(y, *mod['sweep'])
    if mod.get('roll'): y = roll(y, (len(y) - XF * SR) / (b1 - b0))
    return y
def hp_sweep(y, f0, f1, blk=256, kind='hp'):
    """2nd-order high-pass (or kind='lp' low-pass) whose cutoff glides exponentially from f0 to f1 (numpy, block-wise)"""
    y = y.astype(np.float64); out = np.zeros_like(y); z = np.zeros((2, 2)); nb = (len(y) + blk - 1) // blk
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(nb - 1, 1)); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * 0.707); c = np.cos(w)
        if kind == 'hp': b0_, b1_, b2_ = (1 + c) / 2, -(1 + c), (1 + c) / 2
        else: b0_, b1_, b2_ = (1 - c) / 2, 1 - c, (1 - c) / 2
        a0, a1, a2 = 1 + al, -2 * c, 1 - al
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
def join(parts, blends=None):
    """overlap-add with equal-power crossfades of XF seconds; blends[i] = (seconds, mode) makes join i a LONG blend
    (mode 'blend' = plain crossfade, 'filter' = the old song gets muffled (low-pass down) while the new one comes in
    thin and fills out (high-pass down), like a DJ mix)"""
    out = parts[0].copy()
    for i, p in enumerate(parts[1:]):
        L, mode = (blends or {}).get(i, (0, None))
        k = int((L + XF) * SR); p = p.copy()
        fin = np.sin(np.linspace(0, np.pi / 2, k))[:, None]; fout = np.cos(np.linspace(0, np.pi / 2, k))[:, None]
        a, b = out[-k:], p[:k]
        if mode == 'filter': a = hp_sweep(a, 9000, 250, kind='lp'); b = hp_sweep(b, 1500, 30)
        out[-k:] = a * fout + b * fin; out = np.concatenate([out, p[k:]])
    return out
def bar_secs(song, mod): path, bars = SONGS[song]; return len(load(path)) / bars / SR / mod.get('tempo', 1.0)
def build(pieces):
    """pieces may hold ('~', bars, mode) between two pieces = blend them over that many bars (of the next piece).
    Level-match every song to the first one by WHOLE-file loudness (so a quiet build-up stays quiet).
    Returns (arrays, blends) for join()."""
    items, marks = [], {}
    for pc in pieces:
        if pc[0] == '~': marks[len(items) - 1] = (pc[1], pc[2])
        else: items.append((pc[0], pc[1], pc[2], dict(pc[3])))
    blends = {}
    for i, (nb, mode) in marks.items():
        L = nb * bar_secs(items[i + 1][0], items[i + 1][3]); items[i][3]['post'] = L; items[i + 1][3]['pre'] = L; blends[i] = (L, mode)
    ref = rms(load(SONGS[items[0][0]][0]))
    return [piece(*pc) * (ref / rms(load(SONGS[pc[0]][0]))) for pc in items], blends
def trim(x):  # drop the half crossfade at both ends (game files)
    k = int(XF / 2 * SR); return x[k:len(x) - k]
def wav(path, x):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path],
                   input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
for mid, (intro, loop) in MIXES.items():
    if ONLY and mid not in ONLY: continue
    (ip, ib), (lp, lb) = build(intro) if intro else ([], {}), build(loop)
    body = join(lp, lb); ip = [join(ip, ib)] if ip else []
    # preview: intro, body, body again, joined with the same crossfade (the body's own wrap = the real loop seam);
    # 'tr_' clips = transition tests, played once
    prev = join(ip + [body]) if mid.startswith('tr_') else join(ip + [body, body])
    pk = max(np.abs(prev).max(), 1e-6); g = min(1.0, 0.89 / pk)   # same safety gain for preview + game files (peak -1 dB)
    prev, body, ip = prev * g, body * g, [q * g for q in ip]
    if mid == 'camp_night': prev = ff(prev, 'lowpass=f=5500,volume=-2dB'); body = ff(body, 'lowpass=f=5500,volume=-2dB')
    wav(os.path.join(OUT, mid + '_preview.wav'), prev)
    wav(os.path.join(OUT, mid + '_loop.wav'), trim(body))
    if ip: wav(os.path.join(OUT, mid + '_intro.wav'), trim(ip[0]))
    print(f'{mid}: intro {len(ip[0]) / SR if ip else 0:.1f}s, loop {len(body) / SR:.1f}s, preview {len(prev) / SR:.1f}s')
for sid, f, s, e, fade in ([] if ONLY else STINGS):
    x = load(f); x = x[int(s * SR): int(e * SR) if e else len(x)]
    x = ff(x, f'afade=t=out:st={len(x) / SR - fade:.3f}:d={fade}')
    wav(os.path.join(OUT, sid + '_preview.wav'), x); print(f'{sid}: {len(x) / SR:.1f}s')
