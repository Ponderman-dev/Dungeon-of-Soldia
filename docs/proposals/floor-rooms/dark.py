# Run: python3 -I dark.py <out> <overlay.png> <dir with rooms/dungeons/refs.py> <current game screenshot>: the refs mockups recoloured to the game floor brightness/saturation.
import sys, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[3])
import refs
from rooms import compose, W, H, WALL
cur = np.array(Image.open(sys.argv[4]).convert('RGB')).astype(float)
def stats(a):
    lum = a.mean(2); sat = a.max(2) - a.min(2); return lum.mean(), sat.mean()
# current game floor + wall areas (avoid HUD and characters roughly): wall band and floor band
cw = cur[130:190, 0:390]; cf = cur[260:420, 0:390]
(lw, sw), (lf, sf) = stats(cw), stats(cf)
warm = np.array([1.04, 1.0, 0.94])
def match(art):
    a = art.copy()
    big = np.kron(a, np.ones((3, 3, 1)))[:844, :390]
    out = a.copy()
    for (y0, y1, L, S) in [(0, WALL, lw, sw), (WALL, H, lf, sf)]:
        part = a[y0:y1]
        lum = part.mean(2, keepdims=True)
        hot = (part[..., 0] > 170) & (part[..., 0] > part[..., 2] * 1.6)  # fire / torch pixels keep colour
        bl, bs = stats(part)
        k = S / max(bs, 1)  # saturation scale
        grey = lum + (part - lum) * min(1, k * 1.1)
        grey = grey * (L / max(bl, 1)) * warm
        grey[hot] = part[hot]
        out[y0:y1] = grey
    return out
out, overlay = sys.argv[1], Image.open(sys.argv[2])
shots = []
for name, fn, seed in [('A  after picture 1', refs.ref_a, 3), ('B  after picture 2', refs.ref_b, 4), ('C  after picture 3', refs.ref_c, 5)]:
    im = compose(match(fn(np.random.default_rng(seed))), overlay); shots.append((name, im))
now = Image.open(sys.argv[4]).convert('RGB')
shots.insert(0, ('NOW (for comparison)', now))
sheet = Image.new('RGB', (400 * len(shots), 874), (20, 18, 16)); d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(shots):
    sheet.paste(im, (i * 400, 30)); d.text((i * 400 + 8, 8), name, fill=(255, 230, 180))
sheet.save(f"{out}/refs-dark-sheet.png")
print('target wall lum/sat', round(lw), round(sw), 'floor', round(lf), round(sf))
