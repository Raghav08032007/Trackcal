"""Authenticated Phase 2 workflows; all records scoped to the active account."""
import uuid
from datetime import datetime,timezone,date,timedelta
from zoneinfo import ZoneInfo
from flask_app.params import Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_active_user
from services import adventure,gamification,personalization as rules
from services.personalization_inputs import SaveProgress,Preferences,MeasurementInput,GeneratePlan,ActivityAction,PlanAction,ReminderAction,EducationInput
from services.abuse_limits import consume
import models

def lock(db,user):db.query(models.User).filter_by(id=user.id).with_for_update().one()
def profile(db,user,required=False):
 row=db.query(models.PersonalizationProfile).filter_by(user_id=user.id).with_for_update().first()
 if required and (not row or not row.completed_at):raise HTTPException(409,'Finish personalized onboarding first.')
 return row

def prefs_for(row):return Preferences.model_validate(row.preferences) if row else Preferences()
def local_now(prefs):return adventure.now().astimezone(ZoneInfo(prefs.timezone))
def reward(db,user,kind,source,key=None):
 journey=adventure.profile(db,user,locked=True)
 if not journey:return 0
 return gamification.award(db,user,kind,adventure.local_day(journey),source_id=source,key=key)
def result(db,user,**data):
 db.commit()
 return {**data,'summary':adventure.summary(db,user)}
def measurement_view(row,units='metric'):
 display_unit=({'height':'in','weight':'lb'} if units=='imperial' else {'height':'cm','weight':'kg'}).get(row.kind,row.unit)
 display_value=rules.convert_measurement(row.kind,row.value,row.unit,display_unit) if row.kind in ('height','weight') else row.value
 return {'id':row.id,'kind':row.kind,'value':row.value,'unit':row.unit,'canonical_value':row.canonical_value,'display_value':round(display_value,3),'display_unit':display_unit,'recorded_at':row.recorded_at.isoformat()+'Z'}

def plan_view(db,plan):
 if not plan:return None
 activities=db.query(models.PlanActivity).filter_by(plan_id=plan.id).order_by(models.PlanActivity.scheduled_day,models.PlanActivity.id).all()
 return {'id':plan.id,'week_start':plan.week_start,'status':plan.status,'explanation':plan.snapshot,'activities':[{'id':a.id,'template_id':a.template_id,'day':a.scheduled_day,'minutes':a.minutes,'status':a.status,'feedback':a.feedback,'template':{**rules.TEMPLATES[a.template_id],'recovery':rules.RECOVERY}} for a in activities]}

def state(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);row=profile(db,user);prefs=prefs_for(row)
 if not row:
  existing_profile=db.query(models.UserProfile).filter_by(user_id=user.id).first()
  if existing_profile:prefs.display_name=existing_profile.display_name or ''
 measurements=db.query(models.WellnessMeasurement).filter_by(user_id=user.id).order_by(models.WellnessMeasurement.recorded_at.desc(),models.WellnessMeasurement.created_at.desc()).limit(200).all()
 latest={}
 for item in measurements:latest.setdefault(item.kind,item.canonical_value)
 for kind in ('height','weight'):
  latest_row=db.query(models.WellnessMeasurement).filter_by(user_id=user.id,kind=kind).order_by(models.WellnessMeasurement.recorded_at.desc(),models.WellnessMeasurement.created_at.desc()).first()
  if latest_row:latest[kind]=latest_row.canonical_value
 feedback_rows=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id,models.PlanActivity.feedback.isnot(None)).order_by(models.ActivityPlan.created_at.desc()).limit(50).all()
 plan=db.query(models.ActivityPlan).filter_by(user_id=user.id).filter(models.ActivityPlan.status!='archived').order_by(models.ActivityPlan.created_at.desc(),models.ActivityPlan.id.desc()).first()
 data={'minor_account':bool(user.is_minor),'feedback_history':[{'id':a.id,'name':rules.TEMPLATES[a.template_id]['name'],'feedback':a.feedback} for a in feedback_rows],'preferences':prefs.model_dump(),'step':row.step if row else 1,'revision':row.revision if row else 0,'completed':bool(row and row.completed_at),'measurements':[measurement_view(m,prefs.units) for m in measurements],'bmi':rules.bmi(latest.get('height'),latest.get('weight'),prefs.age_group),'plan':plan_view(db,plan),'recommendations':rules.recommendations(prefs),'education':[{key:value for key,value in {'id':key,**module}.items() if key!='answer'} for key,module in rules.EDUCATION.items()],'eligible_templates':[{'id':key,**rules.TEMPLATES[key]} for key in rules.eligible_templates(prefs,include_camera=True)],'today':str(local_now(prefs).date())}
 db.commit();return data

