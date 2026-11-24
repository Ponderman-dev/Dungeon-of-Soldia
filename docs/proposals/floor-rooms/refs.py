# Run: python3 -I refs.py <out dir> <overlay.png> <dir with rooms.py + dungeons.py>. Mockups after the user reference pictures.
# Dungeon mockups after the user's 3 reference pictures (session 55): calm readable floors, a wall seen a little from
# above (top edge / caps), detail from PROPS (barrels, crates, chests, rubble, skulls, vines), clean dark outlines.
import sys, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[3])
from rooms import W, H, WALL, DX, BAYER, YY, XX, hx, ramp, noise, shade, ell, compose
from dungeons import torch, glow

def tone(i, s=0.0): return (np.sin(i * 12.9898 + s) * 43758.5453) % 1

def stamp(img, rows, x0, y0, pal, shadow=True):
    h, w = len(rows), len(rows[0])
    if shadow:  # a soft dark shadow down-right
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != '.':
                    yy, xx = y0 + y + 2, x0 + x + 1
                    if 0 <= yy < H and 0 <= xx < W: img[yy, xx] *= 0.6
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= y0 + y < H and 0 <= x0 + x < W: img[y0 + y, x0 + x] = hx(pal[ch])

WOOD = {'k': '#1a110b', 'w': '#5a3a22', 'W': '#7a5232', 'L': '#9a6a40', 'i': '#3a3a40', 'I': '#6a6a74', 'g': '#c8962e', 'Y': '#f0d060'}
BARREL = [".kkkkkkk.", "kwWLLLWwk", "kIIIIIIIk", "kwWLLLWwk", "kwWLLLWwk", "kwWLLLWwk", "kwWLLLWwk", "kIIIIIIIk", "kwWLLLWwk", "kwwWWWwwk", ".kkkkkkk."]
CRATE = ["kkkkkkkkkk", "kLLLLLLLLk", "kLwWwWwWLk", "kLwWwWwWLk", "kLwWwWwWLk", "kLLLLLLLLk", "kLwWkWkWLk", "kLwWkWkWLk", "kLLLLLLLLk", "kkkkkkkkkk"]
CHEST = [".kkkkkkkkkk.", "kWLLLLLLLLWk", "kwWWWWWWWWwk", "kggggggggggk", "kwWWWgYgWWwk", "kwWWWgggWWwk", "kwWWWWWWWWwk", "kggggggggggk", "kkkkkkkkkkkk"]
SKULL = {'rows': [".bbb.", "bbbbb", "bkbkb", "dbbbd", ".b.b."], 'pal': {'b': '#c8c0aa', 'd': '#8a8270', 'k': '#141010'}}

def rubble(img, rng, cx, cy, stone='#6a6870', plank=True):
    if plank:
        for (dx, dy, L) in [(-6, 3, 12), (-2, 5, 10)]:
            for k in range(L):
                x, y = cx + dx + k, cy + dy - k // 3
                img[y, x] = hx('#7a5232'); img[y + 1, x] = hx('#4a3020'); img[y - 1, x] = hx('#1a110b')
    for _ in range(9):
        x, y = int(cx + rng.normal(0, 3.5)), int(cy + rng.normal(0, 1.6))
        w, h = int(rng.integers(3, 5)), int(rng.integers(2, 4))
        img[y - 1:y + h + 1, x - 1:x + w + 1] = hx('#141214')
        img[y:y + h, x:x + w] = hx(stone); img[y, x:x + w] = hx(stone) * 1.3; img[y + h - 1, x:x + w] = hx(stone) * 0.7

