import json, base64, os
ROOT='/home/user/Dungeon-of-Soldia/'; S='/tmp/claude-0/-home-user-Dungeon-of-Soldia/aedede86-8649-572d-8b1c-eed31925d5ba/scratchpad/'
snd=json.load(open(ROOT+'src/data/sounds.json'))
def path(n): return ROOT+'src/assets/sounds/'+(n if '/' in n else snd['pack']+'/'+n)+'.mp3'
GROUPS=[
 ('Hits', 'One per damage type. A random take plays each time.', [
   ('hitMelee','Melee hit','Sword, axe, dagger, claws','impact punch'),
   ('hitRanged','Arrow hit','Archer, Bard, Skeleton Archer','light wood thunk'),
   ('hitFire','Fire hit','Fireball, Fire Bombs, burning hits','soft heavy thump, a bit deeper'),
   ('hitIce','Ice hit','Frost Nova, Chill Band','light glass'),
   ('hitElectric','Electric hit','Chain Lightning, Static Crystal','light metal, higher'),
   ('hitDark','Dark hit','Death Coil, Cultist','soft thump, much deeper'),
   ('hitHoly','Holy hit','Smite','bell, high and quiet'),
   ('crit','Critical hit','On top of the normal hit','heavy punch')]),
 ('Defense', 'When a hit does not land, or a shield takes it.', [
   ('miss','Miss / dodge','Evasion, Blind','cloth swish'),
   ('block','Block / parry / immune','Shield Totem, Focus Stance, Divine Shield','metal ting'),
   ('shieldSoak','Shield soaks a hit','Arcane Ward, Bone Ward','glass tap, quiet'),
   ('shieldBreak','Shield breaks','A shield used up by damage','heavy glass')]),
 ('Statuses', '', [
   ('stun','Stun lands','Shield Bash, Gambler\'s Dice','heavy wood knock'),
   ('freeze','Freeze lands','5 Chill stacks, Chill Band','heavy glass, higher')]),
 ('Fighters', '', [
   ('enemyDeath','Enemy or minion dies','Every kill','leather drop'),
   ('heroFall','A hero falls','','heavy plate, deep'),
   ('minionSummon','Minion rises','Skeletons, item minions','mining hit, deeper'),
   ('itemProc','Item goes off','With the item icon pop','small tin tap')]),
 ('Bosses', '', [
   ('bossIntro','Boss floor starts','Floors 20, 40 ... 160','one deep bell (gong)'),
   ('bossWarn','Boss winds up a move','With the red bar','low bell'),
   ('bossMove','Boss move goes off','Cleaver Charge, Blizzard ...','heavy plate')]),
 ('Dungeon & rewards', '', [
   ('doorOpen','Door opens','Floor cleared','wooden door'),
   ('step','Footsteps','Heroes walking to and through the door','soft step'),
   ('itemGiven','Item given','Give on the reward sheet (was a chime)','coins')]),
]
cues=[]
blobs={}
for g,sub,rows in GROUPS:
  for cue,name,when,what in rows:
    c=snd['cues'][cue]; files=c.get('files') or [c['file']]
    for f in files:
      if f not in blobs: blobs[f]='data:audio/mpeg;base64,'+base64.b64encode(open(path(f),'rb').read()).decode()
jing={}
for f in sorted(os.listdir(S+'jingles')):
  jing[f[:-4]]='data:audio/mpeg;base64,'+base64.b64encode(open(S+'jingles/'+f,'rb').read()).decode()
data={'groups':[{'name':g,'sub':sub,'rows':[{'cue':cue,'name':n,'when':w,'what':wt,'c':snd['cues'][cue]} for cue,n,w,wt in rows]} for g,sub,rows in GROUPS],'master':snd['masterVolume']}
html=open(S+'listen-template.html').read()
html=html.replace('__DATA__',json.dumps(data)).replace('__BLOBS__',json.dumps(blobs)).replace('__JINGLES__',json.dumps(jing))
open(S+'soldia-sounds.html','w').write(html)
print(len(html)//1024,'KB')
