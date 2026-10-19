# Adds the user's Pixabay batch (Soldia_New_Sound_Effect.zip, 2026-10-19) to the sound board: each file is cleaned
# (silence cut, length cap, fade out, mono mp3, peak -1 dB) and added as 'PIXABAY <name>' options under the moments and
# hero skills it suits (MAP). Files with no moment (the music loop) go to page 2 only (options.json '_library').
# Credits: docs/credits-sounds.md. Run AFTER add-skills.py (it rebuilds the skill rows), then make-board.py.
# Usage: python3 add-pixabay.py <dir with the Pixabay mp3s> <options_dir>
import json, os, re, subprocess, sys
SRC, OPT = sys.argv[1], sys.argv[2]
# Pixabay file = <author>-<title words>-<id>.mp3. Authors with a '-' in their name must be listed here.
AUTHORS = ['dragon-studio']
# id -> (name, max seconds, [cues it may suit]); 'skill_<id>' = a hero skill row.
MAP = {
 '352446': ('Heavy body fall', 1.6, ['heroFall', 'enemyDeath', 'skill_brawl_leap']),
 '268903': ('Shine 3', 2.5, ['levelUp', 'itemProc', 'skill_holy_nova', 'skill_sanctuary']),
 '561890': ('Short electric zap', 0.8, ['hitElectric', 'skill_mage_rotation']),
 '561891': ('Short electric', 1.4, ['hitElectric', 'skill_mage_rotation']),
 '334777': ('Electric shock', 1.0, ['hitElectric', 'stun', 'skill_mage_rotation']),
 '386163': ('Lightning spell', 1.1, ['hitElectric', 'skill_mage_rotation']),
 '378617': ('Water magic 5', 2.5, ['fountain', 'skill_alch_brew', 'skill_mage_ward']),
 '378604': ('Iced magic 4', 2.5, ['hitIce', 'freeze', 'skill_mage_rotation']),
 '378605': ('Iced magic 5', 2.5, ['hitIce', 'freeze', 'skill_mage_rotation']),
 '378639': ('Fire magic 5', 2.5, ['hitFire', 'skill_mage_rotation', 'skill_alch_barrage']),
 '382388': ('Warp magic 5', 2.5, ['minionSummon', 'skill_smoke_bomb', 'skill_mage_ward']),
 '378601': ('Earth magic 6', 2.5, ['bossMove', 'skill_brawl_leap', 'skill_bone_sacrifice']),
 '382381': ('Casting magic 3', 2.5, ['skillCast', 'skill_mage_ward', 'skill_death_coil3']),
 '6005': ('Magic spell', 1.7, ['skillCast', 'itemProc', 'skill_death_coil3']),
 '384915': ('Appear magic', 2.4, ['minionSummon', 'skill_bone_sacrifice', 'skill_mage_ward']),
 '90335': ('Open strings guitar', 3.0, ['skill_change_song', 'skill_discord']),
 '100702': ('Mandolin strum', 2.5, ['skill_change_song', 'skill_discord']),
 '394464': ('Button', 0.3, ['tap']),
 '289742': ('Button click', 0.3, ['tap']),
 '513360': ('UI hover', 0.7, ['tap', 'rewardCard']),
 '82822': ('Ping', 1.3, ['itemProc', 'skill_hunters_mark']),
 '291227': ('Notification', 1.1, ['itemProc', 'levelUp']),
 '326133': ('Level up 05', 1.4, ['levelUp', 'puzzleSolved']),
 '144751': ('Game bonus', 2.5, ['levelUp', 'puzzleSolved', 'chestOpen']),
 '97413': ('Low monster roar', 3.0, ['bossIntro', 'bossWarn', 'skill_challenge']),
 '567196': ('Punch impact hit', 1.2, ['hitMelee', 'crit', 'stun', 'skill_defense_bash', 'skill_brawl_leap']),
 '85571': ('Hitting wall', 1.5, ['stun', 'bossMove', 'skill_defense_bash']),
 '388936': ('RPG sword combo 21', 1.0, ['hitMelee', 'crit', 'skill_multistrike', 'skill_wind_cutter3', 'skill_counter_stance']),
 '388940': ('RPG sword combo 22', 1.0, ['hitMelee', 'crit', 'skill_multistrike', 'skill_wind_cutter3', 'skill_counter_stance']),
 '388941': ('RPG sword combo 24', 1.0, ['hitMelee', 'crit', 'skill_multistrike', 'skill_wind_cutter3', 'skill_counter_stance']),
 '388938': ('RPG sword combo 27', 1.0, ['hitMelee', 'crit', 'skill_multistrike', 'skill_wind_cutter3', 'skill_counter_stance']),
 '143940': ('Shield block (shortsword)', 1.2, ['block', 'skill_counter_stance', 'skill_defense_bash']),
 '6963': ('Shield guard', 0.9, ['block', 'shieldSoak', 'skill_challenge']),
 '268901': ('Shine 8', 1.8, ['hitHoly', 'skill_holy_nova', 'skill_sanctuary']),
 '306037': ('Many arrows flying by', 2.5, ['skill_arrow_rain']),
 '352302': ('Wet squelch impact', 1.2, ['enemyDeath', 'skill_blood_feast', 'skill_alch_barrage']),
 '351023': ('Rising bubbly pop', 1.1, ['potion', 'fountain', 'skill_alch_brew']),
 '417465': ('Game over', 3.1, ['defeat']),
 '43894': ('Videogame death', 3.2, ['heroFall', 'defeat']),
 '291244': ('Dramatic music loop', 24.1, []),
}
def letter(i):
    return chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)
