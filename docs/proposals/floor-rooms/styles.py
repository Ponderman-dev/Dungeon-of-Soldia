# Run: python3 -I styles.py <out dir> <overlay.png> <dir with rooms.py + dungeons.py>. Picture mockups only.
# Classic dungeon, 4 ART DIRECTIONS (session 55, user: 'classic dungeon look but different: art style, stone pattern,
# colour palette'). Same layout as the game: brick wall + 2 pillars + torches + door in the middle, stone floor.
import sys, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[3])
from rooms import W, H, WALL, DX, BAYER, YY, XX, hx, ramp, noise, shade, ell, compose
from dungeons import pillar, glow, torch, finish_vignette, PILLARS

def rnd_tone(idx, seed=0.0):
    return (np.sin(idx * 12.9898 + seed) * 43758.5453) % 1

def door2(img, stone, wood, woodD, iron, outline, hw=9, studs='#b0a898', ink=1):
    top = WALL - 26
    arch = lambda p: (np.abs(XX - DX) <= hw + p) & (YY >= top - p) & (YY < WALL) & ((YY - top + p) >= ((XX - DX) ** 2) / (hw + p) * 0.8)
    img[arch(3 + ink)] = hx(outline)
    img[arch(3)] = hx(stone)
    blocks = arch(3) & ~arch(0) & ((((np.arctan2(YY - WALL, XX - DX) * 9).astype(int)) % 2) == 0)
    img[blocks] = hx(stone) * 0.8
    img[arch(ink)] = hx(outline)
    img[arch(0)] = hx(wood)
    img[arch(0) & (((XX - DX + 9) % 4) == 0)] = hx(woodD)
    for by in (WALL - 7, WALL - 18):
        img[arch(0) & ((YY == by) | (YY == by + 1))] = hx(iron)
        img[arch(0) & (YY == by) & ((XX % 3) == 0)] = hx(studs)

