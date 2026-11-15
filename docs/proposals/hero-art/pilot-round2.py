# ART PILOT round 2: two different APPROACHES (big detailed sprites vs simple mascots), heroes redesigned.
import sys
from PIL import Image, ImageDraw, ImageFont
K=(26,16,32)
def hx(v): return ((v>>16)&255,(v>>8)&255,v&255)
C={k:hx(v) for k,v in dict(steel=0xb4bcc8,blue=0x3f6fd0,navy=0x2c3f8a,gold=0xf0c040,skin=0xf0c8a0,brown=0x8a5a30,dbrown=0x5c3a20,
  green=0x7fb23c,dgreen=0x55852c,bone=0xece6d4,red=0xcc4438,dred=0x8a2c2c,indigo=0x4a44a8,white=0xffffff,orange=0xf08a2c,
  leather=0x9a6c3c,teal=0x3c7a78,yellow=0xf6e060,slime=0x6cc04c,pink=0xe88a8a,grey=0x6c7282).items()}
C['k']=K
class Spr:
    def __init__(s,w,h): s.im=Image.new('RGBA',(w,h),(0,0,0,0)); s.d=ImageDraw.Draw(s.im); s.w,s.h=w,h; s.noshade=set()
    def col(s,c): return C[c]+(255,)
    def rect(s,x0,y0,x1,y1,c): s.d.rectangle([x0,y0,x1,y1],fill=s.col(c))
    def ell(s,x0,y0,x1,y1,c): s.d.ellipse([x0,y0,x1,y1],fill=s.col(c))
    def poly(s,pts,c): s.d.polygon(pts,fill=s.col(c))
    def line(s,pts,c,w=1): s.d.line(pts,fill=s.col(c),width=w)
    def px(s,x,y,c): s.im.putpixel((x,y),s.col(c))
    def finish(s,shadow=2,light=True,outline=True):
        im=s.im; w,h=im.size; src=im.load(); out=im.copy(); o=out.load()
        get=lambda x,y: src[x,y] if 0<=x<w and 0<=y<h else (0,0,0,0)
        flat={C['k']+(255,),C['white']+(255,)}
        for y in range(h):
            for x in range(w):
                c=src[x,y]
                if c[3]==0 or c in flat: continue
                same=lambda dx,dy: get(x+dx,y+dy)==c
                # light from the top left: the right / bottom rim of every colour area is darker, the top / left rim lighter
                if any(not same(d,0) for d in range(1,shadow+1)) or any(not same(0,d) for d in range(1,shadow+1)):
                    o[x,y]=tuple(int(v*0.70) for v in c[:3])+(255,)
                elif light and (not same(-1,0) or not same(0,-1)):
                    o[x,y]=tuple(int(v+(255-v)*0.28) for v in c[:3])+(255,)
        if outline:
            big=Image.new('RGBA',(w+2,h+2),(0,0,0,0)); big.paste(out,(1,1)); b=big.load(); ref=big.copy().load()
            for y in range(h+2):
                for x in range(w+2):
                    if ref[x,y][3]: continue
                    if any(0<=x+dx<w+2 and 0<=y+dy<h+2 and ref[x+dx,y+dy][3] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))): b[x,y]=K+(255,)
            out=big
        return out

