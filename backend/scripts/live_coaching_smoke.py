"""Opt-in loopback-only race test; creates and deactivates disposable QA accounts."""
import os
import sys
import uuid
from pathlib import Path
from datetime import datetime,timedelta,timezone
from concurrent.futures import ThreadPoolExecutor
import httpx
if os.getenv("RUN_LIVE_COACHING")!="true":raise SystemExit("Set RUN_LIVE_COACHING=true to run the disposable local test.")
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("APP_ENV","testing")
from database import SessionLocal
import models

api="http://127.0.0.1:8000/api/v1";web="http://127.0.0.1:3002";accounts=[]
def call(action,token,body=None):
    with httpx.Client(trust_env=False,timeout=20) as client:
        return client.request("GET" if body is None else "POST",web+"/api/coaching/"+action,headers={"Origin":web,"Cookie":"trackcal_access="+token},**({"json":body}if body is not None else {}))
try:
    for index in range(3):
        with httpx.Client(trust_env=False,timeout=20)as client:
            response=client.post(api+"/auth/signup",json={"email":f"qa-coaching-live-{uuid.uuid4().hex}@tests.example.com","password":"Disposable-test-123!","display_name":"QA coach" if index==0 else "QA member"});response.raise_for_status();accounts.append(response.json())
    with SessionLocal()as db:
        for index,account in enumerate(accounts):
            user=db.get(models.User,account["user_id"]);user.email_verified=True
            if index==0:user.role=models.UserRole.professional
        db.commit()
    host=accounts[0]["access_token"]
    def publish(days):
        response=call("publish",host,{"starts_at":(datetime.now(timezone.utc)+timedelta(days=days)).replace(second=0,microsecond=0).isoformat(),"minutes":30});response.raise_for_status();return response.json()["id"]
    first=publish(2);second=publish(3)
    with ThreadPoolExecutor(max_workers=2)as pool:
        results=list(pool.map(lambda account:call("reserve",account["access_token"],{"slot_id":first}),accounts[1:]))
    assert sorted(response.status_code for response in results)==[201,409],[(r.status_code,r.text)for r in results]
    winner=next(index for index,response in enumerate(results,1)if response.status_code==201);identifier=results[winner-1].json()["id"];token=accounts[winner]["access_token"]
    assert call("move",token,{"id":identifier,"slot_id":second}).status_code==200
    assert call("cancel",token,{"id":identifier}).status_code==200
    remaining=call("slots?coach_id="+accounts[0]["user_id"],accounts[1]["access_token"]);remaining.raise_for_status();assert len(remaining.json()["slots"])==2
    print("PASS: live web proxy, exactly one reservation under a two-member race, reschedule, cancel and slot release.")
finally:
    with httpx.Client(trust_env=False,timeout=20)as client:
        for account in accounts:
            response=client.delete(api+"/users/account",headers={"Authorization":"Bearer "+account["access_token"]});response.raise_for_status()
    print("Disposable coaching accounts deactivated.")
