# LOOK TRIAL (session 49): SOLDIA THIN = Soldia Small with 1px strokes (the reference picture's thin font).
# Rebuild: pip install fonttools brotli; python3 scripts/art/make-thin-font.py src/assets/fonts/soldia-small.woff2 src/assets/fonts/soldia-thin.woff2
# How: each glyph is read as pixels (8px grid, 125 units a pixel), every 2px-wide upright stroke keeps its OUTER pixel,
# the slanted letters that break are drawn by hand (HAND), then one repeated middle column is dropped (narrower), and
# the pixels are written back as squares. Print a glyph: python3 make-thin-font.py <src> --show "Kmw".
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.pointInsidePen import PointInsidePen
from fontTools.pens.ttGlyphPen import TTGlyphPen
PX = 125
TOP = 7  # bitmap row 0 = pixel row y 7 (cap top); 9 rows down to y -1

# Hand-drawn letters: rows from y 7 down (cap rows first, then descender rows), '#' = ink.
HAND = {
  'K': ['#....#.', '#...#..', '#..#...', '###....', '#..#...', '#...#..', '#....#.'],
  'M': ['#.....#', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#.....#', '#.....#'],
  'N': ['#.....#', '##....#', '#.#...#', '#..#..#', '#...#.#', '#....##', '#.....#'],
  'Q': ['.#####.', '#.....#', '#.....#', '#.....#', '#...#.#', '#....#.', '.####.#'],
  'R': ['######.', '#.....#', '#.....#', '######.', '#...#..', '#....#.', '#.....#'],
  'W': ['#.....#', '#.....#', '#.....#', '#..#..#', '#.#.#.#', '##...##', '#.....#'],
  'X': ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  'Y': ['#.....#', '.#...#.', '..#.#..', '...#...', '...#...', '...#...', '...#...'],
  'Z': ['#######', '.....#.', '....#..', '...#...', '..#....', '.#.....', '#######'],
  'k': ['#......', '#......', '#...#..', '#..#...', '###....', '#..#...', '#...#..'],
  'm': ['.......', '.......', '######.', '#..#..#', '#..#..#', '#..#..#', '#..#..#'],
  'w': ['.......', '.......', '#.....#', '#.....#', '#..#..#', '#.#.#.#', '.#...#.'],
  'r': ['.......', '.......', '#.###..', '##.....', '#......', '#......', '#......'],
  'x': ['.......', '.......', '#.....#', '.#...#.', '...#...', '.#...#.', '#.....#'],
  'z': ['.......', '.......', '#######', '....#..', '...#...', '..#....', '#######'],
  '2': ['.#####.', '#.....#', '.....#.', '...##..', '..#....', '.#.....', '#######'],
  '4': ['....#..', '...##..', '..#.#..', '.#..#..', '#######', '....#..', '....#..'],
  '7': ['#######', '#.....#', '.....#.', '....#..', '...#...', '...#...', '...#...'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.####.', '#....#', '.....#', '...##.', '..#...', '......', '..#...'],
  '8': ['.#####.', '#.....#', '#.....#', '.#####.', '#.....#', '#.....#', '.#####.'],
}

def bitmap(f, name):
    gs = f.getGlyphSet(); g = gs[name]; W = f['hmtx'][name][0] // PX
    rows = []
    for y in range(TOP, -2, -1):
        r = []
        for x in range(W):
            p = PointInsidePen(gs, ((x + 0.5) * PX, (y + 0.5) * PX)); g.draw(p); r.append(1 if p.getResult() else 0)
        rows.append(r)
    return rows

def thin(rows):
    W = len(rows[0]); cols = [x for r in rows for x, v in enumerate(r) if v]
    if not cols: return rows
    mid = (min(cols) + max(cols)) / 2
    out = []
    for r in rows:
        o = r[:]; x = 0
        while x < W:
            if r[x]:
                e = x
                while e < W and r[e]: e += 1
                if e - x == 2: o[x] = 0 if (x + e - 1) / 2 > mid else o[x]; o[x + 1] = 0 if (x + e - 1) / 2 <= mid else o[x + 1]
                x = e
            else: x += 1
        out.append(o)
    return out

def trim(rows):  # cut empty columns on both sides
    cols = [x for r in rows for x, v in enumerate(r) if v]
    if not cols: return rows
    a, b = min(cols), max(cols)
    return [r[a:b + 1] for r in rows]

def narrow(rows):  # drop one middle column that repeats its left neighbour in every row (6+ wide glyphs only)
    W = len(rows[0])
    if W < 6: return rows
    for c in sorted(range(2, W - 2), key=lambda c: abs(c - (W - 1) / 2)):
        if all(r[c] == r[c - 1] for r in rows):
            return [r[:c] + r[c + 1:] for r in rows]
    return rows

def glyph_rows(f, ch, name):
    if ch in HAND:
        rows = [[1 if c == '#' else 0 for c in s] for s in HAND[ch]]
        rows += [[0] * len(rows[0])] * (TOP + 2 - len(rows))
        return trim(rows) if ch in "mMwW" else narrow(trim(rows))  # three strokes: no narrowing (it lopsides them)
    return narrow(trim(thin(bitmap(f, name))))

def show(rows):
    return [''.join('#' if v else '.' for v in r) for r in rows]

def build(src, out):
    f = TTFont(src); f.flavor = None
    cmap = f.getBestCmap(); g = f['glyf']; hm = f['hmtx']
    for code, name in cmap.items():
        gl = g[name]
        if gl.isComposite() or gl.numberOfContours == 0: continue
        rows = glyph_rows(f, chr(code), name)
        pen = TTGlyphPen(None)
        for i, r in enumerate(rows):
            y = TOP - i; x = 0
            while x < len(r):
                if r[x]:
                    e = x
                    while e < len(r) and r[e]: e += 1
                    pen.moveTo((x * PX, y * PX)); pen.lineTo((x * PX, (y + 1) * PX))
                    pen.lineTo((e * PX, (y + 1) * PX)); pen.lineTo((e * PX, y * PX)); pen.closePath()
                    x = e
                else: x += 1
        new = pen.glyph(); new.recalcBounds(g); g[name] = new
        hm[name] = ((len(rows[0]) + 1) * PX, 0)
    f['hhea'].advanceWidthMax = max(a for a, _ in hm.metrics.values())
    for r in f['name'].names:
        r.string = r.toUnicode().replace('Soldia Small', 'Soldia Thin').replace('SoldiaSmall', 'SoldiaThin')
    f.flavor = 'woff2'; f.save(out)
    print('ok', out)

if __name__ == '__main__':
    if sys.argv[2] == '--show':
        f = TTFont(sys.argv[1]); cmap = f.getBestCmap()
        bms = [show(glyph_rows(f, c, cmap[ord(c)])) for c in sys.argv[3]]
        for y in range(TOP + 2): print('  '.join(b[y] for b in bms))
    else:
        build(sys.argv[1], sys.argv[2])
