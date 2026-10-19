# Adds one sound board row per hero skill (cue `skill_<skillId>`, user: 'every skill sounds different'), with
# A = the shared skill cast sound the game plays now, then the library sounds that suit the skill (MAP = words matched
# in the sound names, taken in turn). Run after the board's options are extracted; then make-board.py.
# Usage: python3 add-skills.py <options_dir>
import json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..'))
OPT = sys.argv[1]
opts = json.load(open(f'{OPT}/options.json'))
snd = json.load(open(f'{ROOT}/src/data/sounds.json'))
heroes = json.load(open(f'{ROOT}/src/data/heroes.json'))
heroes = heroes if isinstance(heroes, list) else heroes['heroes']
MAX = 16
MAP = {
 'defense_bash': ['metal hit', 'sword strikes armor', 'warehouse metal', 'slam', 'axe norse', 'boxing punch', 'pot 0', 'metal 0'],
 'challenge': ['gong', 'creature roar', 'bell 0', 'warehouse metal', 'metal 0', 'powerup'],
 'brawl_leap': ['slam', 'bass hit', 'rock hit', 'falling 0', 'cannon', 'stones', 'punch'],
 'blood_feast': ['creature slime', 'potion drink', 'splash', 'creature hurt', 'bubble', 'weird'],
 'multistrike': ['blade', 'knifeslice', 'slash', 'combo', 'sword cutting flesh', 'swish'],
 'smoke_bomb': ['gentle swish', 'swish', 'teleport', 'weird', 'bubble', 'splash'],
 'arrow_rain': ['thunk', 'wood hit', 'swish', 'chop', 'combo'],
 'hunters_mark': ['pluck', 'lock', 'key open', 'select', 'confirmation', 'bell 0'],
 'wind_cutter3': ['slash', 'blade', 'knifeslice', 'axe norse', 'swish', 'sword'],
 'counter_stance': ['axe norse', 'sword strikes armor', 'metal hit', 'metal 0', 'spring metal', 'bell 0'],
 'mage_rotation': ['wizard fire', 'spell fire', 'fast magic spell', 'zap', 'thunder', 'glass hit', 'light spell'],
 'mage_ward': ['powerup', 'glass 00', 'item gem', 'light spell', 'magic bubbles', 'teleport'],
 'holy_nova': ['light spell', 'bell 0', 'happy bell', 'powerup', 'item gem', 'gong'],
 'sanctuary': ['powerup', 'light spell', 'bell 0', 'item gem', 'confirmation', 'page chime'],
 'death_coil3': ['weird', 'spell 0', 'bass hit', 'magic bubbles', 'creature misc', 'teleport'],
 'bone_sacrifice': ['stones', 'item stone', 'creature die', 'rock hit', 'falling 0', 'weird'],
 'discord': ['pluck', 'weird', 'error', 'creature misc', 'bell 0'],
 'change_song': ['pluck', 'happy bell', 'page chime', 'confirmation', 'bell 0', 'powerup'],
 'alch_barrage': ['glass breaking', 'glass hit', 'splash', 'bubble', 'pot 0'],
 'alch_brew': ['potion drink', 'bubble', 'magic bubbles', 'splash', 'glass 00', 'powerup'],
}
def letter(i):
    return chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)
lib = {}
for v in opts.values():
    for o in v:
        if o.get('yours'): lib.setdefault(o['file'], o['desc'])
# A = what every skill plays today (the shared skillCast cue).
now = snd['cues']['skillCast']
now_file = 'skillCast_now.mp3'
shutil.copy(f"{ROOT}/src/assets/sounds/{now['file']}.mp3", f'{OPT}/{now_file}')
for h in heroes:
    for kind in ('attack', 'support'):
        sid = h['skills'][kind]
        if sid not in MAP: sys.exit(f'add-skills.py: no MAP entry for skill {sid}')
        rows, seen = [{'id': 'A', 'desc': 'Now: shared skill cast', 'file': now_file}], set()
        # Take one sound per word in turn, so a skill gets a mix (not 7 'Spell fire' takes in a row).
        pools = [[f for f, desc in sorted(lib.items(), key=lambda x: x[1]) if word in desc.lower()] for word in MAP[sid]]
        while len(rows) < MAX and any(pools):
            for pool in pools:
                while pool and pool[0] in seen: pool.pop(0)
                if pool and len(rows) < MAX:
                    f = pool.pop(0); seen.add(f); rows.append({'id': letter(len(rows)), 'desc': lib[f], 'file': f, 'yours': True})
        opts['skill_' + sid] = rows
        print(h['name'], sid, len(rows) - 1, 'options')
json.dump(opts, open(f'{OPT}/options.json', 'w'), indent=1)
