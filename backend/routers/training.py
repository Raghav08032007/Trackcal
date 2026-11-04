"""Reviewed exercise catalog and transactional, resumable workout sessions."""
from datetime import datetime,timezone,timedelta
from uuid import UUID
from flask_app.params import Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_active_user
from routers.personalization import plan_view
from services import personalization as rules,adventure,gamification
from services.personalization_inputs import Preferences
from services.wellness_inputs import BlueprintInput,StartSession,SessionUpdate
from services.abuse_limits import consume
import models
CATEGORIES={'walk':'endurance','chair':'mobility','strength':'bodyweight','gym':'strength','run':'endurance','mobility':'mobility','yoga':'yoga','cycle':'endurance','recovery':'recovery','camera_squat':'camera','camera_pushup':'camera','camera_curl':'camera','camera_press':'camera','camera_situp':'camera','camera_wallpush':'camera','camera_lunge':'camera','camera_jack':'camera','camera_raise':'camera','camera_knee':'camera','camera_sumo':'camera','camera_bridge':'camera','camera_calf':'camera','camera_sideleg':'camera','camera_donkey':'camera','camera_incline':'camera','camera_kneepush':'camera','camera_row':'camera','camera_superman':'camera','camera_kickback':'camera','camera_overhead':'camera','camera_hammer':'camera','camera_front':'camera','camera_uprow':'camera','camera_crunch':'camera','camera_legraise':'camera','camera_sidebend':'camera','camera_highknee':'camera','camera_burpee':'camera','camera_climber':'camera','camera_wsquat':'camera','camera_ohsquat':'camera','camera_wlunge':'camera','camera_sidelunge':'camera','camera_squatjump':'camera','camera_buttkick':'camera','camera_deadlift':'camera','camera_rdl':'camera','camera_goodmorning':'camera','camera_wcalf':'camera','camera_hipthrust':'camera','camera_bench':'camera','camera_skull':'camera','camera_revfly':'camera','camera_seatrow':'camera','camera_conccurl':'camera','camera_thruster':'camera','camera_pikepush':'camera','camera_dip':'camera','camera_pullup':'camera','camera_birddog':'camera','camera_flutter':'camera','camera_bicycle':'camera','camera_revcrunch':'camera','camera_vup':'camera','camera_punch':'camera','camera_latpull':'camera','camera_pullover':'camera','camera_kbswing':'camera','camera_legext':'camera','camera_bulgarian':'camera','camera_pistol':'camera','camera_shouldertap':'camera','camera_legcurl':'camera','camera_hspu':'camera','camera_hangleg':'camera','camera_decline':'camera','camera_nordic':'camera','camera_jumplunge':'camera','camera_tuckjump':'camera','camera_cleanpress':'camera','camera_snatch':'camera','camera_inclinebench':'camera','camera_plank':'camera','camera_wallsit':'camera','camera_bridgehold':'camera','camera_tree':'camera','camera_legbalance':'camera','camera_warrior':'camera','camera_downdog':'camera','camera_forwardfold':'camera','camera_widepush':'camera','camera_diamondpush':'camera','camera_revlunge':'camera','camera_bwgoodmorning':'camera','camera_toetouch':'camera','camera_sumojump':'camera','camera_bandcurl':'camera','camera_bandrow':'camera','camera_bandpress':'camera','camera_bandraise':'camera','camera_bandfront':'camera','camera_bandsquat':'camera','camera_bandpulldown':'camera','camera_bandkickback':'camera','camera_bbcurl':'camera','camera_bbrow':'camera','camera_bbpress':'camera','camera_bblunge':'camera','camera_frontsquat':'camera','camera_kbsquat':'camera','camera_kbdeadlift':'camera','camera_kbpress':'camera','camera_kbrow':'camera','camera_kbhighpull':'camera'}
def catalog():return [{'id':key,**t,'category':CATEGORIES[key],'movement':{'strength':'push','gym':'resistance familiarization','walk':'locomotion','run':'locomotion','cycle':'cycling'}.get(key,'comfortable range / rest'),'safety':rules.RECOVERY,'accessibility':['seated'] if t['seated'] else [] if t['floor'] else ['no_floor'],'media':None} for key,t in rules.TEMPLATES.items()]
def clock():return adventure.now().astimezone(timezone.utc).replace(tzinfo=None)
def lock(db,user):db.query(models.User).filter_by(id=user.id).with_for_update().one()
def finish(db,user,**data):db.commit();return {**data,'summary':adventure.summary(db,user)}
def require_exercises(db,user,exercises):
 if len(set(exercises))!=len(exercises) or any(key not in rules.TEMPLATES for key in exercises):raise HTTPException(422,'Choose unique exercises from the reviewed library.')
 profile=db.get(models.PersonalizationProfile,user.id)
 if profile:
  prefs=Preferences.model_validate(profile.preferences);allowed=rules.eligible_templates(prefs,include_camera=True)+['recovery']
  pain=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id,models.PlanActivity.feedback=='pain').first()
  if any(key not in allowed or pain and key!='recovery' for key in exercises):raise HTTPException(409,'Review your restrictions, equipment or pain feedback before selecting this activity. Recovery remains available.')

