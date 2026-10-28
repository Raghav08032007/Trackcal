"""20261028_03 additive nutrition/session upgrade; existing diary/saved meals retained."""
import sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect,select,func,Index
from database import engine,SessionLocal,Base
import models
from services.gamification import seed
TABLES=['food_aliases','food_favorites','food_search_history','workout_blueprints','workout_sessions']
ALIASES={'idli':['idly'],'dosa':['dosai'],'sambar':['sambhar'],'chapati':['chapathi','roti'],'dal':['dhal','lentils']}
def migrate(bind=engine,factory=SessionLocal):
 existing=set(inspect(bind).get_table_names());legacy=['users','meal_logs','meal_items','saved_meals','reward_events','plan_activities']
 def counts():
  with bind.connect() as c:return {n:c.scalar(select(func.count()).select_from(Base.metadata.tables[n])) for n in legacy if n in existing}
 before=counts()
 for name in TABLES:Base.metadata.tables[name].create(bind,checkfirst=True)
 index=next((i for i in models.Food.__table__.indexes if i.name=='ix_food_category_name'),None) or Index('ix_food_category_name',models.Food.category,models.Food.name_normalized)
 index.create(bind,checkfirst=True)
 with factory() as db:
  seed(db)
  for canonical,aliases in ALIASES.items():
   for food in db.query(models.Food).filter(models.Food.name_normalized==canonical).all():
    for alias in aliases:
     if not db.query(models.FoodAlias).filter_by(food_id=food.id,alias=alias).first():db.add(models.FoodAlias(food_id=food.id,alias=alias))
  db.commit()
 if counts()!=before:raise RuntimeError('Legacy record counts changed during migration; verify a quiet release window.')
 return {'version':'20261028_03','new_tables':[n for n in TABLES if n not in existing],'legacy_counts_preserved':True}
if __name__=='__main__':print(migrate())
