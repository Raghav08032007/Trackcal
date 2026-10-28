from datetime import datetime,timezone,timedelta,date
import uuid
import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from services import adventure,personalization as rules
from services.personalization_inputs import Preferences,MeasurementInput
import database,models
from tests.test_adventure import account,client

def setup(prefs=None):
 owner,headers=account();body=Preferences(**(prefs or {})).model_dump()
 response=client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':body,'step':8,'revision':0,'complete':True});assert response.status_code==200,response.text
 return owner,headers,body,response.json()
def state(headers):return client.get('/api/v1/personalization/state',headers=headers).json()
def plan(headers,revision=1):
 r=client.post('/api/v1/personalization/plans',headers=headers,json={'revision':revision});assert r.status_code==200,r.text
 return r.json()

@pytest.mark.parametrize('kind,value,unit,expected',[('height',70,'in',177.8),('weight',100,'lb',45.359237),('height',180,'cm',180),('weight',75,'kg',75),('duration',20,'minutes',20),('repetitions',15,'reps',15),('frequency',3,'days/week',3),('hydration',250,'ml',250),('sleep',8,'hours',8)])
def test_measurement_conversions(kind,value,unit,expected):assert rules.normalize_measurement(kind,value,unit)==pytest.approx(expected)
def test_bmi_arithmetic_no_classification_and_optional_inputs():
 assert rules.bmi(180,81,'20_64')['value']==25
 for age in ('under18','18_19','unspecified'):assert rules.bmi(180,81,age)['classification'] is None
 assert rules.bmi(None,81,'20_64')['value'] is None
 assert 'younger' in rules.bmi(180,81,'under18')['context']

def test_measurements_are_private_timestamped_validated_exportable_and_never_rewarded():
 owner,headers,_,_=setup();other,other_headers,_,_=setup()
 initial=state(headers);assert initial['bmi']['value'] is None
 for kind,value,unit in [('height',70,'in'),('weight',150,'lb')]:
  r=client.post('/api/v1/personalization/measurements',headers=headers,json={'kind':kind,'value':value,'unit':unit,'recorded_at':'2026-01-01T12:00:00Z'});assert r.status_code==200,r.text
 identifier=r.json()['id'];assert state(headers)['bmi']['value'] is not None
 assert state(other_headers)['measurements']==[]
 assert client.delete('/api/v1/personalization/measurements/'+identifier,headers=other_headers).status_code==404
 export=client.get('/api/v1/users/export',headers=headers).json();assert len(export['personalization']['measurements'])==2
 assert client.delete('/api/v1/personalization/measurements/'+identifier,headers=headers).status_code==200
 assert client.get('/api/v1/adventure/summary',headers=headers).json()['xp']==10
 for body in [{'kind':'height','value':0,'unit':'cm','recorded_at':'2026-01-01T12:00:00Z'},{'kind':'height','value':100,'unit':'kg','recorded_at':'2026-01-01T12:00:00Z'},{'kind':'weight','value':50,'unit':'kg','recorded_at':'2099-01-01T12:00:00Z'},{'kind':'weight','value':50,'unit':'kg','recorded_at':'2026-01-01T12:00:00'}]:
  assert client.post('/api/v1/personalization/measurements',headers=headers,json=body).status_code==422

def test_onboarding_resume_revision_conflict_and_first_time_only_rewards():
 owner,headers=account();prefs=Preferences().model_dump()
 assert state(headers)['revision']==0
 draft=client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':prefs,'step':4,'revision':0});assert draft.status_code==200
 assert not state(headers)['completed'] and state(headers)['step']==4
 assert client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':prefs,'step':4,'revision':0}).status_code==409
 done=client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':prefs,'step':8,'revision':1,'complete':True}).json();assert done['awarded_xp']==10
 again=client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':prefs,'step':8,'revision':2,'complete':True}).json();assert again['awarded_xp']==0
 assert any(a['code']=='personal_journey' and a['status']=='unlocked' for a in again['summary']['achievements'])
 assert client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':{**prefs,'timezone':'bad/zone'},'step':8,'revision':3}).status_code==422
 assert client.post('/api/v1/personalization/onboarding',headers=headers,json={'preferences':prefs,'step':8,'revision':3,'xp':999}).status_code==422

