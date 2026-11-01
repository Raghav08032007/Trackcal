"""Server-owned participation rewards. These do not measure nutrition or health."""
from datetime import datetime, timezone, timedelta, date
from zoneinfo import ZoneInfo
from flask_app.params import HTTPException
import models
from services.read_only import READ_ONLY, locked

# name, points, best streak in days. Both are needed. The best streak never falls, so a missed day costs nothing already earned.
COMPANION_UNLOCKS = (("pip", 0, 0), ("nova", 250, 3), ("milo", 500, 7), ("luna", 750, 14), ("rio", 1000, 21), ("sage", 1250, 30))

def unlocked_companions(xp, best_streak=0):
    return [name for name, points, days in COMPANION_UNLOCKS if xp >= points and best_streak >= days]

def now(): return datetime.now(timezone.utc)

def profile(db, user, locked=False):
    if locked:
        db.query(models.User).filter_by(id=user.id).with_for_update().one()
    if locked: return db.query(models.AdventureProfile).filter_by(user_id=user.id).with_for_update().first()
    return db.get(models.AdventureProfile,user.id)

def local_day(item): return now().astimezone(ZoneInfo(item.timezone)).date()

def award(db,user,kind,day,xp=None,key=None,source_id=None,payload=None):
    from services.gamification import award as process
    return process(db,user,kind,day,xp,key,source_id,payload)


def streak_days(days,today):
    days={date.fromisoformat(value) for value in days if value<=str(today)}
    cursor=today if today in days else today-timedelta(days=1)
    current=0
    while cursor in days: current+=1;cursor-=timedelta(days=1)
    best=run=0;previous=None
    for item in sorted(days):
        run=run+1 if previous and item==previous+timedelta(days=1) else 1
        best=max(best,run);previous=item
    return current,best

def summary(db,user):
    item=profile(db,user,locked=not READ_ONLY.get())
    if not item: return {"initialized":False}
    day=local_day(item)
    events=locked(db.query(models.RewardEvent).filter_by(user_id=user.id).order_by(models.RewardEvent.created_at.desc())).all()
    meal_days=sorted({event.local_day for event in events if event.kind=="meal"})
    current,best=streak_days(meal_days,day)
    daily_actions={}
    for event in events:
        if event.kind in ('meal','plan','quiz'):
            daily_actions.setdefault(event.local_day,set()).add(event.kind)
    completed_days=sorted(value for value,actions in daily_actions.items() if actions=={'meal','plan','quiz'})
    task_streak,best_task_streak=streak_days(completed_days,day)
    completed_today=len(daily_actions.get(str(day),set()))
    monday=day-timedelta(days=day.weekday())
    week_days=sum(str(monday)<=value<=str(day) for value in meal_days)
    xp=sum(event.xp for event in events)
    badges=[]
    if meal_days: badges.append("First seed")
    if len(meal_days)>=3: badges.append("Growing roots")
    if best>=7: badges.append("Seven-day gardener")
    if any(event.kind=="quiz" for event in events): badges.append("Label detective")
    result={"initialized":True,"owner_id":str(user.id),"timezone":item.timezone,"today":str(day),"xp":xp,"unlocked_companions":unlocked_companions(xp,best_task_streak),"level":1+xp//250,"level_xp":xp%250,
            "task_streak":task_streak,"best_task_streak":best_task_streak,"completed_days":completed_days[-35:],"daily_goal":{"complete":completed_today,"total":3,"day_complete":completed_today==3},
            "streak":current,"best_streak":best,"active_days":meal_days[-35:],"weekly_days":week_days,"badges":badges,
            "quests":[{"id":kind,"title":title,"xp":points,"complete":any(e.kind==kind and e.local_day==str(day) for e in events)} for kind,title,points in [("meal","Review today's first meal",10),("plan","Generate a feasible meal plan",10),("quiz","Complete Label Detective",10)]],
            "history":[{"kind":e.kind,"day":e.local_day,"xp":e.xp} for e in events[:12]],
            "weekly_complete":any(e.reward_key==f"v1:weekly:{monday}" for e in events)}
    from services.gamification import state
    result.update(state(db,user,day,xp,events))
    for quest in result['quests']:
        rule=db.get(models.GamificationRule,quest['id'])
        quest['xp']=max(0,min(rule.xp,rule.daily_cap)) if rule and rule.enabled else 0
    db.commit()
    return result


def record_plan(db,user):
    item=profile(db,user,locked=True)
    if item:
        award(db,user,"plan",local_day(item),10)
        db.commit()
