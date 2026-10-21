# Round 9 (2026-10-21, user: 'update the menu sounds and opening menu on the sound board'): refreshes the Menus group
# straight in a saved board page (db picks untouched). Option A of tap / rewardUp / rewardCard is re-made from what the
# game plays NOW, and new rows: cardOpen (a menu window opens), cardClose, heroPick, heroBack, scroll.
# Usage: python3 add-menus.py <board.html in> <board.html out> <work dir>
import json, base64, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SND = ROOT + '/src/assets/sounds/'
IN, OUT, WORK = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(WORK, exist_ok=True)
lines = open(IN).read().split('\n')
di = next(i for i, l in enumerate(lines) if l.startswith('const DATA = '))
bi = next(i for i, l in enumerate(lines) if l.startswith('const BLOBS = '))
def parse(l, name):
    body = l[len(f'const {name} = '):].rstrip()
    return json.loads(body[:-1] if body.endswith(';') else body), body.endswith(';')
data, dsemi = parse(lines[di], 'DATA'); blobs, bsemi = parse(lines[bi], 'BLOBS')
snd = json.load(open(ROOT + '/src/data/sounds.json'))
pack = snd.get('pack', 'organic')

def path(f):  # a cue file name -> its mp3 (a name without a folder is in the pack folder)
    return SND + (f if '/' in f else pack + '/' + f) + '.mp3'

def make(name, src, rate=1.0, extra=''):
    out = f'{WORK}/{name}'
    af = f'asetrate=44100*{rate},aresample=44100' + (',' + extra if extra else '') + ',loudnorm=I=-16:TP=-1'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', af, '-ac', '1', '-b:a', '64k', out], check=True)
    blobs[name] = 'data:audio/mpeg;base64,' + base64.b64encode(open(out, 'rb').read()).decode()
    return name

def ours(desc, file): return {'desc': desc, 'file': file}
def lib(desc, file):
    assert file in blobs, file
    return {'desc': desc, 'file': file, 'yours': True}

def row(cue, name, when, opts):
    c = snd['cues'][cue]
    for i, o in enumerate(opts): o['id'] = chr(65 + i) if i < 26 else 'A' + chr(65 + i - 26)
    return {'cue': cue, 'name': name, 'when': when, 'volume': c.get('volume', 1), 'jitter': c.get('pitchJitter', 0), 'options': opts}

def now(cue):  # the game's sound for a cue (its first take)
    c = snd['cues'][cue]
    return path(c['files'][0] if 'files' in c else c['file'])

menus = next(g for g in data['groups'] if g['name'] == 'Menus')
old = {r['cue']: r for r in menus['rows']}
# A = the game sound now (re-made), the old B.. options kept.
for cue, desc in (('tap', 'Now: PIXABAY Button'), ('rewardUp', 'Now: card fan'), ('rewardCard', 'Now: card place')):
    r = old[cue]
    r['options'][0] = {'id': 'A', 'desc': desc, 'file': make(f'{cue}_A.mp3', now(cue))}
old['tap']['when'] = 'Every button: TAP TO START, TO DUNGEON, the reward sheet...'

UI_OPEN = [lib('New: Open 001', 'new_kenney-interfacesounds-audio-open-001.mp3'), lib('New: Open 002', 'new_kenney-interfacesounds-audio-open-002.mp3'),
           lib('New: Open 003', 'new_kenney-interfacesounds-audio-open-003.mp3'), lib('New: Cardfan1', 'new_kenney-casinoaudio-audio-cardfan1.mp3'),
           lib('New: Page turn 1', 'new_bb-books-paper-writing-jan-2021-page-turn-1.mp3'), lib('New: Page turn 2', 'new_bb-books-paper-writing-jan-2021-page-turn-2.mp3'),
           lib('New: Gentle swish', 'new_micro-pack-organic-wooshes-gentle-swish.mp3'), lib('New: Wooden box open', 'new_100-cc0-sfx-wooded-box-open.mp3')]
UI_CLOSE = [lib('New: Cardplace1', 'new_kenney-casinoaudio-audio-cardplace1.mp3'), lib('New: Cardplace2', 'new_kenney-casinoaudio-audio-cardplace2.mp3'),
            lib('New: Page turn 3', 'new_bb-books-paper-writing-jan-2021-page-turn-3.mp3'), lib('New: Swish 1', 'new_micro-pack-organic-wooshes-swish-1.mp3'),
            lib('New: Gentle swish', 'new_micro-pack-organic-wooshes-gentle-swish.mp3'), lib('New: Select 001', 'new_kenney-interfacesounds-audio-select-001.mp3')]
