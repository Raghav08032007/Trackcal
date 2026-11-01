import uuid
import pytest
from tests.test_adventure import account,client,init
from tests.test_wellness import session,update
import models,database

def tracking(**patch):return {'exercise_type':'squat','engine':'mediapipe-pose-lite','version':1,'confidence_mean':.8,'sampled_frames':100,'low_confidence_frames':10,'sets':[{'estimated_reps':3,'corrected_reps':4}],**patch}
def records(reps=4):return [{'exercise_id':'camera_squat','sets':[{'reps':reps,'load':0,'minutes':0}]}]

def test_camera_confirmation_history_correction_owned_and_idempotent():
 _,h=account();_,other=account();init(h);init(other)
 s=session(h,['camera_squat'],tracking_method='camera');r=update(h,s,tracking=tracking(),exercises=records());assert r.status_code==200,r.text
 done=r.json();assert done['awarded_xp']==20;assert done['session']['details']['tracking']['sets']==[{'estimated_reps':3,'corrected_reps':4}]
 assert any(a['code']=='first_camera' and a['status']=='unlocked' for a in done['summary']['achievements'])
 assert update(h,s,tracking=tracking(),exercises=records()).json()['awarded_xp']==0
 assert client.get('/api/v1/wellness/sessions/'+s['id'],headers=other).status_code==404
 assert update(other,s,tracking=tracking(),exercises=records()).status_code==404
 changed=update(h,done['session'],'amend',exercises=records(5));assert changed.status_code==200,changed.text
 assert changed.json()['session']['details']['tracking']['sets'][0]=={'estimated_reps':3,'corrected_reps':5}
 assert update(h,changed.json()['session'],'amend',exercises=records(5),tracking=tracking(sets=[{'estimated_reps':99,'corrected_reps':5}])).status_code==409
 assert client.get('/api/v1/wellness/training',headers=h).json()['insights']['completed']==1

@pytest.mark.parametrize('patch',[{'confidence_mean':1.1},{'sampled_frames':-1},{'low_confidence_frames':101},{'landmarks':[[1,2,3]]},{'video':'data:video/mp4;base64,test'},{'sets':[{'estimated_reps':101,'corrected_reps':0}]},{'exercise_type':'unsupported'},{'sampled_frames':0,'low_confidence_frames':0,'confidence_mean':.4}])
def test_camera_metadata_validation_no_raw_pose_or_video(patch):
 _,h=account();init(h);s=session(h,['camera_squat'],tracking_method='camera');assert update(h,s,tracking=tracking(**patch),exercises=records()).status_code==422

def test_incomplete_manual_and_camera_share_daily_reward_cap():
 _,h=account();init(h);s=session(h,['camera_squat'],tracking_method='camera')
 assert update(h,s).status_code==422
 paused=update(h,s,'pause').json()['session'];assert paused['status']=='paused'
 assert client.get('/api/v1/adventure/summary',headers=h).json()['xp']==0
 assert update(h,paused,tracking=tracking(),exercises=records()).json()['awarded_xp']==20
 manual=session(h);assert update(h,manual).json()['awarded_xp']==0
 second=session(h,['camera_squat'],tracking_method='camera');assert update(h,second,tracking=tracking(),exercises=records()).json()['awarded_xp']==0
 assert client.get('/api/v1/adventure/summary',headers=h).json()['xp']==20

def test_manual_session_cannot_claim_camera_metadata_or_client_xp():
 _,h=account();init(h);s=session(h);assert update(h,s,tracking=tracking()).status_code==422
 assert update(h,s,xp=10000).status_code==422
 assert update(h,s).json()['awarded_xp']==20

def test_camera_start_and_identity_bounds():
 _,h=account();init(h)
 r=client.post('/api/v1/wellness/sessions',headers=h,json={'id':str(uuid.uuid4()),'name':'Bad mode','exercises':['walk'],'tracking_method':'camera'});assert r.status_code==422
 s=session(h,['camera_squat'],tracking_method='camera');assert update(h,s,tracking=tracking(exercise_type='curl'),exercises=records()).status_code==422
 assert update(h,s,'save',exercises=[{'exercise_id':'camera_curl','sets':[]}]).status_code==409

def test_camera_migration_replay_preserves_sessions():
 from scripts.migrate_camera import migrate
 with database.SessionLocal() as db:before=db.query(models.WorkoutSession).count()
 for _ in range(2):assert migrate(factory=database.SessionLocal)['legacy_counts_preserved']
 with database.SessionLocal() as db:assert db.query(models.WorkoutSession).count()==before

