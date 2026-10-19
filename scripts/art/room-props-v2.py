# Room props at the floor's pixel size (3), drawn by code: treasure chest, Mimic (the same chest, bigger, with teeth),
# fountain, Skill Dealer, puzzle tablet. Prints the part art as JSON (palette + rows) to paste into roomProps.json /
# enemies.json (mimic). Run: python3 scripts/art/room-props-v2.py out.json  (user approved the look 2026-10-19)
import json, math, random
CH='0123456789abcdefghijklmnopqrstuvwxyz'
class G:
    def __init__(s,w,h): s.w,s.h=w,h; s.px={}
    def p(s,x,y,c):
        x,y=int(x),int(y)
        if 0<=x<s.w and 0<=y<s.h: s.px[(x,y)]=c
    def rect(s,x,y,w,h,c):
        for i in range(int(w)):
            for j in range(int(h)): s.p(x+i,y+j,c)
    def ell(s,cx,cy,rx,ry,c):
        for x in range(int(cx-rx-1),int(cx+rx+2)):
            for y in range(int(cy-ry-1),int(cy+ry+2)):
                if ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1: s.p(x,y,c)
    def line(s,x1,y1,x2,y2,c):
        n=int(max(abs(x2-x1),abs(y2-y1)))+1
        for i in range(n+1): s.p(round(x1+(x2-x1)*i/n),round(y1+(y2-y1)*i/n),c)
    def padded(s,c):
        n=G(s.w+2,s.h+2)
        for (x,y),v in s.px.items(): n.px[(x+1,y+1)]=v
        n.outline(c); return n
    def outline(s,c):
        add=[]
        for (x,y) in list(s.px):
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                q=(x+dx,y+dy)
                if q not in s.px and 0<=q[0]<s.w and 0<=q[1]<s.h: add.append(q)
        for q in add: s.px[q]=c
    def art(s):
        pal=[]; rows=[]
        for y in range(s.h):
            r=''
            for x in range(s.w):
                c=s.px.get((x,y))
                if c is None: r+='.'; continue
                if c not in pal: pal.append(c)
                r+=CH[pal.index(c)]
            rows.append(r)
        return {'palette':['0x%06x'%c for c in pal],'rows':rows}
