# MUSIC BOARD ROUND 9 (session 53; user: 'rearrange my songs into a soundtrack, and add more xDeviruchi').
# Shows: (1) your 6 loves, (2) MIXES = the loves cut / reordered / joined by make-mixes.py (previews play intro + loop
# twice), (3) the NEW xDeviruchi '16-bit Fantasy & Adventure (2025)' pack (22 songs, own licence: commercial OK,
# edits OK, credit 'Original music by Marllon Silva (xDeviruchi)'; loop points from its DOCUMENTATION & LICENSE.pdf,
# previews = intro + loop body twice), (4) stings. Screens: title, camp, squad, battle, boss, sting.
# Usage: python3 make-board9.py <sources dir> <mixes dir> <out dir>
#   sources dir has the clones (sound.md) + 'xd16' = the pack's 'Loopable + one shots/ogg' folder
#   + 'xd_title_loop.wav' = xDeviruchi 'Title Theme (Loop).wav' from the 8-bit pack's separated files.
import sys, os, re, subprocess, json, base64, glob
SRC, MIX, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
RB = 'superpowers-asset-packs/rpg-battle-system/music/'; NA = 'superpowers-asset-packs/ninja-adventure/musics/'
CC0 = ('CC0', 'free, no credit needed'); XDL = ('CREDIT', 'CC BY-SA 4.0: credit "xDeviruchi"; an edited version stays CC BY-SA')
X16L = ('CREDIT', 'free in a paid game, edits OK; credit "Original music by Marllon Silva (xDeviruchi)"')
def enc(src, dst, cap=None, ss=0):
    af = 'loudnorm=I=-16:TP=-1.5:LRA=11'
    if cap: af += f',afade=t=out:st={cap - 3}:d=3'
    cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-i', src] + (['-t', str(cap)] if cap else []) + ['-af', af, '-ar', '44100', '-ac', '1', '-b:a', '64k', dst]
    if not os.path.exists(dst): subprocess.run(cmd, check=True)
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
opts = []
def add(oid, src, screen, tag, title, desc, by, lic, cap=None):
    enc(src, os.path.join(OUT, 'm', oid + '.mp3'), cap)
    opts.append({'id': oid.replace('_', ':', 1), 'file': 'm/' + oid + '.mp3', 'screen': screen, 'tag': tag, 'title': title, 'desc': desc, 'by': by, 'lic': lic[0], 'licText': lic[1]})
# 1. YOUR LOVES (as you heard them)
LOVES = [('free_xd_title', SRC + '/benesmartin_necromancers-mystery/audio/soundtrack/title.mp3', 'title', 'Title Theme (8-bit)', 'xDeviruchi', XDL),
         ('free_na6', SRC + '/' + NA + 'theme-6.ogg', 'camp', 'Ninja Adventure: Theme 6', 'Pixel-boy', CC0),
         ('free_rb12', SRC + '/' + RB + 'theme-12.ogg', 'squad', 'RPG Battle: Theme 12', 'Pixel-boy', CC0),
         ('free_rb8', SRC + '/' + RB + 'theme-8.ogg', 'battle', 'RPG Battle: Theme 8', 'Pixel-boy', CC0),
         ('free_rb10', SRC + '/' + RB + 'theme-10.ogg', 'battle', 'RPG Battle: Theme 10', 'Pixel-boy', CC0),
         ('free_rb14', SRC + '/' + RB + 'theme-14.ogg', 'boss', 'RPG Battle: Theme 14', 'Pixel-boy', CC0)]