def split(base):
    m = re.fullmatch(r'(.+)-(\d+)', base)
    rest, pid = m.group(1), m.group(2)
    author = next((a for a in AUTHORS if rest.startswith(a + '-')), rest.split('-')[0])
    return author, rest[len(author) + 1:], pid
def convert(src, out, maxs):
    tmp = out + '.tmp.mp3'
    fade = min(0.25, maxs * 0.3)
    af = f'silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:{maxs},afade=t=out:st={maxs - fade}:d={fade},areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse'
    # (trailing silence is cut on the reversed sound: stop_periods would cut at the FIRST quiet gap, e.g. between guitar plucks)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src, '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', tmp], check=True)
    peak = re.search(r'max_volume: (-?[\d.]+) dB', subprocess.run(['ffmpeg', '-nostdin', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={-1 - float(peak.group(1)) if peak else 0}dB', '-b:a', '64k', out], check=True)
    os.remove(tmp)
idx = json.load(open(f'{OPT}/options.json'))
credits, seen, added = [], set(), 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.mp3') or ' (1)' in f: continue  # '(1)' = a second download of the same file
    base = f[:-4]
    author, slug, pid = split(base)
    if pid not in MAP: sys.exit(f'add-pixabay.py: no MAP entry for {f}')
    if pid in seen: continue
    seen.add(pid)
    name, maxs, cues = MAP[pid]
    out = f'pixabay_{slug}-{pid}.mp3'
    convert(f'{SRC}/{f}', f'{OPT}/{out}', maxs)
    opt = {'desc': f'PIXABAY {name}', 'file': out, 'yours': True}
    for cue in cues or ['_library']:
        if cue not in idx and cue != '_library': sys.exit(f'add-pixabay.py: no board row {cue} (run add-skills.py first)')
        rows = idx[cue] = [o for o in idx.get(cue, []) if o['file'] != out]
        rows.append({'id': letter(len(rows)), **opt})
        added += 1
    credits.append({'name': name, 'title': slug.replace('-', ' '), 'author': author, 'id': pid, 'file': out, 'source': f, 'url': f'https://pixabay.com/sound-effects/{slug}-{pid}/'})
json.dump(idx, open(f'{OPT}/options.json', 'w'), indent=1)
json.dump(credits, open(f'{OPT}/pixabay-credits.json', 'w'), indent=1)
print(len(credits), 'Pixabay sounds,', added, 'options added; credits in', f'{OPT}/pixabay-credits.json')
