"""Shared Phase 3 validated snapshots; totals are portions, never invented unknowns."""
from datetime import date
from typing import Literal
from uuid import UUID
from pydantic import Field,model_validator
from services.personalization_inputs import Strict
class Nutrients(Strict):
    calories:float|None=Field(default=None,ge=0,le=20000,allow_inf_nan=False)
    protein:float|None=Field(default=None,ge=0,le=2000,allow_inf_nan=False)
    carbs:float|None=Field(default=None,ge=0,le=2000,allow_inf_nan=False)
    fat:float|None=Field(default=None,ge=0,le=2000,allow_inf_nan=False)
class DiaryItem(Strict):
    name:str=Field(min_length=1,max_length=200)
    grams:float=Field(gt=0,le=20000,allow_inf_nan=False)
    nutrients:Nutrients=Field(default_factory=Nutrients)
    food_id:UUID|None=None
    manual_override:bool=False
    estimated:bool=False
    source:str=Field(default='User reviewed input',max_length=90)
class DiaryInput(Strict):
    id:UUID
    day:date
    meal_type:Literal['breakfast','lunch','dinner','snack','drink','other']='other'
    items:list[DiaryItem]=Field(min_length=1,max_length=30)
    notes:str=Field(default='',max_length=1000)
    method:Literal['manual','photo','saved']='manual'
class SaveMealInput(Strict):
    id:UUID
    name:str=Field(min_length=1,max_length=120)
    meal_type:Literal['breakfast','lunch','dinner','snack','drink','other']='other'
    items:list[DiaryItem]=Field(min_length=1,max_length=30)
class FavoriteInput(Strict):
    food_key:str=Field(min_length=1,max_length=120)
    item:DiaryItem
class BlueprintInput(Strict):
    id:UUID
    name:str=Field(min_length=1,max_length=120)
    exercises:list[str]=Field(min_length=1,max_length=10)
class StartSession(Strict):
    id:UUID
    name:str=Field(min_length=1,max_length=120)
    exercises:list[str]=Field(min_length=1,max_length=10)
    plan_activity_id:UUID|None=None
    tracking_method:Literal['manual','camera']='manual'
class CameraSet(Strict):
    estimated_reps:int=Field(ge=0,le=100)
    corrected_reps:int|None=Field(default=None,ge=0,le=100)
class CameraTracking(Strict):
    exercise_type:Literal['squat','pushup','curl']
    engine:Literal['mediapipe-pose-lite']='mediapipe-pose-lite'
    version:Literal[1]=1
    confidence_mean:float=Field(ge=0,le=1,allow_inf_nan=False)
    sampled_frames:int=Field(ge=0,le=100000)
    low_confidence_frames:int=Field(ge=0,le=100000)
    sets:list[CameraSet]=Field(min_length=1,max_length=20)
    @model_validator(mode='after')
    def valid_frames(self):
        if self.low_confidence_frames>self.sampled_frames:raise ValueError('Invalid sampled-frame summary.')
        if self.sampled_frames==0 and self.confidence_mean!=0:raise ValueError('Confidence requires sampled frames.')
        return self
class WorkoutSet(Strict):
    reps:int=Field(default=0,ge=0,le=100)
    load:float=Field(default=0,ge=0,le=500,allow_inf_nan=False)
    minutes:float=Field(default=0,ge=0,le=60,allow_inf_nan=False)
class ExerciseRecord(Strict):
    exercise_id:str=Field(max_length=40)
    sets:list[WorkoutSet]=Field(default_factory=list,max_length=20)
class SessionUpdate(Strict):
    revision:int=Field(ge=1)
    action:Literal['save','pause','resume','complete','abandon','amend']='save'
    exercises:list[ExerciseRecord]=Field(min_length=1,max_length=10)
    minutes:float=Field(ge=0,le=180,allow_inf_nan=False)
    notes:str=Field(default='',max_length=1000)
    tracking:CameraTracking|None=None
    @model_validator(mode='after')
    def complete_duration(self):
        if self.action in ('complete','amend') and self.minutes<1:raise ValueError('Record at least one minute for a completed session.')
        return self
