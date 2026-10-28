from datetime import datetime,timezone,timedelta
from pathlib import Path
import uuid
import pytest
from tests.test_adventure import account,client,init
import database,models
from services import adventure
from services.wellness_inputs import SessionUpdate

def food(name='Synthetic reviewed food',**extra):return {'name':name,'grams':150,'nutrients':{'calories':200,'protein':10,'carbs':25,'fat':5},'source':'Synthetic test input',**extra}
def diary(headers,**extra):return {'id':str(uuid.uuid4()),'day':client.get('/api/v1/wellness/diary',headers=headers).json()['today'],'meal_type':'lunch','items':[food()],**extra}
def session(headers,keys=None,**extra):
 body={'id':str(uuid.uuid4()),'name':'Synthetic session','exercises':keys or ['walk'],**extra};r=client.post('/api/v1/wellness/sessions',headers=headers,json=body);assert r.status_code==200,r.text
 return r.json()['session']
def update(headers,s,action='complete',**extra):
 return client.put('/api/v1/wellness/sessions/'+s['id'],headers=headers,json={'revision':s['revision'],'action':action,'minutes':10,'notes':'Synthetic notes','exercises':s['details']['exercises'],**extra})

def test_diary_crud_portions_ownership_unknowns_and_idempotent_rewards():
 owner,h=account();_,other=account();init(h);init(other);body=diary(h)
 r=client.post('/api/v1/wellness/diary',headers=h,json=body);assert r.status_code==200,r.text
 saved=r.json();assert saved['awarded_xp']==10 and saved['entry']['totals']['calories']==300
 assert client.post('/api/v1/wellness/diary',headers=h,json=body).json()['awarded_xp']==0
 assert client.post('/api/v1/wellness/diary',headers=other,json=body).status_code==404
 body['items'][0]['grams']=50
 assert client.put('/api/v1/wellness/diary/'+body['id'],headers=h,json=body).json()['entry']['totals']['calories']==100
 assert client.put('/api/v1/wellness/diary/'+body['id'],headers=other,json=body).status_code==404
 unknown=diary(h,items=[food(nutrients={'calories':None,'protein':None,'carbs':None,'fat':None})]);r=client.post('/api/v1/wellness/diary',headers=h,json=unknown)
 assert r.json()['entry']['totals']['calories'] is None and r.json()['awarded_xp']==0
 assert client.delete('/api/v1/wellness/diary/'+body['id'],headers=other).status_code==404
 assert client.delete('/api/v1/wellness/diary/'+body['id'],headers=h).status_code==200
 assert not any(e['id']==body['id'] for e in client.get('/api/v1/wellness/diary',headers=h).json()['entries'])
 assert client.get('/api/v1/adventure/summary',headers=h).json()['xp']==10

def test_food_alias_search_pagination_and_catalog_values_cannot_be_forged():
 owner,h=account();init(h)
 with database.SessionLocal() as db:
  f=models.Food(name='Synthetic Dosa',name_normalized='dosa',data_source=models.NutritionDataSource.usda,is_verified=True,category='regional',serving_size_g=100);db.add(f);db.flush()
  definition=db.query(models.NutrientDefinition).filter_by(slug='energy_kcal').first()
  if not definition:definition=models.NutrientDefinition(name='Energy',slug='energy_kcal',unit='kcal');db.add(definition);db.flush()
  db.add(models.FoodNutrient(food_id=f.id,nutrient_def_id=definition.id,amount_per_100g=120));db.add(models.FoodAlias(food_id=f.id,alias='dosai'));identifier=f.id;db.commit()
 r=client.get('/api/v1/wellness/foods?q=dosai&category=regional&limit=1',headers=h);assert r.status_code==200
 assert r.json()['matched_term']=='dosa' and any(i['food_id']==identifier for i in r.json()['results'])
 r=client.get('/api/v1/wellness/foods/'+identifier,headers=h);assert r.json()['nutrients']['calories']==120
 body=diary(h,items=[food(food_id=identifier,nutrients={'calories':999,'protein':None,'carbs':None,'fat':None})]);saved=client.post('/api/v1/wellness/diary',headers=h,json=body).json();assert saved['entry']['totals']['calories']==180
 assert saved['entry']['totals']['protein'] is None
 assert client.get('/api/v1/wellness/foods?offset=-1',headers=h).status_code==422

