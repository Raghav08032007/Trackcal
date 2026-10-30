"""Bench seed: one demo account with 30 days of realistic, identical-every-run data (Version A or B).

  DB_NAME=trackcal_phase3_test python tools/bench/seed.py

Refuses any database whose name doesn't contain 'test' or 'bench'. Re-running deletes the demo account first, so
every run starts from the same state. Dates are relative to today in Asia/Kolkata (the server's clock can't be
frozen without changing app code; the browser clock is fixed to 10:00 IST on the same day). Writes go straight to
the database through the app's models so meals and workouts can carry past dates. Prints JSON with the account.
Water and other device-only records are added by the harness through browser storage.
"""
import json
import os
import random
import sys
import uuid
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parents[2]
ROOT = Path(os.environ.get('BENCH_REPO') or HERE)  # the checkout being measured (a frozen worktree has no .env of its own)
sys.path.insert(0, str(ROOT / 'backend'))
os.chdir(ROOT / 'backend')
from dotenv import load_dotenv  # noqa: E402
load_dotenv(HERE / 'backend' / '.env')
import database, models  # noqa: E402
from routers.auth import _hash_password  # noqa: E402

EMAIL, PASSWORD = 'bench-demo@tests.example.com', 'Bench-demo-password-2026!'
UNKNOWN_BARCODE = '8909999000010'  # valid check digit; cached as 'not found' so J4 never depends on Open Food Facts
IST = ZoneInfo('Asia/Kolkata')
MEALS = {  # (name, grams, kcal/100g, protein, carbs, fat)
    'breakfast': [('Idli with sambar', 250, 95, 3.8, 17.0, 1.2), ('Poha', 200, 130, 2.6, 24.0, 3.0), ('Masala oats', 220, 105, 3.5, 17.5, 2.4)],
    'lunch': [('Rice, dal and beans poriyal', 420, 120, 4.0, 21.0, 2.2), ('Chapati with paneer curry', 330, 165, 7.0, 16.0, 8.0), ('Veg biryani with raita', 380, 150, 3.8, 22.0, 5.0)],
    'snack': [('Banana', 120, 89, 1.1, 23.0, 0.3), ('Roasted chana', 40, 360, 20.0, 58.0, 5.0), ('Curd', 150, 60, 3.1, 4.7, 3.3)],
    'dinner': [('Ragi dosa with chutney', 260, 140, 3.6, 22.0, 4.0), ('Lemon rice', 300, 160, 3.0, 28.0, 4.2), ('Vegetable khichdi', 340, 115, 4.2, 18.0, 2.8)],
}
WORKOUTS = [('Morning walk', 'walk', [{'reps': 0, 'load': 0, 'minutes': 25}]), ('Bodyweight basics', 'strength', [{'reps': 12, 'load': 0, 'minutes': 0}, {'reps': 10, 'load': 0, 'minutes': 0}]),
            ('Gentle yoga', 'yoga', [{'reps': 0, 'load': 0, 'minutes': 20}])]


def utc(local):
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def main():
    name = database.engine.url.database or ''
    if 'test' not in name and 'bench' not in name:
        sys.exit(f'Refusing to seed database "{name}": use a disposable test or bench database.')
    rng = random.Random(20261030)  # same choices every run
    today = datetime.now(IST).date()
    with database.SessionLocal() as db:
        old = db.query(models.User).filter_by(email=EMAIL).first()
        if old: db.delete(old); db.commit()
        user = models.User(email=EMAIL, hashed_password=_hash_password(PASSWORD), email_verified=True)
        db.add(user); db.flush()
        db.add(models.UserProfile(user_id=user.id, display_name='Bench Demo'))
        db.add(models.PersonalizationProfile(user_id=user.id, preferences={'timezone': 'Asia/Kolkata', 'display_name': 'Bench Demo', 'age_group': '20_64'}, step=6, revision=1, completed_at=utc(datetime.combine(today - timedelta(days=30), time(9), IST)), updated_at=datetime.now(timezone.utc).replace(tzinfo=None)))
        db.add(models.AdventureProfile(user_id=user.id, timezone='Asia/Kolkata', created_at=utc(datetime.combine(today - timedelta(days=30), time(9), IST))))
        meals = workouts = 0
        for back in range(30, 0, -1):  # 30 past days; today starts empty so journeys can log into it
            day = today - timedelta(days=back)
            for slot, hour in (('breakfast', 8), ('lunch', 13), ('snack', 17), ('dinner', 20)):
                if slot == 'snack' and rng.random() < 0.4: continue
                label, grams, kcal, p, c, f = rng.choice(MEALS[slot])
                log = models.MealLog(user_id=user.id, logged_at=utc(datetime.combine(day, time(hour, rng.randint(0, 50)), IST)), meal_type=models.MealType(slot), log_method=models.LogMethod.manual,
                                     total_calories=round(kcal * grams / 100, 1), total_protein_g=round(p * grams / 100, 1), total_carbs_g=round(c * grams / 100, 1), total_fat_g=round(f * grams / 100, 1))
                db.add(log); db.flush()
                db.add(models.MealItem(meal_log_id=log.id, display_name=label, quantity_g=grams, serving_label='User reviewed · Bench seed', calories=log.total_calories, protein_g=log.total_protein_g, carbs_g=log.total_carbs_g, fat_g=log.total_fat_g, user_confirmed=True))
                db.add(models.RewardEvent(user_id=user.id, reward_key=f'meal:{log.id}', kind='meal', local_day=str(day), xp=10, created_at=log.logged_at)) if slot == 'lunch' else None
                meals += 1
            if back % 3 == 0:
                label, kind, sets = WORKOUTS[(back // 3) % len(WORKOUTS)]
                start = utc(datetime.combine(day, time(7, 0), IST))
                db.add(models.WorkoutSession(user_id=user.id, name=label, status='completed', details={'exercises': [{'exercise_id': kind, 'sets': sets}], 'notes': '', 'tracking_method': 'manual'},
                                             revision=2, active_seconds=1500, recorded_minutes=25, started_at=start, completed_at=start + timedelta(minutes=25), is_deleted=False))
                workouts += 1
        for label, grams, kcal, p, c, f in (MEALS['breakfast'][0], MEALS['lunch'][0], MEALS['snack'][1]):
            db.add(models.FoodFavorite(user_id=user.id, food_key=label.lower().replace(' ', '-')[:120], snapshot={'name': label, 'grams': grams, 'nutrients': {'calories': kcal, 'protein': p, 'carbs': c, 'fat': f}, 'food_id': None, 'manual_override': True, 'estimated': False, 'source': 'Bench seed'}))
        saved = [{'name': n, 'grams': g, 'nutrients': {'calories': k, 'protein': p, 'carbs': c, 'fat': f}, 'food_id': None, 'manual_override': True, 'estimated': False, 'source': 'Bench seed'} for n, g, k, p, c, f in (MEALS['breakfast'][0],)]
        db.add(models.SavedMeal(user_id=user.id, name='Usual breakfast', meal_type=models.MealType.breakfast, items_snapshot=saved, total_calories=237.5))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.merge(models.BarcodeCache(barcode=UNKNOWN_BARCODE, found=False, product=None, fetched_at=now, expires_at=now + timedelta(hours=23)))
        db.commit()
        print(json.dumps({'barcode_not_found': UNKNOWN_BARCODE, 'email': EMAIL, 'password': PASSWORD, 'user_id': user.id, 'today': str(today), 'meals': meals, 'workouts': workouts, 'favorites': 3, 'saved_meals': 1}))


if __name__ == '__main__':
    main()
