"""Authenticated Phase 2 workflows; all records scoped to the active account."""
import uuid
from typing import Literal
from pydantic import BaseModel, Field
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
 prefs=effective(db,user,prefs_for(row));today=local_now(prefs).date()
 previous=db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id,models.PlanActivity.feedback.isnot(None)).all()
 feedback={'pain':any(a.feedback=='pain' for a in previous),'too_hard':any(a.feedback=='too_hard' for a in previous),'not_enjoyed':[a.template_id for a in previous if a.feedback=='not_enjoyed']}
 from routers.health import latest_assessment
 activities,explanation=rules.generate(prefs,today,feedback,report=latest_assessment(db,user))
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


class TargetInput(BaseModel):
    """A manual value for any target; null clears it so the calculated value returns."""
    calories:int|None=None
    protein:int|None=None
    carbs:int|None=None
    fat:int|None=None


def latest_weight(db,user):
    row=db.query(models.WellnessMeasurement).filter_by(user_id=user.id,kind='weight').order_by(models.WellnessMeasurement.recorded_at.desc()).first()
    return row.canonical_value if row else None


def targets(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    """Daily food targets from the profile, the latest weigh-in and the health report (services/targets.py)."""
    from services import targets as calc
    from routers.health import assessment
    row=db.get(models.PersonalizationProfile,user.id);prefs=prefs_for(row)
    report=db.query(models.LabReport).filter_by(user_id=user.id).order_by(models.LabReport.report_date.desc(),models.LabReport.created_at.desc()).first()
    plan=(assessment(db,user,report) or {}).get('plan') if report else None
    return calc.compute(prefs,latest_weight(db,user),plan,minor=bool(user.is_minor))


def set_targets(data:TargetInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    lock(db,user);row=db.get(models.PersonalizationProfile,user.id)
    if not row:row=models.PersonalizationProfile(user_id=user.id,preferences=Preferences().model_dump(),step=1,revision=0);db.add(row)
    prefs=prefs_for(row).model_dump()
    override={**prefs.get('target_override',{}),**{k:v for k,v in data.model_dump(exclude_unset=True).items()}}
    prefs['target_override']={k:v for k,v in override.items() if v}
    try:checked=Preferences.model_validate(prefs)
    except ValueError as failure:raise HTTPException(422,str(failure).split('\n')[-1][:200])
    row.preferences=checked.model_dump();row.revision+=1;db.commit()
    return targets(user,db)


# ── One day of water, movement, calories burned, sleep and mood (services/wellness_days.py) ──
from services import wellness_days as days_rules
from services.wellness_days import DayUpdate, DayImport


def day_context(db,user):
    prefs=prefs_for(db.get(models.PersonalizationProfile,user.id));return prefs.timezone,latest_weight(db,user) or prefs.weight_kg


def checked_day(day,tz):
    try:return days_rules.check_day(day,tz)
    except ValueError as failure:raise HTTPException(422,str(failure))


def day_view(db,user,day,row=None,missing=False):
    tz,weight=day_context(db,user)
    if row is None and not missing:row=db.query(models.DailyWellness).filter_by(user_id=user.id,day=day).first()
    return days_rules.view(day,row,weight,days_rules.routes_by_day(db,user.id,tz,day,day,weight).get(day,0))


def recent_days(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    """The last 35 days, newest first, with blanks for days nothing was logged."""
    tz,weight=day_context(db,user);today=local_now(prefs_for(db.get(models.PersonalizationProfile,user.id))).date()
    keys=[(today-timedelta(days=n)).isoformat() for n in range(days_rules.HISTORY_DAYS)]
    rows={r.day:r for r in db.query(models.DailyWellness).filter(models.DailyWellness.user_id==user.id,models.DailyWellness.day>=keys[-1],models.DailyWellness.day<=keys[0])}
    routes=days_rules.routes_by_day(db,user.id,tz,keys[-1],keys[0],weight)
    zone=ZoneInfo(tz);start=datetime.combine(date.fromisoformat(keys[-1]),datetime.min.time(),zone).astimezone(timezone.utc).replace(tzinfo=None)
    meals={}
    for (at,) in db.query(models.MealLog.logged_at).filter(models.MealLog.user_id==user.id,models.MealLog.is_deleted.is_(False),models.MealLog.logged_at>=start):
        key=at.replace(tzinfo=timezone.utc).astimezone(zone).date().isoformat();meals[key]=meals.get(key,0)+1
    return {'today':keys[0],'days':[{**days_rules.view(k,rows.get(k),weight,routes.get(k,0)),'meals':meals.get(k,0)} for k in keys]}


def get_day(day:str,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if day=='import':raise HTTPException(404,'Not found')
    tz,_=day_context(db,user);return day_view(db,user,checked_day(day,tz))


def update_day(day:str,data:DayUpdate,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if day=='import':raise HTTPException(404,'Not found')
    tz,_=day_context(db,user);day=checked_day(day,tz)
    row=days_rules.row_for(db,user.id,day);days_rules.apply(row,data);db.commit()
    return day_view(db,user,day,row)


def import_days(data:DayImport,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    """Days that were only kept in this browser, copied once; the account's own values always win."""
    tz,_=day_context(db,user);count=0
    for item in data.days:
        try:days_rules.check_day(item.day,tz)
        except ValueError:continue
        if days_rules.fill_gaps(days_rules.row_for(db,user.id,item.day),item):count+=1
    db.commit();return {'imported':count}


# ── Exercise safety: what the app advises against, and the person's own decision to go ahead (services/exercise_safety.py) ──
from services import exercise_safety


class SafetyAck(BaseModel):
    template: str
    accepted: bool


def checkins_by_part(db, user, days=35):
    """The person's pain check-ins of the last few weeks, per body part, oldest first."""
    since = (date.today() - timedelta(days=days)).isoformat()
    out = {}
    for row in db.query(models.PainCheckin).filter(models.PainCheckin.user_id == user.id, models.PainCheckin.day >= since).order_by(models.PainCheckin.day).all():
        out.setdefault(row.part, []).append({'day': row.day, 'pain': row.pain, 'trend': row.trend, 'red_flags': row.red_flags or []})
    return out


def effective(db, user, prefs):
    """The preferences with each injury at the stage its check-ins have moved it to: what every exercise decision uses."""
    from services.recovery import effective_conditions
    if not prefs.conditions: return prefs
    return prefs.model_copy(update={'conditions': effective_conditions(prefs.conditions, checkins_by_part(db, user), local_now(prefs).date())})


def safety_state(db, user):
    prefs = effective(db, user, prefs_for(db.get(models.PersonalizationProfile, user.id)))
    from routers.health import assessment
    report = db.query(models.LabReport).filter_by(user_id=user.id).order_by(models.LabReport.report_date.desc(), models.LabReport.created_at.desc()).first()
    plan = (assessment(db, user, report) or {}).get('plan') if report else None
    return exercise_safety.check(prefs.conditions, ((plan or {}).get('exercise') or {}).get('intensity'))


def exercise_safety_view(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Every exercise the app advises against or asks care with, and why."""
    return safety_state(db, user)


def exercise_ack(data: SafetyAck, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """The person read why and chose to go ahead. The reasons are worked out here, not taken from the request."""
    if not data.accepted: raise HTTPException(422, 'Confirm that you accept the responsibility to continue.')
    advice = safety_state(db, user)['exercises'].get(data.template)
    if not advice: return {'status': 'not_needed'}
    row = models.SafetyAcknowledgement(user_id=user.id, template=data.template[:40], level=advice['level'], reasons=advice['reasons'])
    db.add(row); db.commit()
    return {'status': 'recorded', 'recorded_at': row.created_at.isoformat() + 'Z', 'level': advice['level']}


class PainCheckinInput(BaseModel):
    part: str = Field(max_length=24)
    pain: int = Field(ge=0, le=10)
    trend: Literal['better', 'same', 'worse']
    red_flags: list[str] = Field(default_factory=list, max_length=6)


def recovery_view(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Each injured or operated part: its stage now, why, what to do next, and the last four weeks of check-ins."""
    from services.recovery import RED_FLAGS, SOURCE, evaluate
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id)); today = local_now(prefs).date(); by_part = checkins_by_part(db, user)
    return {'today': today.isoformat(), 'parts': [evaluate(c, by_part.get(c.part, []), today) for c in prefs.conditions],
            'red_flags': RED_FLAGS, 'source': SOURCE}


def pain_checkin(data: PainCheckinInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Today's pain for one part the person has told us about. One check-in a day per part; a second one replaces the first."""
    from services.recovery import RED_FLAGS
    consume(db, 'pain-checkin', str(user.id), 60, 3600)
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    if data.part not in {c.part for c in prefs.conditions}: raise HTTPException(422, 'Add this part to your injuries first.')
    if set(data.red_flags) - set(RED_FLAGS): raise HTTPException(422, 'Unknown warning sign.')
    day = local_now(prefs).date().isoformat()
    row = db.query(models.PainCheckin).filter_by(user_id=user.id, part=data.part, day=day).with_for_update().first()
    if row is None:
        row = models.PainCheckin(user_id=user.id, part=data.part, day=day, pain=data.pain, trend=data.trend, red_flags=list(data.red_flags)); db.add(row)
    else:
        row.pain, row.trend, row.red_flags = data.pain, data.trend, list(data.red_flags)
    db.commit()
    return recovery_view(user, db)