def save_progress(data:SaveProgress,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'personalization-save',str(user.id),90,3600);lock(db,user);row=profile(db,user)
 if (row.revision if row else 0)!=data.revision:raise HTTPException(409,'Preferences changed on another page. Reload before saving; your draft is still on screen.')
 if data.complete and data.step!=8:raise HTTPException(422,'Review the final summary before finishing.')
 if not row:row=models.PersonalizationProfile(user_id=user.id,preferences=data.preferences.model_dump(),step=data.step,revision=0);db.add(row)
 row.preferences=data.preferences.model_dump();row.step=data.step;row.revision+=1
 existing=db.query(models.UserProfile).filter_by(user_id=user.id).first()
 if existing and data.preferences.display_name:existing.display_name=data.preferences.display_name
 points=0
 if data.complete and not row.completed_at:
  row.completed_at=datetime.now(timezone.utc).replace(tzinfo=None)
  if not adventure.profile(db,user,locked=True):db.add(models.AdventureProfile(user_id=user.id,timezone=data.preferences.timezone));db.flush()
  points=reward(db,user,'onboarding',str(user.id),f'v2:onboarding:{user.id}')
 return result(db,user,revision=row.revision,step=row.step,completed=bool(row.completed_at),awarded_xp=points)

def save_measurement(data:MeasurementInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'measurement-save',str(user.id),60,3600);lock(db,user)
 try:value=rules.normalize_measurement(data.kind,data.value,data.unit)
 except ValueError as error:raise HTTPException(422,str(error))
 row=models.WellnessMeasurement(user_id=user.id,kind=data.kind,value=data.value,unit=data.unit,canonical_value=value,recorded_at=data.recorded_at)
 db.add(row);db.commit();return measurement_view(row)

def remove_measurement(identifier:uuid.UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 row=db.query(models.WellnessMeasurement).filter_by(id=str(identifier),user_id=user.id).first()
 if not row:raise HTTPException(404,'Measurement not found.')
 db.delete(row);db.commit();return {'status':'removed'}

def generate_plan(data:GeneratePlan,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'plan-generate',str(user.id),20,3600);lock(db,user);row=profile(db,user,True)
 if row.revision!=data.revision:raise HTTPException(409,'Reload your updated preferences before generating.')
 prefs=prefs_for(row);today=local_now(prefs).date()
 previous=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id,models.PlanActivity.feedback.isnot(None)).all()
 feedback={'pain':any(a.feedback=='pain' for a in previous),'too_hard':any(a.feedback=='too_hard' for a in previous),'not_enjoyed':[a.template_id for a in previous if a.feedback=='not_enjoyed']}
 activities,explanation=rules.generate(prefs,today,feedback)
 if not activities and feedback['pain']:activities=[{'template_id':'recovery','scheduled_day':str(today),'minutes':5}]  # pain on the week's last open day: rest, not an error
 if not activities:raise HTTPException(409,'No eligible activity or rest days remain. Review your schedule, restrictions and rest options before creating a plan.')
 for old in db.query(models.ActivityPlan).filter_by(user_id=user.id).filter(models.ActivityPlan.status!='archived').all():old.status='archived'
 plan=models.ActivityPlan(user_id=user.id,week_start=str(today-timedelta(days=today.weekday())),snapshot=explanation);db.add(plan);db.flush()
 for activity in activities:db.add(models.PlanActivity(plan_id=plan.id,**activity))
 db.add(models.RecommendationHistory(user_id=user.id,plan_id=plan.id,explanation=explanation));db.flush()
 points=reward(db,user,'activity_plan',str(user.id),f'v2:activity_plan:{user.id}')
 view=plan_view(db,plan);return result(db,user,plan=view,awarded_xp=points)

def owned_plan(db,user,identifier):
 row=db.query(models.ActivityPlan).filter_by(id=str(identifier),user_id=user.id).with_for_update().first()
 if not row:raise HTTPException(404,'Plan not found.')
 return row
def update_plan(identifier:uuid.UUID,data:PlanAction,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);plan=owned_plan(db,user,identifier)
 if plan.status=='archived':raise HTTPException(409,'An archived plan cannot be resumed.')
 plan.status=data.status;db.commit();return {'plan':plan_view(db,plan)}

