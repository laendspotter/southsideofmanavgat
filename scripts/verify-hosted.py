"""Exercise an already deployed site with isolated temporary records. Admin key via stdin only."""
import json,sys,uuid,http.cookiejar,urllib.request,urllib.error,termios
BASE='https://southsideofmanavgat.vercel.app'
old=termios.tcgetattr(sys.stdin)
new=termios.tcgetattr(sys.stdin);new[3]&=~termios.ECHO
termios.tcsetattr(sys.stdin,termios.TCSADRAIN,new)
print('Ready for verification JSON on stdin (input is hidden).',flush=True)
try: key=json.loads(sys.stdin.readline())['admin']
finally: termios.tcsetattr(sys.stdin,termios.TCSADRAIN,old)
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
other=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(payload=None,admin=False,who=client):
 headers={'Origin':BASE,'Content-Type':'application/json'}
 if admin: headers['x-admin-key']=key
 req=urllib.request.Request(BASE+'/api/community',headers=headers,data=json.dumps(payload).encode() if payload is not None else None)
 try:
  with who.open(req,timeout=40) as r:return r.status,json.loads(r.read())
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def post(p,admin=False):
 status,data=request(p,admin)
 assert status==200,(status,data)
 return data
ids=[]
try:
 status,s=request();assert status==200,(status,s)
 tag='integration-'+uuid.uuid4().hex[:8]
 s=post({'kind':'hotel','data':{'name':tag,'area':'side','source':'','note':'temporary integration check'}})
 h=next(h for h in s['hotels'] if h['name']==tag);ids.append(h['id'])
 status,cross=request(who=other);assert any(x['id']==h['id'] for x in cross['hotels']);print('PASS: shared write persists across independent guest sessions',flush=True)
 s=post({'kind':'hotel','action':'edit','id':h['id'],'baseVersion':h['updatedAt'],'reason':'integration edit','data':{'name':tag,'area':'side','source':'','note':'edited'}})
 status,_=request({'kind':'hotel','action':'edit','id':h['id'],'baseVersion':h['updatedAt'],'data':{'name':tag,'area':'side','note':'stale','source':''}});assert status==409,status
 print('PASS: stale edit rejected with 409',flush=True)
 s=post({'kind':'review','data':{'hotelId':h['id'],'author':'integration check','recommend':True,'rating':4,'food':4,'room':4,'beach':3,'title':'temporary review','body':'temporary integration check, this will be deleted.','visited':'2026-10'}})
 rev=next(r for r in s['reviews'] if r['hotelId']==h['id']);assert rev['mine'];ids.append(rev['id'])
 status,cross=request(who=other);assert not next(r for r in cross['reviews'] if r['id']==rev['id'])['mine'];assert 'owner' not in rev
 print('PASS: review ownership and privacy',flush=True)
 s=post({'kind':'line','data':{'name':tag,'area':'side','from':'temporary a','to':'temporary b','start':'08:15','end':'01:00','interval':10,'days':[1,2,3],'season':'test only','fare':'','points':[{'lat':36.8,'lng':31.3,'name':'a'},{'lat':36.79,'lng':31.39,'name':'b'}],'direction':'both','observed':'2026-10-01','note':'temporary test, not actual service','source':''}})
 line=next(l for l in s['lines'] if l['name']==tag);ids.append(line['id']);assert line['end']=='01:00'
 s=post({'kind':'bazaar','data':{'name':tag,'area':'side','days':[1],'hours':'test only','observed':'2026-10-01','source':'','note':'temporary test'}});ids.append(next(b['id'] for b in s['bazaars'] if b['name']==tag))
 print('PASS: route geometry, overnight schedule and bazaar saved',flush=True)
 s=post({'kind':'report','data':{'targetId':line['id'],'reason':'integration check: temporary report'}});assert not s['reports']
 status,mod=request(admin=True);assert mod['admin'];report=next(r for r in mod['reports'] if r['targetId']==line['id']);assert report
 status,_=request({'kind':'moderate','action':'delete','id':line['id']});assert status==403,status
 post({'kind':'moderate','action':'resolve','id':report['id']},True)
 print('PASS: private reports and server-side moderator authorization',flush=True)
finally:
 for id in reversed(ids):
  status,body=request({'kind':'moderate','action':'delete','id':id},True)
  assert status in (200,404),(status,body)
 print('PASS: temporary records removed',flush=True)
status,final=request();assert not any(x['id'] in ids for k in ['hotels','lines','bazaars','reviews'] for x in final[k])
print('ALL HOSTED CHECKS PASSED',flush=True)
