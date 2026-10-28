"""Opt-in habits and curated label game. All rewards are computed by the server."""
from datetime import timedelta
import random
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from flask_app.params import Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_active_user
from services import adventure as service
from services.abuse_limits import consume
import models


class Initialize(BaseModel):
    timezone:str=Field(min_length=1,max_length=80)

def initialize(data:Initialize,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    try: ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError,ValueError): raise HTTPException(422,'Choose a valid IANA timezone.')
    item=service.profile(db,user,locked=True)
    if item and item.timezone!=data.timezone: raise HTTPException(409,'Your journey timezone is already set. Existing streak dates are preserved.')
    if not item: db.add(models.AdventureProfile(user_id=user.id,timezone=data.timezone));db.commit()
    return service.summary(db,user)

def summary(user=Depends(get_current_active_user),db:Session=Depends(get_db)): return service.summary(db,user)

def require_profile(db,user):
    item=service.profile(db,user,locked=True)
    if not item: raise HTTPException(409,'Start your journey before earning rewards.')
    return item

class ReviewMeal(BaseModel):
    id:UUID
    owner_id:UUID
    day:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    name:str=Field(min_length=1,max_length=200)
    calories:float=Field(ge=0,le=20000,allow_inf_nan=False)
    protein:float=Field(ge=0,le=20000,allow_inf_nan=False)
    carbs:float=Field(ge=0,le=20000,allow_inf_nan=False)
    fat:float=Field(ge=0,le=20000,allow_inf_nan=False)