def test_owned_favorites_saved_meals_and_first_time_only_badge():
 _,h=account();_,other=account();init(h);init(other)
 favorite={'food_key':'synthetic:rice','item':food()}
 for _ in range(2):assert client.post('/api/v1/wellness/favorites',headers=h,json=favorite).status_code==200
 data=client.get('/api/v1/wellness/diary',headers=h).json();assert len(data['favorites'])==1
 identifier=data['favorites'][0]['id'];assert client.delete('/api/v1/wellness/favorites/'+identifier,headers=other).status_code==404
 body={'id':str(uuid.uuid4()),'name':'Synthetic combination','items':[food(),food('Second reviewed food')],'meal_type':'lunch'}
 first=client.post('/api/v1/wellness/saved-meals',headers=h,json=body);assert first.status_code==200,first.text
 assert first.json()['awarded_xp']==10 and any(a['code']=='food_explorer' and a['status']=='unlocked' for a in first.json()['summary']['achievements'])
 assert client.post('/api/v1/wellness/saved-meals',headers=h,json=body).json()['awarded_xp']==0
 body['id']=str(uuid.uuid4());assert client.post('/api/v1/wellness/saved-meals',headers=h,json=body).json()['awarded_xp']==0
 assert client.delete('/api/v1/wellness/saved-meals/'+body['id'],headers=other).status_code==404
 assert client.get('/api/v1/wellness/diary',headers=other).json()['saved_meals']==[]

@pytest.mark.parametrize('patch',[{'items':[food(grams=0)]},{'items':[food(grams=-1)]},{'items':[]},{'xp':999},{'day':'2099-01-01'}])
def test_invalid_diary_input_does_not_write(patch):
 _,h=account();init(h);r=client.post('/api/v1/wellness/diary',headers=h,json=diary(h,**patch));assert r.status_code==422,r.text

def test_exercise_search_details_blueprints_and_unknown_techniques():
 _,h=account();_,other=account()
 result=client.get('/api/v1/wellness/exercises?category=mobility',headers=h).json();assert result['results'] and all(e['category']=='mobility' and e['safety'] for e in result['results'])
 assert client.get('/api/v1/wellness/exercises/walk',headers=h).json()['movement']=='locomotion'
 body={'id':str(uuid.uuid4()),'name':'Synthetic saved workout','exercises':['walk','mobility']}
 assert client.post('/api/v1/wellness/templates',headers=h,json=body).status_code==200
 assert client.post('/api/v1/wellness/templates',headers=other,json=body).status_code==404
 assert client.delete('/api/v1/wellness/templates/'+body['id'],headers=other).status_code==404
 assert client.post('/api/v1/wellness/templates',headers=h,json={**body,'exercises':['unsafe invented technique']}).status_code==422

def test_session_pause_resume_sets_history_amend_and_retry_rewards(monkeypatch):
 _,h=account();init(h);s=session(h);identifier=s['id'];assert s['status']=='active'
 clock=adventure.now();monkeypatch.setattr(adventure,'now',lambda:clock+timedelta(seconds=75))
 paused=update(h,s,'pause').json()['session'];assert paused['active_seconds']>=74 and paused['status']=='paused'
 resumed=update(h,paused,'resume').json()['session'];assert resumed['status']=='active'
 records=[{'exercise_id':'walk','sets':[{'reps':8,'load':0,'minutes':2}]}]
 done=update(h,resumed,exercises=records);assert done.status_code==200,done.text
 assert done.json()['awarded_xp']==20 and done.json()['session']['details']['exercises'][0]['sets'][0]['reps']==8
 assert update(h,resumed,exercises=records).json()['awarded_xp']==0
 amended=update(h,done.json()['session'],'amend',minutes=12);assert amended.status_code==200 and amended.json()['awarded_xp']==0
 history=client.get('/api/v1/wellness/training',headers=h).json();assert history['insights']['completed']==1 and history['insights']['recorded_minutes']==12
 second=session(h);assert update(h,second).json()['awarded_xp']==0

def test_session_conflicts_ownership_incomplete_and_recovery():
 _,h=account();_,other=account();init(h);init(other);s=session(h,['recovery'])
 assert update(other,s).status_code==404
 assert client.get('/api/v1/wellness/sessions/'+s['id'],headers=other).status_code==404
 assert client.post('/api/v1/wellness/sessions',headers=h,json={'id':str(uuid.uuid4()),'name':'Second simultaneous','exercises':['walk']}).status_code==409
 assert update(h,s,'save',revision=999).status_code==409
 assert update(h,s,minutes=0).status_code==422
 abandoned=update(h,s,'abandon').json()['session'];assert abandoned['status']=='abandoned'
 resumed=update(h,abandoned,'resume').json()['session'];assert resumed['status']=='active'
 assert update(h,resumed).json()['awarded_xp']==5
 assert client.delete('/api/v1/wellness/sessions/'+s['id'],headers=other).status_code==404
 assert client.delete('/api/v1/wellness/sessions/'+s['id'],headers=h).status_code==200