for oid, f, scr, t, by, lic in LOVES: add(oid, f, scr, 'pick', t, 'Your LOVE, as it is now (plays on repeat).', by, lic, 120)
# 2. MIXES of your loves
MIXES = [
  ('mix_title', SRC + '/xd_title_loop.wav', 'title', 'Title Theme: game loop', "Your love as the game would play it: xDeviruchi's own loop version (no silence at the end, starts again smoothly).", 'xDeviruchi', XDL),
  ('mix_camp_loop', MIX + '/camp_loop_preview.wav', 'camp', 'Theme 6: camp loop', 'Ninja Adventure 6 without its fading last bars, so it never dips: the warm part loops forever (69 s loop).', 'Pixel-boy, rearranged', CC0),
  ('mix_camp_night', MIX + '/camp_night_preview.wav', 'camp', 'Theme 6: camp at night', 'The camp loop 12% slower (same notes and pitch) and a little softer on top: calmer, sleepier.', 'Pixel-boy, rearranged', CC0),
  ('mix_squad_medley', MIX + '/squad_medley_preview.wav', 'squad', 'Squad medley: Theme 12 + Theme 6', 'RPG 12, then the middle of Ninja Adventure 6 slowed to the same speed. They share a key, so one flows into the other: a 78 s loop instead of 30 s. The change of song (at 0:30) may be noticeable.', 'Pixel-boy, rearranged', CC0),
  ('mix_battle8_energy', MIX + '/battle8_energy_preview.wav', 'battle', 'Theme 8: full energy', 'RPG 8 with its quiet break taken out: after the opening it only loops the driving parts (37 s loop).', 'Pixel-boy, rearranged', CC0),
  ('mix_battle_suite', MIX + '/battle_suite_preview.wav', 'battle', 'Battle suite: Theme 8 into Theme 10', 'Your two battle loves as ONE long loop (96 s): RPG 8 (driving parts) sped up to RPG 10\'s speed, then all of RPG 10. Less repetition on long runs. The change of song (at 0:34) may be noticeable.', 'Pixel-boy, rearranged', CC0),
  ('mix_battle_suite_long', MIX + '/battle_suite_long_preview.wav', 'battle', 'NEW: Battle suite LONG (Pokemon-style)', 'Your battle suite grown into a 2:10 loop: the RPG 8 theme, then all of RPG 10 (0:41), a BUILD-UP where the bass drops out and comes back (1:36), then the RPG 8 theme TWO STEPS HIGHER for the climax (1:43), and round again (2:17). Fixed: no more glitchy drum fills.', 'Pixel-boy, rearranged', CC0),
  ('mix_battle8_long', MIX + '/battle8_long_preview.wav', 'battle', 'NEW: Theme 8 LONG', 'Theme 8 full energy, a build-up (0:44), then the whole theme TWO STEPS HIGHER (0:52), back to the start (1:21). 74 s loop instead of 37 s. Fixed: no more glitchy drum fills.', 'Pixel-boy, rearranged', CC0),
  ('mix_battle10_long', MIX + '/battle10_long_preview.wav', 'battle', 'NEW: Theme 10 LONG', 'All of RPG 10 with a build-up at its end (0:55), then all of it again TWO STEPS HIGHER (1:02), back to the start (2:03).', 'Pixel-boy, rearranged', CC0),
  ('mix_tr_land_soft', MIX + '/tr_land_soft_preview.wav', 'blend', 'C. Build-up lands, softened (your pick)', "RPG 8's build-up (0:14) lands on RPG 10's loud part with a half-second blend (0:20).", 'Pixel-boy, rearranged', CC0),
  ('mix_tr_land_drum', MIX + '/tr_land_drum_preview.wav', 'blend', 'C + drum bar', "Same timing as C: the last bar of RPG 8's build-up (0:18) is RPG 10's drum hit, then RPG 10's loud part lands at 0:20, like in C.", 'Pixel-boy, rearranged', CC0),
  ('mix_boss_rising', MIX + '/boss_rising_preview.wav', 'boss', 'Theme 14: rising', 'RPG 14 twice, then twice one step higher and a bit faster, so the fight heats up; then round again (88 s loop instead of 23 s).', 'Pixel-boy, rearranged', CC0),
  ('mix_boss_rage', MIX + '/boss_rage_preview.wav', 'boss', 'Theme 14: rage', 'RPG 14 two steps higher and 10% faster: an idea for when the boss drops below half HP (the game would switch to it).', 'Pixel-boy, rearranged', CC0),
]
for oid, f, scr, t, d, by, lic in MIXES: add(oid, f, scr, 'mix', t, d, by, lic, 250 if dur(f) > 250 else None)
# 3. NEW: xDeviruchi 16-bit pack. (file number, screen, short use note). Loop points from the pack's PDF.
LOOP = {3: (23.106, 74.483), 4: (0, 85.807), 5: (10.760, 62.608), 6: (8.501, 32.0), 7: (2.135, 76.8), 8: (0, 53.615),
        9: (0.63, 63.278), 10: (0, 92.957), 11: (11.503, 54.715), 12: (0, 73.41), 13: (0.167, 107.502), 14: (2.675, 71.287),
        16: (2.438, 83.267), 17: (13.846, 82.308), 19: (0.639, 66.032), 21: (36.416, 92.6), 22: (5.337, 114.667)}
