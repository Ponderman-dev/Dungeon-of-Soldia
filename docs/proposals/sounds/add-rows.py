# Adds new moment rows straight into a saved sound board page (keeps every other row and the db picks untouched).
# Round 8 (2026-10-20): heroDeath (the low bell when a hero falls) and the 'Begin descent' sounds (descend + gateSlam).
# Usage: python3 add-rows.py <board.html in> <board.html out> <work dir>
# Option A = what the game plays now; B.. = variations made with ffmpeg; green letters = sounds already on the board.
import json, base64, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SND = ROOT + '/src/assets/sounds/'
IN, OUT, WORK = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(IN).read().split('\n')
di = next(i for i, l in enumerate(lines) if l.startswith('const DATA = '))
bi = next(i for i, l in enumerate(lines) if l.startswith('const BLOBS = '))
def parse(l, name):
    body = l[len(f'const {name} = '):].rstrip()
    return json.loads(body[:-1] if body.endswith(';') else body), body.endswith(';')
data, dsemi = parse(lines[di], 'DATA'); blobs, bsemi = parse(lines[bi], 'BLOBS')
snd = json.load(open(ROOT + '/src/data/sounds.json'))

def make(name, src, rate=1.0, extra=''):
    out = f'{WORK}/{name}'
    af = f'asetrate=44100*{rate},aresample=44100' + (',' + extra if extra else '') + ',loudnorm=I=-16:TP=-1'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', SND + src, '-af', af, '-ac', '1', '-b:a', '64k', out], check=True)
    blobs[name] = 'data:audio/mpeg;base64,' + base64.b64encode(open(out, 'rb').read()).decode()
    return name

def ours(id_, desc, file): return {'id': id_, 'desc': desc, 'file': file}
def lib(desc, file):
    assert file in blobs, file
    return {'desc': desc, 'file': file, 'yours': True}

def row(cue, name, when, opts):
    c = snd['cues'][cue]
    letters = [chr(65 + i) if i < 26 else 'A' + chr(65 + i - 26) for i in range(len(opts))]
    for o, l in zip(opts, letters): o['id'] = l
    return {'cue': cue, 'name': name, 'when': when, 'volume': c.get('volume', 1), 'jitter': c.get('pitchJitter', 0), 'options': opts}

