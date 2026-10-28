"""Validated, bounded personalization inputs. No client-owned XP or medical inference."""
from datetime import datetime,timezone
from typing import Literal
from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
from pydantic import BaseModel,Field,ConfigDict,field_validator,model_validator

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
class ReminderChoice(Strict):
    enabled:bool=False
    time:str=Field(default='09:00',pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    days:list[int]=Field(default_factory=lambda:list(range(7)),max_length=7)
    @field_validator('days')
    @classmethod
    def valid_days(cls,v):
        if any(d<0 or d>6 for d in v) or len(set(v))!=len(v):raise ValueError('Choose unique weekdays from 0 to 6.')
        return v
class ReminderSettings(Strict):
    hydration:ReminderChoice=Field(default_factory=ReminderChoice)
    workout:ReminderChoice=Field(default_factory=ReminderChoice)
    recovery:ReminderChoice=Field(default_factory=ReminderChoice)
    sleep:ReminderChoice=Field(default_factory=ReminderChoice)
    motivation:ReminderChoice=Field(default_factory=ReminderChoice)
    quiet_start:str=Field(default='22:00',pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    quiet_end:str=Field(default='07:00',pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
class Preferences(Strict):
    display_name:str=Field(default='',max_length=100)
    age_group:Literal['under18','18_19','20_64','65plus','unspecified']='unspecified'
    language:Literal['en','hi','ta','te','other']='en'
    country:str=Field(default='',max_length=80)
    timezone:str=Field(default='UTC',max_length=64)
    units:Literal['metric','imperial']='metric'
    interests:list[Literal['fitness','strength','endurance','mobility','yoga','running','sports','routine']]=Field(default_factory=lambda:['fitness'],max_length=8)
    experience:Literal['beginner','intermediate','experienced','unspecified']='unspecified'
    available_days:list[int]=Field(default_factory=lambda:[0,2,4],max_length=7)
    rest_days:list[int]=Field(default_factory=lambda:[1,3,5,6],max_length=7)
    duration:int=Field(default=15,ge=5,le=60)
    workout_time:str=Field(default='09:00',pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    setting:Literal['home','gym','outdoor']='home'
    equipment:list[Literal['mat','chair','dumbbells','machine','bicycle']]=Field(default_factory=list,max_length=5)
    accessibility:list[Literal['seated','no_floor','low_impact']]=Field(default_factory=list,max_length=3)
    professional_restrictions:str=Field(default='',max_length=1000)
    diet:Literal['balanced','vegetarian','vegan','pescatarian']='balanced'
    allergies:list[str]=Field(default_factory=list,max_length=20)
    cuisine:Literal['any','Indian','Mediterranean','global']='any'
    preparation:Literal['quick','batch','flexible']='flexible'
    ingredients:list[str]=Field(default_factory=list,max_length=30)
    budget:float|None=Field(default=None,ge=0,le=100000,allow_inf_nan=False)
    currency:str=Field(default='INR',pattern=r'^[A-Z]{3}$')
    reminders:ReminderSettings=Field(default_factory=ReminderSettings)
    motivation:bool=True
    @field_validator('timezone')
    @classmethod
    def zone(cls,v):
        try:ZoneInfo(v)
        except (ZoneInfoNotFoundError,ValueError):raise ValueError('Choose a valid IANA timezone.')
        return v
    @field_validator('allergies','ingredients')
    @classmethod
    def text_lists(cls,v):
        if any(not s.strip() or len(s)>80 for s in v):raise ValueError('Use short, non-empty ingredient names.')
        return list(dict.fromkeys(s.strip().lower() for s in v))
    @field_validator('available_days','rest_days')
    @classmethod
    def days(cls,v):
        if any(d<0 or d>6 for d in v) or len(set(v))!=len(v):raise ValueError('Choose unique weekdays from 0 to 6.')
        return v
class SaveProgress(Strict):
    preferences:Preferences
    step:int=Field(ge=1,le=8)
    revision:int=Field(ge=0)
    complete:bool=False
class MeasurementInput(Strict):
    kind:Literal['height','weight','duration','repetitions','frequency','hydration','sleep']
    value:float=Field(allow_inf_nan=False,ge=0)
    unit:Literal['cm','in','kg','lb','minutes','reps','days/week','ml','hours']
    recorded_at:datetime
    @field_validator('recorded_at')
    @classmethod
    def timestamp(cls,v):
        if v.tzinfo is None:raise ValueError('A timezone is required.')
        if v>datetime.now(timezone.utc):raise ValueError('Future measurements are not supported.')
        return v.astimezone(timezone.utc).replace(tzinfo=None)
class GeneratePlan(Strict):
    revision:int=Field(ge=1)
class ActivityAction(Strict):
    action:Literal['start','complete','reschedule','substitute','feedback','skip']
    day:str|None=Field(default=None,pattern=r'^\d{4}-\d{2}-\d{2}$')
    template_id:str|None=Field(default=None,max_length=40)
    feedback:Literal['comfortable','too_hard','pain','not_enjoyed']|None=None
class PlanAction(Strict):
    status:Literal['active','paused']
class ReminderAction(Strict):
    action:Literal['snooze','dismiss']
    minutes:int=Field(default=15,ge=5,le=120)
class EducationInput(Strict):
    module:Literal['planner','fitness','nutrition']
    answer:int=Field(ge=0,le=3)
