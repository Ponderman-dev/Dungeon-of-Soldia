# MUSIC BOARD (session 52): listen-and-pick page for the game's music, published over the Skill Effects page
# (CLAUDE.md: reuse it). 4 screens (title+camp, squad, battle, boss); each = 2 'code' songs (songs.js, played live by
# synth.js) + free CC0 tracks (Superpowers asset packs by Pixel-boy, Juhani Junkala Retro Game Music Pack).
# Verdicts + notes in the page's db, collection `music` (doc = option id: {verdict 'love'|'maybe'|'no', screen};
# doc 'note:<screen>' / 'note:general': {text}).
# Usage: python3 make-board.py <sources dir> <out.html>
#   <sources dir> holds superpowers-asset-packs/ (git clone of sparklinlabs/superpowers-asset-packs, music folders)
#   and academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] *.wav (from skillmoph/academe-play-assets).
import sys, os, subprocess, base64, json, re
SRC, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'superpowers-asset-packs/'
JJ = 'academe-play-assets/music__Juhani Junkala [Retro Game Music Pack] '
MF, NA, RB = 'Medieval Fantasy', 'Ninja Adventure', 'RPG Battle'
# (id, file, pack name, track name, screen, my description from the measurements: I cannot listen, so it is a hint)
FREE = [
  ('mf2', SP + 'medieval-fantasy/music/theme-2.ogg', MF, 'Theme 2', 'title', 'Very soft and quiet, calm, gentle major key. Background feel.'),
  ('mf4', SP + 'medieval-fantasy/music/theme-4.ogg', MF, 'Theme 4', 'title', 'Slow, dark (minor key), warm low sound. Short loop (27s).'),
  ('na15', SP + 'ninja-adventure/musics/theme-15.ogg', NA, 'Theme 15', 'title', 'Calm, a bit sad (minor key), warm low sound.'),
  ('na5', SP + 'ninja-adventure/musics/theme-5.ogg', NA, 'Theme 5', 'title', 'Calm, minor key, mid tone. Thoughtful.'),
  ('na12', SP + 'ninja-adventure/musics/theme-12.ogg', NA, 'Theme 12', 'title', 'Calm, soft, warm low sound, major key.'),
  ('na18', SP + 'ninja-adventure/musics/theme-18.ogg', NA, 'Theme 18', 'title', 'Quiet and gentle, major key. Peaceful, camp-like.'),
  ('jjend', JJ + 'Ending.wav', 'Retro Game Music Pack', 'Ending', 'title', 'Retro chiptune, slow and calm, warm. 45s.'),
  ('jjtitle', JJ + 'Title Screen.wav', 'Retro Game Music Pack', 'Title Screen', 'title', 'Retro chiptune title jingle, bright and busy. Very short (11s).'),
  ('mf5', SP + 'medieval-fantasy/music/theme-5.ogg', MF, 'Theme 5', 'squad', 'Medium pace, minor key, serious. Getting ready feel.'),
  ('mf6', SP + 'medieval-fantasy/music/theme-6.ogg', MF, 'Theme 6', 'squad', 'Medium pace, dark minor key, low and full sound.'),
  ('na13', SP + 'ninja-adventure/musics/theme-13.ogg', NA, 'Theme 13', 'squad', 'Medium pace, minor key, brighter tone.'),
  ('na14', SP + 'ninja-adventure/musics/theme-14.ogg', NA, 'Theme 14', 'squad', 'Medium-calm, major key, warm sound.'),
  ('rb9', SP + 'rpg-battle-system/music/theme-9.ogg', RB, 'Theme 9', 'squad', 'Medium pace, minor key, mid tone.'),
  ('rb12', SP + 'rpg-battle-system/music/theme-12.ogg', RB, 'Theme 12', 'squad', 'Medium pace, major key, warm. Short (30s).'),
  ('mf1', SP + 'medieval-fantasy/music/theme-1.ogg', MF, 'Theme 1', 'battle', 'Busy, dark minor key, medieval. 77s, so it repeats less.'),
  ('rb10', SP + 'rpg-battle-system/music/theme-10.ogg', RB, 'Theme 10', 'battle', 'Loud and busy, dark minor key, full low sound.'),
  ('rb16', SP + 'rpg-battle-system/music/theme-16.ogg', RB, 'Theme 16', 'battle', 'Busy, minor key, the LONGEST track (90s): repeats the least.'),
  ('na8', SP + 'ninja-adventure/musics/theme-8.ogg', NA, 'Theme 8', 'battle', 'Fast and busy, minor key, bright sound.'),
  ('na2', SP + 'ninja-adventure/musics/theme-2.ogg', NA, 'Theme 2', 'battle', 'Busy, minor key, brighter tone.'),
  ('rb1', SP + 'rpg-battle-system/music/theme-1.ogg', RB, 'Theme 1', 'battle', 'Fast and busy, minor key, bright sound.'),
  ('rb8', SP + 'rpg-battle-system/music/theme-8.ogg', RB, 'Theme 8', 'battle', 'Busy, minor key, bright, a bit quieter.'),
  ('jj1', JJ + 'Level 1.wav', 'Retro Game Music Pack', 'Level 1', 'battle', 'Retro chiptune, very fast and energetic, major key.'),
  ('jj3', JJ + 'Level 3.wav', 'Retro Game Music Pack', 'Level 3', 'battle', 'Retro chiptune, very fast and energetic. 82s.'),
  ('rb14', SP + 'rpg-battle-system/music/theme-14.ogg', RB, 'Theme 14', 'boss', 'Loud, minor key, heavy low sound. Short loop (23s).'),
  ('rb15', SP + 'rpg-battle-system/music/theme-15.ogg', RB, 'Theme 15', 'boss', 'Loud and fast, minor key, heavy. Short loop (26s).'),
  ('na17', SP + 'ninja-adventure/musics/theme-17.ogg', NA, 'Theme 17', 'boss', 'Loud and busy, minor key, intense.'),
  ('rb13', SP + 'rpg-battle-system/music/theme-13.ogg', RB, 'Theme 13', 'boss', 'The LOUDEST and busiest of the pack, full and big. Major key.'),
  ('mf3', SP + 'medieval-fantasy/music/theme-3.ogg', MF, 'Theme 3', 'boss', 'Loud and very busy, bright, major key. Short (30s).'),
  ('jj2', JJ + 'Level 2.wav', 'Retro Game Music Pack', 'Level 2', 'boss', 'Retro chiptune, very fast, intense.'),
]
CREDIT = {MF: 'Pixel-boy / Sparklin Labs, CC0', NA: 'Pixel-boy / Sparklin Labs, CC0', RB: 'Pixel-boy / Sparklin Labs, CC0',
          'Retro Game Music Pack': 'Juhani Junkala, CC0'}
blobs, meta = {}, []
for fid, f, pack, name, screen, desc in FREE:
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, f), '-ac', '1', '-ar', '44100', '-b:a', '48k', '-f', 'mp3', '-'],
                         capture_output=True, check=True).stdout
    blobs[fid] = base64.b64encode(mp3).decode()
    meta.append({'id': fid, 'kind': 'free', 'screen': screen, 'title': f'{pack}: {name}', 'credit': CREDIT[pack], 'desc': desc})
js = lambda n: re.sub(r'^export ', '', open(os.path.join(HERE, n)).read(), flags=re.M)
FONT = base64.b64encode(open(os.path.join(HERE, '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
html = open(os.path.join(HERE, 'board-template.html')).read()
html = (html.replace('/*FONT*/', 'data:font/woff2;base64,' + FONT)
        .replace('/*ENGINE*/', js('synth.js') + '\n' + js('songs.js'))
        .replace('/*FREE*/', json.dumps(meta))
        .replace('/*BLOBS*/', json.dumps(blobs)))
open(OUT, 'w').write(html)
print(len(html) // 1024, 'KB')
