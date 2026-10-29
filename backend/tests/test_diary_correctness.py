"""Phase 2 (diary): day boundaries follow the person's time zone, edits keep a meal's time, deletes can be undone."""
import uuid
from datetime import datetime, timezone

import database, models
from services import adventure
from tests.test_adventure import account, client, init
from tests.test_wellness import diary, food

URL = '/api/v1/wellness/diary'


def zone(user_id, name):
    with database.SessionLocal() as db:
        row = db.get(models.PersonalizationProfile, user_id)
        if row: row.preferences = {**(row.preferences or {}), 'timezone': name}
        else: db.add(models.PersonalizationProfile(user_id=user_id, preferences={'timezone': name}))
        db.commit()


def logged_at(entry_id):
    with database.SessionLocal() as db: return db.get(models.MealLog, entry_id).logged_at


def test_the_day_follows_the_persons_time_zone_not_utc(monkeypatch):
    owner, h = account(); init(h); zone(owner, 'Asia/Kolkata')
    monkeypatch.setattr(adventure, 'now', lambda: datetime(2026, 10, 29, 19, 0, tzinfo=timezone.utc))  # 00:30 on the 30th in India
    state = client.get(URL, headers=h).json()
    assert state['today'] == '2026-10-30'
    body = diary(h); assert body['day'] == '2026-10-30'
    assert client.post(URL, headers=h, json=body).status_code == 200
    assert [e['id'] for e in client.get(URL, headers=h, params={'day': '2026-10-30'}).json()['entries']] == [body['id']]
    assert client.get(URL, headers=h, params={'day': '2026-10-29'}).json()['entries'] == []


def test_editing_a_meal_on_the_same_day_keeps_its_time(monkeypatch):
    _, h = account(); init(h)
    monkeypatch.setattr(adventure, 'now', lambda: datetime(2026, 10, 29, 8, 0, tzinfo=timezone.utc))
    body = diary(h, meal_type='breakfast'); client.post(URL, headers=h, json=body)
    before = logged_at(body['id'])
    monkeypatch.setattr(adventure, 'now', lambda: datetime(2026, 10, 29, 21, 0, tzinfo=timezone.utc))
    body['items'][0]['grams'] = 75
    assert client.put(f"{URL}/{body['id']}", headers=h, json=body).json()['entry']['totals']['calories'] == 150
    assert logged_at(body['id']) == before


def test_moving_a_meal_to_another_day_moves_it(monkeypatch):
    _, h = account(); init(h)
    monkeypatch.setattr(adventure, 'now', lambda: datetime(2026, 10, 29, 8, 0, tzinfo=timezone.utc))
    body = diary(h); client.post(URL, headers=h, json=body)
    assert client.put(f"{URL}/{body['id']}", headers=h, json={**body, 'day': '2026-10-28'}).json()['entry']['day'] == '2026-10-28'
    assert client.get(URL, headers=h, params={'day': '2026-10-29'}).json()['entries'] == []


def test_a_deleted_meal_can_be_restored_once_by_its_owner_without_extra_xp():
    _, h = account(); _, other = account(); init(h); init(other)
    body = diary(h); assert client.post(URL, headers=h, json=body).json()['awarded_xp'] == 10
    assert client.delete(f"{URL}/{body['id']}", headers=h).status_code == 200
    assert client.post(f"{URL}/{body['id']}/restore", headers=other).status_code == 404
    restored = client.post(f"{URL}/{body['id']}/restore", headers=h)
    assert restored.status_code == 200 and restored.json()['awarded_xp'] == 0 and restored.json()['entry']['id'] == body['id']
    assert any(e['id'] == body['id'] for e in client.get(URL, headers=h).json()['entries'])
    assert client.post(f"{URL}/{body['id']}/restore", headers=h).status_code == 404  # not deleted any more
    assert client.get('/api/v1/adventure/summary', headers=h).json()['xp'] == 10


def test_copying_a_meal_to_today_is_retry_safe():
    # "Copy yesterday" reuses POST /diary with a client id per copy: a retried copy is not saved twice.
    _, h = account(); init(h)
    copy = diary(h, items=[food('Yesterday dosa')])
    first, retry = client.post(URL, headers=h, json=copy).json(), client.post(URL, headers=h, json=copy).json()
    assert first['awarded_xp'] == 10 and retry['awarded_xp'] == 0
    assert [e['id'] for e in client.get(URL, headers=h).json()['entries']].count(copy['id']) == 1


def test_the_browser_gateway_allows_restore_and_nothing_else_three_levels_deep():
    from tests.test_web_gateway import browser, post, signed_up
    person = browser(); signed_up(person)
    today = person.get('/api/wellness/diary').get_json()['today']
    entry = {'id': str(uuid.uuid4()), 'day': today, 'meal_type': 'lunch', 'items': [food()]}
    assert post(person, '/api/wellness/diary', entry).status_code == 200
    assert person.delete(f"/api/wellness/diary/{entry['id']}", headers={'Origin': 'http://localhost'}).status_code == 200
    assert post(person, f"/api/wellness/diary/{entry['id']}/restore", {}).status_code == 200
    assert post(person, f"/api/wellness/diary/{entry['id']}/anything", {}).status_code == 404
    assert post(person, f"/api/wellness/favorites/{entry['id']}/restore", {}).status_code == 404
