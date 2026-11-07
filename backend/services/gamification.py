"""Central, server-owned rewards. Call only after a module validates its own activity."""
from collections import defaultdict
from datetime import date,timedelta
from flask_app.params import HTTPException
import models
from services import bond
from services.read_only import locked, writing

KINDS={'checkin':'daily_checkin','verified_challenge_completion':'verified_challenge_completed','verified_event_attendance':'verified_event_attended','saved_meal':'saved_meal_created','onboarding':'onboarding_completed','activity_plan':'activity_plan_created','planner_learning':'planner_education_completed','fitness_learning':'exercise_skill_learned','nutrition_learning':'personal_nutrition_education_completed','recovery':'recovery_activity_completed','meal':'nutrition_log_completed','quiz':'nutrition_education_completed','plan':'personal_plan_activity_completed','workout':'workout_completed','weekly':'weekly_consistency'}
RULES=[('checkin',5,5,True),('saved_meal',10,10,True),('onboarding',10,10,True),('activity_plan',10,10,True),('planner_learning',10,10,True),('fitness_learning',10,10,True),('nutrition_learning',10,10,True),('recovery',5,5,True),('meal',10,10,True),('quiz',10,10,True),('plan',10,10,True),('workout',20,20,True),('weekly',25,25,True),('community_contribution',0,0,False),('verified_event_attendance',50,50,True),('verified_challenge_completion',40,40,True)]
ACHIEVEMENTS=[('food_explorer','Food Explorer','saved_meals',1,True),('wellness_learner','Wellness Learner','wellness_lessons',3,True),('recovery_champion','Recovery Champion','recovery_sessions',3,True),('personal_journey','Personal Journey Started','onboardings',1,True),('first_plan','First Plan Created','activity_plans',1,True),('fitness_explorer','Fitness Explorer','fitness_lessons',1,True),('first_activity','First Activity','activities',1,True),('first_workout','First Workout','workouts',1,True),('skill_builder','Skill Builder','skills',3,False),('community_contributor','Community Contributor','contributions',1,False),('consistency','Consistency Milestone','engaged_days',3,True),('recovery_awareness','Recovery Awareness','rest_days',1,True),('event_attendee','Verified Event','events',1,True),('challenge_finisher','Verified Challenge','challenges',1,True)]
CHARACTERS=['pip','nova','milo','luna','rio','sage']
UNLOCK_STREAKS=(0,3,7,14,21,30)  # best streak needed, alongside the points; an unlock already earned stays
ACHIEVEMENTS += [('first_camera','First Camera Workout','camera_sessions',1,True),('movement_explorer','Movement Explorer','camera_exercises',3,True),('tracking_milestone','Tracking Milestone','camera_days',3,True)]

def seed(db):
    for key,xp,cap,enabled in RULES:
        if not db.get(models.GamificationRule,key):db.add(models.GamificationRule(key=key,version=1,enabled=enabled,xp=xp,daily_cap=cap,settings={}))
    if not db.get(models.GamificationRule,'policy'):
        db.add(models.GamificationRule(key='policy',version=1,enabled=True,xp=0,daily_cap=75,settings={'level_step':250,'rest_days_per_week':2,'protected_days_per_week':1}))
    for code,title,metric,threshold,enabled in ACHIEVEMENTS:
        if not db.get(models.AchievementDefinition,code):db.add(models.AchievementDefinition(code=code,title=title,metric=metric,threshold=threshold,enabled=enabled))
    db.flush()

def policy(db):
    row=db.get(models.GamificationRule,'policy')
    if not row:raise HTTPException(503,'Gamification migration must be applied before starting this release.')
    settings=row.settings or {}
    return {'level_step':max(1,int(settings.get('level_step',250))),'daily_cap':max(0,row.daily_cap),'rest_days_per_week':max(0,min(7,int(settings.get('rest_days_per_week',2)))),'protected_days_per_week':max(0,min(2,int(settings.get('protected_days_per_week',1))))}