X16 = [(2, 'title', 'Their new 16-bit title song.'), (1, 'title', 'A long, story-like opening (no loop).'),
       (20, 'title', 'Adventure-setting-out mood (no loop).'), (22, 'title', 'Finale / credits mood; could also be an end-of-run song.'),
       (14, 'camp', 'Town / home mood.'), (3, 'camp', 'Town mood.'), (7, 'camp', 'Town by the sea mood.'),
       (8, 'camp', 'Shop mood: could play at the camp merchant.'), (4, 'camp', 'Calm forest mood.'), (19, 'camp', 'Open-world travel mood.'),
       (11, 'squad', 'Proud, royal mood.'), (16, 'squad', 'Getting ready before danger: fits picking your squad.'),
       (5, 'battle', 'Their main battle song.'), (9, 'battle', 'Their second battle song.'),
       (10, 'battle', 'Dungeon / ruins mood: could be the floor music between fights.'), (12, 'battle', 'Ice dungeon mood.'),
       (13, 'boss', 'Boss battle.'), (17, 'boss', 'Second boss battle, darker.'), (21, 'boss', 'Final boss battle (long build-up).'),
       (6, 'sting', 'Full Victory! song (the short sting version is above).')]
files = {int(os.path.basename(f)[:2]): f for f in glob.glob(os.path.join(SRC, 'xd16', '*.ogg'))}
import numpy as np
def level(f, t0, t1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t0), '-t', str(t1 - t0), '-i', f, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
for n, scr, note in X16:
    f = files[n]; title = re.sub(r'^\d+ - ', '', os.path.basename(f)[:-4]).strip(); d = dur(f); oid = f'x16_{n:02d}'
    if n in LOOP:
        a, L = LOOP[n]; tmp = os.path.join(OUT, oid + '.wav')
        if not os.path.exists(os.path.join(OUT, 'm', oid + '.mp3')):   # intro + loop body twice, as the game would play it
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-i', f, '-filter_complex',
                            f'[0]atrim=0:{a + L}[p];[1]atrim={a}:{a + L},asetpts=PTS-STARTPTS[q];[p][q]concat=n=2:v=0:a=1', tmp], check=True)
        intro = f'{a:.0f} s intro, then a {L:.0f} s loop' if a > 1 else f'{L:.0f} s loop'
        src = tmp
    else: intro = f'{d:.0f} s, plays once (no loop)'; src = f
    calm = level(f, 0, 4) - level(f, 0, min(d, 60))
    start = ' Starts quiet.' if calm < -6 and scr in ('battle', 'boss') else (' Full energy from the start.' if scr in ('battle', 'boss') else '')
    add(oid, src, scr, 'new', title, f'NEW 16-bit. {note} {intro}.{start}', 'xDeviruchi (16-bit Fantasy & Adventure, 2025)', X16L, 150)
    if os.path.exists(os.path.join(OUT, oid + '.wav')): os.remove(os.path.join(OUT, oid + '.wav'))
# 4. STINGS
for oid, f, t, d in [('mix_sting_victory', MIX + '/sting_victory_preview.wav', 'Victory! (short)', 'The opening of xDeviruchi\'s Victory!, cut before its loop with a fade: a jingle after a floor or boss is won (10 s).'),
                     ('x16_18', MIX + '/sting_defeat_preview.wav', 'Never Give Up', 'A short xDeviruchi piece (8 s): could play when the whole squad falls (Game Over).'),
                     ('x16_15', MIX + '/sting_rest_preview.wav', 'Peaceful Night', 'A short xDeviruchi piece (11 s): could play at a rest / fountain room, or when you get back to camp.')]:
    add(oid, f, 'sting', 'mix' if oid.startswith('mix') else 'new', t, d, 'xDeviruchi (16-bit Fantasy & Adventure, 2025)', X16L)
