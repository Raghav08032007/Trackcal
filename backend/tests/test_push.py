"""Phase 4: push scheduling (time zones, DST, quiet hours, cap, snooze), sending (expiry, retry, payload), two
workers sending once, the API behind the web_push flag, and the protected tick."""
import re
import threading
import time as clock
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

import database, models
from services import notifications as push
from tests.test_adventure import account, client
from tests.test_web_gateway import browser, post, signed_up

ENDPOINT = 'https://push.example.com/send/'


@pytest.fixture(autouse=True)
def flag_on(monkeypatch):
    monkeypatch.setenv('FEATURE_WEB_PUSH', 'true')


def setup_person(db, user_id, zone='UTC', quiet=('22:00', '07:00'), types=None, max_per_day=2, devices=1, snooze=None):
    profile = db.get(models.PersonalizationProfile, user_id)
    prefs = {'timezone': zone, 'reminders': {'quiet_start': quiet[0], 'quiet_end': quiet[1]}}
    if profile: profile.preferences = {**(profile.preferences or {}), **prefs}
    else: db.add(models.PersonalizationProfile(user_id=user_id, preferences=prefs))
    chosen = {name: {'enabled': False, 'time': spec['time']} for name, spec in push.TYPES.items()}
    for name, value in (types or {'daily_plan': '08:00'}).items(): chosen[name] = {'enabled': True, 'time': value}
    db.add(models.NotificationSettings(user_id=user_id, enabled=True, types=chosen, max_per_day=max_per_day, snooze_until=snooze))
    for _ in range(devices):
        endpoint = ENDPOINT + uuid.uuid4().hex
        db.add(models.PushSubscription(user_id=user_id, endpoint=endpoint, endpoint_hash=push.endpoint_hash(endpoint), p256dh='p' * 40, auth='a' * 16))
    db.commit()


def rows(db, user_id):
    return db.query(models.ScheduledNotification).filter_by(user_id=user_id).order_by(models.ScheduledNotification.scheduled_for_utc, models.ScheduledNotification.type).all()


class Recorder:
    def __init__(self, status=201, delay=0):
        self.calls, self.status, self.delay, self.lock = [], status, delay, threading.Lock()

    def __call__(self, device, body):
        if self.delay: clock.sleep(self.delay)
        with self.lock: self.calls.append(body)
        return self.status(device) if callable(self.status) else self.status


# ── Local time ──────────────────────────────────────────────────────────────

def test_local_times_convert_with_each_zones_offset_and_daylight_saving():
    ny, india = ZoneInfo('America/New_York'), ZoneInfo('Asia/Kolkata')
    assert push.local_slot_utc(date(2026, 10, 29), '08:00', india) == datetime(2026, 10, 29, 2, 30)
    assert push.local_slot_utc(date(2026, 3, 7), '08:00', ny) == datetime(2026, 3, 7, 13, 0)   # EST, UTC-5
    assert push.local_slot_utc(date(2026, 3, 9), '08:00', ny) == datetime(2026, 3, 9, 12, 0)   # EDT, UTC-4
    # 02:30 doesn't exist on 8 March in New York: one instant, never two.
    assert push.local_slot_utc(date(2026, 3, 8), '02:30', ny) == datetime(2026, 3, 8, 7, 30)
    # 01:30 happens twice on 1 November: the first one is used, so it still fires once.
    assert push.local_slot_utc(date(2026, 11, 1), '01:30', ny) == datetime(2026, 11, 1, 5, 30)


def test_planning_uses_the_persons_zone_and_is_repeatable():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, zone='Asia/Kolkata', types={'daily_plan': '08:00'})
        now = datetime(2026, 10, 29, 1, 0)  # 06:30 in India
        assert push.plan(db, now) == 2
        assert [(r.local_day, r.scheduled_for_utc) for r in rows(db, owner)] == [('2026-10-29', datetime(2026, 10, 29, 2, 30)), ('2026-10-30', datetime(2026, 10, 30, 2, 30))]
        assert push.plan(db, now) == 0


def test_quiet_hours_that_cross_midnight_are_never_planned():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, quiet=('21:00', '07:00'), types={'daily_plan': '06:30', 'meal_log': '07:00', 'rest_day': '22:30'})
        push.plan(db, datetime(2026, 10, 29, 0, 0))
        assert {r.type for r in rows(db, owner)} == {'meal_log'}


def test_turning_on_after_todays_time_starts_tomorrow():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, types={'daily_plan': '08:00'})
        push.plan(db, datetime(2026, 10, 29, 9, 0))
        assert [r.local_day for r in rows(db, owner)] == ['2026-10-30']


# ── Sending ─────────────────────────────────────────────────────────────────

