from datetime import date,datetime,timezone,timedelta
import uuid
import pytest
from flask_app.params import HTTPException
from services import adventure,gamification
import database,models
from tests.test_adventure import account,init,client,review

def workout(owner,headers,day,identifier=None,**extra):
 body={'id':identifier or str(uuid.uuid4()),'owner_id':owner,'day':day,'name':'Gentle walk','minutes':20,'sets':0,'reps':0,'load':0,**extra}
 return client.post('/api/v1/adventure/review-workout',headers=headers,json=body)

def test_workout_idempotency_daily_cap_achievement_privacy_and_manipulation():
 owner,headers=account();other,other_headers=account();data=init(headers);init(other_headers);day=data['today'];identifier=str(uuid.uuid4())
 first=workout(owner,headers,day,identifier);assert first.status_code==200,first.text
 state=first.json()['summary'];assert first.json()['awarded_xp']==20
 assert state['engagement_streak']['current']==1
 assert {a['code'] for a in state['achievements'] if a['status']=='unlocked'}=={'first_activity','first_workout'}
 assert workout(owner,headers,day,identifier).json()['awarded_xp']==0
 assert workout(owner,headers,day).json()['awarded_xp']==0
 assert workout(owner,headers,day,xp=99999).status_code==422
 assert workout(other,headers,day).status_code==409
 assert workout(owner,headers,'2020-01-01').status_code==422
 assert workout(owner,headers,day,minutes=181).status_code==422
 assert client.get('/api/v1/adventure/summary',headers=other_headers).json()['xp']==0
 export=client.get('/api/v1/users/export',headers=headers)
 assert export.status_code==200,export.text
 assert export.json()['gamification']['activity_events']
 assert client.get('/api/v1/users/export',headers=other_headers).json()['gamification']['activity_events']==[]

def test_rule_configuration_global_cap_and_disabled_contracts():
 owner,headers=account();data=init(headers)
 with database.SessionLocal() as db:
  user=db.get(models.User,owner);rule=db.get(models.GamificationRule,'workout');rule.xp=35;rule.daily_cap=35
  db.get(models.GamificationRule,'policy').daily_cap=12;db.flush()
  assert gamification.award(db,user,'workout',date.fromisoformat(data['today']),xp=9999,source_id='validated-source')==12
  assert gamification.award(db,user,'workout',date.fromisoformat(data['today']),source_id='validated-source')==0
  db.get(models.GamificationRule,'community_contribution').enabled=True  # enabling a rule without an integration still pays nothing
  with pytest.raises(HTTPException):gamification.award(db,user,'community_contribution',date.today())
  db.commit()
 assert client.get('/api/v1/adventure/summary',headers=headers).json()['xp']==12

def test_rest_allowance_idempotence_and_configurable_protection(monkeypatch):
 owner,headers=account();clock=datetime(2026,10,26,12,tzinfo=timezone.utc);monkeypatch.setattr(adventure,'now',lambda:clock);init(headers)
 review(owner,headers,'2026-10-26')
 for day in (27,28):
  clock=datetime(2026,10,day,12,tzinfo=timezone.utc)
  result=client.post('/api/v1/adventure/rest-day',headers=headers,json={'day':f'2026-10-{day}'})
  assert result.status_code==200,result.text
  assert result.json()['awarded_xp']==0
  assert client.post('/api/v1/adventure/rest-day',headers=headers,json={'day':f'2026-10-{day}'}).status_code==200
 assert result.json()['summary']['engagement_streak']['current']==3
 assert any(a['code']=='recovery_awareness' and a['status']=='unlocked' for a in result.json()['summary']['achievements'])
 clock+=timedelta(days=1)
 assert client.post('/api/v1/adventure/rest-day',headers=headers,json={'day':'2026-10-29'}).status_code==409
 assert client.get('/api/v1/adventure/summary',headers=headers).json()['xp']==10

def test_streak_math_and_no_fake_future_rewards():
 day=date(2026,10,28)
 assert gamification.flexible_streak(['2026-10-26'],[],day)['current']==2
 assert gamification.flexible_streak(['2026-10-26'],[],day,False)['current']==0
 assert gamification.flexible_streak([],['2026-10-27'],day)['current']==0
 owner,headers=account();data=init(headers)
 assert all(a['status']=='locked' for a in data['achievements'])
 # Event attendance (Phase 9) and challenges (Phase 10) are operational, but only through verified check-ins and
 # server-computed progress (tests/test_events.py, tests/test_challenges.py), never a client call.
 assert all(not c['operational'] for c in data['integration_contracts'] if c['category'].startswith('verified_') and c['category'] not in ('verified_event_attended','verified_challenge_completed'))
 assert client.post('/api/v1/adventure/activity',headers=headers,json={'category':'verified_event_attendance','xp':999}).status_code==404