# =========================== APPROACH 1: BIG DETAILED SPRITES (heroes ~48 px) ===========================
def knight():   # THE BULWARK: great helm, kite shield, cape
    s=Spr(44,52)
    s.poly([(11,21),(29,21),(33,47),(7,47)],'navy')                      # cape
    s.rect(14,38,18,47,'steel'); s.rect(22,38,26,47,'steel')              # legs
    s.rect(13,46,19,49,'grey'); s.rect(21,46,27,49,'grey')                # boots
    s.rect(13,41,19,42,'grey'); s.rect(21,41,27,42,'grey')                # knee plates
    s.rect(12,20,28,38,'steel')                                           # cuirass
    s.rect(16,21,24,40,'blue'); s.rect(19,24,21,31,'gold'); s.rect(17,26,23,28,'gold')   # tabard + cross
    s.rect(12,34,28,35,'dbrown'); s.rect(19,33,21,36,'gold')              # belt
    s.ell(26,17,34,25,'steel'); s.rect(29,22,33,31,'steel'); s.rect(29,29,34,32,'grey')  # sword arm + gauntlet
    s.rect(31,4,33,27,'white'); s.px(32,3,'white'); s.rect(28,27,36,28,'gold'); s.rect(31,32,33,34,'gold')  # sword
    s.rect(13,5,27,20,'steel'); s.ell(13,2,27,12,'steel')                 # great helm
    s.rect(15,11,25,12,'k'); s.rect(19,11,20,18,'k')                      # cross slit
    for y in (15,17): s.px(16,y,'k'); s.px(23,y,'k')
    s.rect(13,19,27,20,'grey')
    s.poly([(20,3),(18,0),(11,0),(7,4),(12,4),(16,6)],'red')              # plume
    s.poly([(2,22),(15,22),(15,35),(8,44),(2,35)],'gold')                 # kite shield rim
    s.poly([(4,24),(13,24),(13,34),(8,41),(4,34)],'blue')
    s.rect(8,26,9,37,'gold'); s.rect(5,29,12,30,'gold')
    return s.finish()
def mage():     # THE STARGAZER: huge hat, star robe, moon staff
    s=Spr(46,54)
    s.poly([(12,24),(28,24),(33,51),(7,51)],'indigo')                     # robe
    s.rect(7,48,33,51,'navy'); 
    for x in (10,16,22,28): s.px(x,49,'gold'); s.px(x+1,50,'gold')
    for (x,y) in ((14,36),(25,31),(20,43),(27,44),(12,45)): s.px(x,y,'yellow')           # stars
    s.poly([(12,25),(6,36),(10,38),(15,29)],'indigo'); s.poly([(28,25),(35,34),(31,37),(25,29)],'indigo')  # sleeves
    s.rect(6,36,9,38,'skin'); s.rect(33,34,36,37,'skin')                  # hands
    s.rect(15,15,25,22,'skin'); s.rect(17,17,17,18,'k'); s.rect(23,17,23,18,'k'); s.rect(19,19,21,20,'pink')
    s.poly([(14,20),(26,20),(25,30),(20,38),(15,30)],'bone')              # beard
    s.rect(18,21,22,21,'skin')
    s.ell(6,11,34,17,'indigo')                                            # brim
    s.poly([(12,13),(28,13),(25,6),(30,0),(21,3),(15,8)],'indigo')        # cone
    s.rect(13,11,27,12,'gold'); s.px(20,6,'yellow'); s.px(19,7,'yellow'); s.px(21,7,'yellow'); s.px(20,8,'yellow')
    s.rect(36,10,37,51,'brown')                                           # staff
    s.ell(31,0,42,11,'gold'); s.d.ellipse([34,0,44,9],fill=(0,0,0,0)); s.rect(36,4,38,6,'orange')   # crescent + gem
    return s.finish()
def goblin():   # THE SNEAK: hunched, huge ears, jagged knife
    s=Spr(44,40)
    s.rect(15,31,18,37,'green'); s.rect(22,31,25,37,'green'); s.rect(13,36,18,38,'dgreen'); s.rect(22,36,27,38,'dgreen')
    s.ell(13,20,27,34,'green')                                            # body
    s.poly([(14,24),(26,24),(27,33),(13,33)],'leather'); s.rect(14,29,26,30,'dbrown'); s.rect(19,29,21,30,'gold')
    s.poly([(16,32),(24,32),(22,36),(18,36)],'dbrown')
    s.rect(9,24,12,32,'green'); s.rect(8,31,12,33,'dgreen')               # hanging arm
    s.poly([(27,24),(33,18),(36,20),(30,27)],'green')                     # raised arm
    s.poly([(34,19),(36,6),(39,9),(38,13),(40,15),(37,20)],'steel'); s.rect(33,18,37,20,'dbrown')   # knife
    s.ell(11,6,29,22,'green')                                             # head
    s.poly([(12,10),(1,5),(4,13),(11,16)],'green'); s.poly([(28,10),(39,5),(36,13),(29,16)],'green')  # ears
    s.poly([(10,11),(4,8),(6,12)],'dgreen'); s.poly([(30,11),(36,8),(34,12)],'dgreen')
    s.rect(14,12,17,14,'yellow'); s.rect(22,12,25,14,'yellow'); s.rect(16,12,16,14,'k'); s.rect(23,12,23,14,'k')
    s.poly([(19,14),(21,14),(22,19),(20,20)],'dgreen')                    # nose
    s.rect(15,19,24,19,'k'); s.px(15,18,'white'); s.px(24,18,'white'); s.px(17,20,'white'); s.px(22,20,'white')
    return s.finish()
