# Round 10 (session 40, user: 'put the Cleric's attack sound and skill sound on the sound board'): makes new options
# with ffmpeg (peak -1 dB, mean <= -19 dB) for a CLERIC group (hitHoly, skill_holy_nova, skill_sanctuary, grace) and writes `cleric-rows.js`, a
# small script that is pasted into the live board page right after `const JINGLES = ...;` (edit_version; the page is
# too big to download). At runtime it moves those rows out of their old groups into a 'Cleric' group at the top,
# sets option A to what the game plays NOW, keeps the old options (same letters, so saved picks stay right) and adds
# the new ones after them. Option mp3s are kept in round10/ (apply-picks needs them).
# Usage: python3 add-cleric.py   (writes round10/*.mp3 and round10/cleric-rows.js)
import json, base64, os, subprocess, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SND = ROOT + '/src/assets/sounds/'
OUT = HERE + '/round10'
os.makedirs(OUT, exist_ok=True)
snd = json.load(open(ROOT + '/src/data/sounds.json'))

def ff(args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + args, check=True)

def finish(tmp, name):  # mono 64k mp3, short fade out, peak -1 dB
    r = subprocess.run(['ffmpeg', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', r).group(1))
    mean = float(re.search(r'mean_volume: (-?[\d.]+) dB', r).group(1))
    gain = min(-1 - peak, -19 - mean)  # peak -1 dB, but no louder on average than the game's own sounds (~-20 dB)
    out = f'{OUT}/{name}.mp3'
    ff(['-i', tmp, '-af', f'volume={gain}dB', '-ac', '1', '-ar', '44100', '-b:a', '64k', out])
    os.remove(tmp)
    return f'{name}.mp3'

def fx(e):  # ffmpeg formulas have no < >: (t>0.2) -> gt(t,0.2)
    for op, fn in (('>=', 'gte'), ('<=', 'lte'), ('>', 'gt'), ('<', 'lt')):
        e = re.sub(r'\(t' + op + r'([\d.]+)\)', fn + r'(t,\1)', e)
    return e

def synth(name, expr, secs, extra=''):  # a sound made from a formula (t = seconds)
    tmp = f'{OUT}/_{name}.wav'
    af = f'afade=t=out:st={secs * 0.6:.2f}:d={secs * 0.4:.2f}' + (',' + extra if extra else '')
    ff(['-f', 'lavfi', '-i', f"aevalsrc='{fx(expr)}':s=44100:d={secs}", '-af', af, tmp])
    return finish(tmp, name)

def mix(name, inputs, secs, extra=''):  # inputs: [(file or lavfi expr, filter)], mixed together
    tmp = f'{OUT}/_{name}.wav'
    args, chains = [], []
    for i, (src, filt) in enumerate(inputs):
        if src.endswith('.mp3'): args += ['-i', SND + src]
        else: args += ['-f', 'lavfi', '-i', f"aevalsrc='{fx(src)}':s=44100:d={secs}"]
        chains.append(f'[{i}:a]aresample=44100,{filt or "anull"}[a{i}]')
    graph = ';'.join(chains) + ';' + ''.join(f'[a{i}]' for i in range(len(inputs))) + f'amix=inputs={len(inputs)}:normalize=0,atrim=0:{secs},afade=t=out:st={secs * 0.6:.2f}:d={secs * 0.4:.2f}' + (',' + extra if extra else '') + '[o]'
    ff(args + ['-filter_complex', graph, '-map', '[o]', tmp])
    return finish(tmp, name)

def pitch(r): return f'asetrate=44100*{r},aresample=44100'
ECHO = 'aecho=0.8:0.6:120|260:0.35|0.2'
S = lambda f, a=1, d=8: f'{a}*sin(2*PI*{f}*t)*exp(-{d}*t)'  # a decaying sine
THUMP = '0.9*sin(2*PI*(160-120*t)*t)*exp(-14*t)'

rows = []
def row(cue, name, when, add, now=True):
    c = snd['cues'].get(cue, snd['cues']['skillCast'])
    nowFile = None
    if now:
        nowFile = f'cleric_now_{cue}.mp3'
        ff(['-i', SND + c['file'] + '.mp3', '-ac', '1', '-b:a', '64k', f'{OUT}/{nowFile}'])
    rows.append({'cue': cue, 'name': name, 'when': when, 'volume': c.get('volume', 1), 'jitter': c.get('pitchJitter', 0),
                 'nowFile': nowFile, 'add': [{'desc': d, 'file': f} for d, f in add]})

row('hitHoly', 'Cleric: attack hit', 'Her normal holy shot landing (every hit, keep it soft)', [
    ('Thump + two sparkles (brighter)', synth('holy_b', f'{THUMP}+{S(2349, .25, 9)}+{S(3136, .2, 11)}', 0.4)),
    ('Sparkle only, no thump (lightest)', synth('holy_c', f'{S(2349, .4, 10)}+{S(2960, .3, 12)}+{S(3520, .2, 14)}', 0.35)),
    ('Deeper thump + glass ping', mix('holy_d', [('0.9*sin(2*PI*(120-90*t)*t)*exp(-12*t)', ''), ('kenney/impactGlass_heavy_000.mp3', pitch(1.8) + ',volume=0.35')], 0.4)),
    ('Tiny bell tap', mix('holy_e', [('kenney/impactBell_heavy_000.mp3', pitch(1.9) + ',volume=0.6'), (THUMP, 'volume=0.6')], 0.35)),
    ('Soft whoosh + sparkle', mix('holy_f', [('0.5*(random(0)*2-1)*exp(-18*t)', 'highpass=f=1500,lowpass=f=6000'), (S(2637, .35, 9), '')], 0.35)),
])
row('skill_holy_nova', 'Cleric: Holy Nova', 'Heals the most hurt hero and bursts holy light on enemies around them', [
    ('Rising shimmer + soft boom', synth('nova_b', f'0.35*sin(2*PI*(600+900*t)*t)*min(1,t*6)*exp(-2*t)+{S(80, .8, 5)}*(t>0.25)', 0.9, ECHO)),
    ('Holy chord swell', synth('nova_c', '(0.3*sin(2*PI*523*t)+0.25*sin(2*PI*659*t)+0.22*sin(2*PI*784*t)+0.15*sin(2*PI*1047*t))*min(1,t*5)*exp(-2.2*t)*(1+0.25*sin(2*PI*7*t))', 1.0, ECHO)),
    ('Bell strike + shimmer tail', mix('nova_d', [('kenney/impactBell_heavy_002.mp3', pitch(1.2) + ',volume=0.8'), (f'{S(2349, .2, 3)}+{S(3136, .15, 3.5)}', '')], 1.0, ECHO)),
    ('Deep boom + sparkle burst', synth('nova_e', f'{S(70, 1, 4)}+{S(2093, .25, 6)}+{S(2637, .2, 7)}+{S(3136, .18, 8)}+0.25*(random(0)*2-1)*exp(-10*t)', 0.9, ECHO)),
    ('Reverse swell into a hit', synth('nova_f', f'0.4*sin(2*PI*880*t)*(t<0.45)*(t/0.45)^3+{S(110, .9, 6)}*(t>0.45)+{S(1760, .3, 6)}*(t>0.45)', 1.0, ECHO)),
])
row('skill_sanctuary', 'Cleric: Sanctuary', 'A shield and strong healing on the most hurt hero', [
    ('Warm pad swell', synth('sanct_b', '(0.3*sin(2*PI*392*t)+0.25*sin(2*PI*494*t)+0.2*sin(2*PI*587*t))*min(1,t*3)*exp(-1.6*t)', 1.1, ECHO)),
    ('Glass shield ping + echo', mix('sanct_c', [('kenney/impactGlass_heavy_001.mp3', pitch(1.3) + ',volume=0.7'), (S(1568, .25, 4), '')], 1.0, ECHO)),
    ('Soft gong', mix('sanct_d', [('kenney/impactBell_heavy_001.mp3', pitch(0.85) + ',volume=0.9')], 1.2, ECHO)),
    ('Rising notes (C E G C)', synth('sanct_e', '0.35*(sin(2*PI*523*t)*(t<0.12)+sin(2*PI*659*t)*(t>=0.12)*(t<0.24)+sin(2*PI*784*t)*(t>=0.24)*(t<0.36)+sin(2*PI*1047*t)*(t>=0.36))*exp(-1.5*t)', 1.0, ECHO)),
    ('Airy whoosh + chime', mix('sanct_f', [('0.5*(random(0)*2-1)*min(1,t*4)*exp(-3*t)', 'bandpass=f=2500:w=1800'), (f'{S(2093, .3, 3)}*(t>0.2)', '')], 1.0, ECHO)),
])
row('grace', 'Cleric: Grace heal (NEW)', 'Every 7s she raises her staff and heals the most hurt hero (no sound yet; keep it quiet)', [
    ('Tiny two-note chime', synth('grace_a', f'{S(1568, .35, 7)}+{S(2093, .3, 7)}*(t>0.08)', 0.5, ECHO)),
    ('Soft sparkle', synth('grace_b', f'{S(2637, .25, 8)}+{S(3136, .2, 9)}+{S(3951, .15, 10)}', 0.4)),
    ('Faint high bell', mix('grace_c', [('kenney/impactBell_heavy_000.mp3', pitch(2.2) + ',volume=0.5')], 0.5, ECHO)),
    ('Breath up + glint', mix('grace_d', [('0.4*(random(0)*2-1)*min(1,t*5)*exp(-5*t)', 'highpass=f=2000'), (f'{S(2349, .3, 8)}*(t>0.15)', '')], 0.5)),
    ('One soft note with echo', synth('grace_e', '0.4*sin(2*PI*1319*t)*min(1,t*40)*exp(-6*t)', 0.6, ECHO)),
], now=False)

blobs = {}
for r in rows:
    for f in [r['nowFile']] + [o['file'] for o in r['add']]:
        if f: blobs[f] = 'data:audio/mpeg;base64,' + base64.b64encode(open(f'{OUT}/{f}', 'rb').read()).decode()
js = """
// ---------- round 10 (session 40): the CLERIC group at the top (made by docs/proposals/sounds/add-cleric.py)
(() => {
  const R = __R__;
  Object.assign(BLOBS, R.blobs);
  const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));
  const rows = R.rows.map((n) => {
    let old = null;
    for (const g of DATA.groups) { const i = g.rows.findIndex((r) => r.cue === n.cue); if (i >= 0) old = g.rows.splice(i, 1)[0]; }
    const opts = old ? old.options.slice() : [];
    if (n.nowFile) { const a = { id: 'A', desc: 'Game now', file: n.nowFile }; if (opts.length && opts[0].id === 'A') opts[0] = a; else opts.unshift(a); }
    for (const o of n.add) opts.push({ desc: 'NEW: ' + o.desc, file: o.file, id: letter(opts.length) });
    return { cue: n.cue, name: n.name, when: n.when, volume: n.volume, jitter: n.jitter, options: opts };
  });
  DATA.groups = DATA.groups.filter((g) => g.rows.length);
  DATA.groups.unshift({ name: 'Cleric', sub: 'Round 10: her attack, her two skills and her Grace heal. A = what the game plays now; NEW = just made.', rows });
  DATA.moments = DATA.groups.flatMap((g) => g.rows.map((r) => ({ group: g.name, cue: r.cue, name: r.name })));
})();
""".replace('__R__', json.dumps({'rows': rows, 'blobs': blobs}))
open(f'{OUT}/cleric-rows.js', 'w').write(js)
print(len(js) // 1024, 'KB', [f for f in os.listdir(OUT)])