hero_death = row('heroDeath', 'Hero death knell', 'Plays with the red screen flash when a hero falls (on top of "A hero falls")', [
    ours('', 'Now: low bell toll', make('heroDeath_A.mp3', 'kenney/impactBell_heavy_001.mp3', 0.6)),
    ours('', 'Deeper bell', make('heroDeath_B.mp3', 'kenney/impactBell_heavy_000.mp3', 0.48)),
    ours('', 'Higher bell', make('heroDeath_C.mp3', 'kenney/impactBell_heavy_002.mp3', 0.78)),
    ours('', 'Bell, stone-room echo', make('heroDeath_D.mp3', 'kenney/impactBell_heavy_001.mp3', 0.6, 'aecho=0.8:0.7:180|420:0.4|0.25')),
    ours('', 'Boss gong', make('heroDeath_E.mp3', 'picked/bossIntro.mp3', 0.85)),
    lib('New: Gong 01', 'new_100-cc0-sfx-gong-01.mp3'), lib('New: Gong 02', 'new_100-cc0-sfx-gong-02.mp3'),
    lib('New: Bell 01', 'new_100-cc0-sfx-bell-01.mp3'), lib('New: Bell 02', 'new_100-cc0-sfx-bell-02.mp3'),
    lib('PIXABAY Videogame death', 'pixabay_videogame-death-sound-43894.mp3'), lib('PIXABAY Game over', 'pixabay_game-over-417465.mp3'),
    lib('Yours: Losing / failing', 'yours_player-losing-or-failing-2042.mp3'), lib('PIXABAY Low monster roar', 'pixabay_low-monster-roar-97413.mp3'),
])
descend = row('descend', 'Begin descent: button', 'Tapping BEGIN DESCENT on the squad screen', [
    ours('', 'Now: Organic start', make('descend_A.mp3', 'organic/start.mp3')),
    ours('', 'Organic success', make('descend_B.mp3', 'organic/success.mp3')),
    ours('', 'Organic unlock', make('descend_C.mp3', 'organic/unlock.mp3')),
    ours('', 'Organic achievement', make('descend_D.mp3', 'organic/achievement.mp3')),
    ours('', 'Start, lower', make('descend_E.mp3', 'organic/start.mp3', 0.75)),
    lib('PIXABAY Game bonus', 'pixabay_game-bonus-144751.mp3'), lib('PIXABAY Level up 05', 'pixabay_level-up-05-326133.mp3'),
    lib('PIXABAY Casting magic 3', 'pixabay_casting-magic-3-382381.mp3'), lib('PIXABAY Button', 'pixabay_button-394464.mp3'),
    lib('New: Confirmation 001', 'new_kenney-interfacesounds-audio-confirmation-001.mp3'), lib('New: Gong 01', 'new_100-cc0-sfx-gong-01.mp3'),
])
gate = row('gateSlam', 'Begin descent: gate slams open', 'Right after the button, when the big entrance door bursts open', [
    ours('', 'Now: deep THUMP', make('gateSlam_A.mp3', 'picked/gateSlam.mp3')),
    ours('', 'Deeper THUMP', make('gateSlam_B.mp3', 'picked/gateSlam.mp3', 0.8)),
    ours('', 'THUMP, long echo', make('gateSlam_C.mp3', 'picked/gateSlam.mp3', 1.0, 'aecho=0.8:0.7:250|600:0.45|0.3')),
    ours('', 'Door opens (floor door)', make('gateSlam_D.mp3', 'picked/doorOpen.mp3', 0.8)),
    lib('New: Door open', 'new_100-cc0-sfx-door-open.mp3'), lib('New: Door 02', 'new_100-cc0-sfx-2-sfx100v2-door-02.mp3'),
    lib('New: Door 05', 'new_100-cc0-sfx-2-sfx100v2-door-05.mp3'), lib('New: Wood hit 02', 'new_75-cc0-breaking-falling-hit-sfx-bfh1-wood-hit-02.mp3'),
    lib('PIXABAY Hitting wall', 'pixabay_hitting-wall-85571.mp3'), lib('PIXABAY Heavy body fall', 'pixabay_heavy-body-fall-352446.mp3'),
    lib('New: Stones 01', 'new_80-cc0-rpg-sfx-stones-01.mp3'), lib('New: Gong 02', 'new_100-cc0-sfx-gong-02.mp3'),
])
groups = data['groups']
for g in groups:  # re-running replaces the rows instead of adding them twice
    g['rows'] = [r for r in g['rows'] if r['cue'] not in ('heroDeath', 'descend', 'gateSlam')]
groups[:] = [g for g in groups if g['rows'] or g['name'] != 'Squad screen']
fighters = next(g for g in groups if g['name'] == 'Fighters')
fighters['rows'].insert(next(i for i, r in enumerate(fighters['rows']) if r['cue'] == 'heroFall') + 1, hero_death)
groups.insert(next(i for i, g in enumerate(groups) if g['name'] == 'Menus') + 1, {'name': 'Squad screen', 'sub': 'NEW (round 8): the sounds when you tap BEGIN DESCENT.', 'rows': [descend, gate]})
data['moments'] = [{'group': g['name'], 'cue': r['cue'], 'name': r['name']} for g in groups for r in g['rows']]
lines[di] = 'const DATA = ' + json.dumps(data) + (';' if dsemi else '')
lines[bi] = 'const BLOBS = ' + json.dumps(blobs) + (';' if bsemi else '')
html = '\n'.join(lines).replace('sounds, round 7', 'sounds, round 8', 1)
html = html.replace('<p class="lead"><b>NEW in round 7:</b>', '<p class="lead"><b>NEW in round 8:</b> <b>Hero death knell</b> (Fighters: the bell with the red flash when a hero falls) and a <b>Squad screen</b> group with the two <b>Begin descent</b> sounds (the button, then the gate slamming open).</p>\n    <p class="lead"><b>NEW in round 7:</b>', 1)
open(OUT, 'w').write(html)
print(len(html) // 1024, 'KB')
