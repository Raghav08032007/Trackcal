"""Version 20261028: additive foundation preserving legacy profile/reward data."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect,select,func
from database import engine,SessionLocal,Base
import models
from services.gamification import seed
TABLES=['gamification_rules','activity_reward_events','achievements','user_achievements','character_customizations','character_unlocks','streak_records']
def migrate(bind=engine,factory=SessionLocal):
    existing=set(inspect(bind).get_table_names())
    legacy=[models.User.__table__,models.AdventureProfile.__table__,models.RewardEvent.__table__,models.AdventureMeal.__table__]
    def counts():
        with bind.connect() as connection:return {table.name:connection.scalar(select(func.count()).select_from(table)) for table in legacy if table.name in existing}
    before=counts()
    for name in TABLES:Base.metadata.tables[name].create(bind,checkfirst=True)
    with factory() as db:seed(db);db.commit()
    if before!=counts():raise RuntimeError('Legacy counts changed during migration; investigate before release.')
    return {'version':'20261028','new_tables':[name for name in TABLES if name not in existing],'legacy_counts_preserved':True}
if __name__=='__main__':print(migrate())