def run(db, now, send):
    push.plan(db, now - timedelta(minutes=1))
    return [push.deliver(db, i, send, now) for i in push.claim(db, now)]


def test_daily_cap_and_snooze_are_checked_when_sending():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, types={'daily_plan': '08:00', 'meal_log': '08:00'}, max_per_day=1)
        send = Recorder()
        assert sorted(run(db, datetime(2026, 10, 29, 8, 0), send)) == ['sent', 'skipped']
        assert len(send.calls) == 1 and {r.last_error for r in rows(db, owner) if r.status == 'skipped'} == {'daily cap'}
    other, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, other, snooze=datetime(2026, 10, 30))
        send = Recorder()
        assert run(db, datetime(2026, 10, 29, 8, 0), send) == ['skipped'] and send.calls == []
        assert rows(db, other)[0].last_error == 'snoozed'


def test_an_expired_device_is_removed_and_others_still_receive():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, devices=2)
        gone = db.query(models.PushSubscription).filter_by(user_id=owner).first().id
        send = Recorder(status=lambda device: 410 if device.id == gone else 201)
        assert run(db, datetime(2026, 10, 29, 8, 0), send) == ['sent']
        assert [d.id for d in db.query(models.PushSubscription).filter_by(user_id=owner)] != [gone]
        assert db.query(models.PushSubscription).filter_by(user_id=owner).count() == 1


def test_temporary_failures_retry_with_backoff_then_give_up():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner)
        send, now = Recorder(status=503), datetime(2026, 10, 29, 8, 0)
        assert run(db, now, send) == ['pending']
        row = rows(db, owner)[0]
        assert row.attempts == 1 and row.next_attempt_at == now + timedelta(minutes=2)
        assert push.claim(db, now + timedelta(minutes=1)) == []  # not before the backoff
        for minutes in (2, 6, 14, 30):
            later = now + timedelta(minutes=minutes)
            assert [push.deliver(db, i, send, later) for i in push.claim(db, later)]
        db.refresh(row)
        assert row.status == 'failed' and row.attempts == push.MAX_ATTEMPTS and len(send.calls) == 5


def test_a_notification_too_late_to_be_useful_is_skipped():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner)
        push.plan(db, datetime(2026, 10, 29, 7, 0))
        late = datetime(2026, 10, 29, 11, 0)
        assert [push.deliver(db, i, Recorder(), late) for i in push.claim(db, late)] == ['skipped']
        assert rows(db, owner)[0].last_error == 'too late'


def test_payloads_hold_only_a_title_a_neutral_body_and_a_link():
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, types={name: '08:00' for name in push.SCHEDULED}, max_per_day=5)
        send = Recorder()
        run(db, datetime(2026, 10, 29, 8, 0), send)
    assert len(send.calls) == len(push.SCHEDULED)
    for body in send.calls:
        assert set(body) == {'id', 'type', 'title', 'body', 'url'} and body['url'].startswith('/')
        text = (body['title'] + ' ' + body['body']).lower()
        assert not re.search(r'\b(kcal|calories?|weight|kg|bmi|streaks?|missed|lost|fail\w*)\b', text)  # whole words: "trackcal" is fine
        assert not any(ch.isdigit() for ch in text)
    assert next(b for b in send.calls if b['type'] == 'motivation')['body'] == push.motivation_for(date(2026, 10, 29))


def test_two_workers_running_at_once_send_each_notification_once():
    """Real MySQL row locks: both workers commit their claims on separate connections."""
    user_id = str(uuid.uuid4())
    with Session(database.engine) as db:
        db.add(models.User(id=user_id, email=f'qa-push-{uuid.uuid4().hex}@tests.example.com', hashed_password='x')); db.commit()
        setup_person(db, user_id, types={'daily_plan': '08:00', 'meal_log': '08:00', 'workout': '08:00'}, max_per_day=5)
    send, now, errors = Recorder(delay=.2), datetime(2026, 10, 29, 8, 0), []
    def worker():
        try: push.tick(lambda: Session(database.engine), send, now=now, batch=2)
        except Exception as error: errors.append(error)
    try:
        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads: t.start()
        for t in threads: t.join(30)
        assert not errors
        today = [b['id'] for b in send.calls]
        with Session(database.engine) as db:
            due = [r for r in rows(db, user_id) if r.local_day == '2026-10-29']
            assert len(due) == 3 and all(r.status == 'sent' for r in due)
        assert sorted(today) == sorted(r.id for r in due)  # three sends, no duplicates
    finally:
        with Session(database.engine) as db:
            db.query(models.User).filter_by(id=user_id).delete(); db.commit()


