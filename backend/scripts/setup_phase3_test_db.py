"""Create a dedicated Phase 3 test schema; copy public catalog references only, never user records."""
import os,sys,re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['APP_ENV']='testing'
from sqlalchemy import create_engine,text,select
from sqlalchemy.orm import Session
from database import engine,Base
import models
from services.gamification import seed
TARGET='trackcal_phase3_test'
def setup():
 if engine.url.database==TARGET:raise RuntimeError('Run setup with the regular local configuration as catalog source.')
 with engine.begin() as c:c.execute(text('CREATE DATABASE IF NOT EXISTS `'+TARGET+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'))
 target=create_engine(engine.url.set(database=TARGET),pool_pre_ping=True)
 Base.metadata.create_all(target)
 with engine.connect() as source,target.begin() as dest:
  # 30 general catalog foods plus the IFCT catalog (public reference data), so search journeys use real Indian foods.
  foods=[dict(r) for r in source.execute(select(models.Food.__table__).limit(30)).mappings()]+[dict(r) for r in source.execute(select(models.Food.__table__).where(models.Food.data_source=='ifct')).mappings()];ids=[f['id'] for f in foods];brands={f['brand_id'] for f in foods if f['brand_id']}
  copies=[(models.Allergen.__table__,None),(models.NutrientDefinition.__table__,None),(models.Brand.__table__,models.Brand.id.in_(brands)),(models.Food.__table__,models.Food.id.in_(ids)),(models.FoodNutrient.__table__,models.FoodNutrient.food_id.in_(ids)),(models.FoodTranslation.__table__,models.FoodTranslation.food_id.in_(ids)),(models.FoodAlias.__table__,models.FoodAlias.food_id.in_(ids)),(models.SearchSynonym.__table__,None)]
  for table,predicate in copies:
   statement=select(table)
   if predicate is not None:statement=statement.where(predicate)
   rows=[dict(row) for row in source.execute(statement).mappings()]
   if rows:dest.execute(table.insert().prefix_with('IGNORE'),rows)
 with Session(target) as db:seed(db);db.commit()
 print('Dedicated Phase 3 test schema ready. Only public food/reference tables copied; no user records copied.')
if __name__=='__main__':setup()
