# tiny pixel canvas: draw colour regions, auto outline, export rows / preview
from PIL import Image
PAL = {
 '0':0x1a1020,'1':0x2f5a1c,'2':0x4f8f30,'3':0x74b84a,'4':0xff3a2a,'5':0xefe6cf,'6':0xd0d4dc,'7':0x8a90a0,
 '8':0x4c5160,'9':0x4a2e18,'a':0x7a5530,'b':0xa89270,'c':0x5e4c38,'d':0xd9b44a,'e':0x8a2a24,'f':0x2a1010,
 'g':0xb8ac90,'h':0xc04030,
}
class C:
    def __init__(s,w,h): s.w,s.h=w,h; s.g=[['.']*w for _ in range(h)]
    def p(s,x,y,c):
        if 0<=x<s.w and 0<=y<s.h: s.g[y][x]=c
    def rect(s,x0,y0,x1,y1,c):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): s.p(x,y,c)
    def ell(s,cx,cy,rx,ry,c):
        for y in range(s.h):
            for x in range(s.w):
                if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1: s.p(x,y,c)
    def line(s,x0,y0,x1,y1,c):
        n=max(abs(x1-x0),abs(y1-y0)) or 1
        for i in range(n+1): s.p(round(x0+(x1-x0)*i/n),round(y0+(y1-y0)*i/n),c)
    def mirror(s):  # copy left half onto right half
        for y in range(s.h):
            for x in range(s.w//2): s.g[y][s.w-1-x]=s.g[y][x]
    def recolor(s,frm,to,cond=lambda x,y:True):
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x]==frm and cond(x,y): s.g[y][x]=to
    def shade(s,base,light,dark):
        # light on top-left edges of a region, dark on bottom-right edges
        g=[r[:] for r in s.g]
        for y in range(s.h):
            for x in range(s.w):
                if g[y][x]!=base: continue
                up = y==0 or g[y-1][x]!=base; lf = x==0 or g[y][x-1]!=base
                dn = y==s.h-1 or g[y+1][x]!=base; rt = x==s.w-1 or g[y][x+1]!=base
                if dn or rt: s.g[y][x]=dark
                elif up or lf: s.g[y][x]=light
    def outline(s):
        g=[r[:] for r in s.g]
        for y in range(s.h):
            for x in range(s.w):
                if g[y][x]!='.': continue
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if 0<=X<s.w and 0<=Y<s.h and g[Y][X] not in '.0': s.g[y][x]='0'; break
    def rows(s): return [''.join(r) for r in s.g]
def export(rows):
    used=sorted(set(''.join(rows))-{'.'}, key=lambda c:int(c,36))
    m={c:format(i,'x') if i<16 else chr(ord('g')+i-16) for i,c in enumerate(used)}
    return {'palette':['0x%06x'%PAL[c] for c in used],'rows':[''.join(m.get(ch,'.') for ch in r) for r in rows]}
def preview(layers,path,scale=8):
    W=max(l[1]+len(l[0][0]) for l in layers); H=max(l[2]+len(l[0]) for l in layers)
    im=Image.new('RGB',(W,H),(40,40,48))
    for rows,ox,oy in layers:
        for y,r in enumerate(rows):
            for x,ch in enumerate(r):
                if ch!='.': v=PAL[ch]; im.putpixel((ox+x,oy+y),(v>>16,(v>>8)&255,v&255))
    im.resize((W*scale,H*scale),Image.NEAREST).save(path)