def test_a_new_achievement_queues_a_milestone_after_quiet_hours(monkeypatch):
    owner, _ = account()
    with database.SessionLocal() as db:
        setup_person(db, owner, zone='Asia/Kolkata', types={'milestone': None})
        push.enqueue_milestone(db, owner, 'first_meal', now=datetime(2026, 10, 29, 18, 0))  # 23:30 in India: quiet
        push.enqueue_milestone(db, owner, 'first_meal', now=datetime(2026, 10, 29, 18, 5))  # same unlock: no duplicate
        db.commit()
        [row] = rows(db, owner)
        assert row.type == 'milestone' and row.scheduled_for_utc == datetime(2026, 10, 30, 1, 30)  # 07:00 in India


# ── API, flag and tick ──────────────────────────────────────────────────────

def subscription(endpoint=None):
    return {'endpoint': endpoint or ENDPOINT + uuid.uuid4().hex, 'keys': {'p256dh': 'B' * 87, 'auth': 'A' * 22}}


def test_everything_is_hidden_while_the_flag_is_off(monkeypatch):
    monkeypatch.setenv('FEATURE_WEB_PUSH', 'false')
    _, h = account()
    assert client.get('/api/v1/push/settings', headers=h).status_code == 404
    assert client.post('/api/v1/push/subscribe', headers=h, json=subscription()).status_code == 404
    assert client.get('/api/v1/push/config').json()['enabled'] is False


def test_settings_subscriptions_and_turning_off_cancels_what_was_planned(monkeypatch):
    monkeypatch.setenv('VAPID_PUBLIC_KEY', 'public-key'); monkeypatch.setenv('VAPID_PRIVATE_KEY', 'private-key')
    owner, h = account(); _, other = account()
    assert client.get('/api/v1/push/config').json() == {'enabled': True, 'public_key': 'public-key'}
    first = subscription()
    assert client.post('/api/v1/push/subscribe', headers=h, json=first).status_code == 200
    assert client.post('/api/v1/push/subscribe', headers=h, json=first).status_code == 200  # same device, one row
    assert client.post('/api/v1/push/subscribe', headers=h, json={**first, 'endpoint': 'http://insecure.example.com/x' + 'y' * 10}).status_code == 422
    on = client.put('/api/v1/push/settings', headers=h, json={'enabled': True, 'types': {'meal_log': {'enabled': True, 'time': '12:30'}}, 'max_per_day': 2})
    assert on.status_code == 200 and on.json()['types']['meal_log'] == {'enabled': True, 'time': '12:30'} and len(on.json()['devices']) == 1
    with database.SessionLocal() as db:
        push.plan(db, datetime(2026, 10, 29, 5, 0)); assert {r.status for r in rows(db, owner)} == {'pending'}
    assert client.put('/api/v1/push/settings', headers=h, json={'enabled': False}).json()['enabled'] is False
    with database.SessionLocal() as db:
        assert {r.status for r in rows(db, owner)} == {'skipped'}
        kinds = [e.kind for e in db.query(models.NotificationEvent).all()]
        assert 'opt_in' in kinds and 'opt_out' in kinds
    # The same browser signing in as someone else moves the device to them.
    assert client.post('/api/v1/push/subscribe', headers=other, json=first).status_code == 200
    assert client.get('/api/v1/push/settings', headers=h).json()['devices'] == []
    assert client.request('DELETE', '/api/v1/push/subscribe', headers=other, json={'endpoint': first['endpoint']}).status_code == 200
    assert client.get('/api/v1/push/settings', headers=other).json()['devices'] == []


def test_snooze_options_and_limits():
    _, h = account()
    snoozed = client.put('/api/v1/push/settings', headers=h, json={'enabled': True, 'snooze': '1d'}).json()
    assert snoozed['snooze_until'] is not None
    assert client.put('/api/v1/push/settings', headers=h, json={'enabled': True, 'snooze': 'clear'}).json()['snooze_until'] is None
    assert client.put('/api/v1/push/settings', headers=h, json={'enabled': True, 'max_per_day': 9}).status_code == 422
    assert client.put('/api/v1/push/settings', headers=h, json={'enabled': True, 'types': {'workout': {'enabled': True, 'time': '25:00'}}}).status_code == 422


def test_opened_is_recorded_only_for_the_owner():
    owner, h = account(); _, other = account()
    with database.SessionLocal() as db:
        setup_person(db, owner); run(db, datetime(2026, 10, 29, 8, 0), Recorder())
        identifier = rows(db, owner)[0].id
    assert client.post(f'/api/v1/push/opened/{identifier}', headers=other).status_code == 404
    assert client.post(f'/api/v1/push/opened/{identifier}', headers=h).status_code == 200
    with database.SessionLocal() as db: assert rows(db, owner)[0].opened_at is not None


