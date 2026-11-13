"""From confirmed blood test values to a daily diet and exercise plan, with safety first.

Order of decisions: dangerous values stop everything ("see a doctor today", no plan); clearly abnormal values add "see a doctor
this week" but keep the lifestyle plan; everything else is a lifestyle plan. Under 18s get explanations, not a plan. Rules combine:
the strictest limit and the largest target win. Nothing here changes or suggests medicines.
"""
from __future__ import annotations

from services.lab_reference import BY_CODE, normal_range

VEG = {'vegetarian', 'eggetarian', 'vegan', 'jain'}

# Each rule: diet targets, food advice (veg and non-veg versions where they differ), exercise, retest.
RULES = {
    'sugar': {'targets': {'fibre_g': 30, 'added_sugar_g': 25}, 'exercise': {'cardio_min': 150, 'strength_days': 3, 'post_meal_walk': True}, 'retest_days': 90,
              'diet': ['Spread carbs across 3 meals and 1-2 snacks instead of one big rice or roti meal.',
                       'Swap white rice for millets (ragi, jowar, bajra), brown rice or half portions mixed with dal and vegetables.',
                       'Have protein at every meal: dal, paneer, curd, sprouts, chana{nonveg}.',
                       'No sugary drinks, packaged juice or sweets with tea.'],
              'move': ['Walk 10-15 minutes after lunch and dinner: it lowers the sugar spike from that meal.', 'Strength training 3 days a week: muscle uses blood sugar.']},
    'cholesterol': {'targets': {'fibre_g': 30, 'sat_fat_pct': 7}, 'exercise': {'cardio_min': 200, 'strength_days': 2}, 'retest_days': 90,
                    'diet': ['Reach 30 g fibre a day: oats, methi seeds, flaxseed, rajma, chana, vegetables and whole fruit.',
                             'Use less ghee and butter, and avoid vanaspati and deep-fried snacks (samosa, pakora, namkeen).',
                             'A small handful of almonds or walnuts most days.'],
                    'move': ['Aim for 200 minutes a week of brisk walking, cycling or swimming.']},
    'triglycerides': {'targets': {'fibre_g': 30, 'added_sugar_g': 20}, 'exercise': {'cardio_min': 150, 'strength_days': 2}, 'retest_days': 90,
                      'diet': ['Cut back on sweets, sugar in tea, fruit juice, maida and alcohol: they raise triglycerides most.',
                               'Add omega-3 foods: walnuts, flaxseed, chia{fish}.'],
                      'move': ['150 minutes a week of brisk activity lowers triglycerides within weeks.']},
    'hdl_low': {'targets': {}, 'exercise': {'cardio_min': 150, 'strength_days': 2, 'intervals_per_week': 2}, 'retest_days': 90,
                'diet': ['Use healthy fats in small amounts: nuts, seeds, groundnut or mustard oil, rather than vanaspati.', 'If you smoke, stopping raises HDL.'],
                'move': ['Two short interval sessions a week (fast walk 1 minute, easy 2 minutes) raise HDL.']},
    'iron': {'targets': {}, 'exercise': {'cardio_min': 90, 'strength_days': 2, 'intensity': 'moderate'}, 'retest_days': 90,
             'diet': ['Eat iron-rich foods daily: ragi, rajma, chana, spinach, amaranth, jaggery, dates{meat}.',
                      'Pair them with vitamin C (amla, lemon, guava, orange) so more iron is absorbed.',
                      'Keep tea and coffee at least an hour away from meals: they block iron.'],
             'move': ['Keep workouts light to moderate until your haemoglobin improves. Stop if you feel breathless or dizzy.']},
    'vitamin_d': {'targets': {}, 'exercise': {'strength_days': 2, 'outdoor_minutes': 20}, 'retest_days': 90,
                  'diet': ['Have fortified milk or curd daily{egg_fish}.', 'Take vitamin D supplements only as your doctor advises.'],
                  'move': ['Walk outdoors in morning sunlight for 15-20 minutes with arms uncovered.', 'Strength training twice a week protects your bones.']},
    'b12': {'targets': {}, 'exercise': {}, 'retest_days': 90,
            'diet': ['Have milk, curd, buttermilk or paneer every day{egg_fish}.', 'Vegetarians often need a B12 supplement: ask your doctor.'], 'move': []},
    'thyroid_low': {'targets': {}, 'exercise': {'cardio_min': 150, 'strength_days': 2, 'build_up': True}, 'retest_days': 60,
                    'diet': ['Eat regular meals and use iodised salt.', 'If you take thyroid medicine, take it as prescribed, on an empty stomach.'],
                    'move': ['Build up gradually: add 5-10 minutes a week rather than big jumps.', 'Strength training helps keep your metabolism up.']},
    'thyroid_high': {'targets': {}, 'exercise': {'intensity': 'moderate'}, 'retest_days': 42,
                     'diet': ['Eat enough: an overactive thyroid burns extra calories.'], 'move': ['Keep exercise moderate until your doctor has reviewed this.']},
    'kidney': {'targets': {'protein_g_per_kg': 0.8, 'sodium_mg': 2000}, 'exercise': {'intensity': 'moderate', 'no_high_protein': True}, 'retest_days': 90,
               'diet': ['Keep protein moderate (about 0.8 g per kg of body weight) and avoid protein powders unless your doctor agrees.',
                        'Keep salt under 5 g a day: less pickle, papad, namkeen and processed food.', 'Ask your doctor or a dietitian to review this plan.'],
               'move': ['Moderate activity such as walking and light strength work.']},
    'uric_acid': {'targets': {'water_l': 3}, 'exercise': {'cardio_min': 150, 'low_impact': True}, 'retest_days': 90,
                  'diet': ['Drink 2.5-3 litres of water a day.', 'Limit sugary drinks, alcohol{purine}.'],
                  'move': ['Choose low-impact exercise (walking, cycling, swimming), and rest painful joints during a flare.']},
    'liver': {'targets': {'added_sugar_g': 25}, 'exercise': {'cardio_min': 150, 'strength_days': 2}, 'retest_days': 90,
              'diet': ['Avoid alcohol completely while your liver enzymes are raised.', 'Cut refined carbs and sugar: maida, sweets, sugary drinks.',
                       'Losing 5-10% of body weight is the most effective treatment for a fatty liver.'],
              'move': ['150 minutes of brisk activity plus 2 strength days a week reduces liver fat even before weight changes.']},
    'glucose_low': {'targets': {}, 'exercise': {'intensity': 'light'}, 'retest_days': 30,
                    'diet': ['Do not skip meals; carry a snack.'], 'move': ['Avoid fasted workouts until a doctor has reviewed your low sugar.']},
}
# What each rule is about and the guideline behind it, shown with the plan so every change can be checked.
WHY = {'sugar': ('Blood sugar', 'ADA Standards of Care in Diabetes 2025; WHO physical activity guidelines 2020'),
       'cholesterol': ('Cholesterol', 'ACC/AHA 2018 cholesterol guideline; ACC/AHA 2019 primary prevention guideline'),
       'triglycerides': ('Triglycerides', 'AHA scientific statement on triglycerides (2011); Endocrine Society 2012'),
       'hdl_low': ('HDL ("good") cholesterol', 'ACC/AHA 2019 primary prevention guideline'),
       'iron': ('Iron and haemoglobin', 'WHO guideline on anaemia; ICMR-NIN dietary guidelines for Indians (2024)'),
       'vitamin_d': ('Vitamin D', 'Endocrine Society clinical practice guideline (2011)'),
       'b12': ('Vitamin B12', 'NIH Office of Dietary Supplements; ICMR-NIN 2020'),
       'thyroid_low': ('Thyroid (underactive)', 'American Thyroid Association'),
       'thyroid_high': ('Thyroid (overactive)', 'American Thyroid Association'),
       'kidney': ('Kidneys', 'KDIGO 2024 chronic kidney disease guideline'),
       'uric_acid': ('Uric acid', 'ACR 2020 gout guideline'),
       'liver': ('Liver', 'AASLD 2023 practice guidance on fatty liver disease'),
       'glucose_low': ('Low blood sugar', 'ADA Standards of Care in Diabetes 2025')}
