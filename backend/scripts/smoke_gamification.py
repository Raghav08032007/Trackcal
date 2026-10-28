"""Opt-in loopback smoke; creates and removes only its own synthetic account."""
from concurrent.futures import ThreadPoolExecutor
import os,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['APP_ENV']='testing'
import httpx
import database,models

def run():
 root='http://127.0.0.1:8000/api/v1';email=f'qa-phase1-concurrency-{uuid.uuid4().hex}@tests.example.com';owner=None
 try:
  r=httpx.post(root+'/auth/signup',json={'email':email,'password':'Synthetic-only-'+uuid.uuid4().hex+'!'});assert r.status_code==201
  headers={'Authorization':'Bearer '+r.json()['access_token']}
  owner=httpx.get(root+'/auth/me',headers=headers).json()['id']
  r=httpx.post(root+'/adventure/initialize',headers=headers,json={'timezone':'Asia/Kolkata'});assert r.status_code==200
  day=r.json()['today'];body={'id':str(uuid.uuid4()),'owner_id':owner,'day':day,'name':'Synthetic walk','minutes':15,'sets':0,'reps':0,'load':0}
  def submit(_):
   response=httpx.post(root+'/adventure/review-workout',headers=headers,json=body,timeout=30)
   assert response.status_code==200,response.status_code
   return response.json()['awarded_xp']
  with ThreadPoolExecutor(max_workers=8) as pool:points=list(pool.map(submit,range(8)))
  assert sorted(points)==[0,0,0,0,0,0,0,20],points
  state=httpx.get(root+'/adventure/summary',headers=headers).json();assert state['xp']==20
  with database.SessionLocal() as db:
   assert db.query(models.ActivityRewardEvent).filter_by(user_id=owner,source_id=body['id']).count()==1
   assert db.query(models.RewardEvent).filter_by(user_id=owner,kind='workout').count()==1
  print('Live HTTP concurrency: 8 identical reviews, exactly one 20 XP award and one audit event; passed.')
 finally:
  if owner:
   with database.SessionLocal() as db:
    row=db.query(models.User).filter_by(id=owner,email=email).one_or_none()
    if row:db.delete(row);db.commit()
   print('Only the synthetic concurrency account was removed.')
if __name__=='__main__':run()