def customization(db,user):
    item=locked(db.query(models.CharacterCustomization).filter_by(user_id=user.id)).first()
    if not item:writing();item=models.CharacterCustomization(user_id=user.id);db.add(item);db.flush()
    return item

def award(db,user,kind,day,xp=None,key=None,source_id=None,payload=None):
    # Same lock order for all producers. Current reads prevent MySQL snapshot races.
    db.query(models.User).filter_by(id=user.id).with_for_update().one()
    if kind not in KINDS:raise HTTPException(409,'This activity integration is not operational.')
    rule=db.get(models.GamificationRule,kind)
    if not rule:raise HTTPException(503,'Gamification rules are unavailable.')
    if not rule.enabled:return 0
    category=KINDS[kind];source=str(source_id or key or f'v1:{kind}:{day}')
    prior=db.query(models.ActivityRewardEvent).filter_by(user_id=user.id,category=category,source_id=source).with_for_update().first()
    if prior:return 0
    reward_key=key or f'v1:{kind}:{day}'
    ledger=db.query(models.RewardEvent).filter_by(user_id=user.id).with_for_update().all()
    used=sum(max(0,e.xp) for e in ledger if e.local_day==str(day));kind_used=sum(max(0,e.xp) for e in ledger if e.local_day==str(day) and e.kind==kind)
    points=0 if any(e.reward_key==reward_key for e in ledger) else max(0,min(rule.xp,rule.daily_cap-kind_used,policy(db)['daily_cap']-used))
    db.add(models.ActivityRewardEvent(user_id=user.id,category=category,source_id=source,local_day=str(day),rule_version=rule.version,awarded_xp=points,payload=payload or {}))
    if points:
        prefs=db.get(models.CharacterCustomization,user.id) if bond.enabled(db) else None  # which companion shares this XP
        db.add(models.RewardEvent(user_id=user.id,reward_key=reward_key,kind=kind,local_day=str(day),xp=points,companion_id=prefs.character_id if prefs else None))
    db.flush();return points

def flexible_streak(engaged,rests,today,protection=True,allowance=1):
    engaged={date.fromisoformat(v) for v in engaged if v<=str(today)};rests={date.fromisoformat(v) for v in rests if v<=str(today)}-engaged
    if not engaged:return {'current':0,'best':0,'history':[],'protected_days':[]}
    start=min(engaged);end=today if today in engaged or today in rests else today-timedelta(days=1)
    used=defaultdict(int);chain=best=0;history=[];protected=[];cursor=start;last_engaged=None
    # Only activity-backed runs accrue. Protection/rest do not add XP or activity days.
    while cursor<=end:
        week=str(cursor-timedelta(days=cursor.weekday()));state='missed'
        if cursor in engaged:state='engaged';chain+=1;last_engaged=cursor
        elif chain and cursor in rests:state='rest';chain+=1
        elif chain and protection and used[week]<allowance and last_engaged and (cursor-last_engaged).days<=3:
            state='protected';used[week]+=1;chain+=1;protected.append(str(cursor))
        else:chain=0
        best=max(best,chain);history.append({'day':str(cursor),'status':state});cursor+=timedelta(days=1)
    return {'current':chain,'best':best,'history':history[-35:],'protected_days':protected[-35:]}