def ashlar(img, rng, x0, x1, y0, y1, base, gapc, cell=4, maxc=(3, 2), mott=0.05):
    cols, rows = (x1 - x0) // cell + 2, (y1 - y0) // cell + 2
    used = np.zeros((rows, cols), bool)
    for r in range(rows):
        for q in range(cols):
            if used[r, q]: continue
            w, h = 1 + int(rng.random() ** 0.7 * maxc[0]), 1 + int(rng.random() ** 0.7 * maxc[1])
            while w > 1 and (q + w > cols or used[r, q:q + w].any()): w -= 1
            h = min(h, rows - r)
            used[r:r + h, q:q + w] = True
            X0, Y0 = x0 + q * cell - cell // 2 * (r % 2), y0 + r * cell
            c = hx(base) * (0.9 + tone(r * 31 + q, 1) * 0.2)
            m = (XX > X0) & (XX < X0 + w * cell) & (YY > Y0) & (YY < Y0 + h * cell) & (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)
            img[m] = c
            img[m & (YY == Y0 + 1)] = c * 1.12
            img[m & (XX == X0 + w * cell - 1)] = c * 0.85
    gm = (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1) & (img.sum(2) == 0)
    img[gm] = hx(gapc)
    # mottling (two-tone blotches, no speckle)
    mot = (noise(rng, 6) > 0.62) & (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1) & ~gm
    img[mot] *= (1 - mott)

