"""Opt-in loopback-only rewards race and game test with disposable QA accounts."""
import os,json,uuid,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from concurrent.futures import ThreadPoolExecutor
import httpx
from database import SessionLocal
import models

if os.getenv('RUN_LIVE_ADVENTURE')!='true': raise SystemExit('Set RUN_LIVE_ADVENTURE=true')
base='http://127.0.0.1:3002';api='http://127.0.0.1:8000/api/v1';accounts=[]
def call(account,path,body=None):
    with httpx.Client(trust_env=False,timeout=30) as client:
        response=client.request('GET' if body is None else 'POST',base+path,headers={'Origin':base,'Cookie':'; '.join(f'{k}={v}' for k,v in account['cookies'].items())},**({} if body is None else {'json':body}))
        account['cookies'].update(dict(response.cookies));return response

try:
    for _ in range(2):
        account={'email':f'qa-adventure-{uuid.uuid4().hex}@tests.example.com','password':'Synthetic-adventure-test-123!','cookies':{}}
        response=call(account,'/api/account/signup',{'email':account['email'],'password':account['password'],'display_name':'Disposable adventure test'});assert response.status_code==200
        account['id']=call(account,'/api/account/session').json()['id'];accounts.append(account)
        assert call(account,'/api/adventure/initialize',{'timezone':'UTC'}).status_code==200
    owner,other=accounts;today=call(owner,'/api/adventure/summary').json()['today']
    body={'owner_id':owner['id'],'id':str(uuid.uuid4()),'day':today,'name':'Synthetic reviewed meal','calories':200,'protein':10,'carbs':20,'fat':8}
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda _:call(owner,'/api/adventure/review',body),range(2)))
    assert all(response.status_code==200 for response in responses),[r.status_code for r in responses]
    assert sorted(response.json()['awarded_xp'] for response in responses)==[0,10]
    assert call(other,'/api/adventure/review',body).status_code==409
    print('PASS live review race: exactly one 10-XP award; ownership protected')
    session=call(owner,'/api/adventure/start',{}).json()
    with SessionLocal() as db:
        row=db.get(models.GameSession,session['id']);assert row.user_id==owner['id'];answers=[q['answer'] for q in row.challenge]
    payload={'id':session['id'],'answers':answers,'xp':999999}
    assert call(other,'/api/adventure/submit',payload).status_code==404
    assert call(owner,'/api/adventure/submit',payload).json()['awarded_xp']==10
    assert call(owner,'/api/adventure/submit',payload).json()['awarded_xp']==0
    assert call(owner,'/api/adventure/summary').json()['xp']==20
    print('PASS live game scoring, forged-XP rejection, replay protection and reload persistence')
    if os.getenv('KEEP_BROWSER_QA')=='true':
        destination=Path('runtime/adventure-browser-qa.json');destination.parent.mkdir(exist_ok=True)
        destination.write_text(json.dumps(owner),encoding='utf-8')
        print('Disposable browser account retained in ignored runtime file for this verification only.')
finally:
    with httpx.Client(trust_env=False,timeout=20) as client:
        for account in accounts:
            if account is accounts[0] and os.getenv('KEEP_BROWSER_QA')=='true' and Path('runtime/adventure-browser-qa.json').exists(): continue
            response=client.delete(api+'/users/account',headers={'Authorization':'Bearer '+account['cookies']['trackcal_access']});response.raise_for_status()
    print('Other disposable adventure accounts deactivated.')
