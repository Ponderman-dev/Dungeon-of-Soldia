# Builds 5 sound OPTIONS (A-E) per game sound from the Kenney packs (CC0) with ffmpeg:
# layers (file, speed, gain, delay ms) mixed together, then optional lowpass / highpass / room echo, trimmed and
# peak-normalised. A = what the game plays now. Usage: python3 make-options.py <kenney_unzipped_dir> <out_dir>
import json, os, subprocess, sys, re
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FILES = {}
for root, _, names in os.walk(SRC):
    for n in names:
        if n.endswith('.ogg'): FILES[n[:-4]] = os.path.join(root, n)
ROOM = 'aecho=0.8:0.55:45|95:0.28|0.16'       # small stone room
HALL = 'aecho=0.8:0.6:120|260:0.3|0.18'       # bigger hall (bosses)
def L(name, rate=1.0, gain=1.0, delay=0, cut=None): return (name, rate, gain, delay, cut)
# Each option: (short description, [layers], extra filters)
R = {
 'hitMelee': [
  ('Now: punch', [L('impactPunch_medium_000')], []),
  ('Heavy punch, deeper, room', [L('impactPunch_heavy_001', .85)], ['lowpass=f=5000', ROOM]),
  ('Punch + deep thud', [L('impactPunch_medium_002'), L('impactSoft_heavy_000', .7, .8)], []),
  ('Blade bite: chop + punch', [L('chop', 1.0, .9), L('impactPunch_heavy_000', .9, .8)], []),
  ('Steel clash: slice + plate', [L('knifeSlice2', 1.1, .7, 0, .25), L('impactPlate_light_001', .8)], [])],
 'hitRanged': [
  ('Now: light wood', [L('impactWood_light_000')], []),
  ('Medium wood, deeper', [L('impactWood_medium_001', .85)], []),
  ('Plank + soft thud', [L('impactPlank_medium_000', .9), L('impactSoft_medium_000', .8, .7)], []),
  ('Heavy wood, muffled', [L('impactWood_heavy_002', 1.1)], ['lowpass=f=4000']),
  ('Thwip + thunk', [L('drawKnife1', 1.5, .5, 0, .18), L('impactWood_light_002', .8, 1, 90)], [])],
 'hitFire': [
  ('Now: soft heavy', [L('impactSoft_heavy_000', .9)], []),
  ('Deep whoomph, room', [L('impactSoft_heavy_001', .6)], [ROOM]),
  ('Rumble + thump', [L('impactMining_002', .6), L('impactSoft_heavy_000', .8)], ['lowpass=f=2500']),
  ('Low punch whoomph', [L('impactPunch_heavy_003', .55)], ['lowpass=f=1800', ROOM]),
  ('Rush + thump', [L('cloth3', .5, .8, 0, .3), L('impactSoft_heavy_002', .7, 1, 60)], [])],
 'hitIce': [
  ('Now: light glass', [L('impactGlass_light_000')], []),
  ('Medium glass, room', [L('impactGlass_medium_001', .8)], [ROOM]),
  ('Heavy glass + thud', [L('impactGlass_heavy_002', 1.1, .8), L('impactSoft_medium_001', .8, .6)], []),
  ('Crisp: metal tick + glass', [L('impactMetal_light_002', 1.6, .6), L('impactGlass_light_001', .9)], []),
  ('Low glass crack', [L('impactGlass_heavy_000', .75)], ['lowpass=f=6000'])],
 'hitElectric': [
  ('Now: light metal, high', [L('impactMetal_light_000', 1.3)], []),
  ('Crackle: metal + tin', [L('impactMetal_light_003', 1.8, .8), L('impactTin_medium_001', 1.5, .7, 30)], []),
  ('Snap: glass + metal', [L('impactGlass_light_003', 1.6, .8), L('impactMetal_medium_001', 1.2, .6)], []),
  ('Buzz: click + metal', [L('switch3', .8), L('impactMetal_light_001', 1.4, .8, 20)], []),
  ('Sharp rock snap', [L('impactMining_000', 1.5)], ['highpass=f=1500'])],
 'hitDark': [
  ('Now: soft, deep', [L('impactSoft_medium_000', .7)], []),
  ('Very deep thud, room', [L('impactSoft_heavy_000', .55)], ['lowpass=f=1500', ROOM]),
  ('Deep punch + cloth', [L('impactPunch_heavy_002', .6), L('cloth2', .6, .6)], ['lowpass=f=1200']),
  ('Doom bell (short)', [L('impactBell_heavy_001', .4, 1, 0, .6)], ['lowpass=f=900']),
  ('Deep wood, room', [L('impactWood_heavy_001', .6)], ['lowpass=f=1500', ROOM])],
 'hitHoly': [
  ('Now: high bell', [L('impactBell_heavy_000', 1.5)], []),
  ('Bell with long echo', [L('impactBell_heavy_001', 1.2)], [HALL]),
  ('Bright bell + glass', [L('impactBell_heavy_002', 2.0, .8), L('impactGlass_light_002', 1.2, .6)], []),
  ('Metal + bell', [L('impactMetal_light_004', 1.0, .7), L('impactBell_heavy_000', 1.4, .8)], []),
  ('Soft high bell, room', [L('impactBell_heavy_000', 1.8)], ['lowpass=f=6000', ROOM])],
 'crit': [
  ('Now: heavy punch', [L('impactPunch_heavy_000')], []),
  ('Deep punch + plate', [L('impactPunch_heavy_002', .75), L('impactPlate_medium_001', .9, .7)], []),
  ('Punch + metal', [L('impactPunch_heavy_004'), L('impactMetal_heavy_000', 1.0, .6)], []),
  ('Plate crash + punch', [L('impactPlate_heavy_001', 1.1, .8), L('impactPunch_heavy_001', .8)], []),
  ('Deep punch, room + slice', [L('impactPunch_heavy_000', .7), L('knifeSlice', 1.2, .5, 0, .25)], [ROOM])],
 'miss': [
  ('Now: cloth, higher', [L('cloth1', 1.3)], []),
  ('Cloth swish', [L('cloth2')], []),
  ('Low cloth', [L('cloth4', .8)], ['lowpass=f=3000']),
  ('Belt flick', [L('clothBelt', 1.4, 1, 0, .3)], []),
  ('Air swish (slice, soft)', [L('knifeSlice', 1.3, .7, 0, .3)], ['lowpass=f=4000'])],
 'block': [
  ('Now: metal medium', [L('impactMetal_medium_000')], []),
  ('Heavy metal', [L('impactMetal_heavy_001')], []),
  ('Metal, deeper, room', [L('impactMetal_medium_002', .8)], [ROOM]),
  ('Plate + metal ring', [L('impactPlate_medium_000'), L('impactMetal_light_001', 1.2, .6)], []),
  ('Short ting', [L('impactBell_heavy_002', 1.8, 1, 0, .35)], [])],
 'shieldSoak': [
  ('Now: medium glass', [L('impactGlass_medium_000')], []),
  ('Low glass', [L('impactGlass_light_001', .7)], []),
  ('Soft + glass', [L('impactSoft_medium_002', 1.2, .7), L('impactGlass_light_002', 1.3, .7)], []),
  ('Tin, deeper', [L('impactTin_medium_000', .8)], []),
  ('Muffled glass', [L('impactGlass_medium_002', .6)], ['lowpass=f=3000'])],
 'shieldBreak': [
  ('Now: heavy glass', [L('impactGlass_heavy_000')], []),
  ('Heavy glass, room', [L('impactGlass_heavy_001', .8)], [ROOM]),
  ('Double shatter', [L('impactGlass_heavy_002'), L('impactGlass_medium_000', 1.0, .7, 60)], []),
  ('Glass + metal', [L('impactGlass_heavy_000', 1.1), L('impactMetal_light_002', 1.2, .6)], []),
  ('Low shatter', [L('impactGlass_heavy_001', .65)], ['lowpass=f=4000'])],
 'stun': [
  ('Now: wood knock', [L('impactWood_heavy_000', 1.2)], []),
  ('Bonk + ding', [L('impactPunch_heavy_001', .9), L('impactBell_heavy_000', 2.2, .4, 40, .4)], []),
  ('Deep wood knock', [L('impactWood_heavy_002', .9)], []),
  ('Plank + metal ring', [L('impactPlank_medium_001', .8), L('impactMetal_light_000', 1.8, .5, 20)], []),
  ('Ding + thud', [L('impactBell_heavy_001', 2.5, .5, 0, .4), L('impactSoft_heavy_001', 1.0, .8)], [])],
 'freeze': [
  ('Now: glass, higher', [L('impactGlass_heavy_000', 1.25)], []),
  ('Glass + little crack', [L('impactGlass_heavy_001', .9), L('impactGlass_light_000', 1.0, .6, 80)], []),
  ('Rock + glass', [L('impactMining_001', 1.6, .7), L('impactGlass_medium_000', 1.0)], []),
  ('Low glass, room', [L('impactGlass_medium_001', .7)], [ROOM]),
  ('Bright crack', [L('impactGlass_heavy_002', 1.4)], ['lowpass=f=7000'])],
 'enemyDeath': [
  ('Now: leather drop', [L('dropLeather')], []),
  ('Soft heavy thud', [L('impactSoft_heavy_001', .8)], []),
  ('Drop + deep thud', [L('dropLeather', .85), L('impactSoft_medium_000', .6, .7)], []),
  ('Low punch', [L('impactPunch_medium_003', .6)], ['lowpass=f=1500']),
  ('Book drop + thud', [L('bookPlace2', .7), L('impactSoft_heavy_000', .9, .7)], [])],
 'heroFall': [
  ('Now: heavy plate, deep', [L('impactPlate_heavy_000', .7)], []),
  ('Deeper plate, room', [L('impactPlate_heavy_002', .6)], [ROOM]),
  ('Metal + thud', [L('impactMetal_heavy_001', .7), L('impactSoft_heavy_000', .6, .8)], []),
  ('Low bell (sad)', [L('impactBell_heavy_000', .5)], ['lowpass=f=1200']),
  ('Wood + plate', [L('impactWood_heavy_000', .55), L('impactPlate_light_000', .8, .6)], [])],
 'minionSummon': [
  ('Now: rock, deeper', [L('impactMining_000', .8)], []),
  ('Deep rock, room', [L('impactMining_001', .55)], [ROOM]),
  ('Thud + rock', [L('impactSoft_heavy_000', .5), L('impactMining_002', .9, .7)], []),
  ('Creak + thud', [L('creak3', .7, .7), L('impactSoft_heavy_001', .6)], []),
  ('Low wood', [L('impactWood_heavy_001', .5)], ['lowpass=f=1200'])],
 'itemProc': [
  ('Now: tin tap, high', [L('impactTin_medium_000', 1.4)], []),
  ('Metal click', [L('metalClick')], []),
  ('Latch', [L('metalLatch')], []),
  ('Tiny bell', [L('impactBell_heavy_002', 2.6, .5, 0, .35)], []),
  ('Leather + tin', [L('handleSmallLeather'), L('impactTin_medium_002', 1.6, .5)], [])],
 'bossIntro': [
  ('Now: deep bell', [L('impactBell_heavy_000', .45)], []),
  ('Deeper bell, hall echo', [L('impactBell_heavy_001', .35)], [HALL]),
  ('Bell + heavy plate', [L('impactBell_heavy_000', .5), L('impactPlate_heavy_000', .5, .8)], []),
  ('Heavy metal, hall', [L('impactMetal_heavy_000', .4)], [HALL]),
  ('Thud + bell', [L('impactSoft_heavy_000', .4), L('impactBell_heavy_002', .6, .8, 40)], [HALL])],
 'bossWarn': [
  ('Now: low bell', [L('impactBell_heavy_000', .6)], []),
  ('Low bell, room', [L('impactBell_heavy_002', .7)], [ROOM]),
  ('Heavy metal, low', [L('impactMetal_heavy_002', .6)], []),
  ('Bell + metal', [L('impactBell_heavy_001', .8), L('impactMetal_light_003', .9, .5)], []),
  ('Metal pot ring', [L('metalPot1', .8, 1, 0, .7)], [])],
 'bossMove': [
  ('Now: heavy plate', [L('impactPlate_heavy_000', .8)], []),
  ('Plate + deep thud', [L('impactPlate_heavy_001', .65), L('impactSoft_heavy_001', .6, .8)], []),
  ('Heavy metal, deep', [L('impactMetal_heavy_002', .7)], []),
  ('Deep punch + wood', [L('impactPunch_heavy_003', .6), L('impactWood_heavy_000', .7, .7)], []),
  ('Plate, room', [L('impactPlate_heavy_002', .7)], [ROOM])],
 'doorOpen': [
  ('Now: door 1', [L('doorOpen_1')], []),
  ('Door 2 (longer)', [L('doorOpen_2')], []),
  ('Creak + latch', [L('metalLatch'), L('creak1', 1.0, .9, 120)], []),
  ('Creak', [L('creak2')], []),
  ('Door 1, deeper, room', [L('doorOpen_1', .85)], [ROOM])],
 'step': [
  ('Now: soft step', [L('footstep00')], []),
  ('Stone (concrete)', [L('footstep_concrete_000')], []),
  ('Wood floor', [L('footstep_wood_000')], []),
  ('Carpet (very soft)', [L('footstep_carpet_000')], []),
  ('Stone, room', [L('footstep_concrete_002')], [ROOM])],
 'itemGiven': [
  ('Now: small coins', [L('handleCoins2')], []),
  ('Coins (longer)', [L('handleCoins', 1.0, 1, 0, .6)], []),
  ('Belt buckle', [L('beltHandle1')], []),
  ('Leather', [L('handleSmallLeather2')], []),
  ('Book put down', [L('bookPlace1')], [])],
}
def build(cue, i, desc, layers, filters):
    out = f'{OUT}/{cue}_{"ABCDE"[i]}.mp3'
    args, parts = ['ffmpeg', '-nostdin', '-v', 'error', '-y'], []
    for j, (name, rate, gain, delay, cut) in enumerate(layers):
        if name not in FILES: raise SystemExit(f'missing {name} for {cue}')
        args += ['-i', FILES[name]]
        f = f'[{j}:a]aformat=channel_layouts=mono,aresample=44100'
        if cut: f += f',atrim=0:{cut},afade=t=out:st={cut*0.7}:d={cut*0.3}'
        f += f',asetrate={int(44100*rate)},aresample=44100,volume={gain}'
        if delay: f += f',adelay={delay}'
        parts.append(f + f'[l{j}]')
    mix = ''.join(f'[l{j}]' for j in range(len(layers))) + f'amix=inputs={len(layers)}:normalize=0:duration=longest'
    chain = ','.join([mix] + filters + ['silenceremove=stop_periods=1:stop_threshold=-55dB:stop_silence=0.05']) + '[m]'
    args += ['-filter_complex', ';'.join(parts + [chain]), '-map', '[m]', '-ac', '1', '-b:a', '64k', out + '.tmp.mp3']
    subprocess.run(args, check=True)
    # peak-normalise to -1 dB so options compare fairly (the game's cue volume then sets the level)
    peak = re.search(r'max_volume: (-?[\d.]+) dB', subprocess.run(['ffmpeg', '-nostdin', '-i', out + '.tmp.mp3', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr)
    gain = -1 - float(peak.group(1)) if peak else 0
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', out + '.tmp.mp3', '-af', f'volume={gain}dB', '-b:a', '64k', out], check=True)
    os.remove(out + '.tmp.mp3')
    return {'id': 'ABCDE'[i], 'desc': desc, 'file': os.path.basename(out)}
index = {cue: [build(cue, i, *opt) for i, opt in enumerate(opts)] for cue, opts in R.items()}
json.dump(index, open(f'{OUT}/options.json', 'w'), indent=1)
print(sum(len(v) for v in index.values()), 'options')
