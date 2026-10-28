from datetime import datetime,timezone,timedelta,date
import uuid
from fastapi.testclient import TestClient
from main import app
from services import adventure
import database,models

client=TestClient(app)
def account():
    response=client.post('/api/v1/auth/signup',json={'email':f'qa-play-{uuid.uuid4().hex}@tests.example.com','password':'Synthetic-play-test-123!'})
    assert response.status_code==201
    data=response.json();return data['user']['id'] if 'user' in data else client.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+data['access_token']}).json()['id'],{'Authorization':'Bearer '+data['access_token']}
def init(headers,zone='UTC'):
    response=client.post('/api/v1/adventure/initialize',headers=headers,json={'timezone':zone});assert response.status_code==200;return response.json()
def review(owner,headers,day,identifier=None):
    return client.post('/api/v1/adventure/review-meal',headers=headers,json={'id':identifier or str(uuid.uuid4()),'owner_id':owner,'day':day,'name':'Reviewed rice','calories':200,'protein':5,'carbs':40,'fat':2})

def test_daily_review_and_weekly_rewards_are_server_owned_and_idempotent(monkeypatch):
    owner,headers=account();clock=datetime(2026,10,26,12,tzinfo=timezone.utc)
    monkeypatch.setattr(adventure,'now',lambda:clock)
    assert client.get('/api/v1/adventure/summary',headers=headers).json()=={'initialized':False}
    init(headers)
    identifier=str(uuid.uuid4())
    first=review(owner,headers,'2026-10-26',identifier)
    assert first.json()['awarded_xp']==10
    assert review(owner,headers,'2026-10-26',identifier).json()['awarded_xp']==0
    assert review(owner,headers,'2026-10-26').json()['awarded_xp']==0
    assert review(owner,headers,'2026-10-25').status_code==422
    for day in (27,28):
        clock=datetime(2026,10,day,12,tzinfo=timezone.utc)
        result=review(owner,headers,f'2026-10-{day}')
    data=result.json();assert data['awarded_xp']==35
    assert data['summary']['xp']==55 and data['summary']['streak']==3
    assert data['summary']['weekly_complete']
    assert review(owner,headers,'2026-10-28').json()['awarded_xp']==0
    clock+=timedelta(days=1)
    assert client.get('/api/v1/adventure/summary',headers=headers).json()['streak']==3
    clock+=timedelta(days=1)
    assert client.get('/api/v1/adventure/summary',headers=headers).json()['streak']==0

def test_game_validates_answers_ownership_expiry_and_duplicate_rewards(monkeypatch):
    owner,headers=account();_,other=account();init(headers);init(other)
    response=client.post('/api/v1/adventure/game/start',headers=headers);assert response.status_code==200
    game=response.json();assert len(game['questions'])==3 and all('answer' not in question for question in game['questions'])
    with database.SessionLocal() as db:
        answers=[q['answer'] for q in db.get(models.GameSession,game['id']).challenge]
    body={'id':game['id'],'answers':answers}
    assert client.post('/api/v1/adventure/game/submit',headers=other,json=body).status_code==404
    wrong={'id':game['id'],'answers':[(value+1)%4 for value in answers]}
    incorrect=client.post('/api/v1/adventure/game/submit',headers=headers,json=wrong).json()
    assert incorrect['awarded_xp']==0 and incorrect['correct']==0 and len(incorrect['explanations'])==3
    first=client.post('/api/v1/adventure/game/submit',headers=headers,json=body).json();assert first['awarded_xp']==10 and first['completed']
    assert client.post('/api/v1/adventure/game/submit',headers=headers,json=body).json()['awarded_xp']==0
    second=client.post('/api/v1/adventure/game/start',headers=headers).json()
    with database.SessionLocal() as db:
        row=db.get(models.GameSession,second['id']);more=[q['answer'] for q in row.challenge]
    assert client.post('/api/v1/adventure/game/submit',headers=headers,json={'id':second['id'],'answers':more}).json()['awarded_xp']==0
    with database.SessionLocal() as db:
        db.get(models.GameSession,second['id']).expires_at=datetime.utcnow()-timedelta(seconds=1);db.commit()
    assert client.post('/api/v1/adventure/game/submit',headers=headers,json={'id':second['id'],'answers':more}).status_code==410

def test_timezone_binding_and_account_isolation(monkeypatch):
    owner,headers=account();other_id,other=account()
    monkeypatch.setattr(adventure,'now',lambda:datetime(2026,10,26,20,tzinfo=timezone.utc))
    data=init(headers,'Asia/Kolkata');assert data['today']=='2026-10-27'
    assert client.post('/api/v1/adventure/initialize',headers=headers,json={'timezone':'UTC'}).status_code==409
    assert client.post('/api/v1/adventure/initialize',headers=other,json={'timezone':'invalid/zone'}).status_code==422
    init(other)
    assert review(other_id,headers,data['today']).status_code==409
    identifier=str(uuid.uuid4());assert review(owner,headers,data['today'],identifier).status_code==200
    assert review(other_id,other,'2026-10-26',identifier).status_code==409
    assert client.get('/api/v1/adventure/summary',headers=other).json()['xp']==0
    assert client.get('/api/v1/adventure/summary').status_code==401

