# Puts the sound board picks into the game: copies each picked option mp3 to src/assets/sounds/picked/<cue>.mp3 and
# points the cue in sounds.json at it (the option already has its pitch / echo baked in, so `pitch` and `files` go).
# Picks JSON: {cue: 'A'..'Z'} or {cue: {'pick': 'lib' | letter, 'file': 'yours_x.mp3'}} (the board's db docs as they are). A = keep the game's current sound.
# Usage: python3 apply-picks.py <picks.json> <options_dir>
import json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..'))
picks, OPT = json.load(open(sys.argv[1])), sys.argv[2]
opts = json.load(open(f'{OPT}/options.json'))
p = f'{ROOT}/src/data/sounds.json'; snd = json.load(open(p))
os.makedirs(f'{ROOT}/src/assets/sounds/picked', exist_ok=True)
for cue, pk in picks.items():
    pick, file = (pk['pick'], pk.get('file')) if isinstance(pk, dict) else (pk, None)
    if pick == 'A' and not file: print(cue, 'A: keeps the current sound'); continue
    if not file: file = next(o['file'] for o in opts[cue] if o['id'] == pick)
    shutil.copy(f'{OPT}/{file}', f'{ROOT}/src/assets/sounds/picked/{cue}.mp3')
    if cue not in snd['cues']:  # a new cue, e.g. a hero skill's own sound (skill_<id>): skillCast's loudness, as on the board
        base = snd['cues']['skillCast']
        snd['cues'][cue] = {'volume': base['volume'], 'pitchJitter': base.get('pitchJitter', 0), 'minGapMs': 120}
    c = snd['cues'][cue]
    for k in ('files', 'pitch'): c.pop(k, None)
    c['file'] = f'picked/{cue}'
    c['source'] = file
    print(cue, pick, '->', file)
json.dump(snd, open(p, 'w'), indent=2); open(p, 'a').write('\n')