def brickwall(img, x0, x1, y0, y1, face, light, mortar, bw=9, bh=4, top_light=True):
    m = (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)
    row = (YY - y0) // bh; off = (row % 2) * (bw // 2)
    bx, by = (XX - x0 + off) % bw, (YY - y0) % bh
    t = tone(row * 41 + (XX - x0 + off) // bw, 3)
    c = hx(face)[None, None, :] * (0.88 + t[..., None] * 0.24)
    img[m] = c[m]
    if top_light: img[m & (by == 1)] = hx(light)
    img[m & ((bx == 0) | (by == 0))] = hx(mortar)

def darken_edges(img, k=0.85, inner=0.18):
    d = np.maximum(np.abs(XX - W / 2) / (W / 2), np.abs(YY - H / 2) / (H / 2))
    f = np.clip(1 - np.clip(d - (1 - inner), 0, 1) / inner * k, 0.1, 1)
    img *= (np.round(f * 6) / 6)[..., None]

# A ---- after picture 1: pale brick walls framing the room, dark irregular flagstones, vines, deep dark edges
def ref_a(rng):
    img = np.zeros((H, W, 3))
    SIDE = 10
    ashlar(img, rng, SIDE, W - SIDE, WALL, H, '#4a4a4c', '#2c2c2e', cell=4, maxc=(3, 2))
    brickwall(img, 0, W, 0, WALL, '#9a9a9c', '#d0d0d2', '#3a3a3e', bw=10, bh=5)
    for x0 in (0, W - SIDE): brickwall(img, x0, x0 + SIDE, WALL, H, '#9a9a9c', '#d0d0d2', '#3a3a3e', bw=10, bh=5)
    img[WALL:H, SIDE] = hx('#2a2a2c'); img[WALL:H, W - SIDE - 1] = hx('#2a2a2c')
    img[WALL:WALL + 3, SIDE:W - SIDE] *= np.array([0.55, 0.7, 0.85])[:, None, None]
    img[(YY >= WALL - 3) & (YY < WALL)] = hx('#b8b8ba'); img[YY == WALL - 3] = hx('#e0e0e2'); img[YY == WALL - 1] = hx('#3a3a3e')
    for cx in (24, 106):  # square brick pillars with a light edge
        brickwall(img, cx - 6, cx + 6, 0, WALL, '#b0b0b2', '#e4e4e6', '#3a3a3e', bw=6, bh=5)
        img[:WALL, cx - 7] = hx('#2a2a2e'); img[:WALL, cx + 6] = hx('#2a2a2e')
    # door: an arch with a dark wooden door
    hw, top = 9, WALL - 24
    arch = lambda p: (np.abs(XX - DX) <= hw + p) & (YY >= top - p) & (YY < WALL) & ((YY - top + p) >= ((XX - DX) ** 2) / (hw + p) * 0.8)
    img[arch(3)] = hx('#2a2a2e'); img[arch(2)] = hx('#c8c8ca'); img[arch(1)] = hx('#1a1a1c'); img[arch(0)] = hx('#4a3020')
    img[arch(0) & (((XX - DX) % 4) == 0)] = hx('#2e1c12'); img[arch(0) & ((YY == WALL - 8) | (YY == WALL - 17))] = hx('#3a3a40')
    # vines hanging over the top of the floor
    G = ['#1e4a1c', '#2e6a28', '#4a8a3a']
    for x0 in [14, 20, 41, 47, 52, 78, 84, 98, 113]:
        x = x0; L = int(rng.uniform(14, 36))
        for y in range(4, WALL + L - 20):
            xi = int(x)
            img[y, xi] = hx(G[1]); img[y, xi - 1] = hx(G[0])
            if y % 3 == 0: img[y, xi + 1] = hx(G[2])
            x += rng.uniform(-0.35, 0.35)
    # dry weeds near the bottom corners
    for cx, cy in [(22, 248), (108, 252), (60, 262)]:
        for _ in range(16):
            x, y = int(cx + rng.normal(0, 4)), int(cy + rng.normal(0, 2))
            for k in range(int(rng.integers(2, 5))): img[y - k, x + (k % 2)] = hx('#7a7a2a') if k else hx('#4a4a1c')
    stamp(img, CHEST, DX - 6, 250, WOOD)
    for cx in (24, 106): torch(img, cx, 34)
    darken_edges(img, 0.9, 0.12)
    return img

# B ---- after picture 2: brown wall with a top edge, octagon floor tiles + border, props, warm torchlight
def ref_b(rng):
    img = np.zeros((H, W, 3))
    SIDE = 8
    # floor: border band of slabs, octagon tiles with small diamond inserts inside
    fl = (YY >= WALL) & (XX >= SIDE) & (XX < W - SIDE)
    brickwall(img, SIDE, W - SIDE, WALL, H, '#3c3a40', '#4a4850', '#1e1c22', bw=12, bh=8, top_light=False)
    s = 14; inner = (XX >= SIDE + 8) & (XX < W - SIDE - 8) & (YY >= WALL + 8)
    lx, ly = (XX - SIDE - 8) % s - s / 2 + 0.5, (YY - WALL - 8) % s - s / 2 + 0.5
    octa = (np.maximum(np.abs(lx), np.abs(ly)) <= s / 2 - 1) & (np.abs(lx) + np.abs(ly) <= s * 0.62)
    tid = ((XX - SIDE - 8) // s) * 13 + (YY - WALL - 8) // s
    base = hx('#4c525c')[None, None, :] * (0.92 + tone(tid, 2)[..., None] * 0.14)
    img[inner & octa] = base[inner & octa]
    img[inner & ~octa] = hx('#3a3e46')
    edge = inner & octa & ~((np.maximum(np.abs(lx), np.abs(ly)) <= s / 2 - 2) & (np.abs(lx) + np.abs(ly) <= s * 0.62 - 1))
    img[edge] = hx('#24272e')
    img[inner & octa & (ly < -s / 2 + 2.5) & ~edge] = hx('#5a616c')
    mot = inner & octa & (noise(rng, 5) > 0.63); img[mot] *= 0.93
    img[(YY == WALL + 8) & (XX >= SIDE + 8) & (XX < W - SIDE - 8)] = hx('#24272e')
    # wall: a top edge seen from above (bricks lying flat, a light rim), then the wall face; side wall tops
    TOP = 10
    brickwall(img, 0, W, 0, TOP, '#6e5a44', '#8a7458', '#2a2018', bw=11, bh=5)
    img[TOP - 1:TOP + 1, :] = hx('#1a140e')
    brickwall(img, 0, W, TOP + 1, WALL, '#4a3e32', '#5e5040', '#201812', bw=12, bh=6)
    for x0 in (0, W - SIDE):
        brickwall(img, x0, x0 + SIDE, WALL, H, '#6e5a44', '#8a7458', '#2a2018', bw=11, bh=5)
    img[WALL:H, SIDE - 1] = hx('#1a140e'); img[WALL:H, W - SIDE] = hx('#1a140e')
    for gx in (14, 48, 82, 116):  # gold flecks on the wall top
        img[4, gx:gx + 3] = hx('#c8962e'); img[5, gx + 1] = hx('#8a6a20')
    for nx in (36, 94):  # arched niches in the wall face
        n = (np.abs(XX - nx) <= 4) & (YY >= 30) & (YY < 46) & ((YY - 30) >= ((XX - nx) ** 2) / 4)
        img[n] = hx('#140f0b'); img[(np.abs(XX - nx) <= 5) & (YY == 46)] = hx('#6e5a44')
    img[WALL:WALL + 3, SIDE:W - SIDE] *= np.array([0.5, 0.65, 0.8])[:, None, None]
    # door: arched wooden door with a stone frame and iron hinges
    hw, top = 9, WALL - 26
    arch = lambda p: (np.abs(XX - DX) <= hw + p) & (YY >= top - p) & (YY < WALL) & ((YY - top + p) >= ((XX - DX) ** 2) / (hw + p) * 0.8)
    img[arch(3)] = hx('#1a140e'); img[arch(2)] = hx('#8a7458'); img[arch(1)] = hx('#1a140e'); img[arch(0)] = hx('#6a3a26')
    img[arch(0) & (((XX - DX) % 5) == 0)] = hx('#4a2618')
    img[arch(0) & ((YY == WALL - 9) | (YY == WALL - 18)) & (XX < DX + 4)] = hx('#2a2a30')
    img[WALL - 14, DX + 5] = hx('#c8962e')
    # warm light from the torches
    for cx in (24, 106):
        glow(img, cx, 36, '#ffb050', ((34, 0.06), (24, 0.08), (14, 0.1)))
        torch(img, cx, 34)
    # props: barrels, crates, a chest, rubble with planks, pebbles
    stamp(img, BARREL, 12, 76, WOOD); stamp(img, BARREL, 20, 82, WOOD)
    stamp(img, CRATE, 108, 74, WOOD); stamp(img, CRATE, 110, 64 + 20, WOOD)
    stamp(img, CHEST, 84, 70, WOOD)
    rubble(img, rng, 40, 78); rubble(img, rng, 104, 240)
    stamp(img, BARREL, 104, 256, WOOD); stamp(img, CRATE, 14, 258, WOOD)
    for _ in range(10):
        x, y = int(rng.uniform(SIDE + 10, W - SIDE - 10)), int(rng.uniform(WALL + 14, H - 6))
        img[y, x:x + 2] = hx('#8a8898'); img[y + 1, x:x + 2] = hx('#4a4858')
    darken_edges(img, 0.6, 0.08)
    return img

# C ---- after picture 3: capstone row + round capped pillars, big flat square tiles, gargoyle fountains, crates
def ref_c(rng):
    img = np.zeros((H, W, 3))
    # floor: big flat squares with thin dark grid lines that have small notches
    s = 16; fy = YY - WALL; fl = fy >= 0
    img[fl] = hx('#4e403b')
    gl = fl & (((XX % s) == 0) | ((fy % s) == 0))
    img[gl] = hx('#2e2422')
    notch = fl & ((((XX % s) == 1) & ((fy % s) == s // 2)) | (((fy % s) == 1) & ((XX % s) == s // 2)))
    img[notch] = hx('#2e2422')
    img[fl & (fy < 3)] *= 0.7
    # wall: black above, a capstone row (light rounded stones), brick face with light top lines
    img[:6] = hx('#0a0808')
    cap = (YY >= 6) & (YY < 12)
    cx_ = XX % 8
    img[cap] = hx('#9a8478'); img[cap & (YY == 6)] = hx('#c0a898'); img[cap & ((cx_ == 0) | (YY == 11))] = hx('#3a2c28')
    brickwall(img, 0, W, 12, WALL, '#3e302c', '#6a564e', '#1e1614', bw=10, bh=5)
    img[(YY >= WALL - 2) & (YY < WALL)] = hx('#2a201c')
    # round capped pillars sticking out of the wall
    for px in (10, 34, 96, 120):
        for x in range(px - 6, px + 6):
            t = (x - px + 6) / 11
            col = '#5a4a44' if t < 0.25 else '#6e5c54' if t < 0.5 else '#4a3c38' if t < 0.8 else '#2e2422'
            img[8:WALL + 2, x] = hx(col)
        for y in range(14, WALL + 2, 9): img[y, px - 6:px + 6] = hx('#2e2422')
        img[3:9, px - 7:px + 7] = hx('#9a8478'); img[3, px - 6:px + 6] = hx('#c0a898'); img[8, px - 7:px + 7] = hx('#3a2c28')
        img[WALL + 2, px - 6:px + 6] = hx('#1a1210')
        img[WALL + 3:WALL + 5, px - 6:px + 7] *= 0.6
    # gargoyle heads with a lava basin and a water basin beside the door
    for gx, liquid, dark in [(DX - 22, '#e8642a', '#a8381a'), (DX + 22, '#5ab0e0', '#2a6a9a')]:
        head = ell(gx, 22, 5, 6); img[head] = hx('#6e5c54'); img[ell(gx, 22, 5, 6) & ~ell(gx, 22, 4, 5)] = hx('#2e2422')
        img[14:18, gx - 5] = hx('#6e5c54'); img[14:18, gx + 4] = hx('#6e5c54')  # ears
        img[21, gx - 2] = hx('#1a1210'); img[21, gx + 2] = hx('#1a1210')
        img[28:WALL - 4, gx] = hx(liquid); img[28:WALL - 4, gx + 1] = hx(dark)
        b = (np.abs(XX - gx) <= 5) & (YY >= WALL - 5) & (YY < WALL + 1)
        img[b] = hx(liquid); img[b & (YY == WALL - 5)] = hx('#fff0c0') if liquid == '#e8642a' else hx('#c8f0ff')
        img[(np.abs(XX - gx) <= 6) & (YY == WALL + 1)] = hx('#2e2422'); img[(np.abs(XX - gx) == 6) & (YY >= WALL - 5) & (YY <= WALL)] = hx('#2e2422')
    # door: dark wooden double door in the brick face
    hw, top = 9, WALL - 26
    arch = lambda p: (np.abs(XX - DX) <= hw + p) & (YY >= top - p) & (YY < WALL) & ((YY - top + p) >= ((XX - DX) ** 2) / (hw + p) * 0.8)
    img[arch(2)] = hx('#9a8478'); img[arch(1)] = hx('#1a1210'); img[arch(0)] = hx('#7a3e24')
    img[arch(0) & (((XX - DX) % 4) == 0)] = hx('#4a2414'); img[arch(0) & (XX == DX)] = hx('#1a1210')
    img[arch(0) & ((YY == WALL - 6) | (YY == WALL - 16))] = hx('#d08a3a')
    # cracks, a skull, a hole, crates
    for (x, y) in [(28, 110), (100, 108), (70, 200)]:
        for k in range(9):
            img[y + (k // 3), x + k] = hx('#2e2422')
            if k == 4: img[y + 3:y + 6, x + 4] = hx('#2e2422')
    stamp(img, SKULL['rows'], 16, 150, SKULL['pal'])
    hole = ell(108, 232, 7, 3); img[hole] = hx('#120c0a'); img[ell(108, 231, 7, 3) & ~hole] = hx('#2e2422')
    stamp(img, CRATE, 6, 176, WOOD); stamp(img, CRATE, 14, 190, WOOD); stamp(img, CRATE, 118, 140, WOOD)
    for cx in (34, 96): torch(img, cx, 30)
    return img

if __name__ == '__main__':
    out, overlay = sys.argv[1], Image.open(sys.argv[2])
    rooms = [('A  after picture 1', ref_a, 3), ('B  after picture 2', ref_b, 4), ('C  after picture 3', ref_c, 5)]
    shots = []
    for name, fn, seed in rooms:
        im = compose(fn(np.random.default_rng(seed)), overlay)
        im.save(f"{out}/ref-{name.split()[0]}.png"); shots.append((name, im))
    sheet = Image.new('RGB', (400 * len(shots), 874), (20, 18, 16)); d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(shots):
        sheet.paste(im, (i * 400, 30)); d.text((i * 400 + 8, 8), name, fill=(255, 230, 180))
    sheet.save(f"{out}/refs-sheet.png")
