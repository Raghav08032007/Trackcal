"""How far back a person's detailed history goes, and the monthly summaries everyone keeps.

Free: the last 7 days in full detail (meals, workouts, routes, daily wellness, check-ins), plus monthly summaries of everything.
Premium: full detail, however old. Nothing is ever deleted when Premium ends: older detail is only hidden, comes back on upgrading,
and the data export always includes everything. Blood reports are never limited: they are the person's medical results.

While billing is switched off (Premium cannot be bought yet), everyone keeps full history: a limit nobody can lift would be unfair.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

FREE_DAYS = 7
OLDER = ('Older detail is part of Premium. Nothing has been deleted: it is all still here and comes back the moment you upgrade. '
         'Your monthly summaries and your data export always include everything.')


def access(db, user, today: date) -> dict:
    """{'limited', 'from' (first day shown in detail, or None), 'free_days', 'premium', 'billing'}."""
    from services import billing
    on = billing.is_enabled(db, 'billing')
    premium = bool(on and billing.entitlements(db, user)['premium'])
    limited = bool(on and not premium)
    return {'limited': limited, 'from': str(today - timedelta(days=FREE_DAYS - 1)) if limited else None, 'free_days': FREE_DAYS,
            'premium': premium, 'billing': on}


def too_old(acc: dict, day: str) -> bool:
    return bool(acc['limited'] and day < acc['from'])


def utc_start(acc: dict, tz: str):
    """The window's first moment in naive UTC, for filtering stored timestamps; None when unlimited."""
    if not acc['limited']:
        return None
    return datetime.combine(date.fromisoformat(acc['from']), time.min, ZoneInfo(tz)).astimezone(timezone.utc).replace(tzinfo=None)


def monthly(days: list[dict]) -> list[dict]:
    """Per month, newest first: days with anything logged, meals, average calories on days with meals, average water and sleep,
    active minutes, workouts, and weight at the start and end. days: [{'day', 'meals', 'kcal', 'water_ml', 'sleep_hours',
    'active_min', 'workouts', 'weight_kg'}], any order."""
    out = {}
    for d in sorted(days, key=lambda d: d['day']):
        m = out.setdefault(d['day'][:7], {'month': d['day'][:7], 'days_logged': 0, 'meals': 0, 'kcal': [], 'water': [], 'sleep': [], 'active_min': 0,
                                           'workouts': 0, 'weight': []})
        logged = any((d.get('meals'), d.get('water_ml'), d.get('sleep_hours'), d.get('active_min'), d.get('workouts'), d.get('weight_kg')))
        m['days_logged'] += 1 if logged else 0
        m['meals'] += d.get('meals') or 0
        if d.get('meals'): m['kcal'].append(d.get('kcal') or 0)
        if d.get('water_ml'): m['water'].append(d['water_ml'])
        if d.get('sleep_hours'): m['sleep'].append(d['sleep_hours'])
        m['active_min'] += d.get('active_min') or 0
        m['workouts'] += d.get('workouts') or 0
        if d.get('weight_kg'): m['weight'].append(d['weight_kg'])
    avg = lambda xs, n=0: round(sum(xs) / len(xs), n) if xs else None
    return [{'month': m['month'], 'days_logged': m['days_logged'], 'meals': m['meals'], 'avg_kcal': avg(m['kcal']), 'avg_water_ml': avg(m['water']),
             'avg_sleep_h': avg(m['sleep'], 1), 'active_min': m['active_min'], 'workouts': m['workouts'],
             'weight_start': m['weight'][0] if m['weight'] else None, 'weight_end': m['weight'][-1] if m['weight'] else None}
            for m in sorted(out.values(), key=lambda m: m['month'], reverse=True) if m['days_logged']]
