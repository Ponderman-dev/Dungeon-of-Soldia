# Rebuild: pip install fonttools brotli; python3 scripts/art/make-small-font.py src/assets/fonts/press-start-2p.woff2 src/assets/fonts/soldia-small.woff2
# Soldia Small: Press Start 2P's own pixels, proportional (each glyph trimmed to its ink + 1px gap; space 4px).
import sys
from fontTools.ttLib import TTFont
src, out = sys.argv[1], sys.argv[2]
PX = 125
f = TTFont(src); f.flavor = None
g = f['glyf']; hm = f['hmtx']
for t in ('fpgm', 'prep', 'cvt '):
    if t in f: del f[t]
for n in f.getGlyphOrder():
    gl = g[n]
    if hasattr(gl, 'program'):
        from fontTools.ttLib.tables import ttProgram
        gl.program = ttProgram.Program(); gl.program.fromBytecode(b'')
    if gl.isComposite():
        continue
    if gl.numberOfContours == 0:
        if hm[n][0] > 0: hm[n] = (4 * PX, 0)
        continue
    gl.recalcBounds(g)
    dx = -gl.xMin
    gl.coordinates.translate((dx, 0))
    gl.recalcBounds(g)
    hm[n] = (gl.xMax + PX, 0)
hh = f['hhea']; hh.advanceWidthMax = max(a for a, _ in hm.metrics.values())
f['OS/2'].panose.bProportion = 0
nm = f['name']
for r in nm.names:
    s = r.toUnicode()
    s = s.replace('Press Start 2P', 'Soldia Small').replace('PressStart2P', 'SoldiaSmall')
    r.string = s
nm.setName('Soldia Small: a proportional version of Press Start 2P (spacing changed for Dungeon of Soldia). SIL OFL 1.1.', 10, 3, 1, 0x409)
f.flavor = 'woff2'; f.save(out)
print('ok', out)
