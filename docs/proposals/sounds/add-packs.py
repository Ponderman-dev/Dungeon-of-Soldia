# Adds free CC0 sound packs (downloaded from GitHub, see PACKS) to the sound board as new options (green letters,
# "New: ...") under the moments they fit, and adds rows for moments that had none (skills, rooms, menus).
# Each file is trimmed (silence), capped in length, faded, mono mp3, peak -1 dB (same as add-yours.py).
# Usage: python3 add-packs.py <packs dir> <options_dir>
#   <packs dir> holds the clones: CC0-Public-Domain-Sounds (github.com/lavenderdotpet/CC0-Public-Domain-Sounds, CC0)
#   and sound-effects-library-weapons (github.com/PanderMusubi/sound-effects-library-weapons, CC0).
import glob, json, os, re, subprocess, sys
PK, OPT = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..'))
C = f'{PK}/CC0-Public-Domain-Sounds'
# (glob under the packs dir, max seconds, [cues it may suit]). Names come from the file names.
MAP = [
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/blade_0[123].ogg', 0.8, ['hitMelee', 'crit']),
 ('CC0-Public-Domain-Sounds/kenney_rpgaudio/Audio/knifeSlice*.ogg', 0.7, ['hitMelee']),
 ('CC0-Public-Domain-Sounds/kenney_rpgaudio/Audio/chop.ogg', 0.7, ['hitMelee', 'stun']),
 ('CC0-Public-Domain-Sounds/Micro Pack - Organic Wooshes/Slash.wav', 0.8, ['hitMelee', 'crit']),
 ('sound-effects-library-weapons/samples/axe-norse-sword-blade-on-blade.ogg', 1.0, ['hitMelee', 'block', 'crit']),
 ('CC0-Public-Domain-Sounds/Micro Pack - Organic Wooshes/Thunk [12].wav', 0.6, ['hitRanged']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_wood_hit_0[123].ogg', 0.6, ['hitRanged']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/spell_fire_0[1-7].ogg', 1.2, ['hitFire']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_glass_hit_0[12].ogg', 0.8, ['hitIce', 'freeze']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/item_gem_0[1-4].ogg', 0.8, ['hitIce', 'shieldSoak', 'itemProc', 'hitHoly']),
 ('CC0-Public-Domain-Sounds/100-cc0-sfx-2/sfx100v2_thunder_01.ogg', 1.5, ['hitElectric', 'bossMove']),
 ('CC0-Public-Domain-Sounds/kenney_digitalaudio/Audio/zap[12].ogg', 0.6, ['hitElectric']),
 ('CC0-Public-Domain-Sounds/kenney_digitalaudio/Audio/zapTwoTone*.ogg', 0.6, ['hitElectric']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/spell_0[12].ogg', 1.2, ['hitDark', 'skillCast', 'minionSummon']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/weird_0[1-5].ogg', 1.0, ['hitDark']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/bell_0[1-3].ogg', 1.5, ['hitHoly', 'itemProc', 'puzzleSolved']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_metal_hit_0[1245].ogg', 0.9, ['crit', 'block']),
 ('CC0-Public-Domain-Sounds/100-cc0-sfx-2/sfx100v2_metal_hit_0[12].ogg', 0.9, ['crit', 'block']),
 ('CC0-Public-Domain-Sounds/Micro Pack - Organic Wooshes/Swish [1-6].wav', 0.5, ['miss']),
 ('CC0-Public-Domain-Sounds/Micro Pack - Organic Wooshes/Gentle Swish.wav', 0.5, ['miss']),
 ('CC0-Public-Domain-Sounds/Micro Pack - Organic Wooshes/Combo [1-4].wav', 1.0, ['skillCast']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/metal_0[1-6].ogg', 0.8, ['block']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_glass_breaking_0[1-6].ogg', 1.2, ['shieldBreak', 'freeze', 'interrupted']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_rock_hit_01.ogg', 0.8, ['stun']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/pot_0[12].ogg', 0.8, ['stun']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_die_01.ogg', 1.2, ['enemyDeath']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_hurt_0[12].ogg', 0.9, ['enemyDeath']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_slime_0[1-4].ogg', 0.9, ['enemyDeath']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_falling_0[1-4].ogg', 1.0, ['enemyDeath', 'heroFall']),
 ('CC0-Public-Domain-Sounds/75-cc0-breaking-falling-hit-sfx/bfh1_metal_falling_0[1-3].ogg', 1.4, ['heroFall']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_misc_0[1-4].ogg', 1.0, ['minionSummon']),
 ('CC0-Public-Domain-Sounds/50-cc0-sci-fi-sfx/teleport_0[12].ogg', 1.2, ['minionSummon']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/confirmation_00[1-4].ogg', 0.8, ['itemProc', 'puzzleSolved', 'levelUp']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/pluck_00[12].ogg', 0.5, ['itemProc', 'tap']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/select_00[1-4].ogg', 0.5, ['itemProc', 'tap', 'rewardCard']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/glass_00[1-3].ogg', 0.6, ['itemProc']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/item_misc_0[1-3].ogg', 0.6, ['itemProc']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/gong_0[12].ogg', 3.0, ['bossIntro']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_roar_0[1-3].ogg', 1.8, ['bossIntro', 'bossWarn']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/creature_monster_0[1-4].ogg', 1.5, ['bossWarn']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/slam_0[2-5].ogg', 1.0, ['bossMove']),
 ('CC0-Public-Domain-Sounds/25-CC0-bang-sfx/cannon_0[12].ogg', 1.5, ['bossMove']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/door_open.ogg', 1.5, ['doorOpen']),
 ('CC0-Public-Domain-Sounds/100-cc0-sfx-2/sfx100v2_door_0[25].ogg', 1.5, ['doorOpen']),
 ('CC0-Public-Domain-Sounds/100-cc0-sfx-2/sfx100v2_footstep_0[12].ogg', 0.4, ['step']),
 ('CC0-Public-Domain-Sounds/100-cc0-sfx-2/sfx100v2_footstep_wood_0[24].ogg', 0.4, ['step']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/item_coins_0[1-4].ogg', 0.9, ['itemGiven', 'chestOpen']),
 ('CC0-Public-Domain-Sounds/kenney_digitalaudio/Audio/powerUp[1-6].ogg', 1.0, ['levelUp', 'puzzleSolved', 'skillCast']),
 ('CC0-Public-Domain-Sounds/40-cc0-water-splash-slime-sfx/splash_0[1-5].ogg', 1.2, ['potion', 'fountain']),
 ('CC0-Public-Domain-Sounds/40-cc0-water-splash-slime-sfx/bubble_0[1-3].ogg', 1.2, ['potion', 'fountain']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/error_00[1-4].ogg', 0.6, ['interrupted']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/wooded_box_open.ogg', 1.2, ['chestOpen']),
 ('CC0-Public-Domain-Sounds/100-CC0-SFX/key_open_0[12].ogg', 1.0, ['chestOpen']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/lock_0[1-3].ogg', 1.0, ['chestOpen']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/stones_0[1-4].ogg', 0.5, ['puzzleSlide']),
 ('CC0-Public-Domain-Sounds/80-CC0-RPG-SFX/item_stone_0[1-4].ogg', 0.5, ['puzzleSlide']),
 ('CC0-Public-Domain-Sounds/bb - Books, Paper, Writing (Jan 2021)/Page Turn [123].wav', 0.8, ['rewardCard']),
 ('CC0-Public-Domain-Sounds/kenney_casinoaudio/Audio/cardPlace[1-4].ogg', 0.6, ['rewardCard']),
 ('CC0-Public-Domain-Sounds/kenney_uiaudio/Audio/click[1-3].ogg', 0.4, ['tap']),
 ('CC0-Public-Domain-Sounds/kenney_interfacesounds/Audio/open_00[1-3].ogg', 0.8, ['rewardUp']),
 ('CC0-Public-Domain-Sounds/kenney_casinoaudio/Audio/cardFan[12].ogg', 0.8, ['rewardUp']),
]
# Rows for moments the board did not have yet: option A = the sound the game plays there now.
NEW_ROWS = ['skillCast', 'interrupted', 'tap', 'rewardUp', 'rewardCard', 'chestOpen', 'fountain', 'puzzleSlide', 'puzzleSolved']


def pretty(path):
    base = os.path.splitext(os.path.basename(path))[0]
    base = re.sub(r'^(sfx100v2_|bfh1_)', '', base).replace('_', ' ').replace('-', ' ')
    return re.sub(r'\s+', ' ', base).strip().capitalize()


def convert(src, out, maxs):
    tmp = out + '.tmp.mp3'
    fade = min(0.25, maxs * 0.3)
    af = f'silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:{maxs},afade=t=out:st={maxs - fade}:d={fade},silenceremove=stop_periods=1:stop_threshold=-55dB:stop_silence=0.05'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src, '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', tmp], check=True)
    peak = re.search(r'max_volume: (-?[\d.]+) dB', subprocess.run(['ffmpeg', '-nostdin', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={-1 - float(peak.group(1)) if peak else 0}dB', '-b:a', '64k', out], check=True)
    os.remove(tmp)


idx = json.load(open(f'{OPT}/options.json'))
snd = json.load(open(f'{ROOT}/src/data/sounds.json'))
for cue in NEW_ROWS:
    if cue in idx:
        continue
    c = snd['cues'][cue]
    name = c['file'] if '/' in c['file'] else f"{snd['pack']}/{c['file']}"
    src = f'{ROOT}/src/assets/sounds/{name}.mp3'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '64k', f'{OPT}/{cue}_A.mp3'], check=True)
    idx[cue] = [{'id': 'A', 'desc': 'Now: the game sound', 'file': f'{cue}_A.mp3'}]

added = files = 0
for pattern, maxs, cues in MAP:
    found = sorted(glob.glob(f'{PK}/{pattern}'))
    if not found:
        print('nothing for', pattern)
    for src in found:
        out = 'new_' + re.sub(r'[^a-z0-9]+', '-', os.path.splitext(os.path.relpath(src, PK).split('/', 1)[1])[0].lower()).strip('-') + '.mp3'
        convert(src, f'{OPT}/{out}', maxs)
        files += 1
        for cue in cues:
            opts = idx[cue] = [o for o in idx[cue] if o['file'] != out]
            letter = chr(ord('A') + len(opts)) if len(opts) < 26 else f'Z{len(opts) - 25}'
            opts.append({'id': letter, 'desc': f'New: {pretty(src)}', 'file': out, 'yours': True})
            added += 1
json.dump(idx, open(f'{OPT}/options.json', 'w'), indent=1)
print(added, 'options added from', files, 'files')
