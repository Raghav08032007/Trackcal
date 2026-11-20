"""The accuracy report: AI photo estimates are kept next to what the person saved (and later corrected), camera rep
counts are compared with corrections, barcode lookups give catalogue coverage. Only site admins see the report."""
import pytest

import database
import models
from tests.test_adventure import client, init
from tests.test_camera import tracking
from tests.test_item_reports import moderator
from tests.test_social import member
from tests.test_wellness import diary, food, session, update

D = '/api/v1/wellness/diary'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true')   # member() and moderator() make feed profiles


def area(name, days=90):
    body = client.get(f'/api/v1/accuracy?days={days}', headers=moderator()).json()
    return next(a for a in body['areas'] if a['area'] == name)


def sample(meal_id):
    with database.SessionLocal() as db:
        row = db.query(models.AccuracySample).filter_by(kind='food_photo', source_id=meal_id).first()
        return None if not row else (row.estimate, row.final, row.estimate_aux, row.final_aux)


def test_a_photo_meal_keeps_the_ai_estimate_next_to_what_was_saved_and_corrected():
    _, h, _ = member(); init(h)
    before = area('food_photo')['samples']
    body = diary(h, method='photo', ai_estimate={'calories': 450, 'grams': 300})   # the AI said 450 kcal, 300 g
    assert client.post(D, headers=h, json=body).status_code == 200                 # kept: 150 g at 200/100 g = 300 kcal
    assert sample(body['id']) == (450, 300, 300, 150)
    assert area('food_photo')['samples'] == before + 1
    body['items'] = [food(grams=200)]                                              # corrected later in the diary: 400 kcal
    assert client.put(f"{D}/{body['id']}", headers=h, json=body).status_code == 200
    assert sample(body['id']) == (450, 400, 300, 200)


def test_meals_that_were_not_ai_photos_are_not_counted():
    _, h, _ = member(); init(h)
    manual = diary(h)
    assert client.post(D, headers=h, json=manual).status_code == 200 and sample(manual['id']) is None
    photo_without_estimate = diary(h, method='photo')
    assert client.post(D, headers=h, json=photo_without_estimate).status_code == 200 and sample(photo_without_estimate['id']) is None
    assert client.post(D, headers=h, json=diary(h, method='photo', ai_estimate={'calories': -5, 'grams': 100})).status_code == 422


def test_camera_sets_are_compared_with_the_persons_correction():
    _, h, _ = member(); init(h)
    before = area('camera_reps')
    s = session(h, ['camera_squat'], tracking_method='camera')
    sets = [{'estimated_reps': 10, 'corrected_reps': None}, {'estimated_reps': 8, 'corrected_reps': 9}, {'estimated_reps': 5, 'corrected_reps': 9}]
    logged = [{'exercise_id': 'camera_squat', 'sets': [{'reps': r, 'load': 0, 'minutes': 0} for r in (10, 9, 9)]}]   # what was kept
    r = update(h, s, tracking=tracking(sets=sets), exercises=logged); assert r.status_code == 200, r.text
    after = area('camera_reps')
    assert after['sets'] == before['sets'] + 3
    squat = next(e for e in after['by_exercise'] if e['exercise'] == 'squat')
    assert squat['sets'] >= 3 and 0 < squat['within_one_rep'] <= 1


def test_the_report_has_targets_and_says_when_there_is_too_little_data():
    body = client.get('/api/v1/accuracy?days=7', headers=moderator()).json()
    assert body['days'] == 7 and {a['area'] for a in body['areas']} == {'food_photo', 'camera_reps', 'barcode_coverage'}
    for a in body['areas']:
        assert a['status'] in ('not_enough_data', 'meets_target', 'below_target', 'measured')
    assert 'coverage, not accuracy' in next(a for a in body['areas'] if a['area'] == 'barcode_coverage')['note']


def test_only_site_admins_see_the_report_and_people_get_their_samples_in_the_export():
    _, h, _ = member(); init(h)
    assert client.get('/api/v1/accuracy', headers=h).status_code == 403
    assert client.get('/api/v1/accuracy?days=3', headers=moderator()).status_code == 422
    body = diary(h, method='photo', ai_estimate={'calories': 320, 'grams': 250})
    client.post(D, headers=h, json=body)
    records_ = client.get('/api/v1/users/export', headers=h).json()['account_records']
    assert [r['source_id'] for r in records_['accuracy_samples']] == [body['id']]


def test_the_browser_route():
    from tests.test_web_gateway import browser, signed_up
    person = browser(); signed_up(person)
    assert person.get('/api/accuracy').status_code == 403
    assert person.get('/api/accuracy?days=abc').status_code == 422
