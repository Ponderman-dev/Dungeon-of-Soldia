from px import *
w=C(12,24)
w.rect(2,1,9,12,'7'); w.rect(2,1,9,2,'6'); w.rect(8,1,9,12,'8')
w.p(3,4,'e');w.p(4,5,'e'); w.p(6,8,'e')   # blood
w.rect(1,0,1,12,'6')  # sharp edge
w.rect(5,13,6,22,'9'); w.rect(5,14,6,14,'a'); w.rect(5,17,6,17,'a'); w.rect(5,20,6,20,'a')
w.rect(4,13,7,13,'8')
w.outline()
open('cleaver.txt','w').write('\n'.join(w.rows()))