def slime():
    s=Spr(36,24)
    s.ell(2,2,33,30,'slime'); s.d.rectangle([0,22,36,40],fill=(0,0,0,0))
    s.rect(1,17,34,21,'slime'); s.px(1,17,'k'); s.im.putpixel((1,17),(0,0,0,0)); s.im.putpixel((34,17),(0,0,0,0))
    s.rect(4,20,6,22,'slime'); s.rect(27,20,30,23,'slime')                # drips
    s.rect(10,10,13,14,'k'); s.rect(21,10,24,14,'k'); s.px(10,10,'white'); s.px(21,10,'white')
    s.rect(15,16,19,16,'k'); s.px(14,15,'k'); s.px(20,15,'k')
    s.rect(8,5,11,6,'white'); s.px(7,7,'white'); s.ell(24,5,27,8,'dgreen')
    return s.finish()
def skeleton(): # THE DEAD HUNTER: hooded cloak, longbow
    s=Spr(46,54)
    s.poly([(10,19),(30,19),(33,42),(29,39),(26,44),(22,40),(18,45),(14,40),(9,43)],'teal')   # torn cloak
    s.rect(16,37,17,49,'bone'); s.rect(23,37,24,49,'bone'); s.rect(14,49,18,50,'bone'); s.rect(22,49,26,50,'bone')
    s.rect(15,42,18,43,'bone'); s.rect(22,42,25,43,'bone')
    s.rect(14,21,26,34,'k')                                               # the dark inside the ribcage
    s.rect(19,21,21,35,'bone')
    for y in (23,26,29,32): s.rect(15,y,25,y,'bone')
    s.rect(15,35,25,37,'bone')
    s.line([(13,22),(9,28),(11,33)],'bone',2); s.line([(27,22),(32,24),(36,26)],'bone',2)     # arms
    s.poly([(11,4),(20,0),(29,4),(31,18),(27,21),(13,21),(9,18)],'teal')  # hood
    s.ell(14,5,26,17,'bone'); s.rect(17,15,23,19,'bone')                  # skull
    s.rect(16,9,18,12,'k'); s.rect(22,9,24,12,'k'); s.px(17,10,'green'); s.px(23,10,'green'); s.rect(20,13,20,14,'k')
    for x in (18,20,22): s.rect(x,17,x,18,'k')
    s.line([(35,6),(39,13),(40,26),(39,39),(35,46)],'brown',2)            # longbow
    s.line([(35,6),(35,46)],'white',1)
    s.line([(24,26),(40,26)],'leather',1); s.poly([(40,24),(43,26),(40,28)],'steel')        # arrow
    return s.finish()

# =========================== APPROACH 2: SIMPLE MASCOTS (one body shape + eyes + one signature item) ===========================
MP={'s':'steel','b':'blue','y':'gold','f':'skin','n':'brown','g':'green','w':'bone','r':'red','e':'k','o':'orange','t':'teal','h':'white','i':'indigo','Y':'yellow','l':'slime'}
def mascot(txt):
    rows=txt.strip('\n').split('\n'); w=max(len(r) for r in rows); s=Spr(w,len(rows))
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch!='.': s.px(x,y,MP[ch])
    return s.finish(shadow=1,light=False)