def elapsed(row):return min(10800,row.active_seconds+max(0,int((clock()-row.running_since).total_seconds())) if row.running_since else row.active_seconds)
def view(row):return {'id':row.id,'name':row.name,'plan_activity_id':row.plan_activity_id,'status':row.status,'revision':row.revision,'details':row.details,'minutes':row.recorded_minutes,'active_seconds':elapsed(row),'started_at':row.started_at.isoformat()+'Z','completed_at':row.completed_at.isoformat()+'Z' if row.completed_at else None}
def linked(db,user,identifier):
 activity=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.PlanActivity.id==str(identifier),models.ActivityPlan.user_id==user.id).with_for_update().first()
 if not activity:raise HTTPException(404,'Plan activity not found.')
 plan=db.get(models.ActivityPlan,activity.plan_id)
 if plan.status!='active':raise HTTPException(409,'Resume your current plan first.')
 profile=db.get(models.PersonalizationProfile,user.id)
 if not profile:raise HTTPException(409,'Complete personalized setup first.')
 from zoneinfo import ZoneInfo
 prefs=Preferences.model_validate(profile.preferences);today=adventure.now().astimezone(ZoneInfo(prefs.timezone)).date()
 if activity.scheduled_day!=str(today):raise HTTPException(409,'Choose a planned activity scheduled for today.')
 if activity.template_id!='recovery' and today.weekday() in prefs.rest_days:raise HTTPException(409,'Keep this as a chosen rest day or update your plan.')
 return activity

def exercises(q:str=Query('',max_length=100),category:str=Query('',max_length=50),equipment:str=Query('',max_length=50),offset:int=Query(0,ge=0,le=10000),limit:int=Query(12,ge=1,le=50),user=Depends(get_current_active_user)):
 result=[e for e in catalog() if (not q or q.lower() in (e['name']+' '+e['category']+' '+e['instructions']).lower()) and (not category or e['category']==category) and (not equipment or equipment in e['equipment'] or equipment=='none' and not e['equipment'])]
 return {'results':result[offset:offset+limit],'total':len(result),'has_more':offset+limit<len(result)}
def exercise(identifier:str,user=Depends(get_current_active_user)):
 item=next((e for e in catalog() if e['id']==identifier),None)
 if not item:raise HTTPException(404,'Exercise not found.')
 return item
