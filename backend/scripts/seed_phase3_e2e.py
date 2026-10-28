"""Public synthetic fixture for the dedicated E2E database, never the app database."""
import os,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['APP_ENV']='testing'
from database import engine,SessionLocal
import models
assert engine.url.database=='trackcal_phase3_test','Only the dedicated test schema is permitted.'
identifier=str(uuid.uuid5(uuid.NAMESPACE_URL,'trackcal-phase3-e2e-rice'))
with SessionLocal() as db:
 food=db.get(models.Food,identifier)
 if not food:
  food=models.Food(id=identifier,name='Phase Three QA Rice (synthetic fixture)',name_normalized='phase three qa rice',data_source=models.NutritionDataSource.user_created,is_verified=False,category='test fixture',serving_size_g=100);db.add(food);db.flush()
  for slug,value,unit in [('energy_kcal',100,'kcal'),('protein',5,'g'),('carbohydrates',15,'g'),('fat',2,'g')]:
   definition=db.query(models.NutrientDefinition).filter_by(slug=slug).first()
   if not definition:definition=models.NutrientDefinition(name=slug,slug=slug,unit=unit);db.add(definition);db.flush()
   db.add(models.FoodNutrient(food_id=identifier,nutrient_def_id=definition.id,amount_per_100g=value,is_estimated=True,source_note='Synthetic E2E fixture; not real composition data.'))
 db.commit()
print('Synthetic catalog fixture ready in dedicated test schema only.')
