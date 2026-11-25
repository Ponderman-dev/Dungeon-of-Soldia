# HERO BANNERS proposal (session 57; user: 'heroes page like a lore page with a custom pixel banner per hero').
# One small pixel scene per hero from its lore (heroPage.json), sized for the hero page's 'YOUR PIXEL ART' box
# (338x178 screen px): 113x59 art pixels shown at 3x, hard pixels only. Each uses the dusk ground + its hero colour.
# Usage: python3 make-banners.py <out dir>   -> <id>.png (113x59) and <id>@3x.png
import sys, os, math, random, json
from PIL import Image
W, H = 113, 59
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]   # Bayer dither

class Pic:
    def __init__(s): s.im = Image.new('RGB', (W, H)); s.px = s.im.load()
    def p(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[int(x), int(y)] = c
    def rect(s, x, y, w, h, c):
        for j in range(int(y), int(y + h)):
            for i in range(int(x), int(x + w)): s.p(i, j, c)
    def sky(s, stops, y0=0, y1=H):   # dithered vertical gradient through colour stops
        for y in range(y0, y1):
            t = (y - y0) / max(1, y1 - y0 - 1) * (len(stops) - 1); k = min(int(t), len(stops) - 2); f = t - k
            for x in range(W): s.p(x, y, stops[k + 1] if f * 16 > B4[y % 4][x % 4] + 0.5 else stops[k])
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): s.p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def disc(s, cx, cy, r, c, ring=None):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = math.hypot(x - cx, y - cy)
                if d <= r: s.p(x, y, ring if ring and d > r - 1 else c)
    def glow(s, cx, cy, r, c, strength=0.6):   # dithered light pool
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                d = math.hypot(x - cx, (y - cy) * 1.3) / r
                if d < 1 and (1 - d) * strength * 16 > B4[y % 4][x % 4] and 0 <= x < W and 0 <= y < H: s.px[x, y] = mix(s.px[x, y], c, 0.45)
    def poly(s, pts, c):   # filled polygon (scanline)
        ys = [q[1] for q in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if (y0 <= y < y1) or (y1 <= y < y0): xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(round(a), round(b) + 1): s.p(x, y, c)
    def torch(s, x, y, flame):
        s.rect(x, y, 1, 4, (70, 50, 40)); s.rect(x - 1, y - 2, 3, 2, flame); s.p(x, y - 3, (255, 240, 170)); s.glow(x, y - 2, 9, flame, 0.7)
    def save(s, name):
        s.im.save(os.path.join(OUT, name + '.png')); s.im.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(OUT, name + '@3x.png'))

INK = (12, 11, 16); NIGHT = [hx('1a1530'), hx('2a2040'), hx('3a2a4a')]; STONE = hx('4a4652'); STONE2 = hx('35323d'); STONE3 = hx('6a6676')
heroes = {h['id']: hx(h['color'][2:]) for h in json.load(open(os.path.join(os.path.dirname(__file__), '../../../src/data/heroes.json')))}
R = random.Random(7)

def stars(s, n, top=30):
    for _ in range(n): s.p(R.randrange(W), R.randrange(top), (200, 200, 230) if R.random() < .5 else (120, 120, 160))

