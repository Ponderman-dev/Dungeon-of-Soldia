# Adds the user's own sound files (e.g. Mixkit wavs) to the sound board as extra options (F, G, ...) under the game
# moments they fit. Each file is trimmed (silence), capped in length, faded, mono mp3, peak -1 dB.
# Usage: python3 add-yours.py <dir with the user's files> <options_dir>
import json, os, re, subprocess, sys
SRC, OPT = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..'))
# file (without .wav) -> (short name, max seconds, [cues it may suit])
MAP = {
 'mixkit-sword-strikes-armor-2765': ('Sword strikes armor', 1.0, ['hitMelee', 'block', 'crit']),
 'mixkit-sword-cutting-flesh-2788': ('Sword cutting flesh', 1.0, ['hitMelee', 'crit']),
 'mixkit-punch-with-a-hard-whistle-2050': ('Punch with a hard whistle', 1.0, ['crit', 'hitMelee']),
 'mixkit-martial-arts-fast-punch-2047': ('Fast punch', 0.8, ['hitMelee']),
 'mixkit-martial-arts-punch-2052': ('Martial arts punch', 0.8, ['hitMelee', 'stun']),
 'mixkit-boxing-punch-2051': ('Boxing punch', 0.8, ['hitMelee', 'crit', 'stun']),
 'mixkit-weak-hit-impact-2148': ('Weak hit', 0.6, ['hitRanged', 'hitMelee', 'shieldSoak']),
 'mixkit-warehouse-metal-hit-3139': ('Warehouse metal hit', 1.6, ['block', 'bossMove', 'bossWarn']),
 'mixkit-spring-metal-hit-2302': ('Spring metal hit', 1.2, ['block', 'hitElectric']),
 'mixkit-futuristic-bass-hit-2303': ('Bass hit', 2.0, ['bossIntro', 'bossMove', 'hitDark']),
 'mixkit-wizard-fire-woosh-1326': ('Wizard fire woosh', 1.1, ['hitFire']),
 'mixkit-light-spell-873': ('Light spell', 1.5, ['hitHoly', 'hitIce']),
 'mixkit-fast-magic-game-spell-883': ('Fast magic spell', 1.2, ['hitElectric', 'itemProc']),
 'mixkit-magic-bubbles-spell-2999': ('Magic bubbles', 1.2, ['minionSummon', 'hitDark']),
 'mixkit-falling-hit-on-gravel-756': ('Fall on gravel', 1.2, ['enemyDeath', 'heroFall']),
 'mixkit-body-impact-falling-into-the-sand-2498': ('Body falls in sand', 1.1, ['enemyDeath', 'heroFall']),
 'mixkit-walking-on-stones-loop-1269': ('Walking on stones (one step cut out)', 0.45, ['step']),
 'mixkit-video-game-retro-click-237': ('Retro click', 0.3, ['itemProc']),
 'mixkit-page-forward-single-chime-1107': ('Page chime', 1.2, ['itemGiven', 'itemProc']),
 'mixkit-thin-metal-card-deck-shuffle-3175': ('Metal card shuffle', 1.0, ['itemGiven']),
 'mixkit-happy-bell-alert-601': ('Happy bell', 1.5, ['levelUp', 'itemProc']),
 'mixkit-game-magical-potion-drink-2828': ('Potion drink', 1.2, ['potion']),
 'mixkit-player-losing-or-failing-2042': ('Losing / failing', 3.0, ['defeat', 'heroFall']),
}
idx = json.load(open(f'{OPT}/options.json'))
snd = json.load(open(f'{ROOT}/src/data/sounds.json'))
# Menu moments that get a row too: option A = the Organic sound the game plays now.
for cue in ['potion', 'levelUp', 'defeat']:
    if cue not in idx:
        src = f"{ROOT}/src/assets/sounds/{snd['pack']}/{snd['cues'][cue]['file']}.mp3"
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '64k', f'{OPT}/{cue}_A.mp3'], check=True)
        idx[cue] = [{'id': 'A', 'desc': 'Now: Organic menu sound', 'file': f'{cue}_A.mp3'}]
def convert(src, out, maxs, start=0.0):
    tmp = out + '.tmp.mp3'
    fade = min(0.25, maxs * 0.3)
    af = f'silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:{maxs},afade=t=out:st={maxs - fade}:d={fade},silenceremove=stop_periods=1:stop_threshold=-55dB:stop_silence=0.05'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(start), '-i', src, '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', tmp], check=True)
    peak = re.search(r'max_volume: (-?[\d.]+) dB', subprocess.run(['ffmpeg', '-nostdin', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={-1 - float(peak.group(1)) if peak else 0}dB', '-b:a', '64k', out], check=True)
    os.remove(tmp)
added = 0
for base, (name, maxs, cues) in MAP.items():
    src = f'{SRC}/{base}.wav'
    if not os.path.exists(src): print('missing', src); continue
    out = f'yours_{base[7:]}.mp3'
    convert(src, f'{OPT}/{out}', maxs, 1.0 if 'walking' in base else 0.0)
    for cue in cues:
        opts = idx[cue] = [o for o in idx[cue] if o['file'] != out]
        opts.append({'id': chr(ord('A') + len(opts)), 'desc': f'Yours: {name}', 'file': out, 'yours': True})
        added += 1
json.dump(idx, open(f'{OPT}/options.json', 'w'), indent=1)
print(added, 'options added from', len(MAP), 'files')
