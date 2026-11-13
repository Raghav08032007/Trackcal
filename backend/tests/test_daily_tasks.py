"""D3: today's tasks come from the person's data; the Health Score matches hand-worked examples."""
from datetime import date, timedelta

from services.daily_tasks import choose_tasks, health_score
from services.gamification import flexible_streak

BASE = dict(water_ml=500, water_goal_ml=2000, meals_today=0, sleep_logged=False, active_min_today=0)


def ids(ctx):
    return [t['id'] for t in choose_tasks({**BASE, **ctx})]


def test_the_most_important_tasks_come_first():
    assert ids({'injured': ['lower back'], 'plan_today': {'name': 'Comfortable walk', 'minutes': 20, 'done': False}, 'post_meal_walk': True}) == ['checkin', 'plan', 'walk']
    assert ids({'post_meal_walk': True}) == ['walk', 'water', 'meals']
    assert ids({}) == ['water', 'meals', 'sleep']


def test_tasks_stay_put_and_tick_off_from_the_data():
    morning = choose_tasks({**BASE})
    evening = choose_tasks({**BASE, 'water_ml': 2100, 'meals_today': 2})
    assert [t['id'] for t in morning] == [t['id'] for t in evening]          # the list doesn't reshuffle as things get done
    assert [t['done'] for t in evening] == [True, True, False]
    assert morning[0]['title'] == 'Drink 6 more glasses of water'            # 1500 ml left, 250 ml glasses


def test_health_score_matches_a_hand_worked_week():
    days = [dict(water_ml=2000, water_goal_ml=2000, sleep_hours=8, active_min=30, kcal=2000, protein=60, meals=3)] * 5 + \
           [dict(water_ml=1000, water_goal_ml=2000, sleep_hours=6, active_min=0, kcal=2600, protein=40, meals=2)] * 2
    out = health_score(days, {'calories': 2000, 'protein': 60}, task_days=5)
    parts = {p['id']: p['score'] for p in out['parts']}
    # activity: 150 of 150 minutes = 100. sleep: (5 x 100 + 2 x 70) / 7 = 91.4 -> 91.
    # nutrition: on-target days .6x100 + .4x100 = 100; 2600 kcal is 30% over -> 40, protein 40/60 = .67 -> 40: .6x40+.4x40 = 40 -> (500+80)/7 = 82.9 -> 83.
    # water: (5 x 100 + 2 x 50) / 7 = 85.7 -> 86. steadiness: 5/7 = 71.4 -> 71.
    assert parts == {'activity': 100, 'sleep': 91, 'nutrition': 83, 'water': 86, 'steadiness': 71}
    # weighted: (2500 + 1820 + 2075 + 1290 + 1065) / 100 = 87.5 -> 88
    assert out["score"] == 88 and out['focus']['id'] == 'steadiness'


def test_missing_data_is_left_out_not_counted_as_zero():
    out = health_score([dict(water_ml=2000, water_goal_ml=2000)] + [{}] * 6, {'calories': 2000}, task_days=1)
    assert {p['id'] for p in out['parts']} == {'water', 'steadiness'}
    assert out['score'] == round((100 * 15 + 14 * 15) / 30)
    assert health_score([{}] * 7, {'calories': 2000}, task_days=0)['score'] is None


def test_the_streak_forgives_one_missed_day_a_week_and_rest_days():
    today = date(2026, 11, 20)
    def day(n): return str(today - timedelta(days=n))
    one_miss = flexible_streak([day(n) for n in (0, 1, 2, 4, 5, 6)], [], today)
    assert one_miss['current'] == 7 and len(one_miss['protected_days']) == 1
    two_misses = flexible_streak([day(n) for n in (0, 1, 3, 5, 6)], [], today)
    assert two_misses['current'] < 7
    rested = flexible_streak([day(n) for n in (0, 2, 3)], [day(1)], today)
    assert rested['current'] == 4


def test_today_through_the_gateway():
    from tests.test_web_gateway import browser, post, signed_up
    c = browser(); signed_up(c)
    out = c.get('/api/personalization/today').get_json()
    assert [t['id'] for t in out['tasks']] == ['water', 'meals', 'sleep']
    assert out['health']['score'] is None and 'Log a few days' in out['health']['note']
    ticked = post(c, '/api/personalization/task-done', {'task': 'move', 'done': True})
    assert ticked.status_code == 200 and ticked.get_json()['streak']['current'] == 1   # a ticked task makes today count
    assert post(c, '/api/personalization/task-done', {'task': 'nap'}).status_code == 422
