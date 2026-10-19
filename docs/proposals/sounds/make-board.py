# Builds the sound board page (5 options per sound + jingles) from options.json (make-options.py) and sounds.json.
# Page 1 = the moments (incl. one row per hero skill from add-skills.py); page 2 = every library sound with a moment picker.
# Usage: python3 make-board.py <options_dir> <jingles_mp3_dir> <out.html>
import json, base64, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
OPT, JING, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
snd = json.load(open(ROOT + '/src/data/sounds.json')); opts = json.load(open(OPT + '/options.json'))
GROUPS = [
 ('Hits', 'One per damage type.', [('hitMelee', 'Melee hit', 'Sword, axe, dagger, claws'), ('hitRanged', 'Arrow hit', 'Archer, Bard, Skeleton Archer'), ('hitFire', 'Fire hit', 'Fireball, Fire Bombs'), ('hitIce', 'Ice hit', 'Frost Nova, Chill Band'), ('hitElectric', 'Electric hit', 'Chain Lightning, Static Crystal'), ('hitDark', 'Dark hit', 'Death Coil, Cultist'), ('hitHoly', 'Holy hit', 'Smite'), ('crit', 'Critical hit', 'Plays on top of the normal hit')]),
 ('Defense', 'When a hit does not land, or a shield takes it.', [('miss', 'Miss / dodge', 'Evasion, Blind'), ('block', 'Block / parry / immune', 'Shield Totem, Focus Stance, Divine Shield'), ('shieldSoak', 'Shield soaks a hit', 'Arcane Ward, Bone Ward'), ('shieldBreak', 'Shield breaks', 'A shield used up by damage')]),
 ('Statuses', '', [('stun', 'Stun lands', "Shield Bash, Gambler's Dice"), ('freeze', 'Freeze lands', '5 Chill stacks, Chill Band')]),
 ('Fighters', '', [('enemyDeath', 'Enemy or minion dies', 'Every kill'), ('heroFall', 'A hero falls', 'A hero dies'), ('minionSummon', 'Minion rises', 'Skeletons, item minions'), ('itemProc', 'Item goes off', 'With the item icon pop')]),
 ('Bosses', '', [('bossIntro', 'Boss floor starts', 'Floors 20, 40 ... 160'), ('bossWarn', 'Boss winds up a move', 'With the red bar'), ('bossMove', 'Boss move goes off', 'Cleaver Charge, Blizzard ...')]),
 ('Dungeon & rewards', '', [('doorOpen', 'Door opens', 'Floor cleared'), ('step', 'Footsteps', 'Heroes walking to the door'), ('itemGiven', 'Item given', 'Give on the reward sheet')]),
 ('Run moments', 'Menu sounds today (Organic pack); your sounds as other options.', [('levelUp', 'Level up', 'A hero levels up'), ('potion', 'Potion', 'Shared Potion on the reward sheet'), ('defeat', 'Defeat', 'The whole squad falls')]),
 ('Skills', 'The shared sounds. A skill with its own pick below plays that instead.', [('skillCast', 'Skill goes off', 'Any skill without its own sound'), ('interrupted', 'Skill interrupted', 'Stunned or frozen during the wind-up')]),
 ('Special rooms', 'New rows: chests, fountain, puzzle.', [('chestOpen', 'Chest opens', 'Treasure room'), ('fountain', 'Drink from the fountain', 'Rest fountain'), ('puzzleSlide', 'Puzzle tile slides', 'Puzzle room'), ('puzzleSolved', 'Puzzle solved', 'Puzzle room')]),
 ('Menus', 'New rows: buttons and the reward sheet.', [('tap', 'Button tap', 'Every button'), ('rewardUp', 'Reward sheet slides up', 'After a floor'), ('rewardCard', 'Reward card appears', 'Each card rising in')]),
]
heroes = json.load(open(ROOT + '/src/data/heroes.json')); heroes = heroes if isinstance(heroes, list) else heroes['heroes']
skills = json.load(open(ROOT + '/src/data/skills.json')); skills = skills.get('skills', skills)
skill_rows = []
for h in heroes:
    for kind in ('attack', 'support'):
        sid = h['skills'][kind]
        if 'skill_' + sid in opts: skill_rows.append(('skill_' + sid, f"{h['name']}: {skills[sid]['name']}", skills[sid].get('description', '')))
if skill_rows: GROUPS.insert(GROUPS.index(next(g for g in GROUPS if g[0] == 'Skills')) + 1, ('Hero skills', 'NEW: one sound per skill, so every skill sounds different. A = the shared skill sound every skill plays today.', skill_rows))
blobs = {}
groups = []
for g, sub, rows in GROUPS:
    out = []
    for cue, name, when in rows:
        c = snd['cues'].get(cue) or snd['cues']['skillCast']
        for o in opts[cue]:
            blobs[o['file']] = 'data:audio/mpeg;base64,' + base64.b64encode(open(f"{OPT}/{o['file']}", 'rb').read()).decode()
        out.append({'cue': cue, 'name': name, 'when': when, 'volume': c.get('volume', 1), 'jitter': c.get('pitchJitter', 0), 'options': opts[cue]})
    groups.append({'name': g, 'sub': sub, 'rows': out})
jing = {f[:-4]: 'data:audio/mpeg;base64,' + base64.b64encode(open(f'{JING}/{f}', 'rb').read()).decode() for f in sorted(os.listdir(JING)) if f.endswith('.mp3')}
lib = {}
for v in opts.values():
    for o in v:
        if o.get('yours') and o['file'] not in lib:
            lib[o['file']] = {'file': o['file'], 'name': o['desc'].replace('Yours: ', '').replace('New: ', 'New · ')}
            blobs[o['file']] = 'data:audio/mpeg;base64,' + base64.b64encode(open(f"{OPT}/{o['file']}", 'rb').read()).decode()
library = sorted(lib.values(), key=lambda x: x['name'])
# Page 2 shows what each library sound is used for in the game today (a cue's `source` names the option file).
for c, v in snd['cues'].items():
    if v.get('source') in lib: lib[v['source']].setdefault('inGame', []).append(c)
html = open(HERE + '/board-template.html').read()
html = html.replace('__DATA__', json.dumps({'groups': groups, 'master': snd['masterVolume'], 'library': library, 'moments': [{'group': g['name'], 'cue': r['cue'], 'name': r['name']} for g in groups for r in g['rows']]})).replace('__BLOBS__', json.dumps(blobs)).replace('__JINGLES__', json.dumps(jing))
open(OUT, 'w').write(html)
print(len(html) // 1024, 'KB')