# 1 ---- CHUNKY 8-BIT: 5 colours, bold black outlines, flat fills, diagonal diamond floor tiles
def nes(rng):
    K, D, M, L, HI = hx('#0b0b18'), hx('#28304e'), hx('#46557e'), hx('#7f92bf'), hx('#c6d2f0')
    img = np.zeros((H, W, 3))
    # wall: big flat bricks, light top line, black outlines
    bw, bh = 16, 8
    off = ((YY // bh) % 2) * 8; bx, by = (XX + off) % bw, YY % bh
    wall = YY < WALL
    img[wall] = M; img[wall & (by == 1)] = L
    img[wall & ((bx == 0) | (by == 0) | (by == bh - 1) & False)] = K
    img[wall & (((rnd_tone((YY // bh) * 31 + (XX + off) // bw)) < 0.25) & (by > 1) & (bx > 0))] = D
    img[(YY >= WALL - 3) & (YY < WALL)] = D; img[YY == WALL - 3] = L; img[YY == WALL - 1] = K
    # floor: diagonal diamond tiles in 2 tones, black lines, lit upper-left edge
    s = 16; fy = YY - WALL
    u, v = (XX + fy) // s, (XX - fy) // s
    fl = fy >= 0
    img[fl & ((u + v) % 2 == 0)] = M; img[fl & ((u + v) % 2 == 1)] = D
    img[fl & (((XX + fy) % s) == 1)] = L * 0.9
    img[fl & ((((XX + fy) % s) == 0) | (((XX - fy) % s) == 0))] = K
    img[fl & (YY < WALL + 2)] = K
    nes_ramp = ramp('#0b0b18', '#28304e', '#46557e', '#7f92bf', '#c6d2f0')
    for cx in PILLARS: pillar(img, nes_ramp, cx)
    door2(img, '#46557e', '#6a4a2a', '#3a2614', '#28304e', '#0b0b18', studs='#c6d2f0')
    for cx in PILLARS: torch(img, cx, 34)
    return img

# 2 ---- SOFT 16-BIT DUSK: purple-grey, smooth dithered shading, big slabs + a carved border path from the door
def dusk(rng):
    P = ramp('#140d1a', '#1f1628', '#2c2138', '#3a2d49', '#4a3b5b', '#5c4b6e', '#715f84', '#8a7a9c', '#a898b6')
    img = np.zeros((H, W, 3)); n = noise(rng, 14)
    bw, bh = 14, 7
    row = YY // bh; off = (row % 2) * 7; bx, by = (XX + off) % bw, YY % bh
    wall = YY < WALL
    tone = (rnd_tone(row * 41 + (XX + off) // bw) - 0.5) * 0.2
    v = 0.6 + tone - by / bh * 0.25 + (n - 0.5) * 0.12 - 0.15 * (YY < 18)
    shade(img, wall, v, P)
    img[wall & ((bx == 0) | (by == 0))] = P[1]
    # floor slabs 24 x 20 with gradient; a border path (small square tiles) from the door straight down
    fy = YY - WALL; fl = fy >= 0
    sw, sh = 24, 20
    prow = fy // sh; poff = (prow % 2) * 12
    sx, sy = (XX + poff) % sw, fy % sh
    t2 = (rnd_tone(prow * 17 + (XX + poff) // sw, 2.0) - 0.5) * 0.2
    v = 0.55 + t2 - sy / sh * 0.18 + (n - 0.5) * 0.12
    shade(img, fl, v, P)
    img[fl & ((sx == 0) | (sy == 0))] = P[1]; img[fl & (sy == 1)] = P[6]
    path = fl & (np.abs(XX - DX) <= 14)
    pv = 0.42 + ((((XX - DX + 14) // 4) + (fy // 4)) % 2) * 0.08 + (n - 0.5) * 0.08
    shade(img, path, pv, P)
    img[path & ((((XX - DX + 14) % 4) == 0) | ((fy % 4) == 0))] = P[1]
    img[fl & ((np.abs(XX - DX) == 15) | (np.abs(XX - DX) == 16))] = P[7]
    img[fl & (np.abs(XX - DX) == 17)] = P[0]
    img[WALL:WALL + 3] *= np.array([0.55, 0.7, 0.85])[:, None, None]
    for cx in PILLARS: pillar(img, P, cx)
    door2(img, '#4a3b5b', '#5a3a2a', '#35201a', '#2c2138', '#140d1a', studs='#a898b6')
    for cx in PILLARS: torch(img, cx, 34)
    finish_vignette(img, 0.4)
    return img

# 3 ---- INK & SEPIA: warm sandy stone, heavy 2px ink lines, highlights only on top edges, basketweave brick floor
def ink(rng):
    S = ramp('#2a2018', '#4a3a2c', '#6a5640', '#8a7356', '#a89070', '#c4ae8c')
    INK = hx('#120c08')
    img = np.zeros((H, W, 3)); n = noise(rng, 12)
    # wall: large irregular blocks (rows of varying height), ink outlines 2px on bottom/right
    y = 0; wall = YY < WALL
    rows = []
    while y < WALL:
        h = int(rng.integers(8, 13)); rows.append((y, min(WALL, y + h))); y += h
    for (y0, y1) in rows:
        x = -int(rng.integers(0, 20))
        while x < W:
            w = int(rng.integers(14, 26))
            m = (XX >= x) & (XX < x + w) & (YY >= y0) & (YY < y1)
            v = 0.55 + (rng.random() - 0.5) * 0.25 + (n - 0.5) * 0.15
            shade(img, m, v, S)
            img[m & (YY == y0 + 2)] = S[5]
            img[m & ((XX >= x + w - 2) | (YY >= y1 - 2) | (XX == x) | (YY == y0))] = INK
            x += w
    # floor: basketweave bricks (2x2 blocks of 8 px; horizontal pair / vertical pair alternating), ink lines
    fy = YY - WALL; fl = fy >= 0; c = 12
    bx, by = XX // c, fy // c; lx, ly = XX % c, fy % c
    horiz = ((bx + by) % 2) == 0
    half = np.where(horiz, ly // 6, lx // 6)
    bid = (bx * 7 + by * 13) * 2 + half
    v = 0.5 + (rnd_tone(bid, 5.0) - 0.5) * 0.16 + (n - 0.5) * 0.1
    shade(img, fl, v, S)
    line = np.where(horiz, (ly % 6 == 5), (lx % 6 == 5)) | (lx == c - 1) | (ly == c - 1)
    img[fl & line] = S[0]
    hl = np.where(horiz, (ly % 6 == 0), (ly == 0))
    img[fl & hl & ~line] = S[4]
    img[fl & (fy < 2)] = INK
    for cx in PILLARS: pillar(img, S, cx)
    for cx in PILLARS: img[:WALL, cx - 8:cx - 6] = INK; img[:WALL, cx + 6:cx + 8] = INK
    door2(img, '#8a7356', '#6a4428', '#3a2414', '#2a2018', '#120c08', studs='#c4ae8c', ink=2)
    for cx in PILLARS: torch(img, cx, 34)
    finish_vignette(img, 0.35)
    return img

# 4 ---- FLAT MODERN: teal-grey, NO outlines, flat colour blocks, soft ambient-occlusion shadows, mosaic floor
def flat(rng):
    T = ramp('#10191c', '#172427', '#1f3034', '#283d41', '#324a4f', '#3f5a5f', '#4f6c70', '#62807f')
    ACC = [hx('#3d7a6c'), hx('#7a5a3a'), hx('#5a4a6a')]
    img = np.zeros((H, W, 3))
    # wall: long thin bricks, flat tones, a darker band at the foot (AO), no outlines (gap = 1 shade darker)
    bw, bh = 20, 5
    row = YY // bh; off = (row * 9) % bw; bx, by = (XX + off) % bw, YY % bh
    wall = YY < WALL
    tone = rnd_tone(row * 37 + (XX + off) // bw, 1.0)
    idx = np.where(tone < 0.33, 4, np.where(tone < 0.66, 5, 3))
    img[wall] = T[idx][wall]
    img[wall & ((bx == 0) | (by == 0))] = T[2]
    ao = wall & (YY >= WALL - 8); img[ao] = img[ao] * (0.75 + (WALL - YY[ao]) / 8 * 0.25)[..., None]
    # floor: mosaic of 5 px squares, flat tones, a few coloured accent tiles, AO under the wall
    fy = YY - WALL; fl = fy >= 0; s = 7
    tid = (XX // s) * 131 + (fy // s) * 7
    t = rnd_tone(tid, 3.0)
    idx = np.where(t < 0.25, 3, np.where(t < 0.85, 4, 5))
    img[fl] = T[idx][fl]
    for k, col in enumerate(ACC):
        acc = fl & (rnd_tone(tid, 9.0 + k) < 0.012)
        img[acc] = col
    img[fl & (((XX % s) == 0) | ((fy % s) == 0))] = T[2]
    aof = fl & (fy < 10); img[aof] = img[aof] * (0.55 + fy[aof] / 10 * 0.45)[..., None]
    # pillars: flat 3-tone, no outline
    for cx in PILLARS:
        for x in range(cx - 6, cx + 6):
            t = (x - cx + 6) / 11
            img[:WALL, x] = T[6] if t < 0.4 else T[5] if t < 0.75 else T[3]
        img[WALL - 4:WALL, cx - 8:cx + 8] = T[5]; img[WALL - 4, cx - 8:cx + 8] = T[7]
        img[WALL:WALL + 4, cx - 9:cx + 9] *= 0.7
    door2(img, '#4f6c70', '#6a4a30', '#4a3220', '#283d41', '#283d41', studs='#62807f', ink=0)
    for cx in PILLARS: torch(img, cx, 34)
    return img

if __name__ == '__main__':
    out, overlay = sys.argv[1], Image.open(sys.argv[2])
    rooms = [('1 Chunky 8-bit', nes, 3), ('2 Soft 16-bit dusk', dusk, 4), ('3 Ink and sepia', ink, 5), ('4 Flat modern', flat, 6)]
    shots = []
    for name, fn, seed in rooms:
        im = compose(fn(np.random.default_rng(seed)), overlay)
        im.save(f"{out}/style-{name.split()[0]}.png"); shots.append((name, im))
    sheet = Image.new('RGB', (400 * len(shots), 874), (20, 18, 16)); d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(shots):
        sheet.paste(im, (i * 400, 30)); d.text((i * 400 + 8, 8), name, fill=(255, 230, 180))
    sheet.save(f"{out}/styles-sheet.png")
