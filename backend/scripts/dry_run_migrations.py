"""Dry-run every schema migration against the disposable test schema, then restore it.

A. From scratch: empty schema -> ORM bootstrap + rule seed -> every SQL migration, applied twice (replay safety).
B. On a copy of existing data: copy every table of the configured database -> apply the same steps -> verify no
   table lost rows. The copy is dropped afterwards and the test schema is rebuilt with setup_phase3_test_db.
Never touches the configured (source) database except to read it. Prints counts only, no row contents.
"""
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('APP_ENV', 'testing')
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from database import Base, engine
import models  # noqa: F401
from services.gamification import seed

TARGET = 'trackcal_phase3_test'
MIGRATIONS = sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql'))
SOURCE = engine.url.database
if SOURCE == TARGET: raise RuntimeError('Run with the regular local configuration; the target must differ from the source.')
target = create_engine(engine.url.set(database=TARGET), pool_pre_ping=True)


def statements(path):
    body = '\n'.join(line for line in path.read_text(encoding='utf-8').splitlines() if not line.strip().startswith('--'))
    return [s.strip() for s in body.split(';') if s.strip()]


def drop_all():
    with target.begin() as c:
        c.execute(text('SET FOREIGN_KEY_CHECKS=0'))
        for (name,) in c.execute(text('select table_name from information_schema.tables where table_schema=:s'), {'s': TARGET}).fetchall():
            c.execute(text(f'DROP TABLE `{name}`'))
        c.execute(text('SET FOREIGN_KEY_CHECKS=1'))


def migrate(passes=2):
    Base.metadata.create_all(target)
    with Session(target) as db: seed(db); db.commit()
    applied = 0
    for _ in range(passes):
        with target.begin() as c:
            for path in MIGRATIONS:
                for statement in statements(path): c.execute(text(statement)); applied += 1
    return applied


def counts(bind, schema):
    with bind.connect() as c:
        names = [r[0] for r in c.execute(text('select table_name from information_schema.tables where table_schema=:s and table_type="BASE TABLE"'), {'s': schema})]
        return {n: c.execute(text(f'select count(*) from `{schema}`.`{n}`')).scalar() for n in names}


def schema_drift():
    live = inspect(target); drift = {}
    for table in Base.metadata.sorted_tables:
        if not live.has_table(table.name): drift[table.name] = 'missing table'; continue
        missing = {c.name for c in table.columns} - {c['name'] for c in live.get_columns(table.name)}
        if missing: drift[table.name] = sorted(missing)
    return drift


report = {'source': SOURCE, 'target': TARGET, 'migration_files': [p.name for p in MIGRATIONS]}
try:
    drop_all()
    report['scratch_statements_applied'] = migrate()
    report['scratch_tables'] = len(counts(target, TARGET)); report['scratch_orm_drift'] = schema_drift()

    drop_all(); before = counts(engine, SOURCE)
    with target.begin() as c:
        c.execute(text('SET FOREIGN_KEY_CHECKS=0'))
        for name in before:
            c.execute(text(f'CREATE TABLE `{TARGET}`.`{name}` LIKE `{SOURCE}`.`{name}`'))
            c.execute(text(f'INSERT INTO `{TARGET}`.`{name}` SELECT * FROM `{SOURCE}`.`{name}`'))
        c.execute(text('SET FOREIGN_KEY_CHECKS=1'))
    copied = counts(target, TARGET)
    report['copy_matches_source'] = copied == before
    report['copy_statements_applied'] = migrate()
    after = counts(target, TARGET)
    report['copy_tables_before'] = len(before); report['copy_tables_after'] = len(after)
    report['copy_rows_lost'] = {n: [before[n], after.get(n)] for n in before if after.get(n, -1) < before[n]}
    report['copy_new_tables'] = sorted(set(after) - set(before)); report['copy_orm_drift'] = schema_drift()
    report['downgrade'] = 'none: migrations are additive SQL with no down scripts'
finally:
    drop_all()
    from scripts.setup_phase3_test_db import setup
    setup(); report['target_restored'] = True
print(json.dumps(report, indent=1))
