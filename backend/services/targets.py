"""Daily food targets from the person's profile, goal and health report, with every step explained.

Energy: Mifflin-St Jeor resting energy x 1.375 (light daily life). Workouts are not in this number: logged workouts add back to the
day's budget when they happen, so they are never counted twice. Goal and pace adjust it; a safe floor applies; under 18s never
get a deficit. Protein comes from body weight and goal (capped by a kidney finding), fat is 28% of energy and carbs the rest.
Fibre and added sugar follow the health report when there is one. A manual value, if set, wins for that number.
"""
from __future__ import annotations

from datetime import datetime, timezone
from services.i18n import msg, tr

LOSS = {'gentle': msg('For gentle weight loss we take off {kcal} kcal.'), 'steady': msg('For steady weight loss we take off {kcal} kcal.'),
        'faster': msg('For faster weight loss we take off {kcal} kcal.')}
LOSS_FLOOR = {'gentle': msg('For gentle weight loss we take off {kcal} kcal, but never below {floor} kcal.'),
              'steady': msg('For steady weight loss we take off {kcal} kcal, but never below {floor} kcal.'),
              'faster': msg('For faster weight loss we take off {kcal} kcal, but never below {floor} kcal.')}

LIGHT_DAILY_LIFE = 1.375
DEFICIT = {'gentle': 250, 'steady': 500, 'fast': 750}
SURPLUS = {'gentle': 250, 'steady': 350, 'fast': 500}
PROTEIN_PER_KG = {'lose': 1.6, 'gain_muscle': 1.8, 'sport': 1.6, 'fit': 1.4, 'eat_better': 1.2, 'health_report': 1.2, 'unspecified': 1.2}
FLOOR = {'female': 1200, 'male': 1500, 'other': 1350, 'unspecified': 1350}
DEFAULTS = {'calories': 2000, 'protein': 60, 'carbs': 250, 'fat': 62, 'fibre': 28, 'added_sugar_max': 50}


def compute(prefs, latest_weight=None, report_plan=None, minor=False):
    """{'calories', 'protein', 'carbs', 'fat', 'fibre', 'added_sugar_max', 'complete', 'basis', 'explanation', 'manual'}."""
    weight = latest_weight or prefs.weight_kg
    age = datetime.now(timezone.utc).year - prefs.birth_year if prefs.birth_year else None
    minor = minor or prefs.age_group == 'under18' or (age is not None and age < 18)
    complete = bool(weight and prefs.height_cm and age)
    explanation, basis = [], {}
    if complete:
        sex_term = {'male': 5, 'female': -161}.get(prefs.sex, -78)  # unspecified: midway between the two equations
        bmr = 10 * weight + 6.25 * prefs.height_cm - 5 * age + sex_term
        tdee = bmr * LIGHT_DAILY_LIFE
        goal = 'fit' if minor and prefs.goal == 'lose' else prefs.goal
        reached = prefs.target_weight_kg and ((goal == 'lose' and weight <= prefs.target_weight_kg) or (goal == 'gain_muscle' and weight >= prefs.target_weight_kg))
        adjust = 0
        if goal == 'lose' and not minor and not reached:
            adjust = -DEFICIT.get(prefs.pace, 500)
        elif goal == 'gain_muscle' and not reached:
            adjust = SURPLUS.get(prefs.pace, 350)
        floor = FLOOR.get(prefs.sex, 1350)
        calories = max(floor, tdee + adjust) if adjust < 0 else tdee + adjust
        calories = int(round(calories / 10) * 10)
        basis = {'bmr': round(bmr), 'maintenance': round(tdee), 'adjustment': adjust, 'floor': floor, 'weight_kg': weight, 'age': age}
        explanation.append(tr('Your body uses about {kcal} kcal a day at rest (Mifflin-St Jeor, from your age, height, weight and sex).', kcal=round(bmr)))
        explanation.append(tr('With light daily activity that is about {kcal} kcal. Workouts you log are added to the day separately.', kcal=round(tdee)))
        if adjust < 0:
            pace = prefs.pace if prefs.pace in ('gentle', 'steady') else 'faster'
            text = (LOSS_FLOOR if calories == floor else LOSS)[pace]
            explanation.append(tr(text, kcal=-adjust, floor=floor))
        elif adjust > 0:
            explanation.append(tr('To build muscle we add {kcal} kcal.', kcal=adjust))
        elif reached:
            explanation.append(tr('You have reached your target weight, so this keeps you there.'))
        elif minor and prefs.goal == 'lose':
            explanation.append(tr('Under 18 there is no calorie deficit: growing bodies need full energy. The plan builds habits and strength instead.'))
        per_kg = PROTEIN_PER_KG.get(goal, 1.2)
    else:
        calories, per_kg, weight = DEFAULTS['calories'], None, None
        explanation.append(tr('Add your age, height and weight in your profile for targets made for you. Until then these are general adult values.'))
    protein = round(per_kg * weight) if per_kg and weight else DEFAULTS['protein']
    cap = (report_plan or {}).get('targets', {}).get('protein_g_per_kg')
    if cap and weight:
        protein = min(protein, round(cap * weight))
        explanation.append(tr('Protein is kept to about {cap} g per kg because of your kidney result.', cap=cap))
    elif per_kg:
        explanation.append(tr('Protein: {per_kg} g per kg of body weight for your goal.', per_kg=per_kg))
    protein = max(protein, 40)
    fat = round(calories * 0.28 / 9)
    carbs = max(round((calories - protein * 4 - fat * 9) / 4), 50)
    targets = (report_plan or {}).get('targets', {})
    fibre = max(targets.get('fibre_g', 0), round(calories / 1000 * 14))
    sugar = min(targets.get('added_sugar_g', 999), round(calories * 0.10 / 4))
    if targets:
        explanation.append(tr('Fibre and sugar follow your health report.'))
    out = {'calories': calories, 'protein': protein, 'carbs': carbs, 'fat': fat, 'fibre': fibre, 'added_sugar_max': sugar,
           'complete': complete, 'basis': basis, 'explanation': explanation, 'manual': []}
    override = getattr(prefs, 'target_override', None) or {}
    for key in ('calories', 'protein', 'carbs', 'fat'):
        if override.get(key):
            out[key] = override[key]
            out['manual'].append(key)
    if out['manual']:
        explanation.append('You set ' + ', '.join(out['manual']) + ' yourself; the rest are calculated.')
    return out