def update_activity(identifier:uuid.UUID,data:ActivityAction,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'plan-action',str(user.id),120,3600);lock(db,user);row=profile(db,user,True);prefs=prefs_for(row)
 activity=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.PlanActivity.id==str(identifier),models.ActivityPlan.user_id==user.id).with_for_update().first()
 if not activity:raise HTTPException(404,'Activity not found.')
 plan=owned_plan(db,user,activity.plan_id);points=0
 if data.action=='feedback':
  if not data.feedback:raise HTTPException(422,'Choose feedback.')
  activity.feedback=data.feedback
 else:
  if plan.status!='active':raise HTTPException(409,'Resume the active plan before changing activities.')
  if activity.status=='completed':
   if data.action=='complete':return result(db,user,awarded_xp=0,plan=plan_view(db,plan),workout=None)
   raise HTTPException(409,'Completed participation history cannot be rewritten. Record feedback instead.')
  today=local_now(prefs).date()
  if data.action in ('start','complete') and activity.scheduled_day!=str(today):raise HTTPException(422,'Start or complete activities scheduled for today in your personalization timezone.')
  if data.action in ('start','complete') and activity.template_id!='recovery':
   pain=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id,models.PlanActivity.feedback=='pain').first()
   if pain or date.fromisoformat(activity.scheduled_day).weekday() in prefs.rest_days or activity.template_id not in rules.eligible_templates(prefs,include_camera=True):raise HTTPException(409,'Review your feedback or professional restrictions before continuing. Recovery remains available.')
  if data.action=='reschedule':
   try:new_day=date.fromisoformat(data.day or '')
   except ValueError:raise HTTPException(422,'Choose a valid date.')
   if not today<=new_day<=today+timedelta(days=28):raise HTTPException(422,'Choose today or a date within 28 days.')
   if activity.template_id!='recovery' and new_day.weekday() in prefs.rest_days:raise HTTPException(409,'That is a chosen rest day. Edit preferences or choose another day.')
   activity.scheduled_day=str(new_day)
  elif data.action=='substitute':
   if data.template_id not in rules.eligible_templates(prefs,include_camera=True)+['recovery']:raise HTTPException(422,'Choose an eligible alternative from your preferences.')
   if data.template_id!='recovery' and date.fromisoformat(activity.scheduled_day).weekday() in prefs.rest_days:raise HTTPException(409,'Keep this as a rest day, or edit your preferences and reschedule first.')
   activity.template_id=data.template_id;activity.minutes=min(activity.minutes,5) if data.template_id=='recovery' else activity.minutes
  elif data.action=='skip':activity.status='skipped'
  elif data.action=='start':activity.status='started'
  elif data.action=='complete':
   activity.status='completed';activity.completed_at=datetime.now(timezone.utc).replace(tzinfo=None)
   kind='recovery' if activity.template_id=='recovery' else 'workout'
   points=reward(db,user,kind,activity.id)
 workout=None
 if data.action=='complete' and activity.template_id!='recovery':workout={'id':activity.id,'date':activity.scheduled_day,'name':rules.TEMPLATES[activity.template_id]['name'],'minutes':activity.minutes,'sets':0,'reps':0,'load':0,'source':'Personal activity plan · self-reported'}
 return result(db,user,plan=plan_view(db,plan),awarded_xp=points,workout=workout)

def education(data:EducationInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'education-check',str(user.id),30,3600);lock(db,user);profile(db,user,True)
 module=rules.EDUCATION[data.module];correct=data.answer==module['answer']
 points=reward(db,user,data.module+'_learning',f'v1:{data.module}',f'v2:lesson:{data.module}:{user.id}') if correct else 0
 return result(db,user,correct=correct,explanation=module['text'],awarded_xp=points)

def due_reminders(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);row=profile(db,user)
 if not row:return {'items':[]}
 prefs=prefs_for(row);now=local_now(prefs);day=str(now.date());clock=now.strftime('%H:%M');utc=now.astimezone(timezone.utc).replace(tzinfo=None)
 if rules.quiet(clock,prefs.reminders.quiet_start,prefs.reminders.quiet_end):return {'items':[]}
 messages={'hydration':'Consider a hydration break if it suits your needs. No universal amount is prescribed.','workout':'Review your optional planned activity. Rest or reschedule whenever needed.','recovery':'Make room for a comfortable pause.','sleep':'A reminder for your chosen wind-down routine.','motivation':'A small step or a fresh start both count.'}
 items=[]
 for category,message in messages.items():
  setting=getattr(prefs.reminders,category)
  if not setting.enabled or now.weekday() not in setting.days or clock<setting.time:continue
  if category=='motivation' and not prefs.motivation:continue
  delivery=db.query(models.ReminderDelivery).filter_by(user_id=user.id,category=category,local_day=day).with_for_update().first()
  if not delivery:delivery=models.ReminderDelivery(user_id=user.id,category=category,local_day=day);db.add(delivery);db.flush()
  if delivery.status=='dismissed' or delivery.snoozed_until and delivery.snoozed_until>utc:continue
  items.append({'id':delivery.id,'category':category,'message':message})
 db.commit();return {'items':items[:5],'timezone':prefs.timezone,'delivery':'in-app while open; no external push'}

def reminder_action(identifier:uuid.UUID,data:ReminderAction,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);delivery=db.query(models.ReminderDelivery).filter_by(id=str(identifier),user_id=user.id).with_for_update().first()
 if not delivery:raise HTTPException(404,'Reminder not found.')
 if data.action=='dismiss':delivery.status='dismissed'
 else:delivery.snoozed_until=adventure.now().astimezone(timezone.utc).replace(tzinfo=None)+timedelta(minutes=data.minutes)
 db.commit();return {'status':'saved'}