def dashboard(offset:int=Query(0,ge=0,le=10000),limit:int=Query(20,ge=1,le=50),user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 base=db.query(models.WorkoutSession).filter_by(user_id=user.id,is_deleted=False)
 rows=base.order_by(models.WorkoutSession.started_at.desc(),models.WorkoutSession.id).offset(offset).limit(limit+1).all()
 current=base.filter(models.WorkoutSession.status.in_(['active','paused'])).order_by(models.WorkoutSession.started_at.desc()).first()
 completed=base.filter_by(status='completed')
 plans=db.query(models.ActivityPlan).filter_by(user_id=user.id).filter(models.ActivityPlan.status!='archived').order_by(models.ActivityPlan.created_at.desc()).first()
 blueprints=db.query(models.WorkoutBlueprint).filter_by(user_id=user.id).order_by(models.WorkoutBlueprint.created_at.desc()).limit(100).all()
 from zoneinfo import ZoneInfo
 profile=db.get(models.PersonalizationProfile,user.id);zone=ZoneInfo(profile.preferences.get('timezone','UTC') if profile else 'UTC');local_today=adventure.now().astimezone(zone).date()
 calendar={str(local_today-timedelta(days=i)):{'day':str(local_today-timedelta(days=i)),'count':0,'minutes':0} for i in range(6,-1,-1)}
 for record in completed.filter(models.WorkoutSession.completed_at>=clock()-timedelta(days=8)).all():
  day=record.completed_at.replace(tzinfo=timezone.utc).astimezone(zone).date().isoformat()
  if day in calendar:calendar[day]['count']+=1;calendar[day]['minutes']+=record.recorded_minutes
 summary=adventure.summary(db,user)
 return {'today':str(local_today),'calendar':list(calendar.values()),'achievements':summary.get('achievements',[]),'sessions':[view(r) for r in rows[:limit]],'has_more':len(rows)>limit,'current':view(current) if current else None,'templates':[{'id':b.id,'name':b.name,'exercises':b.exercises} for b in blueprints],'plan':plan_view(db,plans),'insights':{'completed':completed.count(),'recorded_minutes':completed.with_entities(func.sum(models.WorkoutSession.recorded_minutes)).scalar() or 0,'note':'Self-reported participation, not body or clinical outcomes.'}}
def blueprint(data:BlueprintInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'workout-blueprint',str(user.id),60,3600);lock(db,user);require_exercises(db,user,data.exercises)
 row=db.get(models.WorkoutBlueprint,str(data.id))
 if row and row.user_id!=user.id:raise HTTPException(404,'Workout not found.')
 if not row and data.name.startswith('Favorite: '):
  row=next((r for r in db.query(models.WorkoutBlueprint).filter_by(user_id=user.id,name=data.name).all() if r.exercises==data.exercises),None)
 if not row:
  if db.query(models.WorkoutBlueprint).filter_by(user_id=user.id).count()>=200:raise HTTPException(409,'Remove an old saved workout before adding another.')
  row=models.WorkoutBlueprint(id=str(data.id),user_id=user.id);db.add(row)
 row.name=data.name;row.exercises=data.exercises;db.commit();return {'id':row.id,'name':row.name,'exercises':row.exercises}
def remove_blueprint(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 row=db.query(models.WorkoutBlueprint).filter_by(id=str(identifier),user_id=user.id).first()
 if not row:raise HTTPException(404,'Workout not found.')
 db.delete(row);db.commit();return {'status':'removed'}
def start(data:StartSession,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'session-start',str(user.id),40,3600);lock(db,user)
 prior=db.get(models.WorkoutSession,str(data.id))
 if prior:
  if prior.user_id!=user.id or prior.is_deleted:raise HTTPException(404,'Session not found.')
  return finish(db,user,session=view(prior),awarded_xp=0)
 require_exercises(db,user,data.exercises)
 if data.tracking_method=='camera' and (len(data.exercises)!=1 or data.exercises[0] not in ('camera_squat','camera_pushup','camera_curl','camera_press','camera_situp','camera_wallpush','camera_lunge','camera_jack','camera_raise','camera_knee','camera_sumo','camera_bridge','camera_calf','camera_sideleg','camera_donkey','camera_incline','camera_kneepush','camera_row','camera_superman','camera_kickback','camera_overhead','camera_hammer','camera_front','camera_uprow','camera_crunch','camera_legraise','camera_sidebend','camera_highknee','camera_burpee','camera_climber','camera_wsquat','camera_ohsquat','camera_wlunge','camera_sidelunge','camera_squatjump','camera_buttkick','camera_deadlift','camera_rdl','camera_goodmorning','camera_wcalf','camera_hipthrust','camera_bench','camera_skull','camera_revfly','camera_seatrow','camera_conccurl','camera_thruster','camera_pikepush','camera_dip','camera_pullup','camera_birddog','camera_flutter','camera_bicycle','camera_revcrunch','camera_vup','camera_punch','camera_latpull','camera_pullover','camera_kbswing','camera_legext','camera_bulgarian','camera_pistol','camera_shouldertap','camera_legcurl','camera_hspu','camera_hangleg','camera_decline','camera_nordic','camera_jumplunge','camera_tuckjump','camera_cleanpress','camera_snatch','camera_inclinebench','camera_widepush','camera_diamondpush','camera_revlunge','camera_bwgoodmorning','camera_toetouch','camera_sumojump','camera_bandcurl','camera_bandrow','camera_bandpress','camera_bandraise','camera_bandfront','camera_bandsquat','camera_bandpulldown','camera_bandkickback','camera_bbcurl','camera_bbrow','camera_bbpress','camera_bblunge','camera_frontsquat','camera_kbsquat','camera_kbdeadlift','camera_kbpress','camera_kbrow','camera_kbhighpull','camera_plank','camera_wallsit','camera_bridgehold','camera_tree','camera_legbalance','camera_warrior','camera_downdog','camera_forwardfold')):raise HTTPException(422,'Choose one supported camera exercise.')
 # A camera workout is already finished when it is saved, so an open session elsewhere has no reason to block it.
 if data.tracking_method!='camera' and db.query(models.WorkoutSession).filter_by(user_id=user.id,is_deleted=False).filter(models.WorkoutSession.status.in_(['active','paused'])).first():raise HTTPException(409,'Resume or end your existing session before starting another.')
 activity=None
 if data.plan_activity_id:
  activity=linked(db,user,data.plan_activity_id)
  if activity.status=='completed':raise HTTPException(409,'This plan activity is already complete.')
  if data.exercises!=[activity.template_id]:raise HTTPException(422,'A linked session must use the planned activity or a plan-approved substitution.')
  existing=db.query(models.WorkoutSession).filter_by(plan_activity_id=activity.id).first()
  if existing:raise HTTPException(409,'This activity already has a session. Open its history rather than duplicating it.')
  activity.status='started'
 row=models.WorkoutSession(id=str(data.id),user_id=user.id,name=data.name,plan_activity_id=activity.id if activity else None,details={'exercises':[{'exercise_id':key,'sets':[]} for key in data.exercises],'notes':'','tracking_method':data.tracking_method},started_at=clock(),running_since=clock())
 db.add(row);db.flush();return finish(db,user,session=view(row),awarded_xp=0)
def get_session(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 row=db.query(models.WorkoutSession).filter_by(id=str(identifier),user_id=user.id,is_deleted=False).first()
 if not row:raise HTTPException(404,'Session not found.')
 return {'session':view(row)}
def update(identifier:UUID,data:SessionUpdate,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'session-update',str(user.id),240,3600);lock(db,user)
 row=db.query(models.WorkoutSession).filter_by(id=str(identifier),user_id=user.id,is_deleted=False).with_for_update().first()
 if not row:raise HTTPException(404,'Session not found.')
 if row.status=='completed' and data.action=='complete':return finish(db,user,session=view(row),awarded_xp=0)
 if row.revision!=data.revision:raise HTTPException(409,'This session changed elsewhere. Reload the saved version; your pending draft remains available.')
 if row.status=='abandoned' and data.action!='resume':raise HTTPException(409,'Resume this incomplete session before changing it.')
 if row.status=='abandoned' and db.query(models.WorkoutSession).filter_by(user_id=user.id,is_deleted=False).filter(models.WorkoutSession.status.in_(['active','paused'])).first():raise HTTPException(409,'End your current session before resuming this one.')
 if row.status=='completed' and data.action!='amend' or row.status!='completed' and data.action=='amend':raise HTTPException(409,'Use the appropriate history correction or session controls.')
 keys=[e.exercise_id for e in data.exercises]
 if any(k not in rules.TEMPLATES for k in keys) or len(set(keys))!=len(keys):raise HTTPException(422,'Choose unique reviewed exercises.')
 if data.action not in ('abandon','amend'):require_exercises(db,user,keys)
 if data.action=='amend' and keys!=[e['exercise_id'] for e in row.details['exercises']]:raise HTTPException(409,'Correct sets, duration or notes without rewriting the historical exercise identity.')
 activity=linked(db,user,row.plan_activity_id) if row.plan_activity_id and data.action not in ('amend','abandon') else None
 if activity and keys!=[activity.template_id]:raise HTTPException(409,'Change the linked activity in your personal plan before replacing its exercise.')
 method=row.details.get('tracking_method','manual');tracking=row.details.get('tracking')
 if method=='camera':
  if keys!=[e['exercise_id'] for e in row.details['exercises']]:raise HTTPException(409,'A camera session keeps its exercise identity. Start a separate session for another exercise.')
  if data.tracking:
   if row.status=='completed' and tracking and (any(getattr(data.tracking,k)!=tracking[k] for k in ('exercise_type','engine','version','confidence_mean','sampled_frames','low_confidence_frames')) or [s.estimated_reps for s in data.tracking.sets]!=[s['estimated_reps'] for s in tracking['sets']]):raise HTTPException(409,'Original camera estimates and confidence cannot be rewritten.')
   if 'camera_'+data.tracking.exercise_type!=keys[0]:raise HTTPException(422,'Tracking exercise does not match this session.')
   tracking=data.tracking.model_dump()
   tracking['sets']=[{k:v for k,v in s.items() if not (k=='duration_s' and v is None)} for s in tracking['sets']]
  if data.action in ('complete','amend'):
   if not tracking:raise HTTPException(422,'Review camera estimates before confirming this session.')
   sets=data.exercises[0].sets
   if len(sets)!=len(tracking['sets']):raise HTTPException(422,'Retain estimated set history when correcting camera results.')
   # Corrections through the existing manual history editor preserve the original estimates.
   tracking={**tracking,'sets':[{**estimate,'corrected_reps':s.reps if s.reps!=estimate['estimated_reps'] else None} for s,estimate in zip(sets,tracking['sets'])]}
   # For analytics only: a big correction says the camera struggled. It never changes XP.
   tracking['large_edit']=any(s['corrected_reps'] is not None and abs(s['corrected_reps']-s['estimated_reps'])>max(3,.3*s['estimated_reps']) for s in tracking['sets'])
 else:
  if data.tracking:raise HTTPException(422,'Manual sessions cannot be relabeled as camera evidence.')
 row.active_seconds=elapsed(row);row.details={'exercises':[e.model_dump() for e in data.exercises],'notes':data.notes,'tracking_method':method,**({'tracking':tracking} if tracking else {})};row.recorded_minutes=data.minutes;row.revision+=1
 if data.action=='pause':row.status='paused';row.running_since=None
 elif data.action=='resume':row.status='active';row.running_since=clock()
 elif row.status=='active':row.running_since=clock()
 points=0
 if data.action=='complete':
  row.status='completed';row.completed_at=clock();row.running_since=None
  if activity:activity.status='completed';activity.completed_at=clock()
  profile=adventure.profile(db,user,locked=True)
  if not profile:  # the first finished workout starts points and the streak, even for someone who has not opened Play
   personal=db.get(models.PersonalizationProfile,user.id)
   profile=models.AdventureProfile(user_id=user.id,timezone=(personal.preferences or {}).get('timezone') or 'UTC' if personal else 'UTC');db.add(profile);db.flush()
  if profile:points=gamification.award(db,user,'recovery' if all(k=='recovery' for k in keys) else 'workout',adventure.local_day(profile),source_id=row.plan_activity_id or row.id,payload={'tracking_method':method,'exercise':keys[0]} if method=='camera' else {})
 elif data.action=='abandon':row.status='abandoned';row.running_since=None
 return finish(db,user,session=view(row),awarded_xp=points)
def delete_session(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);row=db.query(models.WorkoutSession).filter_by(id=str(identifier),user_id=user.id,is_deleted=False).first()
 if not row:raise HTTPException(404,'Session not found.')
 if row.plan_activity_id and row.status!='completed':
  activity=db.get(models.PlanActivity,row.plan_activity_id)
  if activity and activity.status!='completed':activity.status='pending'
  row.plan_activity_id=None
 row.is_deleted=True;row.running_since=None;return finish(db,user,status='removed',awarded_xp=0)
