"""Today's three tasks, the streak they build, and the Health Score: all from the person's own data, each with its reason.

Tasks are chosen from what stays true all day (an injury to check on, a workout planned today, a report that asks for walks after
meals), so the list doesn't reshuffle as things get done. Most important first:
  1. pain check-in, while an injured or operated part is still recovering
  2. today's workout from the weekly plan
  3. a walk after lunch and dinner, when the blood report flags sugar (ADA)
  4. water up to the day's goal
  5. log two meals
  6. log last night's sleep
  7. 20 active minutes (WHO: 150 a week is about 20 a day)
A task counts as done from the data itself (water reached, meals logged...), or when the person ticks it (the walk).

The streak counts days with at least one task done. One missed day a week is covered automatically, and planned rest days keep it
going (services/gamification.flexible_streak).

The Health Score (0-100) is a lifestyle score over the last 7 days, never a medical one, and never uses blood values:
  activity 25%   active minutes against 150 a week (WHO physical activity guidelines 2020)
  sleep 20%      nights of 7-9 hours (American Academy of Sleep Medicine; National Sleep Foundation)
  nutrition 25%  calories within 10% of the day's target and protein near target (ICMR-NIN 2020 for the targets)
  water 15%      the day's water goal
  steadiness 15% days with a task done
A part with no data that week is left out and the rest are re-weighted, so not logging something never counts as failing it.
"""
from __future__ import annotations

WEIGHTS = {'activity': 25, 'sleep': 20, 'nutrition': 25, 'water': 15, 'steadiness': 15}
SOURCES = {'activity': 'WHO physical activity guidelines 2020: 150-300 minutes a week',
           'sleep': 'American Academy of Sleep Medicine and National Sleep Foundation: 7-9 hours for adults',
           'nutrition': 'Your daily targets (Mifflin-St Jeor energy; ICMR-NIN 2020 protein)',
           'water': 'Your daily water goal', 'steadiness': 'Days you completed at least one task'}
NAMES = {'activity': 'Activity', 'sleep': 'Sleep', 'nutrition': 'Nutrition', 'water': 'Water', 'steadiness': 'Steadiness'}
TIPS = {'activity': 'Add a 20-minute walk or a short camera workout on 3 more days this week.',
        'sleep': 'Aim for 7-9 hours: a fixed bedtime and no screens for the last half hour help most.',
        'nutrition': 'Log two meals a day and keep close to your calorie and protein targets.',
        'water': 'Keep a bottle in sight and have a glass with each meal.',
        'steadiness': 'Finish one of today\'s three tasks each day: small and steady counts most.'}
WEEK_ACTIVE_MIN, DAY_ACTIVE_MIN, GLASS_ML = 150, 20, 250


