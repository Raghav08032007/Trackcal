"""Synthetic regression fixture only; hard-guarded existing isolated test schema."""
import os,sys,json,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from database import engine
if engine.url.database!='trackcal_phase3_test':raise RuntimeError('Use only the isolated test database.')
from tests.client import client
from services.personalization_inputs import Preferences
email='qa-phase4-plan-'+uuid.uuid4().hex+'@tests.example.com';password='Synthetic-phase4-'+uuid.uuid4().hex+'!'
r=client.post('/api/v1/auth/signup',json={'email':email,'password':password});assert r.status_code==201,r.text
h={'Authorization':'Bearer '+r.json()['access_token']}
prefs=Preferences(available_days=[0,1,2,3,4,5,6],rest_days=[],age_group='20_64').model_dump()
r=client.post('/api/v1/personalization/onboarding',headers=h,json={'preferences':prefs,'revision':0,'step':8,'complete':True});assert r.status_code==200,r.text
r=client.post('/api/v1/personalization/plans',headers=h,json={'revision':1});assert r.status_code==200,r.text
runtime=Path(__file__).resolve().parents[1]/'runtime';runtime.mkdir(exist_ok=True)
(runtime/'phase4-phase2-qa.json').write_text(json.dumps({'email':email,'password':password}),encoding='utf8')
ledger=runtime/'phase4-qa.json';items=json.loads(ledger.read_text()) if ledger.exists() else [];ledger.write_text(json.dumps(items+[email]),encoding='utf8')
print('Created an explicitly recorded synthetic Phase 2 regression fixture in the isolated test schema.')
