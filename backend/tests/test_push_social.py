"""Phase H: social, record and weekly-summary notifications. Kudos, comments and follows within half an hour arrive as one;
nothing for your own actions or from someone you muted; a first run sets times without a 'record' note; the weekly note is only
planned for Mondays; and no message says who did what."""
import uuid
from datetime import datetime, timedelta

import pytest

import database, models
from services import notifications as push
from tests.test_push import rows, setup_person
from tests.test_social import S, member, post
from tests.client import client


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_WEB_PUSH', 'true')
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true')


def subscribed(user_id, **types):
    with database.SessionLocal() as db:
        setup_person(db, user_id, types=types or {'social': None, 'record': None})


def kinds(user_id):
    with database.SessionLocal() as db:
        return [r.type for r in rows(db, user_id)]


def test_kudos_comments_and_follows_in_one_half_hour_arrive_as_one_note():
    a_id, a, a_handle = member()
    _, b, _ = member()
    _, c, _ = member()
    subscribed(a_id)
    mine = post(a, 'Morning walk done')
    client.post(f'{S}/follow/{a_handle}', headers=b)
    client.post(f'{S}/posts/{mine["id"]}/reactions', headers=b, json={'kind': 'cheer'})
    client.post(f'{S}/posts/{mine["id"]}/comments', headers=c, json={'body': 'Nice one!'})
    client.post(f'{S}/posts/{mine["id"]}/reactions', headers=a, json={'kind': 'like'})       # your own kudos: nothing
    assert kinds(a_id) == ['social']
    with database.SessionLocal() as db:
        [row] = rows(db, a_id)
        body = push.payload(row)
    assert body['title'] == 'Someone cheered you on' and 'Nice one' not in str(body) and 'qa' not in str(body).lower()


def test_a_new_half_hour_starts_a_new_bundle_and_muted_people_never_notify():
    a_id, _, _ = member()
    b_id, _, _ = member()
    c_id, _, c_handle = member()
    subscribed(a_id)
    with database.SessionLocal() as db:
        now = datetime(2026, 11, 16, 12, 5)
        push.notify_social(db, a_id, b_id, now=now)
        push.notify_social(db, a_id, b_id, now=now + timedelta(minutes=20))   # same half hour
        push.notify_social(db, a_id, b_id, now=now + timedelta(minutes=40))   # the next one
        db.add(models.SocialBlock(user_id=a_id, target_id=c_id, kind='mute'))
        db.flush()
        push.notify_social(db, a_id, c_id, now=now + timedelta(minutes=95))
        db.commit()
    assert kinds(a_id) == ['social', 'social']


def test_social_notes_respect_the_switch():
    a_id, _, _ = member()
    b_id, _, _ = member()
    subscribed(a_id, record=None)                                              # social left off
    with database.SessionLocal() as db:
        push.notify_social(db, a_id, b_id); db.commit()
    assert kinds(a_id) == []


def test_a_first_run_sets_times_and_a_faster_one_is_a_record():
    from datetime import timezone
    from tests.test_activities_helpers import fixes_for
    a_id, a, _ = member()
    subscribed(a_id)
    def run(speed, minutes_ago):
        started = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
        r = client.post('/api/v1/activities', headers=a, json={'sport': 'run', 'started_at': started, 'fixes': fixes_for([(900, speed)])})
        assert r.status_code == 201, r.text
    run(3.0, 120)
    assert kinds(a_id) == []
    run(4.0, 60)
    assert kinds(a_id) == ['record']
    with database.SessionLocal() as db:
        assert push.payload(rows(db, a_id)[0])['url'] == '/activities'


def test_the_weekly_summary_is_planned_for_monday_mornings_only():
    a_id, _, _ = member()
    subscribed(a_id, weekly_summary='09:00')
    with database.SessionLocal() as db:
        push.plan(db, now=datetime(2026, 11, 14, 6, 0))       # Saturday: today and tomorrow are the weekend
        assert rows(db, a_id) == []
        push.plan(db, now=datetime(2026, 11, 15, 6, 0))       # Sunday: tomorrow is Monday
        [row] = rows(db, a_id)
        assert row.type == 'weekly_summary' and row.local_day == '2026-11-16' and row.scheduled_for_utc == datetime(2026, 11, 16, 9, 0)
        assert push.payload(row) ['url'] == '/weekly'


def test_the_settings_api_offers_the_new_kinds():
    a_id, a, _ = member()
    r = client.get('/api/v1/push/settings', headers=a)
    assert r.status_code == 200, r.text
    assert {'social', 'record', 'weekly_summary'} <= set(r.json()['types'])
    saved = client.put('/api/v1/push/settings', headers=a, json={'enabled': False, 'types': {'social': {'enabled': False}}})
    assert saved.status_code == 200 and saved.json()['types']['social']['enabled'] is False


def test_every_kind_of_note_is_neutral():
    import re
    for name, spec in push.TYPES.items():
        text = (spec['title'] + ' ' + (spec['body'] or '')).lower()
        assert not re.search(r'(kcal|calories?|weight|kg|bmi|streaks?|missed|lost|fail\w*)', text), name
        assert not any(ch.isdigit() for ch in text) and spec['url'].startswith('/'), name
