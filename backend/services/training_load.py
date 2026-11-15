"""Weekly summary and fitness trend (Phase G). Every number is computed on the server from what was really logged.

Effort: minutes x METs, from the Compendium of Physical Activities (Ainsworth et al., 2011 update). GPS runs and rides use their own
average speed; walks and hikes use their sport; workouts use their type. The sum is MET-minutes, the unit of the WHO guideline:
150-300 minutes of moderate activity a week is about 600-1200 MET-minutes (WHO 2020 physical activity guidelines).

Trend: the impulse-response ("fitness-fatigue") model used by training apps. Each day's MET-minutes feed
  fitness = 42-day exponentially weighted average, fatigue = 7-day one, form = fitness - fatigue.
The acute:chronic ratio (last 7 days against the last 28, per day) flags sudden jumps; above 1.5 is when injury risk rises
most (Gabbett, BJSM 2016), 0.8-1.3 is steady. These are estimates for guidance, not a medical assessment.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, timedelta

WHO_MIN, WHO_MORE = 600, 1200      # MET-minutes a week
BRISK_WALK_MET = 4.3
FITNESS_DAYS, FATIGUE_DAYS = 42, 7

# Workout types (routers/training.py CATEGORIES and templates) -> METs.
TEMPLATE_MET = {'walk': 3.5, 'run': 8.3, 'cycle': 6.8, 'strength': 3.8, 'gym': 5.0, 'chair': 2.3, 'mobility': 2.3, 'yoga': 2.5, 'recovery': 2.0}
CATEGORY_MET = {'endurance': 5.0, 'bodyweight': 3.8, 'strength': 5.0, 'mobility': 2.3, 'yoga': 2.5, 'recovery': 2.0, 'camera': 3.8}
# Camera exercises that get the heart going: vigorous calisthenics (8.0); the rest moderate (3.8).
CAMERA_CARDIO = {'jack', 'highknee', 'burpee', 'climber', 'buttkick', 'punch', 'squatjump', 'tuckjump', 'jumplunge', 'sumojump', 'thruster', 'kbswing', 'snatch', 'cleanpress'}
KIND_OF_TEMPLATE = {'walk': 'walk', 'run': 'run', 'cycle': 'ride'}
# Hand-logged workouts: a word in the name decides; anything else counts as moderate (4.0).
NAME_MET = [(('run', 'jog'), 8.3, 'run'), (('cycl', 'bike', 'ride', 'spin'), 6.8, 'ride'), (('swim',), 6.0, 'other'), (('hike', 'trek'), 6.0, 'walk'),
            (('walk',), 3.5, 'walk'), (('yoga', 'pilates'), 2.5, 'mobility'), (('stretch', 'mobility'), 2.3, 'mobility'),
            (('hiit', 'circuit', 'crossfit', 'boxing', 'skipping', 'jump rope'), 8.0, 'strength'), (('weight', 'gym', 'lift', 'strength'), 5.0, 'strength')]


def _interp(table, x):
    """Linear between (x, met) points, held flat beyond the ends."""
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


# Compendium codes 12xxx (running), 01xxx (cycling), 17xxx (walking): speed in km/h -> METs.
RUN = [(6.4, 6.0), (8.0, 8.3), (9.7, 9.8), (11.3, 11.0), (12.9, 11.8), (14.5, 12.8), (16.1, 14.5)]
RIDE = [(12.0, 4.0), (16.0, 6.8), (19.3, 8.0), (22.5, 10.0), (25.7, 12.0)]
WALK = [(3.2, 2.8), (4.0, 3.0), (4.8, 3.5), (5.6, 4.3), (6.4, 5.0), (7.2, 7.0)]


def activity_met(sport, distance_m, moving_s):
    kmh = distance_m / moving_s * 3.6 if moving_s else 0.0
    if sport == 'run':
        return _interp(RUN, kmh)
    if sport == 'ride':
        return _interp(RIDE, kmh)
    if sport == 'hike':
        return 6.0
    return _interp(WALK, kmh)


def session_met(details, categories):
    """METs and kind of a logged workout from its exercises; the most demanding one sets the pace."""
    tracking = (details or {}).get('tracking') or {}
    if tracking.get('exercise_type'):
        return (8.0 if tracking['exercise_type'] in CAMERA_CARDIO else 3.8), 'strength'
    best, kind = 0.0, 'other'
    for e in (details or {}).get('exercises') or []:
        key = e.get('exercise_id', '')
        met = TEMPLATE_MET.get(key) or CATEGORY_MET.get(categories.get(key, ''), 3.8)
        if met > best:
            best = met
            kind = KIND_OF_TEMPLATE.get(key) or ('mobility' if categories.get(key) in ('mobility', 'yoga', 'recovery') else 'strength')
    return (best or 3.8), kind


def entry_met(name):
    low = (name or '').lower()
    for words, met, kind in NAME_MET:
        if any(w in low for w in words):
            return met, kind
    return 4.0, 'other'


def ewma(values, days):
    k = 1 - math.exp(-1 / days)
    out, level = [], 0.0
    for v in values:
        level += k * (v - level)
        out.append(level)
    return out


def summarise(items, today: date, weeks=12):
    """items: (local day, minutes, METs, kind, distance_m). Weekly totals (Monday to Sunday, oldest first) and the daily trend."""
    first_week = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)
    start = first_week - timedelta(days=FITNESS_DAYS * 2)      # warm-up, so the oldest shown week isn't measured from zero
    daily = defaultdict(float)
    week_rows = {first_week + timedelta(weeks=i): {'minutes': 0.0, 'met_minutes': 0.0, 'distance_m': 0.0, 'days': set(), 'sessions': 0,
                                                     'by_kind': defaultdict(float)} for i in range(weeks)}
    seen = []
    for day, minutes, met, kind, distance in items:
        if day < start or day > today or minutes <= 0:
            continue
        load = minutes * met
        daily[day] += load
        seen.append(day)
        monday = day - timedelta(days=day.weekday())
        w = week_rows.get(monday)
        if w is not None:
            w['minutes'] += minutes; w['met_minutes'] += load; w['distance_m'] += distance or 0; w['days'].add(day); w['sessions'] += 1
            w['by_kind'][kind] += load
    span = (today - start).days + 1
    loads = [daily[start + timedelta(days=i)] for i in range(span)]
    fit, fat = ewma(loads, FITNESS_DAYS), ewma(loads, FATIGUE_DAYS)
    shown = weeks * 7
    days = [{'day': (start + timedelta(days=i)).isoformat(), 'load': round(loads[i]), 'fitness': round(fit[i], 1), 'fatigue': round(fat[i], 1),
             'form': round(fit[i] - fat[i], 1)} for i in range(span - shown, span)]
    acute, chronic = sum(loads[-7:]) / 7, sum(loads[-28:]) / 28
    history_days = (today - min(seen)).days + 1 if seen else 0
    active_28 = len({d for d in seen if (today - d).days < 28})
    enough = history_days >= 21 and active_28 >= 3
    ratio = round(acute / chronic, 2) if chronic > 0 and enough else None
    this_week = week_rows[today - timedelta(days=today.weekday())]
    return {
        'today': today.isoformat(),
        'weeks': [{'start': monday.isoformat(), 'minutes': round(w['minutes']), 'met_minutes': round(w['met_minutes']), 'distance_m': round(w['distance_m']),
                   'active_days': len(w['days']), 'sessions': w['sessions'], 'by_kind': {k: round(v) for k, v in w['by_kind'].items()}}
                  for monday, w in sorted(week_rows.items())],
        'guideline': guideline(round(this_week['met_minutes']), today.weekday() + 1),
        'trend': {'days': days, 'fitness': days[-1]['fitness'], 'fatigue': days[-1]['fatigue'], 'form': days[-1]['form'], 'ratio': ratio,
                  'enough_history': enough, 'message': advice(ratio, enough)},
    }


def guideline(met_minutes, days_in):
    if met_minutes >= WHO_MORE:
        status, text = 'more', 'You’re above the WHO level for extra health benefits this week.'
    elif met_minutes >= WHO_MIN:
        status, text = 'met', 'You’ve met the WHO weekly activity guideline. Going on to 1,200 brings extra benefits.'
    else:
        need = WHO_MIN - met_minutes
        status, text = 'building', f'{need:,} MET-minutes to the WHO weekly minimum: about {math.ceil(need / BRISK_WALK_MET / 5) * 5} minutes of brisk walking.'
    return {'met_minutes': met_minutes, 'minimum': WHO_MIN, 'more': WHO_MORE, 'status': status, 'text': text, 'days_into_week': days_in}


def advice(ratio, enough):
    if not enough:
        return 'Your trend appears after three weeks with a few active days. Until then, every session still counts in your weekly totals.'
    if ratio is None:
        return 'No activity in the last four weeks. Start gently: a few short sessions rebuild the habit safely.'
    if ratio > 1.5:
        return 'This week is much bigger than your recent weeks. Big jumps are when injuries happen most, so keep the next few days easy.'
    if ratio > 1.3:
        return 'You’re building quickly. Fine for a week; avoid stacking another big jump on top.'
    if ratio >= 0.8:
        return 'Steady: you’re training at a level your body is used to. A good place to build from.'
    return 'Lighter than usual. Good for recovery; if it wasn’t planned, a short session keeps your fitness ticking over.'