def state(db,user,day,xp,events):
    config=policy(db);prefs=customization(db,user)
    qualifying=[e for e in events if e.kind in KINDS and e.kind!='weekly' and e.xp>0]
    engaged={e.local_day for e in qualifying}
    rests=[r.local_day for r in locked(db.query(models.StreakRecord).filter_by(user_id=user.id,kind='rest')).all()]
    # Opening the app keeps the streak alive, but it is not an activity for badges.
    metrics={'activities':sum(e.kind!='checkin' for e in qualifying),'workouts':sum(e.kind=='workout' for e in qualifying),'engaged_days':len(engaged),'rest_days':len(rests),'skills':0,'contributions':0,'events':0,'challenges':0}
    audits=db.query(models.ActivityRewardEvent).filter_by(user_id=user.id).all()
    camera=[e for e in audits if e.category=='workout_completed' and (e.payload or {}).get('tracking_method')=='camera']
    metrics.update({'camera_sessions':len(camera),'camera_exercises':len({e.payload.get('exercise') for e in camera}),'camera_days':len({e.local_day for e in camera})})
    metrics['challenges']=len({e.source_id for e in audits if e.category=='verified_challenge_completed'})
    metrics['events']=len({e.source_id for e in audits if e.category=='verified_event_attended'})
    metrics.update({'saved_meals':sum(e.category=='saved_meal_created' for e in audits),'wellness_lessons':sum(e.category in ('planner_education_completed','exercise_skill_learned','personal_nutrition_education_completed') for e in audits),'recovery_sessions':sum(e.category=='recovery_activity_completed' and e.awarded_xp>0 for e in audits),'onboardings':sum(e.category=='onboarding_completed' for e in audits),'activity_plans':sum(e.category=='activity_plan_created' for e in audits),'fitness_lessons':sum(e.category=='exercise_skill_learned' for e in audits)})
    earned={r.code:r for r in locked(db.query(models.UserAchievement).filter_by(user_id=user.id)).all()}
    achievements=[]
    for definition in db.query(models.AchievementDefinition).order_by(models.AchievementDefinition.code).all():
        value=metrics.get(definition.metric,0)
        if definition.enabled and value>=definition.threshold and definition.code not in earned:
            writing();row=models.UserAchievement(user_id=user.id,code=definition.code);db.add(row);db.flush();earned[definition.code]=row
            from services import notifications;notifications.enqueue_milestone(db,user.id,definition.code)  # opt-in push only
        achievements.append({'code':definition.code,'title':definition.title,'status':'unlocked' if definition.code in earned else 'in_progress' if definition.enabled and value else 'locked','progress':min(value,definition.threshold),'required':definition.threshold,'operational':definition.enabled,'unlocked_at':earned[definition.code].unlocked_at.isoformat()+'Z' if definition.code in earned else None})
    unlocks={r.character_id for r in locked(db.query(models.CharacterUnlock).filter_by(user_id=user.id)).all()}
    milestones=[]
    streak=flexible_streak(engaged,rests,day,prefs.protection_enabled,config['protected_days_per_week'])
    for index,identifier in enumerate(CHARACTERS):
        required,days=index*config['level_step'],UNLOCK_STREAKS[index]
        if xp>=required and streak['best']>=days and identifier not in unlocks:writing();db.add(models.CharacterUnlock(user_id=user.id,character_id=identifier));unlocks.add(identifier)
        milestones.append({'id':identifier,'level':index+1,'required_xp':required,'required_streak':days,'unlocked':identifier in unlocks})
    monday=day-timedelta(days=day.weekday());rest_used=sum(str(monday)<=v<=str(day) for v in rests)
    db.flush()
    result={'level':1+xp//config['level_step'],'level_xp':xp%config['level_step'],'level_step':config['level_step'],'unlocked_companions':[c for c in CHARACTERS if c in unlocks],'companion_unlocks':milestones,'achievements':achievements,'engagement_streak':streak,'rest_days_remaining':max(0,config['rest_days_per_week']-rest_used),'rest_today':str(day) in rests,'customization':{key:getattr(prefs,key) for key in ('character_id','accessory','enabled','minimized','muted','position','protection_enabled')},'daily_xp_cap':config['daily_cap'],'integration_contracts':[{'category':KINDS.get(k,k),'operational':bool(k in KINDS and db.get(models.GamificationRule,k) and db.get(models.GamificationRule,k).enabled)} for k,_xp,_cap,enabled in RULES if k!='weekly']}
    from services import billing
    perks=billing.entitlements(db,user);result['premium']=perks['premium'];result['premium_accessories']=list(billing.PREMIUM_ACCESSORIES)
    if bond.enabled(db):result['customization']['aura']=prefs.aura
    if result['customization']['accessory'] in billing.PREMIUM_ACCESSORIES and not perks['premium']:result['customization']['accessory']='none'  # lapsed Premium: hidden, choice kept
    return result
