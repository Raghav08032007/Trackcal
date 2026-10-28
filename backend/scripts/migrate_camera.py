"""20261028_04: versioned JSON snapshot extension, no duplicate session tables or DDL."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select,func
from database import engine,SessionLocal
import models
from services.gamification import seed
def migrate(bind=engine,factory=SessionLocal):
 tables=[models.User,models.WorkoutSession,models.MealLog,models.RewardEvent,models.PlanActivity]
 def counts():
  with bind.connect() as c:return [c.scalar(select(func.count()).select_from(t)) for t in tables]
 before=counts()
 with factory() as db:seed(db);db.commit()
 if before!=counts():raise RuntimeError('Existing counts changed; run in a quiet release window.')
 return {'version':'20261028_04','schema':'existing workout_sessions.details JSON; version 1 camera summaries','legacy_counts_preserved':True}
if __name__=='__main__':print(migrate())