UI_PICK = [lib('New: Select 001', 'new_kenney-interfacesounds-audio-select-001.mp3'), lib('New: Select 002', 'new_kenney-interfacesounds-audio-select-002.mp3'),
           lib('New: Select 003', 'new_kenney-interfacesounds-audio-select-003.mp3'), lib('New: Click1', 'new_kenney-uiaudio-audio-click1.mp3'),
           lib('New: Click2', 'new_kenney-uiaudio-audio-click2.mp3'), lib('PIXABAY Button click', 'pixabay_button-click-289742.mp3'),
           lib('Yours: Retro click', 'yours_video-game-retro-click-237.mp3')]
O = lambda f: SND + 'organic/' + f + '.mp3'
card_open = row('cardOpen', 'Menu window opens', 'A window opens: a hero card on the squad screen, an NPC at camp, Profile, Settings', [
    ours('Now: card slide (1 of 3 takes)', make('cardOpen_A.mp3', SND + 'picked/cardOpen_1.mp3')),
    ours('Card slide, take 2', make('cardOpen_B.mp3', SND + 'picked/cardOpen_2.mp3')),
    ours('Card slide, lower', make('cardOpen_C.mp3', SND + 'picked/cardOpen_1.mp3', 0.8)),
    ours('Organic open', make('cardOpen_D.mp3', O('open'))),
    ours('Organic swipe', make('cardOpen_E.mp3', O('swipe'))),
] + UI_OPEN)
card_close = row('cardClose', 'Menu window closes', 'Tapping outside a window or its X', [
    ours('Now: Organic close', make('cardClose_A.mp3', O('close'))),
    ours('Card slide, reversed', make('cardClose_B.mp3', SND + 'picked/cardOpen_1.mp3', 1.0, 'areverse')),
    ours('Card slide, lower', make('cardClose_C.mp3', SND + 'picked/cardOpen_2.mp3', 0.8)),
    ours('Organic deselect', make('cardClose_D.mp3', O('deselect'))),
    ours('Close, lower', make('cardClose_E.mp3', O('close'), 0.8)),
] + UI_CLOSE)
hero_pick = row('heroPick', 'Squad screen: hero picked', 'Adding a hero to the squad', [
    ours('Now: Organic select', make('heroPick_A.mp3', O('select'))),
    ours('Organic press', make('heroPick_B.mp3', O('press'))),
    ours('Select, lower', make('heroPick_C.mp3', O('select'), 0.8)),
    ours('Organic receive', make('heroPick_D.mp3', O('receive'))),
] + UI_PICK)
hero_back = row('heroBack', 'Squad screen: hero taken out', 'Taking a hero out of the squad', [
    ours('Now: Organic deselect', make('heroBack_A.mp3', O('deselect'))),
    ours('Deselect, lower', make('heroBack_B.mp3', O('deselect'), 0.8)),
    ours('Organic close', make('heroBack_C.mp3', O('close'))),
] + UI_PICK[:3] + UI_CLOSE[:2])
scroll = row('scroll', 'Squad screen: scroll', 'Swiping the hero list', [
    ours('Now: Organic swipe', make('scroll_A.mp3', O('swipe'))),
    ours('Swipe, softer and lower', make('scroll_B.mp3', O('swipe'), 0.85, 'volume=0.7')),
    lib('New: Gentle swish', 'new_micro-pack-organic-wooshes-gentle-swish.mp3'), lib('New: Swish 2', 'new_micro-pack-organic-wooshes-swish-2.mp3'),
    lib('New: Page turn 1', 'new_bb-books-paper-writing-jan-2021-page-turn-1.mp3'), lib('New: Cardfan1', 'new_kenney-casinoaudio-audio-cardfan1.mp3'),
])
new = ('cardOpen', 'cardClose', 'heroPick', 'heroBack', 'scroll')
menus['rows'] = [r for r in menus['rows'] if r['cue'] not in new]  # re-running replaces them
menus['rows'] = menus['rows'][:1] + [card_open, card_close] + menus['rows'][1:] + [hero_pick, hero_back, scroll]
menus['sub'] = 'Round 9: A is what the game plays now. NEW rows: menu window opens / closes, squad screen pick / take out / scroll.'
data['moments'] = [{'group': g['name'], 'cue': r['cue'], 'name': r['name']} for g in data['groups'] for r in g['rows']]
lines[di] = 'const DATA = ' + json.dumps(data) + (';' if dsemi else '')
lines[bi] = 'const BLOBS = ' + json.dumps(blobs) + (';' if bsemi else '')
html = '\n'.join(lines).replace('sounds, round 8', 'sounds, round 9', 1)
html = html.replace('<p class="lead"><b>NEW in round 8:</b>', '<p class="lead"><b>NEW in round 9:</b> the <b>Menus</b> group is up to date (A = what the game plays now) and has new rows: <b>Menu window opens</b> and <b>closes</b> (hero cards, the camp NPCs, Profile, Settings) and the squad screen <b>hero picked / taken out / scroll</b>.</p>\n    <p class="lead"><b>NEW in round 8:</b>', 1)
open(OUT, 'w').write(html)
print(len(html) // 1024, 'KB')