def test_plan_completion_integrates_existing_ledger_and_modifications_are_owned():
 today=adventure.now().date();owner,headers,_,_=setup({'available_days':list(range(7)),'rest_days':[],'interests':['strength']});_,other,_,_=setup()
 first=plan(headers);assert first['awarded_xp']==10
 assert any(a['code']=='first_plan' and a['status']=='unlocked' for a in first['summary']['achievements'])
 current=next(a for a in first['plan']['activities'] if a['day']==str(today));path='/api/v1/personalization/activities/'+current['id']
 assert client.post(path,headers=other,json={'action':'start'}).status_code==404
 assert client.post(path,headers=headers,json={'action':'start'}).status_code==200
 done=client.post(path,headers=headers,json={'action':'complete'}).json();assert done['awarded_xp']==20 and done['workout']['id']==current['id']
 assert client.post(path,headers=headers,json={'action':'complete'}).json()['awarded_xp']==0
 assert client.post(path,headers=headers,json={'action':'substitute','template_id':'recovery'}).status_code==409
 assert client.post(path,headers=headers,json={'action':'feedback','feedback':'comfortable'}).status_code==200
 regenerated=plan(headers);assert regenerated['awarded_xp']==0
 assert client.post('/api/v1/personalization/plans/'+regenerated['plan']['id'],headers=headers,json={'status':'paused'}).status_code==200
 next_activity=regenerated['plan']['activities'][0]
 assert client.post('/api/v1/personalization/activities/'+next_activity['id'],headers=headers,json={'action':'start'}).status_code==409
 assert client.post('/api/v1/personalization/plans/'+regenerated['plan']['id'],headers=other,json={'status':'active'}).status_code==404
 assert client.post('/api/v1/personalization/plans/'+regenerated['plan']['id'],headers=headers,json={'status':'active'}).status_code==200
 path='/api/v1/personalization/activities/'+next_activity['id']
 assert client.post(path,headers=headers,json={'action':'reschedule','day':'2099-01-01'}).status_code==422
 assert client.post(path,headers=headers,json={'action':'reschedule','day':str(today+timedelta(days=1))}).status_code==200
 assert client.post(path,headers=headers,json={'action':'substitute','template_id':'unsafe'}).status_code==422
 assert client.post(path,headers=headers,json={'action':'substitute','template_id':'recovery'}).status_code==200

def test_rule_priorities_feedback_restrictions_and_no_xp_based_progression():
 p=Preferences(interests=['running'],accessibility=['seated'],equipment=['chair'],available_days=list(range(7)),rest_days=[])
 assert rules.eligible_templates(p)==['chair']
 base,explanation=rules.generate(p,date(2026,10,26),{})
 reduced,_=rules.generate(p,date(2026,10,26),{'too_hard':True})
 assert reduced[0]['minutes']<base[0]['minutes']
 p.professional_restrictions='Follow clinician instructions'
 assert rules.eligible_templates(p)==[]
 blocked,explanation=rules.generate(p,date(2026,10,26),{'pain':True})
 assert blocked==[] and explanation['professional_review']
 assert 'XP' in ' '.join(explanation['priorities'])

def test_allergy_diet_and_unknown_medical_requirements_fail_closed():
 p=Preferences(diet='vegan',allergies=['soy'],cuisine='Indian')
 meal=rules.recommendations(p)['meals'];assert meal[0]['id']=='lentil'
 assert all('soy' not in m['allergens'] and 'vegan' in m['diet'] for m in meal)
 p.allergies=['unknown allergen'];assert rules.recommendations(p)['meals']==[]
 p.allergies=[];p.professional_restrictions='Professional medical instructions';assert rules.recommendations(p)['needs_review']

def test_education_uses_server_answers_and_cannot_reaward():
 _,headers,_,_=setup()
 for module,answer in [('planner',1),('fitness',2),('nutrition',0)]:
  assert client.post('/api/v1/personalization/education',headers=headers,json={'module':module,'answer':(answer+1)%3}).json()['awarded_xp']==0
  first=client.post('/api/v1/personalization/education',headers=headers,json={'module':module,'answer':answer}).json();assert first['awarded_xp']==10
  assert client.post('/api/v1/personalization/education',headers=headers,json={'module':module,'answer':answer}).json()['awarded_xp']==0
 assert any(a['code']=='fitness_explorer' and a['status']=='unlocked' for a in first['summary']['achievements'])