def review_meal(data:ReviewMeal,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if str(data.owner_id)!=str(user.id): raise HTTPException(409,'Your account changed. Refresh before reviewing a meal.')
    consume(db,'adventure-review',str(user.id),60,3600)
    item=require_profile(db,user);day=service.local_day(item)
    if data.day!=str(day): raise HTTPException(422,'Only a meal reviewed for today in your journey timezone can earn XP. Imported history does not earn XP.')
    if not data.name.strip(): raise HTTPException(422,'Confirm the meal name.')
    # Current reads are required after the account lock: MySQL's repeatable-read
    # snapshot may predate a concurrent claim that just finished.
    meal=db.query(models.AdventureMeal).filter_by(id=str(data.id)).with_for_update().first()
    if meal and meal.user_id!=user.id: raise HTTPException(409,'This meal identifier is unavailable.')
    if meal and meal.local_day!=str(day): raise HTTPException(409,'An older review cannot earn a new reward.')
    if not meal: db.add(models.AdventureMeal(id=str(data.id),user_id=user.id,local_day=str(day),snapshot=data.model_dump(mode='json')))
    points=service.award(db,user,'meal',day,source_id=str(data.id))
    monday=day-timedelta(days=day.weekday())
    days={e.local_day for e in db.query(models.RewardEvent).filter_by(user_id=user.id,kind='meal').with_for_update().all() if str(monday)<=e.local_day<=str(day)}
    if len(days)>=3: points+=service.award(db,user,'weekly',day,25,f'v1:weekly:{monday}')
    db.commit()
    return {'awarded_xp':points,'summary':service.summary(db,user)}

QUESTIONS=[
 {'prompt':'A fictional label lists 200 kcal per 100 g. What is the energy in 50 g?','options':['50 kcal','100 kcal','200 kcal','400 kcal'],'answer':1,'explanation':'50 g is half of 100 g, so 200 × 0.5 = 100 kcal.'},
 {'prompt':'One serving has 6 g protein. Two servings contain…','options':['3 g','6 g','12 g','24 g'],'answer':2,'explanation':'Multiply the value per serving by the number of servings: 6 × 2 = 12 g.'},
 {'prompt':'A fictional label lists 8 g fat per 100 g. How much is in 25 g?','options':['2 g','4 g','8 g','32 g'],'answer':0,'explanation':'25 g is one quarter of 100 g: 8 ÷ 4 = 2 g.'},
 {'prompt':'A pack contains three servings. Which number describes the whole pack?','options':['The per-serving value alone','The per-serving value divided by three','The per-serving value multiplied by three','Always 100 kcal'],'answer':2,'explanation':'The whole pack contains three times the listed per-serving amounts.'},
 {'prompt':'A photo estimate misses an ingredient. What should you do?','options':['Treat the estimate as exact','Review the ingredients and correct the saved entry','Skip the meal to protect a streak','Earn more points by eating less'],'answer':1,'explanation':'Photo nutrition is an estimate. Review ingredients and portions; XP does not measure health.'},
]

def game_start(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    consume(db,'label-game-start',str(user.id),12,3600)
    require_profile(db,user)
    session=models.GameSession(user_id=user.id,challenge=random.SystemRandom().sample(QUESTIONS,3),expires_at=(service.now()+timedelta(minutes=15)).replace(tzinfo=None))
    db.add(session);db.commit();db.refresh(session)
    return {'id':session.id,'expires_at':session.expires_at.isoformat()+'Z','questions':[{'prompt':q['prompt'],'options':q['options']} for q in session.challenge]}

class Answers(BaseModel):
    id:UUID
    answers:list[int]=Field(min_length=3,max_length=3)

def game_submit(data:Answers,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    consume(db,'label-game-submit',str(user.id),60,3600)
    item=require_profile(db,user)
    session=db.query(models.GameSession).filter_by(id=str(data.id),user_id=user.id).with_for_update().first()
    if not session: raise HTTPException(404,'Game session not found.')
    if session.expires_at<=service.now().replace(tzinfo=None): raise HTTPException(410,'This round expired. Start a fresh round; earned XP is safe.')
    if any(answer<0 or answer>3 for answer in data.answers): raise HTTPException(422,'Choose one option for every question.')
    if session.attempts>=10 and not session.completed: raise HTTPException(429,'Start a fresh round after reviewing the explanations.')
    score=sum(answer==q['answer'] for answer,q in zip(data.answers,session.challenge))
    points=0
    if not session.completed:
        session.attempts+=1
        if score==3:
            session.completed=True
            points=service.award(db,user,'quiz',service.local_day(item),source_id=session.id)
    db.commit()
    return {'correct':score,'completed':session.completed,'awarded_xp':points,'explanations':[q['explanation'] for q in session.challenge], 'summary':service.summary(db,user)}


class WorkoutReview(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id:UUID
    owner_id:UUID
    day:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    name:str=Field(min_length=1,max_length=200)
    minutes:float=Field(ge=1,le=180,allow_inf_nan=False)
    sets:int=Field(ge=0,le=100)
    reps:int=Field(ge=0,le=200)
    load:float=Field(ge=0,le=1000,allow_inf_nan=False)

def review_workout(data:WorkoutReview,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if str(data.owner_id)!=str(user.id):raise HTTPException(409,'Your account changed. Refresh before reviewing a workout.')
    consume(db,'workout-review',str(user.id),30,3600)
    item=require_profile(db,user);day=service.local_day(item)
    if data.day!=str(day) or not data.name.strip():raise HTTPException(422,'Review a named workout for today in your journey timezone.')
    prior=db.query(models.ActivityRewardEvent).filter_by(user_id=user.id,category='workout_completed',source_id=str(data.id)).with_for_update().first()
    if prior and prior.local_day!=str(day):raise HTTPException(409,'An older session cannot be reused for a new day.')
    points=service.award(db,user,'workout',day,source_id=str(data.id),payload=data.model_dump(mode='json'))
    db.commit();return {'awarded_xp':points,'summary':service.summary(db,user)}

class RestDay(BaseModel):
    model_config=ConfigDict(extra='forbid')
    day:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')

def rest_day(data:RestDay,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    from services.gamification import policy
    consume(db,'rest-day',str(user.id),20,3600)
    item=require_profile(db,user);day=service.local_day(item)
    if data.day!=str(day):raise HTTPException(422,'Rest days can only be planned for today in your journey timezone.')
    rows=db.query(models.StreakRecord).filter_by(user_id=user.id).with_for_update().all()
    if not any(row.local_day==str(day) for row in rows):
        monday=day-timedelta(days=day.weekday())
        if sum(str(monday)<=row.local_day<=str(day) for row in rows)>=policy(db)['rest_days_per_week']:raise HTTPException(409,'This week’s planned rest allowance is used. Earned XP and badges remain safe during breaks.')
        db.add(models.StreakRecord(user_id=user.id,local_day=str(day),kind='rest'))
    db.commit();return {'awarded_xp':0,'summary':service.summary(db,user)}

class CompanionSettings(BaseModel):
    model_config=ConfigDict(extra='forbid')
    character_id:Literal['pip','nova','milo','luna','rio','sage']='pip'
    accessory:Literal['none','flower','crown','sun']='none'
    enabled:bool=True
    minimized:bool=True
    muted:bool=False
    position:Literal['left','right']='right'
    protection_enabled:bool=True

def companion_settings(data:CompanionSettings,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    from services.gamification import customization
    consume(db,'companion-settings',str(user.id),90,3600)
    require_profile(db,user);snapshot=service.summary(db,user);require_profile(db,user)
    if data.character_id not in snapshot['unlocked_companions']:raise HTTPException(409,'Earn this character before selecting it.')
    if snapshot['level']<{'none':1,'flower':2,'crown':5,'sun':10}[data.accessory]:raise HTTPException(409,'This accessory is not unlocked yet.')
    prefs=customization(db,user)
    for key,value in data.model_dump().items():setattr(prefs,key,value)
    db.commit();return service.summary(db,user)