def choose_tasks(ctx):
    """ctx: injured (list of part names still recovering), checked_in (bool), plan_today ({'name', 'minutes', 'done'} or None),
    post_meal_walk (bool), walk_done (bool), water_ml, water_goal_ml, meals_today, sleep_logged (bool), active_min_today, move_done.
    Returns the three most important tasks: {'id', 'title', 'why', 'done', 'tick' (ticked by hand), 'href'}."""
    tasks = []
    if ctx.get('injured'):
        parts = ctx['injured']
        tasks.append({'id': 'checkin', 'title': f"Check in on your {parts[0]}" + (f" and {len(parts) - 1} more" if len(parts) > 1 else ''),
                      'why': 'Your daily pain score moves your recovery stage safely.', 'done': bool(ctx.get('checked_in')), 'tick': False, 'href': '/recovery'})
    plan = ctx.get('plan_today')
    if plan:
        tasks.append({'id': 'plan', 'title': f"{plan['name']}, {plan['minutes']} minutes", 'why': "Today's session from your weekly plan.",
                      'done': bool(plan.get('done')), 'tick': False, 'href': '/plan'})
    if ctx.get('post_meal_walk'):
        tasks.append({'id': 'walk', 'title': 'Walk 10 minutes after lunch and dinner', 'why': 'Your report flags blood sugar; walks after meals lower the rise (ADA).',
                      'done': bool(ctx.get('walk_done')), 'tick': True, 'href': None})
    goal = ctx.get('water_goal_ml') or 2000
    left = max(0, goal - (ctx.get('water_ml') or 0))
    glasses = -(-left // GLASS_ML)
    tasks.append({'id': 'water', 'title': 'Water goal reached' if not left else f"Drink {glasses} more glass{'es' if glasses != 1 else ''} of water",
                  'why': f'Your goal is {goal / 1000:g} litres today.', 'done': not left, 'tick': False, 'href': '/'})
    tasks.append({'id': 'meals', 'title': 'Log two meals', 'why': 'Logged meals make your calorie and protein numbers accurate.',
                  'done': (ctx.get('meals_today') or 0) >= 2, 'tick': False, 'href': '/food'})
    tasks.append({'id': 'sleep', 'title': "Log last night's sleep", 'why': 'Sleep is a fifth of your Health Score.', 'done': bool(ctx.get('sleep_logged')), 'tick': False, 'href': '/'})
    tasks.append({'id': 'move', 'title': f'Move for {DAY_ACTIVE_MIN} minutes', 'why': 'About 150 minutes a week is the WHO guideline.',
                  'done': (ctx.get('active_min_today') or 0) >= DAY_ACTIVE_MIN or bool(ctx.get('move_done')), 'tick': True, 'href': '/move'})
    return tasks[:3]


def _night(hours):
    if 7 <= hours <= 9: return 100
    if 6 <= hours < 7 or 9 < hours <= 10: return 70
    if 5 <= hours < 6: return 40
    return 20


def _energy(ratio):
    off = abs(ratio - 1)
    return 100 if off <= .10 else 70 if off <= .20 else 40 if off <= .35 else 20


def health_score(days, targets, task_days):
    """days: the last 7 days, [{'water_ml', 'water_goal_ml', 'sleep_hours', 'active_min', 'kcal', 'protein', 'meals'}];
    targets: {'calories', 'protein'}; task_days: how many of those 7 days had a task done.
    Returns {'score' (None with fewer than 2 parts), 'parts': [{'id', 'name', 'score', 'detail', 'source', 'weight'}], 'focus'}."""
    parts = {}
    active = [d.get('active_min') or 0 for d in days]
    if any(active):
        week = sum(active); parts['activity'] = (min(100, round(100 * week / WEEK_ACTIVE_MIN)), f'{week} of {WEEK_ACTIVE_MIN} active minutes this week')
    nights = [d['sleep_hours'] for d in days if d.get('sleep_hours')]
    if nights:
        parts['sleep'] = (round(sum(_night(h) for h in nights) / len(nights)), f'{sum(7 <= h <= 9 for h in nights)} of {len(nights)} logged nights had 7-9 hours')
    fed = [d for d in days if (d.get('meals') or 0) >= 2 and d.get('kcal')]
    if fed and targets.get('calories'):
        def day_score(d):
            e = _energy(d['kcal'] / targets['calories'])
            p = 100 if not targets.get('protein') else 100 if d.get('protein', 0) >= .9 * targets['protein'] else 70 if d.get('protein', 0) >= .7 * targets['protein'] else 40
            return .6 * e + .4 * p
        on = sum(abs(d['kcal'] / targets['calories'] - 1) <= .10 for d in fed)
        parts['nutrition'] = (round(sum(day_score(d) for d in fed) / len(fed)), f'{on} of {len(fed)} fully logged days within 10% of your calorie target')
    wet = [d for d in days if d.get('water_ml')]
    if wet:
        parts['water'] = (round(100 * sum(min(1, d['water_ml'] / (d.get('water_goal_ml') or 2000)) for d in wet) / len(wet)),
                          f"{sum(d['water_ml'] >= (d.get('water_goal_ml') or 2000) for d in wet)} of {len(wet)} days reached the water goal")
    if task_days or parts:
        parts['steadiness'] = (round(100 * task_days / 7), f'{task_days} of the last 7 days with a task done')
    out = [{'id': k, 'name': NAMES[k], 'score': v[0], 'detail': v[1], 'source': SOURCES[k], 'weight': WEIGHTS[k]} for k, v in parts.items()]
    if len(out) < 2:
        return {'score': None, 'parts': out, 'focus': None, 'note': 'Log a few days of meals, water, sleep or activity to see your Health Score.'}
    total = sum(p['weight'] for p in out)
    score = round(sum(p['score'] * p['weight'] for p in out) / total)
    low = min(out, key=lambda p: (p['score'], -p['weight']))
    return {'score': score, 'parts': out, 'focus': {'id': low['id'], 'name': low['name'], 'tip': TIPS[low['id']]} if low['score'] < 90 else None,
            'note': 'A lifestyle score from the last 7 days. It is not a medical assessment and does not use your blood results.'}