def test_in_app_reminders_timezone_quiet_hours_snooze_and_ownership(monkeypatch):
 clock=datetime(2026,10,26,3,tzinfo=timezone.utc);monkeypatch.setattr(adventure,'now',lambda:clock)
 p=Preferences(timezone='Asia/Kolkata');p.reminders.hydration.enabled=True;p.reminders.hydration.time='08:00'
 _,headers,_,_=setup(p.model_dump());_,other,_,_=setup()
 first=client.get('/api/v1/personalization/reminders',headers=headers).json()['items'];assert len(first)==1
 identifier=first[0]['id'];path='/api/v1/personalization/reminders/'+identifier
 assert client.get('/api/v1/personalization/reminders',headers=headers).json()['items'][0]['id']==identifier
 assert client.post(path,headers=other,json={'action':'dismiss'}).status_code==404
 assert client.post(path,headers=headers,json={'action':'snooze','minutes':15}).status_code==200
 assert client.get('/api/v1/personalization/reminders',headers=headers).json()['items']==[]
 clock+=timedelta(minutes=16)
 assert len(client.get('/api/v1/personalization/reminders',headers=headers).json()['items'])==1
 assert client.post(path,headers=headers,json={'action':'dismiss'}).status_code==200
 assert client.get('/api/v1/personalization/reminders',headers=headers).json()['items']==[]
 clock=datetime(2026,10,27,18,tzinfo=timezone.utc)
 assert client.get('/api/v1/personalization/reminders',headers=headers).json()['items']==[]
 assert rules.quiet('23:00','22:00','07:00') and not rules.quiet('12:00','22:00','07:00')

def test_recovery_and_youth_do_not_create_restrictive_targets():
 _,headers,_,_=setup({'age_group':'under18','rest_days':list(range(7))})
 data=plan(headers);assert all(a['template_id']=='recovery' for a in data['plan']['activities'])
 activity=next(a for a in data['plan']['activities'] if a['day']==state(headers)['today'])
 result=client.post('/api/v1/personalization/activities/'+activity['id'],headers=headers,json={'action':'complete'}).json();assert result['awarded_xp']==5 and result['workout'] is None
 assert 'calorie' not in state(headers)['preferences']
 assert client.post('/api/v1/users/onboarding/calculate-plan',headers=headers,json={'age':25}).status_code==400

@pytest.mark.parametrize('path',['state','reminders'])
def test_private_endpoints_require_authentication(path):assert client.get('/api/v1/personalization/'+path).status_code==401

def test_additive_migration_replay_preserves_records_and_configuration():
 from scripts.migrate_personalization import migrate
 assert migrate(factory=database.SessionLocal)['legacy_counts_preserved']
 assert migrate(factory=database.SessionLocal)['new_tables']==[]

@pytest.mark.parametrize('kind,value,source,target,expected',[('height',177.8,'cm','in',70),('height',70,'in','cm',177.8),('weight',45.359237,'kg','lb',100),('weight',100,'lb','kg',45.359237)])
def test_bidirectional_conversions(kind,value,source,target,expected):assert rules.convert_measurement(kind,value,source,target)==pytest.approx(expected)

def test_nonfinite_measurements_and_empty_unsafe_plans_are_rejected():
 for value in (float('nan'),float('inf')):
  with pytest.raises(ValidationError):MeasurementInput(kind='height',value=value,unit='cm',recorded_at=datetime.now(timezone.utc))
 _,headers,_,_=setup({'available_days':list(range(7)),'rest_days':[],'professional_restrictions':'Review with professional'})
 assert client.post('/api/v1/personalization/plans',headers=headers,json={'revision':1}).status_code==409

def test_feedback_can_be_reviewed_after_regeneration_without_automatic_progression():
 _,headers,_,_=setup({'available_days':list(range(7)),'rest_days':[6]})
 data=plan(headers);activity=next(a for a in data['plan']['activities'] if a['template_id']!='recovery')
 path='/api/v1/personalization/activities/'+activity['id']
 assert client.post(path,headers=headers,json={'action':'feedback','feedback':'pain'}).status_code==200
 second=plan(headers);assert second['plan']['explanation']['professional_review']
 assert state(headers)['feedback_history'][0]['feedback']=='pain'
 assert client.post(path,headers=headers,json={'action':'feedback','feedback':'comfortable'}).status_code==200
 third=plan(headers);assert not third['plan']['explanation']['professional_review']

def test_substitution_cannot_override_a_chosen_rest_day():
 _,headers,_,_=setup({'rest_days':list(range(7)),'available_days':list(range(7))})
 data=plan(headers);activity=data['plan']['activities'][0]
 assert client.post('/api/v1/personalization/activities/'+activity['id'],headers=headers,json={'action':'substitute','template_id':'walk'}).status_code==409

def test_minor_account_flag_cannot_be_overridden_by_adult_preferences():
 owner,headers,_,_=setup({'age_group':'20_64'})
 with database.SessionLocal() as db:
  db.get(models.User,owner).is_minor=True;db.commit()
 assert state(headers)['minor_account'] is True
 assert client.post('/api/v1/users/onboarding/calculate-plan',headers=headers,json={'age':28}).status_code==400
