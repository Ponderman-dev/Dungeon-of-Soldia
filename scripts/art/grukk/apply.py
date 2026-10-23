import json,sys
from px import export
repo,var=sys.argv[1],sys.argv[2]
spec={'a':('a_brute.txt',(39.5,32)),'b':('b_king.txt',(34.5,31)),'c':('c_orc.txt',(34.5,29))}[var]
body=open(spec[0]).read().split('\n'); wpn=open('cleaver.txt').read().split('\n')
W,H=len(body[0]),len(body); ww,wh=len(wpn[0]),len(wpn); ax,ay=5.5,18
P=repo+'/src/data/enemies.json'; E=json.load(open(P))
g=E['grukk']; fx,fy=-W/2+spec[1][0],-H+spec[1][1]
g['parts']={'body':{'x':0,'y':-H/2,'w':W,'h':H,'art':export(body),'anchor':[W/2,H]},
 'weapon':{'x':fx-ax+ww/2,'y':fy-ay+wh/2,'w':ww,'h':wh,'art':export(wpn),'anchor':[ax,ay]}}
g['height']=H
open(P,'w').write(json.dumps(E,indent=2,ensure_ascii=False)+'\n')