def test_the_tick_needs_the_secret_and_reports_counts(monkeypatch):
    from flask_app.blueprints import internal
    monkeypatch.setenv('TICK_SECRET', 's' * 40)
    monkeypatch.setattr(push, 'webpush_sender', lambda: Recorder())
    assert client.post('/internal/tick').status_code == 404
    assert client.post('/internal/tick', headers={'X-Tick-Secret': 'wrong'}).status_code == 404
    done = client.post('/internal/tick', headers={'X-Tick-Secret': 's' * 40})
    assert done.status_code == 200 and done.json()['enabled'] is True
    metrics = client.get('/internal/notification-metrics', headers={'X-Tick-Secret': 's' * 40}).json()
    assert metrics['note'].startswith('Guardrail') and 'open_rate' in metrics
    monkeypatch.setenv('TICK_SECRET', 'short')
    assert client.post('/internal/tick', headers={'X-Tick-Secret': 'short'}).status_code == 404  # weak secrets refused


def test_browser_routes_and_daily_motivation(monkeypatch):
    monkeypatch.setenv('VAPID_PUBLIC_KEY', 'public-key'); monkeypatch.setenv('VAPID_PRIVATE_KEY', 'private-key')
    person = browser()
    assert person.get('/api/push/config').get_json()['enabled'] is True
    assert person.get('/api/push/settings').status_code == 401
    signed_up(person)
    assert post(person, '/api/push/subscribe', subscription()).status_code == 200
    assert post(person, '/api/push/subscribe', subscription(), origin='https://evil.example').status_code == 403
    assert person.put('/api/push/settings', json={'enabled': True}, headers={'Origin': 'http://localhost'}).get_json()['enabled'] is True
    assert person.get('/api/push/anything').status_code == 404
    line = person.get('/api/motivation/today?day=2026-10-29').get_json()
    assert line['message'] == push.motivation_for(date(2026, 10, 29))
    assert person.get('/api/motivation/today?day=tomorrow').status_code == 400


def test_the_real_sender_encrypts_a_payload_only_the_device_can_read(monkeypatch):
    """pywebpush end to end against a local receiver: aes128gcm encryption and a signed VAPID header."""
    import base64, json as js, http.server, http_ece, jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
    server_key = ec.generate_private_key(ec.SECP256R1())
    server_public = b64(server_key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    monkeypatch.setenv('VAPID_PRIVATE_KEY', b64(server_key.private_numbers().private_value.to_bytes(32, 'big')))
    monkeypatch.setenv('VAPID_SUBJECT', 'mailto:push-admin@example.com')
    device_key, auth_secret = ec.generate_private_key(ec.SECP256R1()), b'0123456789abcdef'
    received = {}
    class Receiver(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            received['headers'] = {k.lower(): v for k, v in self.headers.items()}; received['body'] = self.rfile.read(int(self.headers['Content-Length']))
            self.send_response(201); self.end_headers()
        def log_message(self, *args): pass
    server = http.server.HTTPServer(('127.0.0.1', 0), Receiver)
    threading.Thread(target=server.handle_request, daemon=True).start()
    device = models.PushSubscription(endpoint=f'http://127.0.0.1:{server.server_port}/push/abc',
                                     p256dh=b64(device_key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)), auth=b64(auth_secret))
    body = {'id': 'n1', 'type': 'daily_plan', 'title': "Today's plan is ready", 'body': 'Open TrackCal whenever it suits you.', 'url': '/plan'}
    try: assert push.webpush_sender()(device, body) == 201
    finally: server.server_close()
    assert received['headers']['content-encoding'] == 'aes128gcm' and int(received['headers']['ttl']) == push.TTL_SECONDS
    assert b'TrackCal' not in received['body']  # encrypted on the wire
    plain = http_ece.decrypt(received['body'], private_key=device_key, auth_secret=auth_secret, version='aes128gcm')
    assert js.loads(plain) == body
    token, key = re.match(r'vapid t=([^,]+),\s*k=(.+)', received['headers']['authorization']).groups()
    assert key == server_public
    claims = jwt.decode(token, options={'verify_signature': False})
    assert claims['aud'] == f'http://127.0.0.1:{server.server_port}' and claims['sub'] == 'mailto:push-admin@example.com'


def test_a_data_export_includes_notification_settings_but_never_push_credentials():
    owner, h = account()
    endpoint = subscription()
    client.post('/api/v1/push/subscribe', headers=h, json=endpoint)
    client.put('/api/v1/push/settings', headers=h, json={'enabled': True})
    exported = client.get('/api/v1/users/export', headers=h)
    assert exported.status_code == 200
    text = exported.text
    assert endpoint['endpoint'] not in text and endpoint['keys']['p256dh'] not in text and endpoint['keys']['auth'] not in text
    assert 'notification_settings' in text and 'push_subscriptions' in text
