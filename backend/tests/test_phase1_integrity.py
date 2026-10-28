"""Phase 1 integrity proofs: XP ledger idempotency under real concurrency and server-derived levels."""
import threading
import uuid
from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

import database, models
from services import gamification
from tests.test_adventure import account, client, init


def test_ledger_unique_constraints_exist_in_the_live_schema():
    with database.engine.connect() as connection:
        found = {row[0] for row in connection.execute(text(
            "select constraint_name from information_schema.table_constraints "
            "where table_schema=database() and constraint_type='UNIQUE' "
            "and table_name in ('reward_events','activity_reward_events')"))}
    assert {'uq_reward_user_key', 'uq_activity_reward_source'} <= found


def test_database_rejects_a_duplicate_reward_source():
    owner, _headers = account()
    with database.SessionLocal() as db:
        row = dict(user_id=owner, category='workout_completed', source_id='dup-source', local_day='2026-10-28', rule_version=1, awarded_xp=0, payload={})
        db.add(models.ActivityRewardEvent(**row)); db.flush()
        db.add(models.ActivityRewardEvent(**row))
        with pytest.raises(IntegrityError):
            db.flush()


def test_two_concurrent_requests_for_the_same_event_grant_xp_once():
    # Separate engine connections, committed for real, so the row lock is what serializes them.
    owner = str(uuid.uuid4()); day = date.today(); source = f'concurrency-{owner}'
    with Session(database.engine) as db:
        db.add(models.User(id=owner, email=f'qa-concurrency-{owner}@tests.example.com', is_active=True)); db.commit()
    barrier = threading.Barrier(2); results, deadlocks, errors = [], [], []

    def worker():
        with Session(database.engine) as db:
            try:
                user = db.get(models.User, owner); barrier.wait(timeout=10)
                results.append(gamification.award(db, user, 'workout', day, source_id=source)); db.commit()
            except IntegrityError:
                db.rollback(); results.append(0)
            except OperationalError as error:
                # MySQL 1213: the victim is rolled back, so integrity holds. Tracked as KNOWN_ISSUES KI-01.
                db.rollback(); (deadlocks if error.orig.args[0] == 1213 else errors).append(error)
            except Exception as error:  # surfaced in the assertion below
                db.rollback(); errors.append(error)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    try:
        for thread in threads: thread.start()
        for thread in threads: thread.join(timeout=30)
        assert not errors, errors
        assert sum(results) == 20 and len(results) + len(deadlocks) == 2
        with Session(database.engine) as db:
            assert db.query(models.ActivityRewardEvent).filter_by(user_id=owner, source_id=source).count() == 1
            assert sum(e.xp for e in db.query(models.RewardEvent).filter_by(user_id=owner)) == 20
    finally:
        with Session(database.engine) as db:
            for model in (models.ActivityRewardEvent, models.RewardEvent):
                db.query(model).filter_by(user_id=owner).delete()
            db.query(models.User).filter_by(id=owner).delete(); db.commit()


def test_client_cannot_raise_level_or_unlock_characters_by_tampering():
    owner, headers = account(); data = init(headers); prefs = data['customization']
    # Extra privileged fields in the payload are rejected, not merged.
    for field, value in (('level', 6), ('xp', 99999), ('unlocked_companions', ['sage']), ('user_id', str(uuid.uuid4()))):
        assert client.post('/api/v1/adventure/companion-settings', headers=headers, json={**prefs, field: value}).status_code == 422
    # Query-string values do not change the server-derived level.
    summary = client.get('/api/v1/adventure/summary?level=6&xp=99999&unlocked_companions=sage', headers=headers).json()
    assert summary['xp'] == 0 and summary['level'] == 1 and summary['unlocked_companions'] == ['pip']
    # Selecting a locked character is refused even with a forged owner id.
    assert client.post('/api/v1/adventure/companion-settings', headers=headers, json={**prefs, 'character_id': 'sage'}).status_code == 409
