"""KI-02: closed accounts are permanently erased after the erasure window, and nothing else is touched."""
import uuid
from datetime import datetime, timedelta

import pytest

import database, models
from services import account_erasure
from tests.client import client


def account():
    r = client.post('/api/v1/auth/signup', json={'email': f'qa-erase-{uuid.uuid4().hex}@tests.example.com', 'password': 'Synthetic-erase-123!'})
    assert r.status_code == 201, r.text
    return r.json()['user_id'], {'Authorization': 'Bearer ' + r.json()['access_token']}


def populate(db, user_id, upload):
    db.add(models.SavedMeal(user_id=user_id, name='Lunch', meal_type='lunch', items_snapshot=[], total_calories=500))
    db.add(models.SupportTicket(user_id=user_id, subject='Help', body='Personal question', category='general'))
    db.add(models.CommunitySubmission(user_id=user_id, submission_type='food', data={'name': 'Idli'}, status='pending'))
    db.add(models.AuditLog(user_id=user_id, action='login', resource_type='user', resource_id=user_id, ip_address='203.0.113.5'))
    db.add(models.FoodImage(user_id=user_id, storage_path=str(upload), original_filename='meal.jpg', file_size_bytes=3, mime_type='image/jpeg'))
    db.add(models.WaterEntry(user_id=user_id, amount_ml=250, logged_at=datetime.utcnow()))


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    monkeypatch.setenv('LOCAL_STORAGE_PATH', str(tmp_path)); return tmp_path


def test_closing_reports_the_erasure_date_and_erasure_removes_everything(uploads, monkeypatch):
    monkeypatch.setenv('ACCOUNT_ERASURE_DAYS', '30')
    owner, headers = account(); other, _ = account()
    photo, other_photo = uploads / f'{owner}.jpg', uploads / f'{other}.jpg'
    photo.write_bytes(b'jpg'); other_photo.write_bytes(b'jpg')
    with database.SessionLocal() as db:
        populate(db, owner, photo); populate(db, other, other_photo); db.commit()
    closed = client.delete('/api/v1/users/account', headers=headers).json()
    assert closed['status'] == 'account_closed'
    assert closed['erase_after'] == (datetime.utcnow() + timedelta(days=30)).date().isoformat()
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401  # access stops immediately
    with database.SessionLocal() as db:
        assert owner not in account_erasure.due_accounts(db)  # still inside the 30-day window
        assert owner in account_erasure.due_accounts(db, now=datetime.utcnow() + timedelta(days=31))
        assert account_erasure.erase_account(db, owner) == 1; db.commit()
        assert account_erasure.remaining_rows(db, owner) == {}
        assert not photo.exists()
        # The other account and its file are untouched.
        assert other_photo.exists() and db.get(models.User, other) is not None
        assert db.query(models.SupportTicket).filter_by(user_id=other).count() == 1
        assert db.query(models.SavedMeal).filter_by(user_id=other).count() == 1


def test_active_accounts_are_never_erased_or_due(uploads):
    owner, _ = account()
    with database.SessionLocal() as db:
        with pytest.raises(ValueError): account_erasure.erase_account(db, owner)
        assert owner not in account_erasure.due_accounts(db, now=datetime.utcnow() + timedelta(days=3650))
        assert db.get(models.User, owner) is not None


def test_zero_day_window_erases_on_the_next_run(uploads, monkeypatch):
    monkeypatch.setenv('ACCOUNT_ERASURE_DAYS', '0')
    owner, headers = account()
    client.delete('/api/v1/users/account', headers=headers)
    with database.SessionLocal() as db:
        assert owner in account_erasure.due_accounts(db)


def test_files_outside_the_uploads_folder_are_never_deleted(uploads, tmp_path_factory):
    outside = tmp_path_factory.mktemp('elsewhere') / 'keep.txt'; outside.write_text('keep')
    owner, headers = account()
    with database.SessionLocal() as db:
        db.add(models.FoodImage(user_id=owner, storage_path=str(outside), original_filename='x', file_size_bytes=4, mime_type='text/plain')); db.commit()
    client.delete('/api/v1/users/account', headers=headers)
    with database.SessionLocal() as db:
        assert account_erasure.erase_account(db, owner) == 0
    assert outside.exists()


def test_invalid_erasure_window_is_rejected(monkeypatch):
    for bad in ('-1', '366', 'thirty'):
        monkeypatch.setenv('ACCOUNT_ERASURE_DAYS', bad)
        with pytest.raises(RuntimeError): account_erasure.erasure_days()