# PICKED (session 53): title + camp = mix_title, squad = RPG 12 as is, boss = boss_final. The board now shows only
# these (screen 'picked') + the battle floors; everything else is hidden (the files stay published).
add('mix_boss_final', MIX + '/boss_final_preview.wav', 'boss', 'pick', 'Boss: rising into rage', 'Your pick (B + C): RPG 14 twice, then one step higher and faster (0:45), then two steps higher and faster again (1:28), then round again (2:09).', 'Pixel-boy, rearranged', CC0, 250)
PICK = {'mix:title': 'Title + Base camp', 'free:rb12': 'Hero select', 'mix:battle8_long': 'Battle floors (takes turns)', 'mix:battle10_long': 'Battle floors (takes turns)', 'mix:boss_final': 'Boss fights'}
for o in opts:
    if o['id'] in PICK: o['screen'] = 'picked'; o['tag'] = 'pick'; o['title'] = PICK[o['id']] + ': ' + o['title'].replace('Boss: ', '')
opts = [o for o in opts if o['screen'] == 'picked']   # user: battle = F + G taking turns -> the soundtrack is complete
opts.sort(key=lambda o: list(PICK).index(o['id']))
# ---------- page ----------
T = open(os.path.join(HERE, 'board2-template.html')).read()
INTRO = '<p class="lede">Round 9: <b>your loves, rearranged into a soundtrack</b>, plus <b>22 new xDeviruchi songs</b> from their 16-bit pack (2025): the same console style as your loves. Gold <b>YOUR PICK</b> = your loves as they are. Blue <b>MIX</b> = your loves cut up, reordered and joined for the game (the preview plays the start once, then the loop twice, so you can hear if the loop point is smooth). Green <b>NEW</b> = the new xDeviruchi songs. Tap <b>PLAY</b>, then <b>LOVE</b> / <b>MAYBE</b> / <b>NO</b>.</p>'
T = re.sub(r'<p class="lede">.*?</p>', lambda m: INTRO, T, count=1, flags=re.S)
T = T.replace('Soldia Music Board · Round 2', 'Soldia Music Board · Round 9')
T = re.sub(r'<div class="key">.*?</div>', '<div class="key"><span><span class="tag CC0">CC0</span> free, no credit needed.</span><span><span class="tag lic">CREDIT</span> free, but the game\'s credits must name the composer (normal for games).</span></div>', T, count=1, flags=re.S)
T = T.replace('<p>Other music ideas: a song per boss, a short victory jingle after a floor, a Game Over tune…</p>', '<p>Ideas: a rage version when the boss is low, a shop song at the camp merchant, a different song every 20 floors… Anything you want changed in a MIX (e.g. "battle suite but no speed-up")?</p>')
T = re.sub(r'<details class="lic">.*?</details>', '<details class="lic"><summary>About the credit lines</summary><p>xDeviruchi\'s 16-bit pack: free in a game you sell, and we may edit it; the credits must say "Original music by Marllon Silva (xDeviruchi)". The 8-bit Title Theme is CC BY-SA 4.0: credit "xDeviruchi", and our edited loop stays CC BY-SA. Pixel-boy\'s songs are CC0: no credit needed (we will thank them anyway). I keep this list for the credits screen.</p></details>', T, count=1, flags=re.S)
SCREENS = "const SCREENS = [\n  ['picked', 'Your soundtrack', 'Every screen is picked. Next: putting the music into the game.'],\n];"
T = re.sub(r'const SCREENS = \[.*?\n\];', lambda m: SCREENS, T, count=1, flags=re.S)
T = T.replace("const ORDER = { pick: 0, ours: 1, new: 2, r1: 3 };", "const ORDER = { pick: 0, mix: 1, new: 2 };")
T = T.replace(""": o.tag === 'r1' ? '<span class="badge r1">ROUND 1</span>'""", """: o.tag === 'mix' ? '<span class="badge mix">MIX</span>'""")
T = T.replace('.badge.r1 { background: var(--soft); color: var(--fg); }', '.badge.mix { background: var(--code); color: #000; }')
T = T.replace('placeholder="e.g. Hearthfire but slower, or Fjeld for the camp…"', 'placeholder="e.g. Battle suite but without the speed-up…"')
T = T.replace('.sort((a, b) => ORDER[a.tag] - ORDER[b.tag])', '.sort((a, b) => (ORDER[a.tag] ?? 9) - (ORDER[b.tag] ?? 9))')
# TIMELINE (user: 'a timeline so I can drag the needle to some parts'): a seek bar in the sticky bar + every 'm:ss'
# in a card's text is a button that jumps there. Songs load as blobs so seeking always works.
T = T.replace('<div class="vol"><label for="vol">VOLUME</label>', '<div class="seek"><span id="tcur">0:00</span><input id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Song position" disabled><span id="tdur">0:00</span></div>\n    <div class="vol"><label for="vol">VOLUME</label>')
T = T.replace('details.lic { font-size', '.seek { flex: 1 1 100%; display: flex; gap: 10px; align-items: center; font: 9px var(--display); color: var(--muted); }\n.seek input { flex: 1; min-width: 0; height: 28px; accent-color: var(--ok); }\n.tj { font: 600 13px var(--body); color: var(--ok); background: none; border: 1px solid var(--ok); padding: 1px 5px; cursor: pointer; }\ndetails.lic { font-size')
T = T.replace('<p>${esc(o.desc)}</p>', '<p>${esc(o.desc).replace(/(\\d+:\\d\\d)/g, (m) => `<button class="tj" type="button" data-t="${m}">${m}</button>`)}</p>')
T = T.replace('  audio.src = o.file;', '  blobUrl(o).then((u) => { if (current !== o) return; audio.src = u; audio.play().then(() => { if (current === o) nowEl.innerHTML = \'Playing \' + label(o); if (o.jump != null) { audio.currentTime = o.jump; o.jump = null; } }).catch(() => {}); });\n  return;')
T = T.replace('</script>', r"""
// ---------- timeline ----------
const blobs = {};
function blobUrl(o) { if (!blobs[o.id]) blobs[o.id] = fetch(o.file).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => o.file); return blobs[o.id]; }
const seek = document.getElementById('seek'), tcur = document.getElementById('tcur'), tdur = document.getElementById('tdur');
const fmt = (t) => { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
let dragging = false;
audio.addEventListener('loadedmetadata', () => { seek.disabled = false; tdur.textContent = fmt(audio.duration); });
audio.addEventListener('timeupdate', () => { if (!dragging && audio.duration) { seek.value = Math.round(1000 * audio.currentTime / audio.duration); tcur.textContent = fmt(audio.currentTime); } });
seek.addEventListener('input', () => { dragging = true; if (audio.duration) tcur.textContent = fmt(seek.value / 1000 * audio.duration); });
seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; dragging = false; });
document.addEventListener('click', (e) => {
  const b = e.target.closest('.tj'); if (!b) return;
  const [m, s] = b.dataset.t.split(':').map(Number), t = m * 60 + s;
  const o = OPTS.find((q) => q.el.contains(b)); if (!o) return;
  if (current === o && audio.duration) audio.currentTime = t; else { o.jump = t; if (current === o) return; play(o); }
});
audio.addEventListener('emptied', () => { seek.value = 0; seek.disabled = true; tcur.textContent = '0:00'; tdur.textContent = '0:00'; });
</script>""", 1)
# ARRANGER (user: 'make me a timeline so I can manually adjust'): arranger.html goes on top of the board. Sources =
# RPG 8 sped to 140 bpm, RPG 10, and both two semitones up; mp3 stereo 128k, RPG 8 levelled to RPG 10 (whole-file loudness).
def render_src(src, dst, af):
    if not os.path.exists(dst): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ar', '44100', '-ac', '2', dst], check=True)