@pytest.mark.parametrize('sets',[{'reps':101,'load':0,'minutes':0},{'reps':1,'load':501,'minutes':0},{'reps':1.5,'load':0,'minutes':0}])
def test_invalid_sets_are_rejected(sets):
 _,h=account();s=session(h)
 assert update(h,s,exercises=[{'exercise_id':'walk','sets':[sets]}]).status_code==422

def test_new_history_export_and_authentication():
 _,h=account();_,other=account();init(h);s=session(h);update(h,s)
 assert len(client.get('/api/v1/users/export',headers=h).json()['phase3']['workout_sessions'])==1
 assert client.get('/api/v1/users/export',headers=other).json()['phase3']['workout_sessions']==[]
 for path in ['diary','foods','training','exercises']:assert client.get('/api/v1/wellness/'+path).status_code==401

def test_phase3_migration_replay_preserves_legacy_records():
 from scripts.migrate_wellness import migrate
 assert migrate(factory=database.SessionLocal)['legacy_counts_preserved']
 assert migrate(factory=database.SessionLocal)['new_tables']==[]

def test_linked_plan_completion_shares_reward_source_and_marks_plan_once():
 from tests.test_personalization import setup,plan
 _,h,_,_=setup({'available_days':list(range(7)),'rest_days':[]})
 data=plan(h);today=client.get('/api/v1/personalization/state',headers=h).json()['today']
 activity=next(a for a in data['plan']['activities'] if a['day']==today)
 s=session(h,[activity['template_id']],plan_activity_id=activity['id'])
 done=update(h,s);assert done.status_code==200,done.text
 assert done.json()['awarded_xp']==20
 repeated=client.post('/api/v1/personalization/activities/'+activity['id'],headers=h,json={'action':'complete'});assert repeated.json()['awarded_xp']==0
 with database.SessionLocal() as db:assert db.query(models.RewardEvent).filter_by(user_id=done.json()['summary']['owner_id'],kind='workout').count()==1

def test_photo_requires_real_provider_consent_and_owned_image_deletion(monkeypatch,tmp_path):
 from routers import ai_scan
 owner,h=account();_,other=account()
 fixture=Path(__file__).parent/'fixtures/nutrition-label.png'
 monkeypatch.setattr(ai_scan,'MOCK_MODE',False)
 response=client.post('/api/v1/scan/photo',headers=h,files={'file':('photo.png',fixture.read_bytes(),'image/png')})
 assert response.status_code==400 and 'consent' in response.json()['detail'].lower()
 monkeypatch.setattr(ai_scan,'STORAGE_PATH',tmp_path)
 path=tmp_path/(owner+'_synthetic.png');path.write_bytes(fixture.read_bytes())
 with database.SessionLocal() as db:
  image=models.FoodImage(user_id=owner,storage_path=str(path));db.add(image);db.commit();identifier=image.id
 assert client.delete('/api/v1/scan/images/'+identifier,headers=other).status_code==404
 assert client.delete('/api/v1/scan/images/'+identifier,headers=h).status_code==200
 assert not path.exists()

def test_repeated_exercise_favorite_has_one_saved_blueprint():
 _,h=account()
 for _ in range(2):
  assert client.post('/api/v1/wellness/templates',headers=h,json={'id':str(uuid.uuid4()),'name':'Favorite: Comfortable walk','exercises':['walk']}).status_code==200
 assert len(client.get('/api/v1/wellness/training',headers=h).json()['templates'])==1

def test_manual_photo_review_is_not_mislabeled_as_ai_recognition():
 _,h=account();init(h)
 body=diary(h,method='photo',items=[food(estimated=True,source='Manual selection from local photo')])
 response=client.post('/api/v1/wellness/diary',headers=h,json=body);assert response.status_code==200
 with database.SessionLocal() as db:
  item=db.query(models.MealItem).filter_by(meal_log_id=body['id']).one()
  assert item.data_source==models.NutritionDataSource.user_created and not item.is_ai_estimated
 assert response.json()['entry']['items'][0]['estimated'] is True