ACTIVITY_SOURCE = 'WHO physical activity guidelines 2020: 150-300 minutes of moderate activity and 2 strength days a week'
INTENSITY = ['light', 'moderate', 'vigorous']


def _food(line, diet):
    veg = diet in VEG
    return (line.replace('{nonveg}', '' if veg else ', eggs, chicken or fish')
                .replace('{meat}', '' if veg else ', and lean meat, chicken or fish')
                .replace('{fish}', '' if veg else ' and fatty fish (salmon, mackerel, sardine) twice a week')
                .replace('{egg_fish}', ', and eggs' if diet == 'eggetarian' else '' if veg else ', eggs and fish')
                .replace('{purine}', ' and organ meat' if veg else ', organ meat, red meat and shellfish') )


def judge(result, sex):
    """Status and severity of one confirmed value, using the lab's printed range first."""
    test = BY_CODE[result['code']]
    low, high = normal_range(test, sex)
    lab = result.get('ref_low') is not None or result.get('ref_high') is not None
    if lab:
        low = result.get('ref_low') if result.get('ref_low') is not None else low
        high = result.get('ref_high') if result.get('ref_high') is not None else high
    v = result['value']
    status = 'high' if high is not None and v > high else 'low' if low is not None and v < low else 'normal'
    severity = 'ok' if status == 'normal' else 'watch'
    u_low, u_high = test.urgent
    s_low, s_high = test.soon
    if (u_low is not None and v < u_low) or (u_high is not None and v > u_high):
        severity = 'today'
    elif (s_low is not None and v < s_low) or (s_high is not None and v > s_high):
        severity = 'soon'
    rule = test.high_rule if status == 'high' else test.low_rule if status == 'low' else None
    explanation = test.explain_high if status == 'high' else test.explain_low if status == 'low' else f'Your {test.name} is in the normal range.'
    return {'code': test.code, 'name': test.name, 'value': v, 'unit': test.unit, 'low': low, 'high': high, 'range_from': 'your lab' if lab else 'standard adult range',
            'status': status, 'severity': severity, 'rule': rule, 'explanation': explanation, 'source': test.source}