def pcm(f):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
RB_ = SRC + '/' + RB; RBQ = 'transients=crisp:detector=compound:pitchq=quality:channels=together'
g8 = 20 * np.log10(np.sqrt((pcm(RB_ + 'theme-10.ogg') ** 2).mean()) / np.sqrt((pcm(RB_ + 'theme-8.ogg') ** 2).mean()))
ARR = [('rb8', 'RPG 8', 'R8', RB_ + 'theme-8.ogg', 28, f'rubberband=tempo={140 / 130}:pitch=1:{RBQ},volume={g8:.2f}dB', '#ffd84a'),
       ('rb10', 'RPG 10', 'R10', RB_ + 'theme-10.ogg', 36, 'anull', '#8fc8ff'),
       ('rb8hi', 'RPG 8 two steps higher', 'R8+', RB_ + 'theme-8.ogg', 28, f'rubberband=tempo={140 / 130}:pitch={2 ** (2 / 12)}:{RBQ},volume={g8:.2f}dB', '#ff8a6a'),
       ('rb10hi', 'RPG 10 two steps higher', 'R10+', RB_ + 'theme-10.ogg', 36, f'rubberband=tempo=1:pitch={2 ** (2 / 12)}:{RBQ}', '#c9a3ff')]
arr_src = []
for aid, name, short, f, bars, af, col in ARR:
    wavf = os.path.join(OUT, 'a_' + aid + '.wav'); render_src(f, wavf, af + ',alimiter=limit=0.95')
    x = pcm(wavf); d = len(x) / 44100; bar = len(x) / bars
    lv = [round(float(20 * np.log10(np.sqrt((x[int(k * bar):int((k + 1) * bar)] ** 2).mean()) + 1e-9)), 1) for k in range(bars)]
    mp = os.path.join(OUT, 'm', 'a_' + aid + '.mp3')
    if not os.path.exists(mp): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wavf, '-b:a', '128k', mp], check=True)
    arr_src.append({'id': aid, 'name': name, 'short': short, 'file': 'm/a_' + aid + '.mp3', 'bars': bars, 'dur': d, 'beats': 4, 'color': col, 'lv': lv})
