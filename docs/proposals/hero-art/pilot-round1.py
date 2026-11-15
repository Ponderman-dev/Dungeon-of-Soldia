# ART PILOT: the same 6 characters in 3 directions, one shared palette. Output: one PNG.
import sys
from PIL import Image, ImageDraw, ImageFont
PAL = {'k':0x1a1020,'e':0x1a1020,'s':0xb8c0cc,'S':0x7c8496,'b':0x3f6fd0,'B':0x2b4a96,'y':0xf2c544,'Y':0xb8862c,
 'f':0xf0c8a0,'F':0xc8946c,'n':0x8a5a30,'N':0x5c3a20,'g':0x7fb23c,'G':0x4f7a28,'w':0xeee8d8,'W':0xb8b09c,
 'r':0xd04438,'R':0x8e2a28,'h':0xffffff,'o':0xf08a2c,'O':0xb85a1c,'t':0x9a7a50,'T':0x6e5434}
SHADOW = {'s':'S','b':'B','y':'Y','f':'F','n':'N','g':'G','w':'W','r':'R','o':'O','t':'T'}
def grid(txt):
    rows=[r for r in txt.strip('\n').split('\n')]; w=max(len(r) for r in rows)
    return [list(r.ljust(w,'.')) for r in rows]
def blank(w,h): return [['.']*w for _ in range(h)]
def paste(dst,src,ox,oy):
    for y,r in enumerate(src):
        for x,c in enumerate(r):
            if c!='.' and 0<=oy+y<len(dst) and 0<=ox+x<len(dst[0]): dst[oy+y][ox+x]=c
def rect(g,x0,y0,x1,y1,c):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            if 0<=y<len(g) and 0<=x<len(g[0]): g[y][x]=c
def ell(g,cx,cy,rx,ry,c):
    for y in range(len(g)):
        for x in range(len(g[0])):
            if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1: g[y][x]=c
def shade(g):
    # ONE shadow tone, light from the top left: the right / bottom rim of the whole shape goes one tone darker
    h=len(g); w=len(g[0]); o=[r[:] for r in g]
    E=lambda x,y: not(0<=x<w and 0<=y<h) or o[y][x]=='.'
    for y in range(h):
        for x in range(w):
            c=o[y][x]
            if c in SHADOW and (E(x+1,y) or E(x,y+1)) and x>0 and o[y][x-1] not in '.' and not E(x,y-1): g[y][x]=SHADOW[c]
    return g
def pad(g,n=1):
    w=len(g[0]); return [['.']*(w+2*n) for _ in range(n)]+[['.']*n+r+['.']*n for r in g]+[['.']*(w+2*n) for _ in range(n)]
def outline(g,mode):
    # mode 'black' = one dark line round the shape; 'self' = a darker version of the colour next to it
    g=pad(g); h=len(g); w=len(g[0]); o=[r[:] for r in g]; cols={}
    for y in range(h):
        for x in range(w):
            if o[y][x]!='.': continue
            for dx,dy in ((0,1),(1,0),(-1,0),(0,-1)):
                X,Y=x+dx,y+dy
                if 0<=X<w and 0<=Y<h and o[Y][X]!='.':
                    g[y][x]='k' if mode=='black' else ('#',o[Y][X]); break
    return g
def rgb(c):
    if isinstance(c,tuple): v=PAL[c[1]]; return tuple(int(((v>>s)&255)*0.42) for s in (16,8,0))
    v=PAL[c]; return ((v>>16)&255,(v>>8)&255,v&255)

