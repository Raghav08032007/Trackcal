"""Dry-run every Alembic migration against the disposable test schema, then restore it (Master Rule 2).

A. From scratch: empty schema -> upgrade head -> no drift -> downgrade base -> upgrade head again.
B. On a copy of existing data: copy every table of the configured database (including alembic_version) ->
   upgrade head -> no table lost rows -> step down to the baseline and back up -> still no rows lost.
Never writes to the configured (source) database. Prints counts only, no row contents.
The test schema is rebuilt with setup_phase3_test_db afterwards.
"""
import json, os, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('APP_ENV', 'testing')
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from database import Base, engine
import models  # noqa: F401

TARGET = 'trackcal_phase3_test'
SOURCE = engine.url.database
if SOURCE == TARGET: raise RuntimeError('Run with the regular local configuration; the target must differ from the source.')
target = create_engine(engine.url.set(database=TARGET), pool_pre_ping=True)
config = Config(str(ROOT / 'alembic.ini')); config.set_main_option('script_location', str(ROOT / 'alembic'))
config.cmd_opts = type('Opts', (), {'x': [f'db={TARGET}']})()
BASELINE = '0001'
HEAD = ScriptDirectory.from_config(config).get_current_head()


def drop_all():
    with target.begin() as c:
        c.execute(text('SET FOREIGN_KEY_CHECKS=0'))
        for (name,) in c.execute(text('select table_name from information_schema.tables where table_schema=:s'), {'s': TARGET}).fetchall():
            c.execute(text(f'DROP TABLE `{name}`'))
        c.execute(text('SET FOREIGN_KEY_CHECKS=1'))


def counts(bind, schema):
    with bind.connect() as c:
        names = [r[0] for r in c.execute(text('select table_name from information_schema.tables where table_schema=:s and table_type="BASE TABLE"'), {'s': schema})]
        return {n: c.execute(text(f'select count(*) from `{schema}`.`{n}`')).scalar() for n in names}


def drift():
    with target.connect() as c:
        return [str(d)[:160] for d in compare_metadata(MigrationContext.configure(c, opts={'compare_type': True}), Base.metadata)]


def lost(before, after):
    return {n: [before[n], after.get(n)] for n in before if n != 'alembic_version' and after.get(n, -1) < before[n]}


report = {'source': SOURCE, 'target': TARGET, 'head': HEAD, 'baseline': BASELINE}
try:
    drop_all()
    command.upgrade(config, 'head'); report['scratch_tables'] = len(counts(target, TARGET)); report['scratch_drift'] = drift()
    command.downgrade(config, 'base'); report['scratch_tables_after_downgrade'] = len(counts(target, TARGET))
    command.upgrade(config, 'head'); report['scratch_reupgrade_drift'] = drift()

    drop_all(); before = counts(engine, SOURCE)
    with target.begin() as c:
        c.execute(text('SET FOREIGN_KEY_CHECKS=0'))
        for name in before:
            # SHOW CREATE TABLE keeps foreign keys; CREATE TABLE ... LIKE silently drops them.
            ddl = c.execute(text(f'SHOW CREATE TABLE `{SOURCE}`.`{name}`')).fetchone()[1]
            c.execute(text(ddl.replace(f'CREATE TABLE `{name}`', f'CREATE TABLE `{TARGET}`.`{name}`', 1)))
            c.execute(text(f'INSERT INTO `{TARGET}`.`{name}` SELECT * FROM `{SOURCE}`.`{name}`'))
        c.execute(text('SET FOREIGN_KEY_CHECKS=1'))
    report['copy_matches_source'] = counts(target, TARGET) == before
    with target.connect() as c: report['copy_started_at'] = MigrationContext.configure(c).get_current_revision()
    command.upgrade(config, 'head'); upgraded = counts(target, TARGET)
    report['copy_rows_lost_on_upgrade'] = lost(before, upgraded); report['copy_drift'] = drift()
    command.downgrade(config, BASELINE); report['copy_rows_lost_on_downgrade'] = lost(before, counts(target, TARGET))
    command.upgrade(config, 'head'); report['copy_rows_lost_on_reupgrade'] = lost(before, counts(target, TARGET))
finally:
    drop_all()
    from scripts.setup_phase3_test_db import setup
    setup(); report['target_restored'] = True
print(json.dumps(report, indent=1))