PRESETS = {
  'Your pick C (RPG 8 build lands on RPG 10)': [{'src': 'rb8', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8', 'from': 17, 'to': 20, 'fade': 0}, {'src': 'rb10', 'from': 5, 'to': 16, 'fade': 2}],
  'C + drum bar': [{'src': 'rb8', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8', 'from': 17, 'to': 19, 'fade': 0}, {'src': 'rb10', 'from': 4, 'to': 16, 'fade': 2}],
  'Battle suite (your love)': [{'src': 'rb8', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8', 'from': 17, 'to': 28, 'fade': 0}, {'src': 'rb10', 'from': 1, 'to': 36, 'fade': 0}],
  'Battle suite LONG (as now)': [{'src': 'rb8', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8', 'from': 17, 'to': 28, 'fade': 0}, {'src': 'rb10', 'from': 1, 'to': 36, 'fade': 0},
                                 {'src': 'rb8hi', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8hi', 'from': 17, 'to': 28, 'fade': 0}],
  'Idea: full suite with C landings': [{'src': 'rb8', 'from': 5, 'to': 12, 'fade': 0}, {'src': 'rb8', 'from': 17, 'to': 20, 'fade': 0}, {'src': 'rb10', 'from': 5, 'to': 36, 'fade': 2},
                                       {'src': 'rb8hi', 'from': 1, 'to': 12, 'fade': 0}, {'src': 'rb8hi', 'from': 17, 'to': 20, 'fade': 0}, {'src': 'rb10', 'from': 5, 'to': 16, 'fade': 2}],
}
ARRH = open(os.path.join(HERE, 'arranger.html')).read().replace('/*ARR_CFG*/', json.dumps({'sources': arr_src, 'presets': PRESETS}))
SHOW_ARRANGER = False   # user: 'I can't understand a single thing' -> hidden (kept for reference)
if SHOW_ARRANGER: T = T.replace('<div id="screens"></div>', ARRH + '\n  <div id="screens"></div>', 1)
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = T.replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('/*OPTS*/', json.dumps(opts))
for must in ['MIX</span>', "['picked'", 'Round 9', 'id="seek"', 'blobUrl(o).then', 'class="tj"']: assert must in html, must
open(os.path.join(OUT, 'index.html'), 'w').write(html)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, 'm', '*.mp3')))
print(len(opts), 'options,', len(html) // 1024, 'KB page,', tot // 1048576, 'MB audio')
