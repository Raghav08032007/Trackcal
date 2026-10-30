"""KI-03: the account export covers every user-owned table, or excludes it with a stated reason."""
import uuid

import database, models
from database import Base
from routers import users
from tests.client import client

OWNER_COLUMNS = ('user_id', 'owner_id', 'client_id', 'coach_id', 'author_id', 'follower_id', 'reporter_id', 'organizer_id', 'creator_id')


def test_every_user_owned_table_is_exported_or_excluded_with_a_reason():
    owned = {t.name for t in Base.metadata.sorted_tables if any(c.name in OWNER_COLUMNS for c in t.columns)} | {'users'}
    unaccounted = owned - users.EXPORTED_TABLES - set(users.EXPORT_EXCLUDED)
    assert not unaccounted, f'Add these user-owned tables to the export or EXPORT_EXCLUDED: {sorted(unaccounted)}'
    assert not users.EXPORTED_TABLES & set(users.EXPORT_EXCLUDED)
    assert all(reason.strip() for reason in users.EXPORT_EXCLUDED.values())
    assert users.EXPORTED_TABLES | set(users.EXPORT_EXCLUDED) <= set(Base.metadata.tables), 'register names a table that does not exist'


def test_new_sections_contain_own_records_without_credentials():
    def signup():
        r = client.post('/api/v1/auth/signup', json={'email': f'qa-export-{uuid.uuid4().hex}@tests.example.com', 'password': 'Synthetic-export-123!'})
        return r.json()['user_id'], {'Authorization': 'Bearer ' + r.json()['access_token']}
    owner, headers = signup(); other, other_headers = signup()
    with database.SessionLocal() as db:
        db.add(models.SavedMeal(user_id=owner, name='Usual breakfast', meal_type='breakfast', items_snapshot=[], total_calories=300))
        db.add(models.UserDevice(user_id=owner, device_token='push-secret-token', platform='web', device_name='Laptop'))
        db.add(models.SupportTicket(user_id=owner, subject='Help', body='My question', category='general'))
        db.commit()
    records = client.get('/api/v1/users/export', headers=headers).json()['account_records']
    assert set(records) == {entry[0] for entry in users.ACCOUNT_RECORDS}
    assert [m['name'] for m in records['saved_meals']] == ['Usual breakfast']
    assert records['support_tickets'][0]['body'] == 'My question'
    assert records['devices'][0]['device_name'] == 'Laptop' and 'device_token' not in records['devices'][0]
    assert 'push-secret-token' not in str(records)
    # Another account's export contains none of it.
    other_records = client.get('/api/v1/users/export', headers=other_headers).json()['account_records']
    assert other_records['saved_meals'] == [] and other_records['devices'] == [] and other_records['support_tickets'] == []
