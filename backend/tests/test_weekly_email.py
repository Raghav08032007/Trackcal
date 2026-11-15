"""Phase H: the Monday weekly-summary email. Opt-in, verified addresses only, Monday 09:00 in the person's own zone, once a week
however often the scheduler runs, the same numbers as Your weeks, and no health details. Written to the development outbox, which
production refuses."""
import email
import email.policy
import uuid
from datetime import datetime, timedelta

import pytest

import database, models
from services import account_mail, weekly_email
from tests.test_web_gateway import browser, post, signed_up


@pytest.fixture
def outbox(tmp_path, monkeypatch):
    monkeypatch.setenv('MAIL_OUTBOX', str(tmp_path))
    monkeypatch.setenv('PUBLIC_APP_URL', 'http://localhost')
    return tmp_path


def person(zone='Asia/Kolkata', verified=True, on=True, minutes=45):
    c = browser(); address, _ = signed_up(c)
    assert c.put('/api/wellness/trend/email', json={'on': on}, headers={'Origin': 'http://localhost', 'Content-Type': 'application/json'}).status_code == 200
    with database.SessionLocal() as db:
        user = db.query(models.User).filter_by(email=address).one()
        user.email_verified = verified
        profile = db.get(models.PersonalizationProfile, user.id)
        profile.preferences = {**profile.preferences, 'timezone': zone}
        # Last week: a 45-minute gym session on Wednesday 11 Nov 2026.
        done = datetime(2026, 11, 11, 12, 0)
        db.add(models.WorkoutSession(id=str(uuid.uuid4()), user_id=user.id, name='Gym', status='completed', details={'exercises': [{'exercise_id': 'gym', 'sets': []}]},
                                     active_seconds=minutes * 60, recorded_minutes=minutes, started_at=done - timedelta(minutes=minutes), running_since=None, completed_at=done))
        db.commit()
        return user.id, address


def sent(folder):
    return [email.message_from_bytes(p.read_bytes(), policy=email.policy.default) for p in sorted(folder.glob('*.eml'))]


def text_of(message):
    return next(part.get_content() for part in message.walk() if part.get_content_type() == 'text/plain')


def test_sent_once_on_monday_morning_in_the_persons_zone(outbox):
    _, address = person()
    with database.SessionLocal() as db:
        assert weekly_email.run(db, now=datetime(2026, 11, 16, 2, 0)) == 0      # 07:30 Monday in India: too early
        assert weekly_email.run(db, now=datetime(2026, 11, 16, 4, 0)) == 1      # 09:30
        assert weekly_email.run(db, now=datetime(2026, 11, 16, 4, 1)) == 0      # the next tick: already sent
        assert weekly_email.run(db, now=datetime(2026, 11, 17, 4, 0)) == 0      # Tuesday
    [message] = [m for m in sent(outbox) if m['To'] == address]
    body = text_of(message)
    assert message['Subject'] == 'Your week in TrackCal' and 'week of 2026-11-09' in body.lower()
    assert '225 MET-minutes' in body and '45 active minutes over 1 days' in body                   # 45 min x 5.0 METs
    assert 'http://localhost/weekly' in body and 'medical' in body
    for word in ('kcal', 'calorie', 'weight', 'kg'):
        assert word not in body.lower()


def test_only_people_who_opted_in_with_a_verified_address(outbox):
    _, off = person(on=False)
    _, unverified = person(verified=False)
    with database.SessionLocal() as db:
        weekly_email.run(db, now=datetime(2026, 11, 16, 10, 0))
    to = {m['To'] for m in sent(outbox)}
    assert off not in to and unverified not in to


def test_nothing_is_marked_sent_while_email_is_not_set_up(monkeypatch):
    monkeypatch.delenv('MAIL_OUTBOX', raising=False); monkeypatch.delenv('SMTP_HOST', raising=False)
    user_id, _ = person()
    with database.SessionLocal() as db:
        assert weekly_email.run(db, now=datetime(2026, 11, 16, 10, 0)) == 0
        assert not db.query(models.ScheduledNotification).filter_by(user_id=user_id, type='weekly_email').first()


def test_the_outbox_is_refused_in_production(monkeypatch, tmp_path):
    monkeypatch.setenv('MAIL_OUTBOX', str(tmp_path)); monkeypatch.setenv('APP_ENV', 'production')
    assert account_mail.outbox() is None


def test_the_switch_is_saved_and_shown_on_your_weeks():
    c = browser(); signed_up(c)
    h = {'Origin': 'http://localhost', 'Content-Type': 'application/json'}
    assert c.get('/api/wellness/trend').get_json()['weekly_email'] is False
    r = c.put('/api/wellness/trend/email', json={'on': True}, headers=h).get_json()
    assert r == {'weekly_email': True, 'email_verified': False}
    assert c.get('/api/wellness/trend').get_json()['weekly_email'] is True
    assert c.put('/api/wellness/trend/email', json={'on': True}, headers={'Origin': 'https://evil.example', 'Content-Type': 'application/json'}).status_code == 403