def test_customization_is_owned_persistent_and_unlock_validated():
 owner,headers=account();data=init(headers);prefs=data['customization']
 assert client.post('/api/v1/adventure/companion-settings',headers=headers,json={**prefs,'character_id':'sage'}).status_code==409
 assert client.post('/api/v1/adventure/companion-settings',headers=headers,json={**prefs,'accessory':'crown'}).status_code==409
 changed={**prefs,'position':'left','muted':True,'enabled':False,'protection_enabled':False}
 assert client.post('/api/v1/adventure/companion-settings',headers=headers,json=changed).json()['customization']==changed
 assert client.get('/api/v1/adventure/summary',headers=headers).json()['customization']==changed
 with database.SessionLocal() as db:
  db.get(models.GamificationRule,'policy').settings={'level_step':10}
  db.commit()
 result=workout(owner,headers,data['today']).json()['summary']
 assert result['level']==3 and result['level_xp']==0 and result['unlocked_companions']==['pip']  # points without the streak
 assert [m['required_streak'] for m in result['companion_unlocks']]==[0,3,7,14,21,30]
 with database.SessionLocal() as db:  # someone who unlocked Nova under the old points-only rule
  db.add(models.CharacterUnlock(user_id=result['owner_id'],character_id='nova'));db.commit()
 assert 'nova' in client.get('/api/v1/adventure/summary',headers=headers).json()['unlocked_companions']  # an earned companion is never taken away
 assert client.post('/api/v1/adventure/companion-settings',headers=headers,json={**changed,'character_id':'nova','accessory':'flower'}).json()['customization']['accessory']=='flower'


def test_repeatable_migration_preserves_legacy_records():
 from scripts.migrate_gamification import migrate
 # Tables already exist; this checks an actual repeat without dropping anything.
 first=migrate(factory=database.SessionLocal)
 second=migrate(factory=database.SessionLocal)
 assert first['legacy_counts_preserved'] and second['legacy_counts_preserved']
 assert first['new_tables']==second['new_tables']==[]
 assert first['version']=='20261028'

def test_consistency_uses_distinct_local_days_not_volume(monkeypatch):
 owner,headers=account();clock=datetime(2026,10,26,12,tzinfo=timezone.utc);monkeypatch.setattr(adventure,'now',lambda:clock);init(headers)
 for n in range(3):
  clock=datetime(2026,10,26+n,12,tzinfo=timezone.utc)
  response=workout(owner,headers,f'2026-10-{26+n}')
  achievement=next(a for a in response.json()['summary']['achievements'] if a['code']=='consistency')
  assert achievement['status']==('unlocked' if n==2 else 'in_progress')
  assert achievement['progress']==n+1

def test_timezone_streak_across_daylight_saving(monkeypatch):
 owner,headers=account();clock=datetime(2026,11,1,3,30,tzinfo=timezone.utc);monkeypatch.setattr(adventure,'now',lambda:clock)
 assert init(headers,'America/New_York')['today']=='2026-10-31'
 assert workout(owner,headers,'2026-10-31').json()['awarded_xp']==20
 clock=datetime(2026,11,1,6,30,tzinfo=timezone.utc)
 result=workout(owner,headers,'2026-11-01').json()
 assert result['awarded_xp']==20 and result['summary']['engagement_streak']['current']==2
 clock=datetime(2026,11,1,7,30,tzinfo=timezone.utc)
 assert workout(owner,headers,'2026-11-01').json()['awarded_xp']==0

def test_disabling_reward_does_not_break_the_existing_module():
 owner,headers=account();data=init(headers)
 with database.SessionLocal() as db:
  rule=db.get(models.GamificationRule,'meal');rule.enabled=False;db.commit()
 response=review(owner,headers,data['today'])
 assert response.status_code==200 and response.json()['awarded_xp']==0
 assert next(q for q in response.json()['summary']['quests'] if q['id']=='meal')['xp']==0
