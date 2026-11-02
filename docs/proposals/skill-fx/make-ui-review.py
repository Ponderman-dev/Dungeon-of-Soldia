# UI LOOK REVIEW (session 40): real game screenshots of the menu frame styles (?frame=) and the Glossary layout trials
# (?bar=1 / ?list=1), published over the Skill Effects page (CLAUDE.md: reuse it). Picks + notes in the page's db,
# collection `ui` (doc 'frame' / 'layout': {pick, text}; 'general': {text}).
# Usage: python3 make-ui-review.py <screenshots dir> <out.html>
#   the dir holds <Screen>-<frame>.png (Base / Settings / Shop x single / double / shadow / rivets) and
#   layout-<now|bar|list|barlist>.png, taken with the dev server (see docs/systems/ui.md 'SESSION 40 TRIALS').
import sys, base64, io, os
from PIL import Image
D, OUT = sys.argv[1], sys.argv[2]
FONT = base64.b64encode(open(os.path.join(os.path.dirname(__file__), '../../../src/assets/fonts/press-start-2p.woff2'), 'rb').read()).decode()
def img(name, crop=None):
    im = Image.open(os.path.join(D, name)).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.quantize(colors=96, method=Image.Quantize.MEDIANCUT)  # small, still crisp (no smoothing)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
FRAMES = [('A', 'single', 'Today', 'One 2px white line with stepped corners.'),
          ('B', 'double', 'Double line', 'The classic RPG frame: a thick white line and a thin one just inside it.'),
          ('C', 'shadow', 'Grey inner line', 'The white line plus a dark grey line inside it: a little depth, still black and white.'),
          ('D', 'rivets', 'Corner plates', 'The white line plus small square plates on the corners, like a riveted frame.')]
LAYOUTS = [('A', 'now', 'Today', 'Back button top left, the title under it, a stack of big boxes.'),
           ('B', 'bar', 'Title bar', 'One bar across the top: the back arrow inside it on the left, the title in the middle.'),
           ('C', 'list', 'Cursor list', 'The chapters in ONE window, rows with thin dotted lines, the ▶ cursor on the row you touch.'),
           ('D', 'barlist', 'Title bar + cursor list', 'B and C together: the most classic RPG menu.')]
def option(group, letter, name, desc, shots):
    pics = ''.join(f'<img src="{s}" alt="{name}: {cap}" width="390"><span class="cap">{cap}</span>' for cap, s in shots)
    return f'''<div class="opt" data-group="{group}" data-id="{letter}"><div class="ttl"><span class="ltr">{letter}</span><span class="nm">{name}</span></div>
<p>{desc}</p><div class="shots">{pics}</div><button class="btn pk" type="button" aria-pressed="false">PICK {letter}</button></div>'''
frames = ''.join(option('frame', l, n, d, [(s, img(f'{s}-{f}.png', (0, 0, 390, 844))) for s in ('Base', 'Settings', 'Shop')]) for l, f, n, d in FRAMES)
layouts = ''.join(option('layout', l, n, d, [('Glossary', img(f'layout-{f}.png', (0, 0, 390, 560)))]) for l, f, n, d in LAYOUTS)
html = open(os.path.join(os.path.dirname(__file__), 'ui-review.html')).read()
html = html.replace('/*FONT*/', 'data:font/woff2;base64,' + FONT).replace('<!--FRAMES-->', frames).replace('<!--LAYOUTS-->', layouts)
open(OUT, 'w').write(html)
print(len(html) // 1024, 'KB')