# ---------------- direction A: BIG HEADS (storybook), dark outline ----------------
A={}
A['Knight']=grid('''
.....rr.......
...ssssss.....
..ssssssss....
.ssssssssss...
.seeeeeeees...
.ssseesssss.s.
.ssseesssss.s.
..ssssssss..s.
...bbbbbb...s.
..sbbyybbs..s.
..sbbyybbsfyyy
..fbbbbbb...n.
...bbbbbb.....
...ss..ss.....
...SS..SS.....
''')
A['Mage']=grid('''
......b.......
.....bbb......
....bbbbb.....
...bbbbbbb..o.
.bbyyyyyybb.n.
..ffffffff..n.
..feeffeef..n.
..wwwwwwww..n.
...wwwwww...n.
..bbwwwwbb..n.
..bbbwwbbbf.n.
..bbbbbbbb..n.
..bbbbbbbb..n.
.bbbbbbbbbb.n.
''')
A['Goblin']=grid('''
............nn
g..gggggg..gnn
gg.gggggg.ggnn
.gggggggggg.n.
..geeggeeg..n.
..gggggggg..n.
..gghhhhgg..n.
...gggggg...n.
...nnnnnn.g.n.
..gnnnnnngg...
..gnnnnnn.....
...gg..gg.....
''')
A['Slime']=grid('''
....gggg....
..gggggggg..
.gggggggggg.
.gggggggggg.
ggeeggggeegg
ggeeggggeegg
gggggggggggg
gggggggggggg
''')
A['Skeleton Archer']=grid('''
...wwwwww.....
..wwwwwwww.n..
..weewweew..n.
..weewweew..n.
..wwwwwwww...n
...wewewe....n
.....ww......n
..wwwwwwww...n
..w.wewe.w..n.
..w.wwww.w..n.
.....ww....n..
....wwww......
....w..w......
...ww..ww.....
''')
# ---------------- direction B: CLASSIC ADVENTURER proportions, no outline ----------------
B={}
B['Knight']=grid('''
....rr......
...ssss.....
..ssssss....
..ssssss....
..seeees....
..ssesss....
..ssssss....
...ssss...s.
.ssbbbbss.s.
.sbbbbbbs.s.
.sbbyybbs.s.
.sbbyybbs.s.
.sbbbbbbs.s.
.fbbbbbbfyyy
..bbbbbb..n.
..yyyyyy....
..bbbbbb....
..ss..ss....
..ss..ss....
..ss..ss....
..ss..ss....
..ss..ss....
.sss..sss...
''')
B['Mage']=grid('''
.....b......
....bbb.....
....bbb.....
...bbbbb....
...bbbbb..o.
..bbbbbbb.o.
.byyyyyyyb.n
..ffffff..n.
..feffef..n.
..wwwwww..n.
..wwwwww..n.
.bbwwwwbb.n.
.bbbwwbbb.n.
.bbbwwbbbfn.
.bbbbbbbb.n.
.bbyyyybb.n.
.bbbbbbbb.n.
.bbbbbbbb.n.
.bbbbbbbb.n.
.bbbbbbbb.n.
.bbbbbbbb.n.
bbbbbbbbbbn.
bbbbbbbbbb..
''')
B['Goblin']=grid('''
..........nn
g.gggg.g..nn
gggggggg..nn
.geggeg...n.
.gggggg...n.
..ghhg....n.
.nnnnnn.g.n.
gnnnnnngg...
gnnnnnn.....
.nnnnnn.....
.gg..gg.....
.gg..gg.....
.gg..gg.....
''')
B['Slime']=grid('''
....gg....
...gggg...
..gggggg..
.gggggggg.
.gegggegg.
gggggggggg
gggggggggg
gggggggggg
''')
B['Skeleton Archer']=grid('''
..wwww......
.wwwwww..n..
.wewwew...n.
.wwwwww...n.
..wewe....n.
..wwww.....n
...ww......n
.wwwwww....n
w.wwww.ww..n
w..ww...w.n.
w.wwww....n.
..wwww...n..
..w..w......
..w..w......
..w..w......
..w..w......
.ww..ww.....
''')
# ---------------- direction C: BLOCKY TOY shapes, coloured outline ----------------
C={}
C['Knight']=grid('''
....rrrr.......
..ssssssss.....
..ssssssss.....
..ssssssss.....
..seessees.....
..ssssssss.....
..ssssssss.....
..ssssssss.....
ssbbbbbbbbss.s.
ssbbbyybbbss.s.
ssbbyyyybbss.s.
ssbbbyybbbss.s.
ffbbbbbbbbffyyy
..yyyyyyyy...n.
..bbbbbbbb.....
..sss..sss.....
..sss..sss.....
..sss..sss.....
..sss..sss.....
''')
C['Mage']=grid('''
....bbbb......
....bbbb......
...bbbbbb.....
.bbyyyyyybb.oo
..ffffffff..oo
..feeffeef...n
..ffffffff...n
..wwwwwwww...n
..wwwwwwww...n
bbbbwwwwbbbb.n
bbbbbwwbbbbb.n
bbbbbbbbbbbb.n
ffbbbbbbbbff.n
..bbyyyybb...n
..bbbbbbbb...n
..bbbbbbbb...n
..bbbbbbbb...n
..bbbbbbbb...n
.bbbbbbbbbb..n
''')
C['Goblin']=grid('''
.............nn
gg.gggggg.gg.nn
ggggggggggggnnn
.ggeeggeegg..n.
..gggggggg...n.
..gghhhhgg...n.
ggnnnnnnnngg.n.
ggnnnnnnnnggg..
..nnnnnnnn.....
..ggg..ggg.....
..ggg..ggg.....
''')
C['Slime']=grid('''
.gggggggggg.
gggggggggggg
gggggggggggg
ggeegggggeeg
ggeegggggeeg
gggggggggggg
gggggggggggg
gggggggggggg
''')
C['Skeleton Archer']=grid('''
..wwwwwwww....
..wwwwwwww..n.
..weewweew...n
..weewweew...n
..wwwwwwww...n
..wewewewe...n
ww.wwwwww.ww.n
ww.wewwew.ww.n
ww.wwwwww.w..n
...wewwew...n.
...wwwwww.....
...ww..ww.....
...ww..ww.....
...ww..ww.....
..www..www....
''')
# ---------------- the boss (Grukk, the goblin king) built from the SAME recipe in 3 proportions ----------------
def grukk(hw,hh,bw,bh,lh,round_,horn):
    W=max(hw,bw)+22; H=horn+3+hh+bh+lh+2; g=blank(W,H); cx=W//2
    top=horn+3; by=top+hh; ly=by+bh
    # red cape behind
    rect(g,cx-bw//2-1,by+2,cx+bw//2,ly+lh-2,'r')
    rect(g,cx-bw//2-3,by+bh//2,cx+bw//2+2,ly+lh-2,'r'); rect(g,cx-bw//2-4,ly-1,cx+bw//2+3,ly+lh-2,'r')
    # legs + boots
    lw=max(3,bw//4)
    rect(g,cx-bw//2+2,ly,cx-bw//2+1+lw,ly+lh-1,'g'); rect(g,cx+bw//2-1-lw,ly,cx+bw//2-2,ly+lh-1,'g')
    rect(g,cx-bw//2+1,ly+lh-2,cx-bw//2+2+lw,ly+lh-1,'N'); rect(g,cx+bw//2-2-lw,ly+lh-2,cx+bw//2-1,ly+lh-1,'N')
    # body
    if round_: ell(g,cx-0.5,by+bh/2-0.5,bw/2,bh/2+1,'g')
    else: rect(g,cx-bw//2,by,cx+bw//2-1,ly-1,'g')
    # belt + skull buckle, loincloth
    rect(g,cx-bw//2+1,ly-max(3,bh//4),cx+bw//2-2,ly-1,'n'); rect(g,cx-2,ly-max(3,bh//4)-1,cx+1,ly-2,'w'); g[ly-max(3,bh//4)][cx-1]='e'; g[ly-max(3,bh//4)][cx]='e'
    # arms
    aw=max(3,bw//6); ah=max(5,bh*2//3)
    rect(g,cx-bw//2-aw,by+2,cx-bw//2-1,by+1+ah,'g'); rect(g,cx+bw//2,by+2,cx+bw//2+aw-1,by+1+ah,'g')
    rect(g,cx-bw//2,by+2,cx-bw//2,by+1+ah,'G'); rect(g,cx+bw//2-1,by+2,cx+bw//2-1,by+1+ah,'G')
    rect(g,cx-bw//2-aw,by+ah,cx-bw//2-1,by+1+ah,'f' if False else 'G'); rect(g,cx+bw//2,by+ah,cx+bw//2+aw-1,by+1+ah,'G')
    # fur mantle over the shoulders
    mh=max(1,bh//7)
    rect(g,cx-bw//2-aw+1,by-1,cx+bw//2+aw-2,by-1,'t'); rect(g,cx-bw//2-aw,by,cx+bw//2+aw-1,by+mh,'t')
    for x in range(cx-bw//2-aw,cx+bw//2+aw,2): g[by+mh+1][x]='t'
    # head: green face, skull helm on top, red eyes, tusks
    if round_: ell(g,cx-0.5,top+hh/2,hw/2,hh/2+0.5,'g')
    else: rect(g,cx-hw//2,top,cx+hw//2-1,by-1,'g')
    hel=max(3,hh*2//5)
    for y in range(top,top+hel):
        for x in range(W):
            if g[y][x]=='g': g[y][x]='w'
    ey=top+hel+1; ex=max(2,hw//4)
    rect(g,cx-ex-1,ey,cx-ex,ey+(1 if hh>10 else 0),'r'); rect(g,cx+ex-1,ey,cx+ex,ey+(1 if hh>10 else 0),'r')
    rect(g,cx-ex-1,top+hel-2,cx-ex,top+hel-2,'e'); rect(g,cx+ex-1,top+hel-2,cx+ex,top+hel-2,'e')
    ty=by-3 if hh>10 else by-2
    g[ty][cx-ex-1]='w'; g[ty-1][cx-ex-1]='w'; g[ty][cx+ex]='w'; g[ty-1][cx+ex]='w'
    rect(g,cx-ex+1,ty+1 if ty+1<by else ty,cx+ex-2,ty+1 if ty+1<by else ty,'G')
    # gold crown
    rect(g,cx-hw//4,top-2,cx+hw//4-1,top-1,'y')
    for x in range(cx-hw//4,cx+hw//4,2): g[top-3][x]='y'
    # horns
    for i in range(horn+2):
        for t in range(2):
            xl=cx-hw//2-1-i//1+t; xr=cx+hw//2+i-t; y=top+hel-1-i
            if i>horn-2: xl+=i-(horn-2); xr-=i-(horn-2)
            if 0<=y<H and 0<=xl<W: g[y][xl]='w'
            if 0<=y<H and 0<=xr<W: g[y][xr]='w'
    # cleaver in the right hand
    hx=cx+bw//2+aw; hy=by+1+ah
    rect(g,hx,hy-ah-3,hx,hy,'n'); rect(g,hx+1,hy-ah-4,hx+5,hy-ah+3,'s'); rect(g,hx+1,hy-ah+4,hx+3,hy-ah+4,'s')
    return g
A['Grukk (boss)']=grukk(20,15,20,10,3,True,6)
B['Grukk (boss)']=grukk(12,10,24,18,8,True,5)
C['Grukk (boss)']=grukk(16,12,22,13,5,False,5)

DIRS=[('A  BIG HEADS','storybook shapes: big head, small body  |  DARK OUTLINE  |  flat colour + one shadow',A,'black'),
      ('B  CLASSIC','adventurer shapes: small head, long body (closest to today)  |  NO OUTLINE  |  flat colour + one shadow',B,None),
      ('C  BLOCKY','toy-block shapes: square heads, straight bodies  |  COLOURED OUTLINE (a darker shade of each colour)  |  flat colour + one shadow',C,'self')]
ORDER=['Knight','Mage','Goblin','Slime','Skeleton Archer','Grukk (boss)']
def finish(g,mode):
    g=shade([r[:] for r in g]); return outline(g,mode) if mode else g
def draw(im,g,cx,feet,z):
    h=len(g); w=len(g[0]); px=im.load()
    for y,r in enumerate(g):
        for x,c in enumerate(r):
            if c=='.': continue
            col=rgb(c); X0=cx-(w*z)//2+x*z; Y0=feet-h*z+y*z
            for a in range(z):
                for b in range(z):
                    if 0<=X0+a<im.width and 0<=Y0+b<im.height: px[X0+a,Y0+b]=col
def main(out):
    Z=5; COLW=[150,150,150,130,160,330]; W=sum(COLW)+40; ROWH=330
    im=Image.new('RGB',(W,ROWH*3+40),(24,22,30)); d=ImageDraw.Draw(im)
    try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20); f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
    except Exception: f=f2=ImageFont.load_default()
    for i,(title,desc,S,mode) in enumerate(DIRS):
        y0=20+i*ROWH
        d.rectangle([10,y0,W-10,y0+ROWH-14],fill=(46,42,52))           # the dungeon floor colour (dark stone)
        d.rectangle([10,y0+ROWH-64,W-10,y0+ROWH-14],fill=(38,35,44))
        d.text((22,y0+8),title,fill=(255,231,168),font=f); d.text((22,y0+34),desc,fill=(200,198,212),font=f2)
        x=20
        for name,cw in zip(ORDER,COLW):
            g=finish(S[name],mode); feet=y0+ROWH-70
            draw(im,g,x+cw//2,feet,Z)
            d.text((x+cw//2,feet+10),name,fill=(170,168,184),font=f2,anchor='ma')
            x+=cw
        # the same row at the game's real size (3x), bottom right
        x=W-330
    im.save(out)
    # second picture: all three at the real in-game size (3 screen pixels per art pixel), side by side on the floor colour
    im2=Image.new('RGB',(390*2,3*150+20),(46,42,52)); d2=ImageDraw.Draw(im2)
    for i,(title,desc,S,mode) in enumerate(DIRS):
        y0=10+i*150; x=70; d2.text((8,y0+4),title.split()[0],fill=(255,231,168),font=f)
        for name in ORDER:
            g=finish(S[name],mode); draw(im2,g,x+ (60 if name.startswith('Grukk') else 0),y0+135,3); x+=92 if not name.startswith('Skel') else 110
    im2.save(out.replace('.png','-phone-size.png'))
main(sys.argv[1])