def test_explicit_plan_camera_substitution_completes_same_activity_once():
 from tests.test_personalization import setup,state
 from services import adventure
 owner,h,prefs,_=setup({'available_days':[0,1,2,3,4,5,6],'rest_days':[]})
 r=client.post('/api/v1/personalization/plans',headers=h,json={'revision':1});assert r.status_code==200,r.text
 view=state(h);today=view['today'];activity=next(a for a in view['plan']['activities'] if a['day']==today)
 changed=client.post('/api/v1/personalization/activities/'+activity['id'],headers=h,json={'action':'substitute','template_id':'camera_squat'});assert changed.status_code==200,changed.text
 s=session(h,['camera_squat'],tracking_method='camera',plan_activity_id=activity['id'])
 done=update(h,s,tracking=tracking(),exercises=records());assert done.status_code==200,done.text
 assert next(a for a in state(h)['plan']['activities'] if a['id']==activity['id'])['status']=='completed'
 repeated=client.post('/api/v1/personalization/activities/'+activity['id'],headers=h,json={'action':'complete'});assert repeated.status_code==200 and repeated.json()['awarded_xp']==0

def test_camera_exercises_respect_restrictions_and_are_not_automatically_prescribed():
 from services.personalization_inputs import Preferences
 from services import personalization as rules
 assert not any(k.startswith('camera_') for k in rules.eligible_templates(Preferences()))
 assert 'camera_squat' in rules.eligible_templates(Preferences(),include_camera=True)
 assert 'camera_pushup' not in rules.eligible_templates(Preferences(accessibility=['no_floor']),include_camera=True)
 assert 'camera_curl' not in rules.eligible_templates(Preferences(),include_camera=True)
 assert rules.eligible_templates(Preferences(professional_restrictions='Review first'),include_camera=True)==[]


def test_counter_v2_keeps_set_durations_and_flags_large_corrections_without_changing_xp():
 _,h=account();init(h)
 s=session(h,['camera_squat'],tracking_method='camera')
 r=update(h,s,tracking=tracking(version=2,sets=[{'estimated_reps':3,'corrected_reps':None,'duration_s':41.5}]),exercises=records(12))
 assert r.status_code==200,r.text
 saved=r.json()['session']['details']['tracking']
 assert saved['version']==2 and saved['sets']==[{'estimated_reps':3,'corrected_reps':12,'duration_s':41.5}] and saved['large_edit'] is True
 assert r.json()['awarded_xp']==20
 small=session(h,['camera_squat'],tracking_method='camera')
 r=update(h,small,tracking=tracking(version=2),exercises=records(4))
 assert r.json()['session']['details']['tracking']['large_edit'] is False


@pytest.mark.parametrize('bad',[{'version':3},{'sets':[{'estimated_reps':3,'corrected_reps':None,'duration_s':-1}]},{'sets':[{'estimated_reps':3,'corrected_reps':None,'frames':[1,2]}]}])
def test_camera_summary_rejects_unknown_versions_bad_durations_and_extra_data(bad):
 _,h=account();init(h)
 s=session(h,['camera_squat'],tracking_method='camera')
 assert update(h,s,tracking=tracking(**bad),exercises=records()).status_code==422

def test_wall_push_camera_session_saves():
 _,h=account();init(h);s=session(h,['camera_wallpush'],tracking_method='camera')
 r=update(h,s,tracking=tracking(exercise_type='wallpush'),exercises=[{'exercise_id':'camera_wallpush','sets':[{'reps':6,'load':0,'minutes':0}]}]);assert r.status_code==200,r.text


def test_an_open_manual_workout_does_not_block_saving_a_camera_result():
 _,h=account();init(h);session(h,['strength'])
 s=session(h,['camera_squat'],tracking_method='camera');r=update(h,s,tracking=tracking(),exercises=records());assert r.status_code==200,r.text


def test_the_first_finished_workout_starts_points_and_the_streak_without_opening_play():
 _,h=account()
 s=session(h,['camera_squat'],tracking_method='camera');r=update(h,s,tracking=tracking(),exercises=records());assert r.status_code==200,r.text
 body=r.json();assert body['awarded_xp']==20 and body['summary']['engagement_streak']['current']==1


@pytest.mark.parametrize('kind', ['lunge', 'jack', 'raise', 'knee'])
def test_new_camera_exercises_save(kind):
 _,h=account();init(h);key='camera_'+kind;s=session(h,[key],tracking_method='camera')
 r=update(h,s,tracking=tracking(exercise_type=kind),exercises=[{'exercise_id':key,'sets':[{'reps':8,'load':0,'minutes':0}]}]);assert r.status_code==200,r.text
