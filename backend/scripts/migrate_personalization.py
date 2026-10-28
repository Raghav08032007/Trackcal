"""20261028_02: additive Phase 2 storage and reward definitions; never drop user data."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect,select,func
from database import engine,SessionLocal,Base
import models
from services.gamification import seed
TABLES=['personalization_profiles','wellness_measurements','activity_plans','plan_activities','recommendation_history','reminder_deliveries']
def migrate(bind=engine,factory=SessionLocal):
 existing=set(inspect(bind).get_table_names());legacy=['users','user_profiles','meal_logs','reward_events','adventure_profiles']
 def counts():
  with bind.connect() as connection:return {name:connection.scalar(select(func.count()).select_from(Base.metadata.tables[name])) for name in legacy if name in existing}
 before=counts()
 for name in TABLES:Base.metadata.tables[name].create(bind,checkfirst=True)
 with factory() as db:seed(db);db.commit()
 if counts()!=before:raise RuntimeError('Legacy record counts changed; investigate in a quiet release window.')
 return {'version':'20261028_02','new_tables':[n for n in TABLES if n not in existing],'legacy_counts_preserved':True}
if __name__=='__main__':print(migrate())
