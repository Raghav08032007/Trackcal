"""Companion bond behind `advanced_progression`: earned only from real XP, never decays, nothing is bought."""
from datetime import date

import pytest

import database, models
from services import gamification
from tests.test_adventure import account, client, init

B = '/api/v1/adventure/bond'


@pytest.fixture(autouse=True)
def flag(monkeypatch):
    monkeypatch.setenv('FEATURE_ADVANCED_PROGRESSION', 'true')


def member():
    made = account()
    uid, h = made if isinstance(made, tuple) and isinstance(made[1], dict) else (made[1], made[0])
    init(h)
    return uid, h


def give(uid, companion, xp):
    with database.SessionLocal() as db:
        db.add(models.RewardEvent(user_id=uid, reward_key=f'test:{companion}:{xp}', kind='test', local_day=str(date.today()), xp=xp, companion_id=companion)); db.commit()


def bond(h):
    r = client.get(B, headers=h); assert r.status_code == 200, r.text
    return r.json()


def test_off_by_default(monkeypatch):
    uid, h = member(); monkeypatch.setenv('FEATURE_ADVANCED_PROGRESSION', 'false')
    assert client.get(B, headers=h).status_code == 404
    assert client.post(B, headers=h, json={'aura': 'none', 'title': ''}).status_code == 404


def test_xp_only_counts_for_a_bond_while_the_feature_is_on(monkeypatch):
    uid, h = member()
    with database.SessionLocal() as db:
        monkeypatch.setenv('FEATURE_ADVANCED_PROGRESSION', 'false')
        gamification.award(db, db.get(models.User, uid), 'saved_meal', date.today()); db.commit()
        monkeypatch.setenv('FEATURE_ADVANCED_PROGRESSION', 'true')
        gamification.award(db, db.get(models.User, uid), 'planner_learning', date.today()); db.commit()
    seen = bond(h)
    assert seen['xp'] == 10 and seen['companion'] == 'pip'


def test_stages_follow_earned_xp():
    uid, h = member()
    assert bond(h)['stage'] == 'new' and bond(h)['next']['remaining'] == 250
    give(uid, 'pip', 300)
    seen = bond(h)
    assert seen['stage'] == 'friends' and seen['next'] == {'name': 'Trusted partners', 'xp': 750, 'remaining': 450}
    assert seen['auras'] == ['none', 'glow'] and seen['titles'] == ['Steady friend']
    give(uid, 'pip', 1500)
    assert bond(h)['stage'] == 'team' and bond(h)['next'] is None


def test_each_companion_has_its_own_bond_and_unlocks_are_kept():
    uid, h = member(); give(uid, 'nova', 800)
    seen = bond(h)
    assert seen['xp'] == 0 and seen['stage'] == 'new'  # Pip is active, and Nova's XP isn't Pip's
    assert seen['others'] == [{'companion': 'nova', 'xp': 800, 'stage_name': 'Trusted partners'}]
    assert 'sparkle' in seen['auras']  # earned with any companion, kept for good


def test_only_earned_auras_and_titles_can_be_chosen():
    uid, h = member()
    assert client.post(B, headers=h, json={'aura': 'halo', 'title': ''}).status_code == 409
    assert client.post(B, headers=h, json={'aura': 'none', 'title': 'True teammate'}).status_code == 409
    assert client.post(B, headers=h, json={'aura': 'rainbow', 'title': ''}).status_code == 422
    give(uid, 'pip', 250)
    assert client.post(B, headers=h, json={'aura': 'glow', 'title': 'Steady friend'}).status_code == 200
    seen = bond(h)
    assert seen['aura'] == 'glow' and seen['title'] == 'Steady friend'
    assert client.get('/api/v1/adventure/summary', headers=h).json()['customization']['aura'] == 'glow'


def test_summary_stays_as_it_was_while_the_feature_is_off(monkeypatch):
    uid, h = member(); monkeypatch.setenv('FEATURE_ADVANCED_PROGRESSION', 'false')
    assert 'aura' not in client.get('/api/v1/adventure/summary', headers=h).json()['customization']


def test_browser_route():
    assert client.get('/api/adventure/bond').status_code in (401, 404)