def assess(results, sex='unspecified', age_group='unspecified', diet='balanced'):
    findings = [judge(r, sex) for r in results if r.get('code') in BY_CODE]
    worst = 'today' if any(f['severity'] == 'today' for f in findings) else 'soon' if any(f['severity'] == 'soon' for f in findings) else 'ok'
    out = {'findings': findings, 'safety': worst, 'plan': None,
           'safety_message': {'today': 'One or more results need a doctor today. Please contact your doctor or visit a clinic now. We have not made a diet or exercise plan until a doctor has seen these results.',
                              'soon': 'Some results should be reviewed by a doctor this week. The plan below is general lifestyle guidance and does not replace that visit.',
                              'ok': ''}[worst],
           'disclaimer': 'This explains your report and suggests lifestyle changes. It is not a diagnosis and never changes medicines. Discuss your report with your doctor.'}
    if worst == 'today':
        return out
    rules = list(dict.fromkeys(f['rule'] for f in findings if f['rule']))
    if age_group == 'under18':
        out['plan_note'] = 'Under 18: we explain your results, but a doctor should guide any plan.'
        return out
    if not rules:
        out['plan'] = {'rules': [], 'targets': {}, 'diet': [], 'move': ['Your results are in range. Keep up regular activity and balanced meals.'], 'exercise': {}, 'retest_days': 365}
        return out
    targets, exercise, diet_lines, move_lines, retest = {}, {}, [], [], 365
    for key in rules:
        rule = RULES[key]
        for name, value in rule['targets'].items():
            # Caps take the strictest (smallest) value, goals the largest.
            caps = {'added_sugar_g', 'sat_fat_pct', 'sodium_mg', 'protein_g_per_kg'}
            targets[name] = min(targets.get(name, value), value) if name in caps else max(targets.get(name, value), value)
        for name, value in rule['exercise'].items():
            if name == 'intensity':
                exercise[name] = min(exercise.get(name, 'vigorous'), value, key=INTENSITY.index)
            elif isinstance(value, bool):
                exercise[name] = exercise.get(name, False) or value
            else:
                exercise[name] = max(exercise.get(name, value), value)
        diet_lines += [_food(l, diet) for l in rule['diet']]
        move_lines += rule['move']
        retest = min(retest, rule['retest_days'])
    if exercise.get('intensity') in ('light', 'moderate'):
        exercise.pop('intervals_per_week', None)  # intervals wait until the reason for the limit is resolved
        move_lines = [l for l in move_lines if 'interval' not in l.lower()]
    why = [{'rule': key, 'about': WHY[key][0], 'source': WHY[key][1], 'retest_days': RULES[key]['retest_days']} for key in rules]
    out['plan'] = {'rules': rules, 'targets': targets, 'exercise': exercise, 'diet': list(dict.fromkeys(diet_lines)), 'move': list(dict.fromkeys(move_lines)), 'retest_days': retest,
                   'why': why, 'activity_source': ACTIVITY_SOURCE}
    return out
