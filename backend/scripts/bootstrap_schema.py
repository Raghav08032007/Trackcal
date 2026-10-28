"""Release job: apply versioned Alembic migrations, then seed gamification rules. Never run during API startup.

A database created before Alembic (Phase 1 baseline schema, no alembic_version table) is stamped at the
baseline first; this is safe only because scripts/dry_run_migrations.py proved that schema equals 0001.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from database import SessionLocal, engine
from services.gamification import seed

config = Config(str(ROOT / 'alembic.ini')); config.set_main_option('script_location', str(ROOT / 'alembic'))
tables = set(inspect(engine).get_table_names())
if 'users' in tables and 'alembic_version' not in tables:
    command.stamp(config, '0001'); print('Pre-Alembic schema stamped at baseline 0001.')
command.upgrade(config, 'head')
with SessionLocal() as db:
    seed(db)
    db.commit()
print('Schema at Alembic head and gamification rules seeded. Existing data was not altered.')
