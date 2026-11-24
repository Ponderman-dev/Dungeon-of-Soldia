# Run: python3 -I dungeons.py <out dir> <overlay.png> <dir with rooms.py>. Picture mockups only.
# Four DUNGEON variations (session 55, user: 'too different, back to dungeons, variations of dungeon'): the game's
# layout (brick back wall, 2 pillars with torches at x 24 / 106, a door in the middle, stone floor), different moods.
import sys, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[3])
from rooms import W, H, WALL, DX, BAYER, YY, XX, hx, ramp, noise, shade, voronoi, ell, compose

PILLARS = (24, 106)

def bricks(img, rng, rmp, bw, bh, top=0, bottom=WALL, jitter=0.12, light=None, missing=0.0, n=None):
    """Running-bond brick wall: per-brick tone, lit top row, shaded bottom/right, dark mortar. Returns brick id map."""
    yy = YY - top
    row = yy // bh
    off = (row * 7 % bw) if bw > 8 else (row % 2) * (bw // 2)
    col = (XX + off) // bw
    bid = row * 97 + col
    tone = ((np.sin(bid * 12.9898 + 4.1) * 43758.5453) % 1 - 0.5) * jitter * 2
    bx, by = (XX + off) % bw, yy % bh
    m = (YY >= top) & (YY < bottom)
    v = 0.55 + tone - (by == bh - 1) * 0.0
    v = np.where(by == 1, v + 0.18, v)
    v = np.where((by == bh - 1) | (bx == bw - 1), v - 0.16, v)
    if n is not None: v = v + (n - 0.5) * 0.12
    if light is not None: v = v * light
    shade(img, m, v, rmp)
    img[m & ((bx == 0) | (by == 0))] = rmp[0]
    if missing:
        gone = m & (((np.sin(bid * 78.233) * 43758.5453) % 1) < missing) & (YY > top + 2)
        img[gone] = rmp[0] * 0.5
        img[gone & (by == 1)] = rmp[0]
    return bid

def flags(img, rng, rmp, sw, sh, top=WALL, light=None, n=None, bevel=True, irregular=False):
    fy = YY - top
    if irregular:
        pts = [(x + rng.uniform(-3, 3), y + rng.uniform(-2, 2)) for y in range(top, H + 12, sh) for x in range((y // sh % 2) * sw // 2 - sw, W + sw, sw)]
        i1, d1, d2, P = voronoi(rng, pts)
        sid = i1; edge = (d2 - d1) < 1.2
        dx, dy = XX - P[i1, 0], YY - P[i1, 1]
        tone = ((np.sin(sid * 12.9898) * 43758.5453) % 1 - 0.5) * 0.22
        v = 0.55 + tone - (dx + dy) / (sw * 4)
        lit = ((d2 - d1) < 2.2) & (dy < -1)
    else:
        row = fy // sh; off = (row % 2) * (sw // 2)
        sx, sy = (XX + off) % sw, fy % sh
        sid = row * 53 + (XX + off) // sw
        tone = ((np.sin(sid * 12.9898) * 43758.5453) % 1 - 0.5) * 0.22
        v = 0.55 + tone
        edge = (sx == 0) | (sy == 0)
        lit = (sy == 1) | ((sx == 1) & bevel)
        v = np.where((sy == sh - 1) | (sx == sw - 1), v - 0.15, v)
    v = np.where(lit, v + 0.15, v)
    if n is not None: v = v + (n - 0.5) * 0.14
    if light is not None: v = v * light
    m = YY >= top
    shade(img, m, v, rmp)
    img[m & edge] = rmp[0]
    return sid

def pillar(img, rmp, cx, light=None, broken_top=None):
    for x in range(cx - 6, cx + 6):
        t = (x - cx + 6) / 11
        v = 0.75 if t < 0.2 else 0.9 if t < 0.45 else 0.6 if t < 0.8 else 0.35
        top = 0 if broken_top is None else broken_top + int(abs(np.sin(x * 2.1)) * 4)
        for y in range(top, WALL):
            vv = v * (light[y, x] if light is not None else 1)
            if (y - top) % 12 == 0 and y > top: vv *= 0.55  # block joints
            img[y, x] = rmp[int(np.clip(round(vv * (len(rmp) - 1)), 0, len(rmp) - 1))]
        img[WALL - 4:WALL, x] = rmp[3]
    img[:, cx - 7][: WALL] = rmp[0]; img[:, cx + 6][: WALL] = rmp[0]
    img[WALL - 4, cx - 8:cx + 8] = rmp[-2]; img[WALL - 1, cx - 8:cx + 8] = rmp[0]

def glow(img, cx, cy, col, steps=((22, 0.07), (15, 0.09), (9, 0.12), (5, 0.16))):
    for r, a in steps:
        m = np.hypot(XX - cx, (YY - cy) * 1.1) < r
        img[m] = img[m] * (1 - a) + hx(col) * a

def torch(img, cx, cy, strong=False):
    glow(img, cx, cy - 3, '#ff9a40', ((30, 0.06), (20, 0.08), (12, 0.1), (6, 0.16)) if strong else ((20, 0.06), (13, 0.08), (7, 0.12)))
    img[cy:cy + 6, cx] = hx('#5a3a24'); img[cy, cx - 1:cx + 2] = hx('#3c3833'); img[cy + 1, cx - 1:cx + 2] = hx('#3c3833')
    for y, half, c in [(-1, 1, '#ffd75a'), (-2, 1, '#ff9a30'), (-3, 1, '#ffd75a'), (-4, 0, '#ff9a30'), (-5, 0, '#c9452a')]:
        img[cy + y, cx - half:cx + half + 1] = hx(c)
    img[cy - 2, cx] = hx('#fff2b0')

def door(img, kind='plain', wood='#5a3a24'):
    hw, top = 9, WALL - 26
    arch = lambda pad: (np.abs(XX - DX) <= hw + pad) & (YY >= top - pad) & (YY < WALL) & ((YY - top + pad) >= ((XX - DX) ** 2) / (hw + pad) * 0.8)
    stone = arch(3) & ~arch(0)
    img[stone] = hx('#4a453f'); img[stone & (((XX + YY) % 5) == 0)] = hx('#302c28'); img[arch(3) & ~arch(2)] = hx('#17130f')
    img[arch(0)] = hx(wood)
    planks = arch(0) & (((XX - DX + 9) % 4) == 0); img[planks] = hx('#3a2416')
    if kind in ('plain', 'heavy', 'damp'):
        for by in (WALL - 7, WALL - 18):
            b = arch(0) & (YY == by) | arch(0) & (YY == by + 1); img[b] = hx('#35322f'); img[arch(0) & (YY == by) & ((XX % 3) == 0)] = hx('#9a948a')
        img[WALL - 13, DX + 4:DX + 6] = hx('#9a948a')
    if kind == 'heavy':
        img[arch(0) & (XX == DX)] = hx('#1a120c')
        img[arch(0) & (((XX + YY) % 4) == 0) & ((YY % 6) == 0)] = hx('#b0a898')
    if kind == 'damp':
        img[arch(0) & (YY > WALL - 6) & (((XX + YY) % 2) == 0)] = hx('#3f5a34')
    if kind == 'broken':  # the door hangs off one hinge: a dark gap and a tilted leaf
        img[arch(0)] = hx('#050403')
        for y in range(top + 3, WALL - 1):
            x0 = DX - 9 + (y - top) // 5
            img[y, x0:x0 + 8] = hx(wood); img[y, x0 + 3] = hx('#3a2416'); img[y, x0 + 7] = hx('#2a180e')
        img[WALL - 10, DX - 8:DX + 2] = hx('#35322f')

def lightmap(sources, ambient, falloff):
    L = np.full((H, W), ambient)
    for (x, y, r, s) in sources:
        L = L + s * np.clip(1 - np.hypot(XX - x, (YY - y) * 0.9) / r, 0, 1) ** falloff
    return np.round(np.clip(L, 0, 1.3) * 8) / 8  # stepped light (pixel art)

def finish_vignette(img, k):
    d = np.sqrt(((XX - W / 2) / (W / 2)) ** 2 + ((YY - H * 0.5) / (H * 0.6)) ** 2)
    f = np.round(np.clip(1 - k * np.clip(d - 0.6, 0, 1) * 1.5, 0.4, 1) * 6) / 6
    img *= f[..., None]

def classic(rng):
    img = np.zeros((H, W, 3)); n = noise(rng, 16)
    g = ramp('#141316', '#24232a', '#33323a', '#43424b', '#55545e', '#6a6973', '#827f89')
    bricks(img, rng, g, 12, 6, n=n)
    flags(img, rng, g, 18, 15, n=n)
    for _ in range(10):
        x, y = rng.uniform(0, W), rng.uniform(WALL + 4, H)
        for k in range(int(rng.uniform(4, 9))):
            img[int(min(H - 1, y)), int(x) % W] = g[1]; x += rng.choice([-1, 0, 1]); y += rng.choice([0, 1])
    for cx in PILLARS: pillar(img, g, cx)
    img[WALL:WALL + 3] *= np.array([0.6, 0.75, 0.9])[:, None, None]
    door(img, 'plain')
    for cx in PILLARS: torch(img, cx, 34)
    finish_vignette(img, 0.35)
    return img

def damp(rng):
    img = np.zeros((H, W, 3)); n = noise(rng, 14)
    g = ramp('#0c1214', '#16201f', '#1f2c2b', '#2a3938', '#364846', '#455956', '#5a706b')
    bricks(img, rng, g, 11, 6, n=n, jitter=0.16)
    flags(img, rng, g, 15, 12, n=n, irregular=True)
    MOSS = ramp('#1a2a14', '#26391c', '#335026', '#456a30')
    moss = (noise(rng, 10) > 0.6)
    m = moss & (((YY > WALL - 14) & (YY < WALL)) | ((YY >= WALL) & (noise(rng, 8) > 0.66)))
    shade(img, m & (((XX + YY) % 3) != 0), 0.3 + noise(rng, 5) * 0.6, MOSS)
    for _ in range(14):  # drips / wet stains down the wall
        x = int(rng.uniform(0, W)); y0 = int(rng.uniform(0, 30))
        for y in range(y0, y0 + int(rng.uniform(8, 26))):
            if (x + y) % 2 == 0: img[y, x] = img[y, x] * 0.75
        img[min(WALL - 1, y0 + 26), x] = hx('#7fa6a6')
    # a water gutter along the foot of the wall, with a grate
    gut = (YY >= WALL + 2) & (YY < WALL + 7)
    img[gut] = hx('#0f1a20'); img[gut & (YY == WALL + 2)] = hx('#070b0d'); img[gut & (YY == WALL + 4) & ((XX % 9) < 3)] = hx('#4a6a78')
    img[(YY == WALL + 7)] = g[4]
    gr = gut & (np.abs(XX - DX) < 8); img[gr] = hx('#070b0d'); img[gr & ((XX % 2) == 0)] = hx('#3a4448')
    for cx, cy, r in [(30, 150, 9), (96, 205, 11), (52, 248, 7)]:
        p = ell(cx, cy, r, r / 2.6); img[p] = hx('#1a2a32'); img[p & ~ell(cx, cy, r - 1, r / 2.6 - 1)] = hx('#121c22')
        img[int(cy - r / 4), int(cx - r / 2):int(cx)] = hx('#5a7a88')
    for cx in PILLARS: pillar(img, g, cx)
    door(img, 'damp', '#40301f')
    for cx in PILLARS: torch(img, cx, 34)
    finish_vignette(img, 0.5)
    return img

def torchlit(rng):
    img = np.zeros((H, W, 3)); n = noise(rng, 16)
    g = ramp('#0d0907', '#1d1410', '#2e2119', '#423024', '#584131', '#70533e', '#8c6a4d', '#a8835f')
    L = lightmap([(24, 34, 75, 0.8), (106, 34, 75, 0.8), (12, 190, 85, 0.95), (118, 190, 85, 0.95), (DX, 40, 40, 0.25)], 0.28, 1.2)
    bricks(img, rng, g, 13, 6, n=n, light=L)
    flags(img, rng, g, 20, 16, n=n, light=L)
    for cx in PILLARS: pillar(img, g, cx, light=L)
    door(img, 'heavy', '#5a3a24')
    for cx in PILLARS: torch(img, cx, 34, strong=True)
    for bx in (10, 120):  # braziers on the floor
        by = 190
        img[by:by + 7, bx - 3:bx + 4] = hx('#2a2622'); img[by, bx - 4:bx + 5] = hx('#4a4540'); img[by + 7, bx - 2:bx + 3] = hx('#151210')
        for y, half, c in [(-1, 3, '#ff9a30'), (-2, 3, '#ffd75a'), (-3, 2, '#ff9a30'), (-4, 2, '#ffd75a'), (-5, 1, '#ff9a30'), (-6, 1, '#c9452a'), (-7, 0, '#c9452a')]:
            img[by + y, bx - half:bx + half + 1] = hx(c)
        glow(img, bx, by - 4, '#ff8a30', ((26, 0.05), (16, 0.08), (9, 0.12)))
    finish_vignette(img, 0.7)
    return img

def ruined(rng):
    img = np.zeros((H, W, 3)); n = noise(rng, 16)
    g = ramp('#121012', '#211e22', '#2f2b2f', '#3e393c', '#4f494b', '#635c5c', '#7b7270')
    bricks(img, rng, g, 12, 6, n=n, jitter=0.18, missing=0.07)
    flags(img, rng, g, 17, 14, n=n)
    # broken floor: dirt where stones are gone, roots
    dirt = (noise(rng, 10) > 0.7) & (YY > WALL + 3)
    D = ramp('#160f0a', '#22180f', '#2e2015', '#3b2a1b')
    shade(img, dirt, 0.3 + noise(rng, 6) * 0.7, D)
    for _ in range(8):
        x, y = rng.uniform(0, W), rng.uniform(WALL, H)
        for k in range(int(rng.uniform(8, 20))):
            img[int(min(H - 1, y)), int(x) % W] = hx('#3b281a'); x += rng.uniform(-1, 1); y += rng.uniform(0.2, 1)
    # a collapsed corner (top right): a dark hole in the wall and a rubble heap spilling onto the floor
    hole = ell(122, 12, 20, 16); img[hole] = hx('#050405')
    img[ell(122, 12, 21, 17) & ~hole & (((XX + YY) % 2) == 0)] = g[1]
    for _ in range(40):
        cx, cy = rng.normal(112, 9), rng.normal(WALL + 6, 4)
        r = rng.uniform(1.2, 3.2)
        m = ell(cx, cy, r * 1.3, r)
        shade(img, m, 0.8 - ((XX - cx) + (YY - cy)) / (r * 3), g, False)
        img[ell(cx + 1, cy + 1.5, r * 1.3, r * 0.6) & ~m] *= 0.7
    # a fallen pillar chunk on the floor
    fx, fy = 34, 128
    for x in range(fx - 10, fx + 10):
        for y in range(fy - 4, fy + 4):
            t = (y - fy + 4) / 7
            img[y, x] = g[5] if t < 0.3 else g[4] if t < 0.6 else g[2]
    img[fy - 4:fy + 4, fx - 10] = g[0]; img[fy - 4:fy + 4, fx + 9] = g[1]; img[fy + 4, fx - 10:fx + 10] = g[0] * 0.8
    img[fy - 4:fy + 4, fx - 2] = g[2]
    for cx, top in [(24, None), (106, 14)]: pillar(img, g, cx, broken_top=top)
    door(img, 'broken')
    torch(img, 24, 34)
    finish_vignette(img, 0.45)
    return img

if __name__ == '__main__':
    out, overlay = sys.argv[1], Image.open(sys.argv[2])
    rooms = [('A Classic', classic, 3), ('B Damp', damp, 4), ('C Torchlit', torchlit, 5), ('D Ruined', ruined, 6)]
    shots = []
    for name, fn, seed in rooms:
        im = compose(fn(np.random.default_rng(seed)), overlay)
        im.save(f"{out}/dungeon-{name.split()[0]}.png"); shots.append((name, im))
    sheet = Image.new('RGB', (400 * len(shots), 874), (20, 18, 16)); d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(shots):
        sheet.paste(im, (i * 400, 30)); d.text((i * 400 + 8, 8), name, fill=(255, 230, 180))
    sheet.save(f"{out}/dungeons-sheet.png")