def test_streak_date_math_crosses_year_and_does_not_count_future_days():
    assert adventure.streak_days(['2025-12-31','2026-01-01','2026-01-02','2099-01-01'],date(2026,1,3))==(3,3)
    assert adventure.streak_days([],date(2026,1,3))==(0,0)

def test_planner_awards_only_after_feasible_result_and_only_once():
    _,headers=account();init(headers)
    foods=[{'id':str(index),'name':f'Recipe {index}','calories':600,'protein':30,'carbs':50,'fat':10,'cost':50,'minutes':20,'tags':[]} for index in range(3)]
    data={'foods':foods,'slots':3,'calories_min':1600,'calories_max':2000,'protein_min':60,'budget':200}
    for _ in range(2): assert client.post('/api/v1/integrations/plan',headers=headers,json=data).status_code==200
    progress=client.get('/api/v1/adventure/summary',headers=headers).json()
    assert progress['xp']==10 and progress['streak']==0
    assert next(q for q in progress['quests'] if q['id']=='plan')['complete']

def test_dst_fall_back_does_not_create_a_second_daily_reward(monkeypatch):
    owner,headers=account();clock=datetime(2026,11,1,5,30,tzinfo=timezone.utc)
    monkeypatch.setattr(adventure,'now',lambda:clock)
    init(headers,'America/New_York')
    assert review(owner,headers,'2026-11-01').json()['awarded_xp']==10
    clock=datetime(2026,11,1,6,30,tzinfo=timezone.utc)
    assert review(owner,headers,'2026-11-01').json()['awarded_xp']==0

def test_forged_xp_is_ignored_and_game_attempts_are_bounded():
    _,headers=account();init(headers)
    session=client.post('/api/v1/adventure/game/start',headers=headers).json()
    with database.SessionLocal() as db:
        correct=[q['answer'] for q in db.get(models.GameSession,session['id']).challenge]
    wrong=[(answer+1)%4 for answer in correct]
    for _ in range(10): assert client.post('/api/v1/adventure/game/submit',headers=headers,json={'id':session['id'],'answers':wrong,'xp':999999}).status_code==200
    assert client.post('/api/v1/adventure/game/submit',headers=headers,json={'id':session['id'],'answers':correct}).status_code==429
    assert client.get('/api/v1/adventure/summary',headers=headers).json()['xp']==0

def test_account_export_includes_own_adventure_but_not_other_accounts():
    owner,headers=account();_,other=account();day=init(headers)['today']
    assert review(owner,headers,day).status_code==200
    own=client.get('/api/v1/users/export',headers=headers).json()['adventure']
    assert own['profile']['user_id']==owner and len(own['rewards'])==1
    assert own['reviewed_meals'][0]['snapshot']['name']=='Reviewed rice'
    assert client.get('/api/v1/users/export',headers=other).json()['adventure']['rewards']==[]


def test_companion_unlock_thresholds():
    from services.adventure import unlocked_companions
    assert unlocked_companions(0) == ['pip']
    assert unlocked_companions(249) == ['pip']
    for level in range(2,7):
        xp=(level-1)*250
        assert unlocked_companions(xp) == ['pip','nova','milo','luna','rio','sage'][:level]
        assert len(unlocked_companions(xp-1)) == level-1


def test_complete_day_streak_requires_every_daily_quest(monkeypatch):
    owner,headers=account()
    monkeypatch.setattr(adventure,'now',lambda:datetime(2026,10,28,12,tzinfo=timezone.utc))
    init(headers)
    with database.SessionLocal() as db:
        for day in ('2026-10-26','2026-10-27','2026-10-28'):
            for kind in (('meal',) if day.endswith('28') else ('meal','plan','quiz')):
                db.add(models.RewardEvent(user_id=owner,reward_key=f'task-test:{kind}:{day}',kind=kind,local_day=day,xp=10))
        db.commit()
    data=client.get('/api/v1/adventure/summary',headers=headers).json()
    assert data['task_streak']==2 and data['daily_goal']=={'complete':1,'total':3,'day_complete':False}
    assert data['streak']==3
    with database.SessionLocal() as db:
        for kind in ('plan','quiz'):
            db.add(models.RewardEvent(user_id=owner,reward_key=f'task-test:{kind}:2026-10-28',kind=kind,local_day='2026-10-28',xp=10))
        db.commit()
    data=client.get('/api/v1/adventure/summary',headers=headers).json()
    assert data['task_streak']==3 and data['best_task_streak']==3 and data['daily_goal']['day_complete']
    assert data['completed_days']==['2026-10-26','2026-10-27','2026-10-28']
    monkeypatch.setattr(adventure,'now',lambda:datetime(2026,10,30,12,tzinfo=timezone.utc))
    data=client.get('/api/v1/adventure/summary',headers=headers).json()
    assert data['task_streak']==0 and data['best_task_streak']==3
