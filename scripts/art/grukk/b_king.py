from px import *
c=C(40,44)
# red cape behind (shows at the sides and bottom)
c.rect(4,18,19,40,'e')
for x in range(4,20,3): c.p(x,40,'.'); 
# legs + boots
c.rect(12,34,17,39,'c'); c.rect(10,39,17,42,'9')
# kilt
c.rect(10,29,19,35,'a')
for x in range(10,20,3): c.line(x,31,x,35,'9')
# arms
c.rect(3,19,8,29,'2'); c.ell(5.5,31,3.2,2.6,'2')
c.rect(3,25,8,26,'d')  # gold arm ring
# torso
c.ell(19.5,22,11,9,'2'); c.rect(9,22,19,29,'2')
c.rect(9,28,19,30,'9')
# fur mantle over the shoulders, jagged bottom
c.ell(19.5,19,17,4,'b'); 
for x in range(3,20):
    if x%2==0: c.p(x,22,'b')
# head
c.ell(19.5,13,7,6,'2'); c.rect(13,13,19,18,'2')
# beast skull helm with long curved horns
c.ell(19.5,7,7,4,'5'); c.rect(13,8,19,10,'5')
for (x,y) in [(11,7),(10,6),(9,5),(8,5),(7,4),(6,3),(6,2),(7,1),(8,0)]: c.p(x,y,'g'); c.p(x-1,y,'g')
c.mirror()
c.shade('2','2','1'); c.shade('b','b','c'); c.shade('a','a','9'); c.shade('e','e','f'); c.shade('5','5','g')
# skull helm: eye holes and teeth over the brow
for x in (16,17,22,23): c.p(x,6,'0'); c.p(x,7,'0')
c.p(19,8,'0'); c.p(20,8,'0')
for x in range(14,26,2): c.p(x,11,'5'); c.p(x,10,'5')
# face in the skull's shadow: glowing eyes, grin, tusks
c.rect(13,12,26,12,'1')
for x in (15,16,23,24): c.p(x,13,'4')
c.p(19,14,'1'); c.p(20,14,'1')
c.rect(15,16,24,17,'f')
for x in (16,18,21,23): c.p(x,16,'5')
for x in (15,24): c.p(x,15,'5'); c.p(x,14,'5')
# crown of gold spikes on the skull
for x in (15,19,20,24): c.p(x,3,'d'); c.p(x,2,'d')
c.p(19,1,'d'); c.p(20,1,'d')
# tooth necklace
for x in range(14,26):
    c.p(x,23,'9')
    if x%2==0: c.p(x,24,'5')
c.p(19,24,'4'); c.p(20,24,'4')
# belt trophies: little skulls
for sx in (12,19,25):
    c.rect(sx,29,sx+2,31,'5'); c.p(sx,30,'0'); c.p(sx+2,30,'0')
c.outline()
open('b_king.txt','w').write('\n'.join(c.rows()))