M_knight=mascot('''
....rrr.......
...rrr........
..ssssssss..h.
.ssssssssss.h.
.ssssssssss.h.
.seeeeeeees.h.
.ssseesssss.h.
.ssseessssyyyy
.bbbbbbbbbb.n.
.bbbbyybbbb...
.bbbyyyybbb...
.bbbbyybbbb...
.bbbbbbbbbb...
..bbbbbbbb....
''')
M_mage=mascot('''
........i.....
.......iii....
......iiiii...
.....iiYiiii.o
....iiiiiiii.n
..yyyyyyyyyyyn
.iiiiiiiiiiiin
...ffffffff..n
...feeffeef..n
...wwwwwwww..n
..iwwwwwwwwi.n
..iiwwwwwwii.n
..iiiwwwwiii.n
..iiiiwwiiii.n
...iiiiiiii..n
''')
M_goblin=mascot('''
gg...........gg.s
ggg.gggggggg.ggg.s
.gggggggggggggg..s
..gggggggggggg..ss
..gYYegggYYegg..n.
..gYYegggYYegg..n.
..gggggggggggg....
..ghggeeeegghg....
..gggggggggggg....
..nnnnnnnnnnnn....
..nnnnnynnnnnn....
...nnnnnnnnnn.....
''')
M_slime=mascot('''
....llllll....
..llllllllll..
.llhhllllllll.
.llllllllllll.
lleelllllleell
lleelllllleell
llllleeeelllll
llllllllllllll
''')
M_skel=mascot('''
..tttttttttt...n.
.ttwwwwwwwwtt...n
.twwwwwwwwwwt...n
.tweeewweeewt...n
.tweeewweeewt...n
.twwwwewwwwwt...n
.ttwewewewett...n
.tttttttttttt...n
.tttttttttttt..n.
.tttttttttttt.n..
..tttttttttt.....
''')

def main(out):
    try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20); f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
    except Exception: f=f2=ImageFont.load_default()
    rows=[('1  BIG DETAILED SPRITES','heroes about 48 px tall (twice today): real helmets, beards, cloaks, weapons. Dark outline, light + shadow on every surface.',
           [('Knight: "the Bulwark"',knight()),('Mage: "the Stargazer"',mage()),('Goblin',goblin()),('Slime',slime()),('Skeleton Archer',skeleton())],4,330),
          ('2  SIMPLE MASCOTS','one rounded body + eyes + ONE signature item, about 14 px tall. No arms or legs. Dark outline, flat colour + one shadow.',
           [('Knight',M_knight),('Mage',M_mage),('Goblin',M_goblin),('Slime',M_slime),('Skeleton Archer',M_skel)],6,210)]
    W=1100; H=sum(r[4] for r in rows)+60+190
    im=Image.new('RGB',(W,H),(24,22,30)); d=ImageDraw.Draw(im); y0=16
    for title,desc,list_,z,rh in rows:
        d.rectangle([10,y0,W-10,y0+rh-12],fill=(46,42,52)); d.rectangle([10,y0+rh-52,W-10,y0+rh-12],fill=(38,35,44))
        d.text((22,y0+8),title,fill=(255,231,168),font=f); d.text((22,y0+34),desc,fill=(200,198,212),font=f2)
        for i,(name,spr) in enumerate(list_):
            cx=120+i*215; big=spr.resize((spr.width*z,spr.height*z),Image.NEAREST); feet=y0+rh-58
            im.paste(big,(cx-big.width//2,feet-big.height),big); d.text((cx,feet+12),name,fill=(170,168,184),font=f2,anchor='ma')
        y0+=rh
    # both at the size they would have in the game (3 screen pixels per art pixel; the big ones at 2 so they fit like today's bosses do)
    d.rectangle([10,y0,W-10,y0+178],fill=(46,42,52)); d.text((22,y0+8),'ON THE PHONE (real size)',fill=(255,231,168),font=f)
    x=60
    for title,desc,list_,z,rh in rows:
        zz=2 if z==4 else 3
        d.text((x,y0+38),title.split('  ')[1].title()+(' (2 screen px per art px)' if zz==2 else ' (3 screen px per art px)'),fill=(200,198,212),font=f2)
        xx=x+30
        for name,spr in list_:
            big=spr.resize((spr.width*zz,spr.height*zz),Image.NEAREST); im.paste(big,(xx-big.width//2,y0+166-big.height),big); xx+=96
        x+=540
    im.save(out)
main(sys.argv[1])