# KNIGHT: Soldia's broken gate, the stair going down into the dark, torches.
def knight(c):
    s = Pic(); s.sky(NIGHT + [hx('4a3a58')]); stars(s, 30)
    s.rect(0, 22, W, H - 22, STONE2)
    for x in range(0, W, 8):   # wall stones
        for y in range(22, H, 5): s.rect(x + (4 if (y // 5) % 2 else 0), y, 7, 4, STONE)
    for x in range(0, W, 6): s.rect(x, 18, 4, 4, STONE)   # battlements
    s.rect(38, 14, 37, 45, STONE3); s.rect(41, 11, 31, 3, STONE3)
    for x in range(41, 72, 5): s.rect(x, 8, 3, 3, STONE3)
    s.poly([(45, 59), (45, 30), (49, 25), (56, 23), (63, 25), (68, 30), (68, 59)], INK)   # arch
    for i, y in enumerate(range(44, 59, 3)): s.rect(47 + i * 2 - 2, y, 23 - i * 2 + 4, 1, (28, 26, 34))   # stair down
    for x in range(47, 68, 4):   # bent portcullis, half up
        for y in range(26, 37): s.p(x + (1 if x in (55,) and y > 32 else 0), y, (90, 92, 104))
    s.rect(46, 36, 22, 1, (90, 92, 104)); s.rect(46, 30, 22, 1, (90, 92, 104))
    s.rect(54, 2, 1, 10, (120, 110, 90)); s.rect(55, 2, 9, 6, c); s.rect(55, 7, 9, 1, mix(c, INK, .4))   # banner flag
    s.rect(58, 3, 3, 3, hx('ffd84a'))
    s.torch(34, 34, hx('ffa030')); s.torch(78, 34, hx('ffa030'))
    s.save('knight')

# BERSERKER: three war camps on fire under a red sky, crossed axes.
def berserker(c):
    s = Pic(); s.sky([hx('2a0e10'), hx('5a1a14'), hx('a03a1a'), hx('e07a30')], 0, 40); s.rect(0, 40, W, 19, hx('2a1a14'))
    for i, (x, w) in enumerate([(4, 28), (43, 28), (82, 28)]):
        top = 24 + i % 2 * 4
        s.poly([(x, 46), (x + w // 2, top), (x + w, 46)], hx('6a4a2a')); s.poly([(x + 3, 46), (x + w // 2, top + 3), (x + w // 2, 46)], hx('4a3020'))
        s.poly([(x + w // 2 - 3, 46), (x + w // 2, 38), (x + w // 2 + 3, 46)], hx('ffb030'))   # lit door
        s.rect(x + w // 2, top - 5, 1, 5, hx('3a2418'))   # tent pole
        for k in range(10):   # fire on the roof, rising
            fx = x + w // 2 - 6 + R.randrange(12); fy = top - 2 + R.randrange(8); s.rect(fx, fy - 3, 2, 3, hx('ffb030') if k % 3 else hx('fff0a0'))
        s.glow(x + w // 2, top + 4, 16, hx('ff8030'), 0.7)
    for _ in range(40): s.p(R.randrange(W), R.randrange(24), hx('ffc070'))   # embers
    for d in (1, -1):   # crossed axes in front
        cx = 56; s.line(cx - 11 * d, 58, cx + 9 * d, 38, hx('8a6040')); s.line(cx - 11 * d + 1, 58, cx + 9 * d + 1, 38, hx('5a3a24'))
        s.poly([(cx + 7 * d, 33), (cx + 15 * d, 30), (cx + 17 * d, 40), (cx + 9 * d, 44)], hx('c8ccd8')); s.line(cx + 15 * d, 30, cx + 17 * d, 40, (255, 255, 255))
        s.line(cx + 8 * d, 35, cx + 10 * d, 42, hx('7a7e8a'))
    s.save('berserker')

# ROGUE: rooftops at night under a moon, the lord's lit window, a falling gold coin.
def rogue(c):
    s = Pic(); s.sky([hx('120c22'), hx('24183c'), mix(c, INK, .55)]); stars(s, 40, 40)
    s.disc(86, 14, 8, hx('e8e0c8')); s.disc(83, 12, 7, hx('24183c'))   # crescent
    s.rect(52, 18, 30, 41, hx('1a1424')); s.poly([(48, 19), (67, 6), (86, 19)], hx('2a2038'))   # manor
    for x, y in [(57, 24), (70, 24), (57, 36)]: s.rect(x, y, 6, 7, hx('2a2234'))
    s.rect(70, 36, 6, 7, hx('ffd060')); s.glow(73, 40, 10, hx('ffb040'))
    s.poly([(0, 59), (0, 38), (18, 30), (40, 38), (40, 59)], hx('0e0a16'))   # rooftop in front
    s.rect(28, 26, 4, 10, hx('0e0a16'))   # chimney
    s.poly([(16, 32), (19, 26), (22, 32)], c); s.rect(17, 30, 5, 4, mix(c, INK, .5)); s.p(18, 29, (255, 255, 255)); s.p(20, 29, (255, 255, 255))   # hooded eyes
    for i in range(4): s.p(98 - i * 2, 30 + i * 4, hx('ffd84a') if i == 0 else hx('8a7020'))   # coin trail
    s.disc(98, 28, 2, hx('ffd84a'), hx('c89a20'))
    s.save('rogue')

# ARCHER: the forest around the tower at sunset, an arrow in flight.
def archer(c):
    s = Pic(); s.sky([hx('2a1a3a'), hx('7a3a4a'), hx('e08a50'), hx('f0c070')], 0, 42)
    s.disc(56, 38, 9, hx('ffe0a0'))
    s.rect(53, 10, 8, 34, hx('3a2a3a')); s.poly([(51, 11), (57, 2), (63, 11)], hx('4a2a3a')); s.rect(56, 16, 2, 3, hx('ffd060'))   # tower
    for layer, (col, base, hgt) in enumerate([(hx('2a3a2a'), 46, 16), (mix(c, INK, .5), 52, 18), (mix(c, INK, .72), 60, 20)]):
        x = -4 + layer * 3
        while x < W + 4:   # pines
            h = hgt - R.randrange(6); s.poly([(x - 5, base), (x, base - h), (x + 5, base)], col); x += 7 + R.randrange(4)
    s.line(8, 22, 34, 16, hx('d8c8a0')); s.poly([(34, 14), (37, 15), (34, 18)], hx('c0c4cc')); s.rect(7, 21, 2, 3, c)   # arrow
    s.save('archer')

# SAMURAI: a huge red sun, the old master's grave stone with a sword planted, blowing petals.
def samurai(c):
    s = Pic(); s.sky([hx('f0e0c0'), hx('e8c8a0'), hx('c8a080')], 0, 44); s.disc(56, 30, 20, c)
    for y in range(26, 36, 3): s.rect(30, y, 52, 1, hx('e8c8a0'))   # sun cut by mist lines
    s.rect(0, 44, W, 15, hx('3a2a24')); s.poly([(0, 46), (30, 40), (60, 45), (90, 39), (113, 44), (113, 59), (0, 59)], hx('2a1e1a'))
    s.rect(48, 34, 14, 14, hx('5a5450')); s.rect(46, 32, 18, 3, hx('6a6460')); s.rect(51, 37, 2, 7, hx('3a3430')); s.rect(56, 37, 2, 7, hx('3a3430'))   # grave
    s.line(72, 26, 72, 46, hx('c8ccd8')); s.rect(70, 32, 5, 1, hx('ffd84a')); s.rect(71, 26, 3, 6, hx('2a1a1a'))   # planted katana
    for _ in range(26): s.p(R.randrange(W), R.randrange(44), hx('f08aa0') if R.random() < .7 else (255, 255, 255))
    s.save('samurai')

# MAGE: the academy library burning: shelves, flames, an ice shard and a bolt.
def mage(c):
    s = Pic(); s.rect(0, 0, W, H, hx('1c1424'))
    for sx in (2, 80):
        s.rect(sx, 6, 31, 53, hx('3a2418'))
        for y in range(9, 56, 9):
            s.rect(sx + 2, y + 6, 27, 2, hx('5a3a24'))
            for bx in range(sx + 3, sx + 29, 2): s.rect(bx, y + 6 - (2 + R.randrange(4)), 1 + (R.random() < .3), 2 + R.randrange(4), R.choice([hx('8a2a2a'), hx('2a4a8a'), hx('6a5a2a'), hx('3a6a3a')]))
    s.poly([(36, 59), (36, 20), (56, 6), (76, 20), (76, 59)], hx('140e1c')); s.rect(52, 22, 8, 12, mix(c, INK, .3))   # window
    for k in range(70):   # fire climbing the shelves
        x = R.choice([R.randrange(2, 33), R.randrange(80, 111)]); y = 30 + R.randrange(29); s.rect(x, y - R.randrange(4), 2, 3, R.choice([hx('ff6020'), hx('ffb030'), hx('fff0a0')]))
    s.glow(18, 40, 22, hx('ff7030'), .9); s.glow(96, 40, 22, hx('ff7030'), .9)
    s.poly([(52, 50), (56, 36), (60, 50)], hx('a8e0ff')); s.line(56, 38, 56, 48, (255, 255, 255))   # ice shard
    for a, b in [((62, 8), (58, 18)), ((58, 18), (63, 20)), ((63, 20), (57, 32))]: s.line(*a, *b, hx('fff8a0'))   # bolt
    s.glow(56, 44, 12, c, .7)
    s.save('mage')

# CLERIC: the chapel of the dawn: a stained window, light rays falling into the dark.
def cleric(c):
    s = Pic(); s.rect(0, 0, W, H, hx('14121c'))
    for x in range(0, W, 9): s.rect(x, 0, 8, H, hx('1c1a24'))
    s.poly([(42, 44), (42, 16), (48, 8), (56, 5), (64, 8), (70, 16), (70, 44)], hx('2a2234'))
    s.poly([(44, 42), (44, 17), (49, 10), (56, 7), (63, 10), (68, 17), (68, 42)], hx('ffe8a0'))
    for x0, x1, col in [(44, 50, hx('e8c050')), (50, 56, hx('f8f0d0')), (56, 62, hx('e8c050')), (62, 68, hx('f0a050'))]: s.rect(x0, 18, x1 - x0, 24, col)
    s.rect(55, 9, 2, 33, hx('2a2234')); s.rect(44, 26, 24, 2, hx('2a2234'))   # cross in the lead
    for i in range(-3, 4):   # rays
        for t in range(40):
            x = 56 + i * 3 + i * t * 0.55; y = 42 + t * 0.5
            if (t + i) % 3: s.p(round(x), round(y), mix(hx('14121c'), c, 0.55))
    s.glow(56, 52, 26, c, .8); s.rect(40, 54, 32, 5, hx('3a3240'))   # altar step
    s.save('cleric')

# NECROMAGE: the crypt: candles, a glowing skull on a book, bones that listen.
def necromancer(c):
    s = Pic(); s.rect(0, 0, W, H, hx('0e1416'))
    for x in range(-6, W, 24):   # crypt vaults: round arches on pillars
        s.disc(x + 12, 20, 12, hx('1a2422')); s.rect(x, 20, 24, 39, hx('1a2422')); s.disc(x + 12, 20, 9, hx('0a1010')); s.rect(x + 3, 20, 18, 39, hx('0a1010'))
    s.rect(38, 44, 37, 15, hx('2a2a30')); s.rect(36, 42, 41, 3, hx('3a3a44'))   # tomb
    s.rect(46, 38, 21, 4, hx('4a2a3a')); s.rect(56, 38, 1, 4, hx('2a1a24'))   # open book
    s.disc(56, 31, 5, hx('d8e0d0')); s.rect(53, 35, 7, 3, hx('d8e0d0')); s.rect(54, 30, 2, 2, c); s.rect(58, 30, 2, 2, c); s.p(56, 33, hx('2a2a30'))   # skull
    s.glow(56, 31, 20, c, 1.0)
    for x in (30, 82, 18, 94):   # candles
        h = 4 + (x % 3); s.rect(x, 48 - h, 2, h, hx('e8e0c8')); s.p(x, 47 - h, hx('ffd060')); s.glow(x, 46 - h, 8, hx('ffc060'), .6)
    for (x, y) in [(8, 55), (100, 54), (24, 56)]: s.line(x, y, x + 6, y - 2, hx('c8c8b8')); s.disc(x + 7, y - 2, 1, hx('c8c8b8'))
    for _ in range(16): s.p(46 + R.randrange(21), 14 + R.randrange(14), c)   # soul wisps
    s.save('necromancer')

# WARDEN: the deepest cells, broken bars, the big key ring, chains.
def bard(c):
    s = Pic(); s.rect(0, 0, W, H, hx('16151c'))
    for x in range(0, W, 8):
        for y in range(0, H, 5): s.rect(x + (4 if (y // 5) % 2 else 0), y, 7, 4, hx('22212a'))
    for cx in (8, 78):   # two cells
        s.rect(cx, 12, 27, 40, INK); s.rect(cx - 2, 10, 31, 3, hx('5a5c68')); s.rect(cx - 2, 50, 31, 3, hx('5a5c68'))
        for x in range(cx + 2, cx + 26, 4): s.rect(x, 13, 2, 37, hx('8a8c98') if x != cx + 14 or cx == 8 else INK)
    for y in range(18, 30): s.p(91 + (y - 18) // 3, y, hx('8a8c98'))   # bent bar of the escaped cell
    for k in range(9): s.rect(56 + (k % 2), 2 + k * 3, 2, 2, hx('6a6c78'))   # chain from the ceiling
    s.disc(57, 36, 7, hx('16151c'), c); s.disc(57, 36, 6, hx('16151c'), mix(c, (255, 255, 255), .3))   # key ring
    for i, a in enumerate([2.3, 1.6, 0.9]):
        x0 = 57 + math.cos(a) * 6; y0 = 36 + math.sin(a) * 6; x1 = 57 + math.cos(a) * 15; y1 = 36 + math.sin(a) * 15
        s.line(round(x0), round(y0), round(x1), round(y1), hx('d8b040')); s.rect(round(x1) - 1, round(y1) - 1, 3, 2, hx('d8b040'))
    s.torch(44, 22, hx('ffa030')); s.rect(0, 53, W, 6, hx('0e0d12'))
    s.save('bard')

# ALCHEMIST: the lab shelf, bubbling bottles, one going off.
def alchemist(c):
    s = Pic(); s.rect(0, 0, W, H, hx('1a1614'))
    for y in (22, 42): s.rect(0, y, W, 3, hx('5a3a24')); s.rect(0, y + 3, W, 1, hx('2a1a12'))
    cols = [c, hx('d03a3a'), hx('3a6ae0'), hx('e8c050'), hx('9a5ad8'), hx('3ab8a0')]
    for row, base in enumerate((22, 42)):
        x = 4
        while x < W - 6:
            if row == 1 and 46 < x < 68: x += 4; continue
            col = R.choice(cols); h = 6 + R.randrange(7); w = 4 + R.randrange(3)
            s.rect(x, base - h, w, h, hx('c8d8d8')); s.rect(x + 1, base - h + 3, w - 2, h - 4, col); s.rect(x + w // 2 - 1, base - h - 2, 2, 2, hx('8a6a4a'))
            x += w + 3
    s.disc(57, 34, 9, hx('fff0a0')); s.disc(57, 34, 6, (255, 255, 255))   # the bang
    for k in range(14):
        a = k / 14 * math.tau; s.line(round(57 + math.cos(a) * 10), round(34 + math.sin(a) * 9), round(57 + math.cos(a) * 17), round(34 + math.sin(a) * 15), c if k % 2 else hx('ffb030'))
    s.glow(57, 34, 30, c, .9)
    for _ in range(12): s.rect(R.randrange(W), 46 + R.randrange(12), 2, 1, mix(c, INK, .3))   # spills
    s.save('alchemist')

for fn in [knight, berserker, rogue, archer, samurai, mage, cleric, necromancer, bard, alchemist]:
    fn(heroes[fn.__name__])
print('10 banners ->', OUT)
