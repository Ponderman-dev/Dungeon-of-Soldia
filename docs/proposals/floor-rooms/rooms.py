# Session 55 room-design mockups. Run: python3 -I rooms.py <out dir> <overlay.png> (overlay = a battle screenshot on a
# magenta background with the floor hidden). Writes room-1..4.png + rooms-sheet.png. Picture only, not game code.
# Four dungeon-room mockups (floor + wall + door), each in its own pixel-art style, at the game's art size
# (130 x 282 art px, x3 = 390 x 846), with the real battle overlay (heroes, enemies, HUD) keyed on top.
import sys, numpy as np
from PIL import Image, ImageDraw

W, H, WALL, DX = 130, 282, 67, 65
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
YY, XX = np.mgrid[0:H, 0:W]

def hx(s): s = s.lstrip('#'); return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], float)
def ramp(*cols): return np.array([hx(c) for c in cols])

def noise(rng, cell, octaves=3):
    out = np.zeros((H, W))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = max(2, cell // (2 ** o))
        g = rng.random((H // c + 3, W // c + 3))
        gy, gx = YY / c, XX / c
        y0, x0 = gy.astype(int), gx.astype(int)
        fy, fx = gy - y0, gx - x0
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        a = g[y0, x0] * (1 - fx) + g[y0, x0 + 1] * fx
        b = g[y0 + 1, x0] * (1 - fx) + g[y0 + 1, x0 + 1] * fx
        out += amp * (a * (1 - fy) + b * fy); tot += amp; amp *= 0.5
    return out / tot

def shade(img, mask, v, rmp, dither=True):
    """Paint mask with ramp colours chosen by value v (0..1), ordered-dithered between steps."""
    n = len(rmp)
    t = np.clip(v, 0, 0.999) * (n - 1)
    if dither: t = t + (BAYER[YY % 4, XX % 4] - 0.5)
    idx = np.clip(np.round(t), 0, n - 1).astype(int)
    img[mask] = rmp[idx][mask]

def voronoi(rng, pts):
    pts = np.array(pts, float)
    d = np.sqrt((XX[..., None] - pts[:, 0]) ** 2 + ((YY[..., None] - pts[:, 1]) * 1.0) ** 2)
    order = np.argsort(d, axis=2)
    i1 = order[..., 0]
    d1 = np.take_along_axis(d, order[..., :1], 2)[..., 0]
    d2 = np.take_along_axis(d, order[..., 1:2], 2)[..., 0]
    return i1, d1, d2, pts

def ell(cx, cy, rx, ry): return ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1

def vignette(img, k=0.45):
    d = np.sqrt(((XX - W / 2) / (W / 2)) ** 2 * 0.9 + ((YY - H * 0.55) / (H * 0.62)) ** 2)
    f = np.clip(1 - k * np.clip(d - 0.55, 0, 1) * 1.6, 0.35, 1)
    # stepped (pixel-art) darkening, not smooth
    f = np.round(f * 6) / 6
    img *= f[..., None]

# ---------------------------------------------------------------- 1. NATURAL CAVE (soft painterly, no outlines)
def cave(rng):
    img = np.zeros((H, W, 3))
    rock = ramp('#120e0c', '#1f1915', '#2d2520', '#3d332b', '#504338', '#665647', '#7f6c59', '#9a856d')
    earth = ramp('#140f0b', '#1e1610', '#2a1f16', '#36291d', '#433325', '#523f2d')
    n = noise(rng, 24)
    floor_line = WALL + (noise(rng, 10)[0] * 10).astype(int)  # an irregular foot of the rock face
    wall = YY < floor_line[XX]
    # boulders: big voronoi cells, dome lit from the top-left, dark crevices
    pts = [(rng.uniform(-5, W + 5), rng.uniform(-6, WALL + 8)) for _ in range(34)]
    i1, d1, d2, P = voronoi(rng, pts)
    dx, dy = XX - P[i1, 0], YY - P[i1, 1]
    v = 0.62 - d1 / 26 - (dx + dy) / 40 + (n - 0.5) * 0.25
    v = v * (0.55 + 0.45 * np.clip(YY / WALL, 0, 1))  # ceiling in shadow
    v[(d2 - d1) < 1.6] = 0.02
    shade(img, wall, v, rock)
    # floor: packed earth, a worn lighter path in the middle, darker toward the sides
    fl = ~wall
    path = np.exp(-((XX - DX) / 34.0) ** 2)
    v = 0.35 + (n - 0.5) * 0.5 + path * 0.25 - (YY > 240) * 0.05
    shade(img, fl, v, earth)
    # a shadow band under the rock face
    band = fl & (YY < floor_line[XX] + 3)
    img[band] *= 0.6
    # loose stones and pebbles (dome shaded rock)
    for _ in range(26):
        cx, cy = rng.uniform(2, W - 2), rng.uniform(WALL + 8, H - 4)
        r = rng.choice([1.2, 1.6, 2.2, 3.5]) if rng.random() < 0.85 else rng.uniform(4, 6)
        m = ell(cx, cy, r * 1.3, r) & fl
        img[ell(cx + 1, cy + 1.5, r * 1.3, r * 0.7) & fl & ~m] *= 0.55  # its shadow
        shade(img, m, 0.75 - ((XX - cx) + (YY - cy)) / (r * 3) - np.hypot(XX - cx, YY - cy) / (r * 4), rock)
    # stalagmites at the sides
    for sx, h in [(6, 30), (14, 18), (122, 26), (113, 14), (2, 12)]:
        base = WALL + 18 + rng.integers(0, 40)
        for y in range(base - h, base):
            half = (y - (base - h)) / h * 4 + 0.5
            m = (np.abs(XX - sx) <= half) & (YY == y)
            shade(img, m, 0.75 - (XX - sx + half) / (half * 2 + 1) * 0.6, rock)
    # roots creeping from the rock face
    for _ in range(7):
        x, y = rng.uniform(0, W), floor_line[int(rng.uniform(0, W - 1))] - rng.uniform(0, 6)
        for k in range(int(rng.uniform(10, 26))):
            xi, yi = int(x), int(y)
            if 0 <= xi < W and 0 <= yi < H: img[yi, xi] = hx('#2b1c12') if k % 3 else hx('#3b281a')
            x += rng.uniform(-1, 1); y += rng.uniform(0.3, 1.2)
    # glowing mushrooms (teal): caps + a soft stepped glow
    for cx, cy in [(18, 128), (110, 160), (24, 222), (98, 246), (60, 104)]:
        g = np.hypot(XX - cx, (YY - cy) * 1.2)
        for r, a in [(11, 0.08), (7, 0.12), (4, 0.16)]:
            m = g < r
            img[m] = img[m] * (1 - a) + hx('#4fe0c8') * a
        for k in range(rng.integers(2, 4)):
            mx, my = int(cx + rng.integers(-3, 4)), int(cy + rng.integers(-2, 2))
            img[my, mx - 1:mx + 2] = hx('#8ff5e6'); img[my - 1, mx] = hx('#c8fff6'); img[my + 1, mx] = hx('#5a4a3a')
    # door: a cave mouth with a timber frame (mine style)
    hole = (np.abs(XX - DX) <= 13) & (YY >= 26) & (YY < WALL + 2) & ((YY - 26) >= (np.abs(XX - DX) ** 2) / 12)
    depth = np.clip((YY - 26) / 40, 0, 1)
    img[hole] = (hx('#000000') * 1)[None, :]
    img[hole & (np.abs(XX - DX) >= 10)] = hx('#0b0806')
    wood = ramp('#2a1a0e', '#3e2715', '#56371e', '#6e4828')
    for px in (DX - 15, DX + 13):
        m = (XX >= px) & (XX < px + 3) & (YY >= 28) & (YY < WALL + 3)
        shade(img, m, 0.3 + (XX - px) * 0.25, wood, False)
    m = (XX >= DX - 18) & (XX <= DX + 18) & (YY >= 25) & (YY < 29)
    shade(img, m, 0.85 - (YY - 25) * 0.18, wood, False)
    # a lantern on the frame
    lx, ly = DX + 19, 34
    for r, a in [(14, 0.08), (9, 0.12), (5, 0.18)]:
        m = np.hypot(XX - lx, YY - ly) < r; img[m] = img[m] * (1 - a) + hx('#ffb050') * a
    img[ly - 2:ly + 2, lx - 1:lx + 2] = hx('#ffd27a'); img[ly - 3, lx] = hx('#3a3a3a'); img[ly + 2, lx - 1:lx + 2] = hx('#3a3a3a')
    vignette(img, 0.5)
    return img

# ---------------------------------------------------------------- 2. ROYAL CRYPT (clean NES-like, few colours, black outlines)
def crypt(rng):
    K, D, M, L, HI = hx('#0d0b14'), hx('#2c2643'), hx('#4a4368'), hx('#7a73a0'), hx('#b9b2d6')
    RED, RED2, GOLD, GOLD2 = hx('#6e1a2a'), hx('#8f2a3a'), hx('#d0a040'), hx('#8a6420')
    img = np.zeros((H, W, 3)); img[:] = D
    # floor: big square tiles, checker, lit top-left edge, black grout bottom-right
    T = 13
    fy = YY - WALL
    tile = (fy >= 0)
    chk = ((XX // T + fy // T) % 2 == 0)
    img[tile & chk] = M; img[tile & ~chk] = D
    img[tile & ((XX % T == 0) | (fy % T == 0))] = L * 0.85
    img[tile & ((XX % T == T - 1) | (fy % T == T - 1))] = K
    # the royal runner: red with a gold border and diamonds, from the door to the bottom
    run = tile & (np.abs(XX - DX) <= 15)
    img[run] = RED
    img[run & (np.abs(XX - DX) >= 13)] = GOLD
    img[run & (np.abs(XX - DX) == 15)] = K
    dia = run & ((np.abs(XX - DX) + np.abs((fy % 18) - 9)) <= 5)
    img[dia] = RED2
    img[run & ((np.abs(XX - DX) + np.abs((fy % 18) - 9)) == 5)] = GOLD2
    # wall: big smooth blocks, flat colour, light top line, black mortar
    BW, BH = 18, 9
    wy = YY
    off = ((wy // BH) % 2) * (BW // 2)
    wall = YY < WALL
    img[wall] = M
    img[wall & ((wy % BH) == 1)] = L
    img[wall & (((XX + off) % BW == 0) | (wy % BH == 0))] = K
    # frieze band: dark with gold diamonds
    fr = (YY >= 3) & (YY < 9)
    img[fr] = D; img[(YY == 3) | (YY == 8)] = K
    img[fr & ((np.abs((XX % 8) - 4) + np.abs(YY - 5.5)) <= 2)] = GOLD
    # plinth along the foot
    img[(YY >= WALL - 4) & (YY < WALL)] = L; img[YY == WALL - 4] = HI; img[YY == WALL - 1] = K
    # alcoves with urns and candles
    for ax in (24, 106):
        top = 22
        niche = (np.abs(XX - ax) <= 9) & (YY >= top) & (YY < WALL - 5) & ((YY - top) >= ((XX - ax) ** 2) / 10)
        img[niche] = K
        edge = (np.abs(XX - ax) <= 10) & (YY >= top - 1) & (YY < WALL - 4) & ~niche & ((YY - top + 1) >= ((XX - ax) ** 2) / 11)
        img[edge] = HI
        # urn
        u = ell(ax, WALL - 13, 4, 5) | ((np.abs(XX - ax) <= 2) & (YY >= WALL - 20) & (YY < WALL - 16))
        img[u] = GOLD; img[u & (XX < ax - 1)] = hx('#f0d070'); img[u & (XX > ax + 1)] = GOLD2
        img[(np.abs(XX - ax) <= 3) & (YY == WALL - 20)] = GOLD2
        for c in (ax - 7, ax + 7):
            img[WALL - 9:WALL - 6, c] = HI; img[WALL - 10, c] = hx('#ffd040'); img[WALL - 11, c] = hx('#ff8030')
    # door: a carved slab in a stepped frame with a skull emblem
    for k, col in enumerate([K, HI, L, M, K]):
        m = (np.abs(XX - DX) <= 16 - k) & (YY >= 20 + k) & (YY < WALL)
        img[m] = col
    slab = (np.abs(XX - DX) <= 11) & (YY >= 25) & (YY < WALL)
    img[slab] = L; img[slab & (XX == DX)] = K; img[slab & (YY == 25)] = HI
    em = ell(DX, 42, 6, 6); img[em] = GOLD; img[ell(DX, 42, 6, 6) & ~ell(DX, 42, 5, 5)] = K
    sk = ell(DX, 41, 3, 3) | ((np.abs(XX - DX) <= 1) & (YY >= 43) & (YY <= 45)); img[sk] = HI
    img[41, DX - 1] = K; img[41, DX + 1] = K
    img[(YY == WALL) & (np.abs(XX - DX) <= 17)] = K
    vignette(img, 0.3)
    return img

# ---------------------------------------------------------------- 3. TEMPLE RUIN (warm sandstone, rich gradients, glowing runes)
def temple(rng):
    sand = ramp('#241509', '#3a2412', '#55361c', '#734b27', '#936235', '#b07b45', '#c99759', '#dfb575', '#f0d29a')
    TEAL, GOLD = hx('#45e6c6'), hx('#f0c860')
    img = np.zeros((H, W, 3)); n = noise(rng, 16)
    # wall: huge blocks, vertical gradient each, dark outline bottom/right only (selective outlines)
    BW, BH = 26, 15
    row = YY // BH; off = (row % 2) * 13
    bx = (XX + off) % BW; by = YY % BH
    wall = YY < WALL
    v = 0.78 - by / BH * 0.38 + (n - 0.5) * 0.18 - 0.1 * (YY < 14)
    shade(img, wall, v, sand)
    img[wall & ((bx == BW - 1) | (by == BH - 1))] = sand[1]
    img[wall & (by == 0)] = sand[7]
    # frieze of carved glyphs
    fr = (YY >= 16) & (YY < 27)
    shade(img, fr, 0.5 + (n - 0.5) * 0.1, sand)
    glyph = fr & (((XX % 10 == 2) & (YY % 4 != 0)) | ((YY == 21) & (XX % 10 < 6)) | ((XX % 10 == 6) & (YY > 21)))
    img[glyph] = sand[2]; img[(YY == 16) | (YY == 26)] = sand[1]
    # broken fluted columns
    for cx, top in [(18, 6), (112, 14)]:
        col = (np.abs(XX - cx) <= 6) & (YY >= top + (np.abs(XX - cx) % 3)) & (YY < WALL)
        fl = (XX - cx + 6) % 4
        shade(img, col, np.select([fl == 0, fl == 1, fl == 2], [0.85, 0.65, 0.45], 0.3), sand, False)
        img[col & (np.abs(XX - cx) == 6)] = sand[1]
        base = (np.abs(XX - cx) <= 8) & (YY >= WALL - 5) & (YY < WALL); shade(img, base, 0.7 - (YY - WALL + 5) * 0.1, sand, False)
    # door: a round stone seal in a dark recess with gold-capped jambs
    rec = (np.abs(XX - DX) <= 17) & (YY >= 24) & (YY < WALL)
    img[rec] = sand[0]
    disc = ell(DX, 46, 15, 15) & rec
    shade(img, disc, 0.75 - ((XX - DX) + (YY - 46)) / 40, sand, True)
    ang = np.arctan2(YY - 46, XX - DX); rr = np.hypot(XX - DX, YY - 46)
    spiral = disc & (np.abs(((rr - ang * 1.6) % 5)) < 0.9) & (rr > 3)
    img[spiral] = sand[2]
    img[ell(DX, 46, 15, 15) & ~ell(DX, 46, 14, 14)] = sand[1]
    for r, a in [(6, 0.35), (3, 0.6)]:
        m = ell(DX, 46, r, r); img[m] = img[m] * (1 - a) + TEAL * a
    img[45:48, DX - 1:DX + 2] = hx('#c8fff2')
    for jx in (DX - 19, DX + 17):
        m = (XX >= jx) & (XX < jx + 3) & (YY >= 22) & (YY < WALL); shade(img, m, 0.8 - (XX - jx) * 0.2, sand, False)
        img[20:23, jx - 1:jx + 4] = GOLD; img[22, jx - 1:jx + 4] = hx('#9a7020')
    # vines
    for x0 in [8, 33, 47, 90, 101, 124]:
        x = x0
        for y in range(0, int(rng.uniform(10, 34))):
            img[y, int(x) % W] = hx('#3e6a32') if y % 4 else hx('#6a9c44')
            if rng.random() < 0.3: img[y, (int(x) + 1) % W] = hx('#5c8c3c')
            x += rng.uniform(-0.5, 0.5)
    # floor: large plates with gradient shading, cracks, some missing (sand)
    PW, PH = 22, 17
    fy = YY - WALL; prow = fy // PH; poff = (prow % 2) * 11
    pxm = (XX + poff) % PW; pym = fy % PH
    pid = (XX + poff) // PW + prow * 31
    fl = fy >= 0
    lift = (np.sin(pid * 12.9898) * 43758.5453) % 1
    v = 0.6 + (lift - 0.5) * 0.25 - pym / PH * 0.22 + (n - 0.5) * 0.15
    shade(img, fl, v, sand)
    img[fl & ((pxm == PW - 1) | (pym == PH - 1))] = sand[1]
    img[fl & ((pxm == 0) | (pym == 0))] = sand[6]
    # sand drifts where plates are gone
    drift = fl & (noise(rng, 14) > 0.7)
    shade(img, drift, 0.82 + (BAYER[YY % 4, XX % 4] - 0.5) * 0.2, sand)
    # the rune circle in the middle of the floor, faintly glowing
    cy = 170
    rr = np.hypot(XX - DX, (YY - cy) * 1.6)
    ring = fl & ((np.abs(rr - 36) < 0.8) | (np.abs(rr - 30) < 0.8))
    img[ring] = img[ring] * 0.45 + TEAL * 0.35
    a2 = np.arctan2((YY - cy) * 1.6, XX - DX)
    runes = fl & (rr > 31) & (rr < 35) & ((np.round(a2 * 8 / np.pi * 2) % 2) == 0) & (((XX + YY) % 3) == 0)
    img[runes] = TEAL * 0.8
    # cracks
    for _ in range(14):
        x, y = rng.uniform(0, W), rng.uniform(WALL + 4, H)
        for k in range(int(rng.uniform(4, 11))):
            xi, yi = int(x) % W, int(min(H - 1, y)); img[yi, xi] = sand[1]
            x += rng.choice([-1, 0, 1]); y += rng.choice([0, 1])
    vignette(img, 0.4)
    return img

# ---------------------------------------------------------------- 4. PRISON (gritty, high contrast, cold blue rim light, heavy outlines)
def prison(rng):
    K = hx('#040507')
    stone = ramp('#101319', '#1a1e27', '#252b37', '#323a49', '#434d5f', '#58647a')
    RIM, RIM2 = hx('#9cc0e6'), hx('#5c7ea6')
    img = np.zeros((H, W, 3))
    n = noise(rng, 18)
    # floor: cobblestones (voronoi), domed, black outlines, cold rim light top-left
    pts = [(x + rng.uniform(-2.5, 2.5), y + rng.uniform(-2, 2)) for y in range(WALL - 2, H + 6, 9) for x in range(-3 + (y // 9 % 2) * 5, W + 6, 10)]
    i1, d1, d2, P = voronoi(rng, pts)
    dx, dy = XX - P[i1, 0], YY - P[i1, 1]
    fl = YY >= WALL
    v = 0.66 - d1 / 11 - (dx + dy) / 26 + (n - 0.5) * 0.3
    shade(img, fl, v, stone)
    edge = (d2 - d1) < 1.3
    img[fl & edge] = K
    rim = fl & ~edge & ((d2 - d1) < 2.4) & (dx < -1) & (dy < -0.5)
    img[rim] = RIM2
    # wall: rough rubble (bigger irregular voronoi), thick outlines
    pts = [(rng.uniform(-4, W + 4), rng.uniform(-4, WALL + 2)) for _ in range(58)]
    i1, d1, d2, P = voronoi(rng, pts)
    dx, dy = XX - P[i1, 0], YY - P[i1, 1]
    wall = YY < WALL
    v = 0.55 - d1 / 16 - (dx + dy) / 30 + (n - 0.5) * 0.25
    shade(img, wall, v, stone)
    img[wall & ((d2 - d1) < 1.8)] = K
    img[wall & ~((d2 - d1) < 1.8) & ((d2 - d1) < 3) & (dx < -1) & (dy < -1)] = RIM2
    img[(YY >= WALL - 2) & (YY < WALL + 2)] = K
    # barred window high on the right with a moonbeam falling down-left onto the floor
    wx, wy = 100, 10
    win = (np.abs(XX - wx) <= 6) & (YY >= wy) & (YY < wy + 12)
    img[win] = hx('#1c2c48'); img[win & (np.abs(XX - wx) % 3 == 0)] = K; img[(np.abs(XX - wx) <= 7) & ((YY == wy - 1) | (YY == wy + 12))] = K
    beam = (YY > wy + 12) & (YY < 200) & (np.abs((XX - wx) + (YY - wy - 12) * 0.32) < 6 + (YY - wy) * 0.05)
    lit = beam & (((XX + YY) % 2) == 0)
    img[lit] = img[lit] * 0.55 + RIM * 0.32
    # chains with shackles on the wall
    for cx in (30, 48, 84):
        for y in range(4, 30 + (cx % 7) * 2):
            img[y, cx] = hx('#6b707c') if (y // 2) % 2 else hx('#2e3138'); img[y, cx + ((y // 2) % 2)] = hx('#3c404a')
        yb = 30 + (cx % 7) * 2
        cuff = ell(cx, yb + 3, 3, 2) & ~ell(cx, yb + 3, 2, 1)
        img[cuff] = hx('#7a5a3a'); img[cuff & (YY < yb + 3)] = RIM2
    # straw piles in the corners
    for cx, cy in [(14, 112), (118, 250), (8, 236)]:
        for _ in range(70):
            x, y = cx + rng.normal(0, 6), cy + rng.normal(0, 3)
            L = rng.integers(2, 5); dxs = rng.choice([-1, 1])
            for k in range(L):
                xi, yi = int(x + k * dxs), int(y - k * 0.5)
                if 0 <= xi < W and WALL <= yi < H: img[yi, xi] = hx('#a08a3c') if k == 0 else hx('#6e5c28')
    # a drain grate
    gx, gy = 64, 214
    gr = (np.abs(XX - gx) <= 7) & (np.abs(YY - gy) <= 4)
    img[gr] = K; img[gr & ((XX - gx) % 3 == 0)] = hx('#3c404a'); img[gr & (np.abs(YY - gy) == 4)] = hx('#5a5f6b')
    # door: an iron portcullis in a stone arch, black passage behind
    arch = (np.abs(XX - DX) <= 14) & (YY >= 22) & (YY < WALL) & ((YY - 22) >= ((XX - DX) ** 2) / 14)
    img[(np.abs(XX - DX) <= 17) & (YY >= 19) & (YY < WALL) & ((YY - 19) >= ((XX - DX) ** 2) / 15) & ~arch] = stone[4]
    img[arch] = hx('#020203')
    bars = arch & (((XX - DX) % 4) == 0); img[bars] = hx('#4a4e58'); img[bars & (((XX - DX) % 8) == 0)] = hx('#6b4a30')
    cross = arch & ((YY - 30) % 11 == 0); img[cross] = hx('#3a3e48')
    img[(YY == WALL - 1) & (np.abs(XX - DX) <= 14) & (((XX - DX) % 4) == 0)] = RIM
    vignette(img, 0.55)
    return img

def compose(art, overlay):
    big = Image.fromarray(np.clip(art, 0, 255).astype(np.uint8)).resize((W * 3, H * 3), Image.NEAREST).crop((0, 0, 390, 844))
    ov = np.array(overlay.convert('RGB')).astype(int)
    r, g, b = ov[..., 0], ov[..., 1], ov[..., 2]
    key = (r > 120) & (b > 120) & (g < 0.55 * np.minimum(r, b))
    a = np.where(key, 0, 255).astype(np.uint8)
    o = Image.fromarray(np.dstack([ov.astype(np.uint8), a]), 'RGBA')
    big = big.convert('RGBA'); big.alpha_composite(o)
    return big.convert('RGB')

if __name__ == '__main__':
    out = sys.argv[1]
    overlay = Image.open(sys.argv[2])
    rooms = [('1 Natural cave', cave, 3), ('2 Royal crypt', crypt, 4), ('3 Temple ruin', temple, 5), ('4 Prison cells', prison, 6)]
    shots = []
    for name, fn, seed in rooms:
        art = fn(np.random.default_rng(seed))
        im = compose(art, overlay)
        im.save(f"{out}/room-{name.split()[0]}.png"); shots.append((name, im))
    sheet = Image.new('RGB', (400 * len(shots), 874), (20, 18, 16)); d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(shots):
        sheet.paste(im, (i * 400, 30)); d.text((i * 400 + 8, 8), name, fill=(255, 230, 180))
    sheet.save(f"{out}/rooms-sheet.png")