OUT=0x1a1020
# --- chest / mimic: same drawing at two sizes
WOOD=0x7a4e2a; WOODD=0x5a361c; WOODL=0x96643a; GOLD=0xe0b048; GOLDD=0xa77a26; IRON=0x4a4650; DARK=0x2a1810
def chest_parts(w, h, teeth=False):
    body=G(w,h); lid=G(w,h)
    # body: planks (horizontal), dark inside top edge, gold corner bands and a lock plate
    for y in range(h):
        for x in range(w):
            c = WOODD if (y % 3 == 2) else WOOD
            if x in (1, w-2): c = GOLDD if y%2 else GOLD
            body.p(x,y,c)
    body.rect(0,0,w,1,WOODL)
    lw=max(3,w//5); lx=w//2-lw//2
    body.rect(lx,0,lw,max(3,h//2),GOLD); body.rect(lx+lw//2,1,1,1,DARK); body.rect(lx+lw//2,2,1,1,DARK) if h>4 else None
    # lid: rounded top, planks, gold band across + corner bands
    for y in range(h):
        for x in range(w):
            r = h-1-y
            edge_in = (y==0 and (x<2 or x>w-3)) or (y==1 and (x<1 or x>w-2))
            if edge_in: continue
            c = WOODL if y<2 else (WOODD if (y%3==1) else WOOD)
            if x in (1,w-2): c = GOLDD if y%2 else GOLD
            lid.p(x,y,c)
    lid.rect(0,h-1,w,1,WOODD); lid.rect(w//2-1,0,2,h,GOLD); lid.rect(w//2-1,0,1,h,GOLDD)
    if teeth:
        for x in range(2,w-2,2):
            lid.p(x,h-1,0xf2eee2); lid.p(x,h-2,0xf2eee2) if (x//2)%2 else None
            body.p(x+1,0,0xf2eee2); body.p(x+1,1,0xf2eee2) if (x//2)%2==0 else None
        body.rect(w//2-3,2,6,2,0xc2304a); body.rect(w//2-2,2,4,1,0xe0506a)   # tongue
    body=body.padded(OUT); lid=lid.padded(OUT)
    return body, lid
# --- fountain
ST=0x7d7a86; STL=0x9c99a6; STD=0x55525e; W1=0x3f8ce0; W2=0x6fb4ff; W3=0xc8e8ff; W0=0x2a5ea8
def fountain():
    b=G(33,18)
    b.ell(16.5,11,16,6.5,STD); b.ell(16.5,10,16,6,ST); b.ell(16.5,9,16,5,STL)   # basin rim
    b.ell(16.5,9,13,3.8,W0); b.ell(16.5,8.6,12.5,3.2,W1)                          # water
    for x in (8,14,21,26): b.p(x,9,W2); b.p(x+1,9,W2)
    b.rect(3,11,27,5,ST); b.ell(16.5,15.5,13.5,2.5,ST)                           # basin side
    for x in range(3,30,5): b.rect(x,12,1,4,STD)                                 # stone blocks
    b.rect(3,11,27,1,STL)
    b.ell(16.5,16.5,14,1.5,STD)
    b=b.padded(OUT)
    h=G(30,13)
    h.rect(13,6,4,7,ST); h.rect(13,6,1,7,STL); h.rect(16,6,1,7,STD); h.ell(15,6,3,1.5,STL)   # spout column
    for k,(dx,top) in enumerate(((-1,1),(1,1))):
        for t in range(12):
            x=15+dx*(t*1.1); y=4-math.sin(t/11*math.pi)*4+t*0.55
            h.p(x,y,W2 if t<6 else W1); h.p(x,y+1,W1)
    h.ell(15,3,2,2.5,W2); h.ell(15,2.5,1,1.2,W3)
    for (x,y) in ((4,10),(26,10),(7,8),(23,8)): h.p(x,y,W3)
    return b,h
# --- dealer (Skill Dealer: hooded, purple robe with gold trim, glowing eyes, a red book)
PU=0x5a3a8a; PUD=0x3e2766; PUL=0x7650ad; GO=0xe0b048; SKN=0x2a1830; EYE=0xffd75a; RED=0xb02838; REDL=0xd84858
def dealer():
    hd=G(12,11)
    hd.ell(6,6,5.5,5.5,PU); hd.rect(1,6,11,5,PU); hd.p(6,0,PU); hd.p(5,0,PU)
    hd.ell(6.5,6.5,3.5,3.2,SKN); hd.rect(3,7,7,4,SKN)
    hd.p(5,6,EYE); hd.p(8,6,EYE)
    hd.rect(1,3,2,8,PUD); hd.rect(9,2,2,3,PUL)
    hd=hd.padded(OUT)
    bd=G(15,16)
    for y in range(16):
        half=4+y*0.25
        for x in range(int(7.5-half),int(7.5+half)+1): bd.p(x,y,PU)
    bd.rect(7,0,1,16,GO); bd.rect(2,15,12,1,GO); bd.rect(3,7,10,1,0x3a2414)   # gold trim, belt
    bd.rect(4,8,2,2,0x8a5a2a); bd.rect(10,8,2,2,0x8a5a2a)                     # pouches
    for y in range(16): bd.p(int(7.5-(4+y*0.25)),y,PUD)
    bd=bd.padded(OUT)
    wp=G(8,7)
    wp.rect(0,0,7,6,RED); wp.rect(0,0,7,1,REDL); wp.rect(0,5,7,1,0x7a1824); wp.rect(1,1,1,4,0xf2e6c8); wp.rect(3,2,3,1,GO); wp.rect(3,3,2,1,GO)
    wp=wp.padded(OUT)
    return bd,hd,wp
# --- puzzle tablet
TS=0x6e6a78; TSL=0x8c8898; TSD=0x4a4654; PAN=0x1c2030; GLO=0x7fd8ff; GLOL=0xd8f4ff; MOSS=0x4c5a2e
def tablet():
    t=G(37,37)
    t.rect(1,2,35,35,TS); t.rect(1,2,35,2,TSL); t.rect(1,2,2,35,TSL); t.rect(34,2,2,35,TSD); t.rect(1,35,35,2,TSD)
    t.rect(4,0,29,3,TS); t.rect(4,0,29,1,TSL)                                       # top crest
    t.rect(6,6,25,25,PAN)
    for gy in range(3):
        for gx in range(3):
            x0,y0=8+gx*8,8+gy*8
            t.rect(x0,y0,6,6,GLO); t.rect(x0,y0,6,1,GLOL); t.rect(x0,y0,1,6,GLOL)
    for (x,y) in ((3,10),(3,18),(3,26),(33,12),(33,20),(33,28)):                    # carved runes on the frame
        t.p(x,y,TSD); t.p(x,y+1,TSD); t.p(x+(1 if x<20 else -1),y+1,TSD)
    t.line(10,33,14,36,TSD); t.line(28,4,30,1,TSD)                                   # cracks
    for x in range(1,36,3): t.p(x,36,MOSS); t.p(x+1,36,MOSS) if x%2 else None
    t=t.padded(OUT)
    return t
if __name__=='__main__':
    out={}
    b,l=chest_parts(17,7); out['chest']={'body':b.art(),'head':l.art()}
    b,l=chest_parts(26,10,teeth=True); out['mimic']={'body':b.art(),'head':l.art()}
    b,h=fountain(); out['fountain']={'body':b.art(),'head':h.art()}
    bd,hd,wp=dealer(); out['dealer']={'body':bd.art(),'head':hd.art(),'weapon':wp.art()}
    out['tablet']={'body':tablet().art()}
    import sys
    json.dump(out,open(sys.argv[1] if len(sys.argv)>1 else 'room-props-art.json','w'))
    for k,v in out.items(): print(k,{n:(len(a['rows'][0]),len(a['rows'])) for n,a in v.items()})
