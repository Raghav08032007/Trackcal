"""Measured loopback API timings on synthetic records in the dedicated test schema."""
import os,sys,time,uuid,json,statistics
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]));os.environ['APP_ENV']='testing'
import httpx
from sqlalchemy import text
from database import engine,SessionLocal
import models
assert engine.url.database=='trackcal_phase3_test'
email=f'qa-phase3-perf-{uuid.uuid4().hex}@tests.example.com';owner=None
try:
 with httpx.Client(base_url='http://127.0.0.1:8003/api/v1',timeout=15) as client:
  r=client.post('/auth/signup',json={'email':email,'password':'Synthetic-'+uuid.uuid4().hex+'!'});assert r.status_code==201
  headers={'Authorization':'Bearer '+r.json()['access_token']};owner=client.get('/auth/me',headers=headers).json()['id'];metrics={}
  for name,path in [('food_search','/wellness/foods?q=phase%20three&limit=12'),('exercise_library','/wellness/exercises?limit=12'),('workout_history','/wellness/training?limit=20')]:
   times=[]
   for _ in range(12):
    start=time.perf_counter();response=client.get(path,headers=headers);assert response.status_code==200;times.append((time.perf_counter()-start)*1000)
   metrics[name]={'samples':len(times),'p50_ms':round(statistics.median(times),2),'p95_ms':round(sorted(times)[-1],2),'max_ms':round(max(times),2)}
 with engine.connect() as c:
  count=c.scalar(text('SELECT COUNT(*) FROM foods'))
  plans=[dict(r) for r in c.execute(text("EXPLAIN SELECT id FROM foods WHERE name_normalized LIKE 'phase%' ORDER BY name_normalized LIMIT 12")).mappings()]
 report={'date':'2026-10-28','database':'trackcal_phase3_test','catalog_rows':count,'metrics':metrics,'prefix_query_index':plans[0].get('key'),'scope':'Loopback synthetic-account timings on a small test catalog; not production, physical-mobile or large-catalog certification.'}
 Path('../docs/phase3-performance.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
finally:
 if owner:
  with SessionLocal() as db:
   row=db.query(models.User).filter_by(id=owner,email=email).one_or_none()
   if row:db.delete(row);db.commit()
