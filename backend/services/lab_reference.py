"""Blood tests TrackCal understands: what labs call them, their units, adult reference ranges, safety limits, and which plan rules
they trigger. A lab's own printed range is used before these defaults whenever the report has one.

Ranges are common adult reference intervals (ADA for glucose and HbA1c, NCEP ATP III for lipids, typical Indian lab intervals for
the rest). Safety limits are deliberately conservative. This is guidance for lifestyle planning, not a diagnosis; review by a
clinician before launch is recommended.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Test:
    code: str
    name: str
    unit: str
    aliases: tuple[str, ...]             # regular expressions, matched case-insensitively at a word boundary
    plausible: tuple[float, float]       # anything outside is a misread, not a result
    normal: dict                         # {'any': (low, high)} or per sex {'female': (...), 'male': (...)}; None = no bound
    convert: dict = field(default_factory=dict)   # other unit (lower case) -> factor to the canonical unit
    urgent: tuple[float | None, float | None] = (None, None)    # see a doctor today
    soon: tuple[float | None, float | None] = (None, None)      # see a doctor this week
    high_rule: str | None = None
    low_rule: str | None = None
    exclude: tuple[str, ...] = ()        # phrases that look like this test but are not (e.g. "estimated average glucose")
    explain_high: str = ''
    explain_low: str = ''


TESTS: tuple[Test, ...] = (
    Test('hba1c', 'HbA1c', '%', (r'hba1c', r'hb\s*a1c', r'glycated\s+ha?emoglobin', r'glycosylated\s+ha?emoglobin', r'a1c'), (3, 20),
         {'any': (None, 5.6)}, soon=(None, 10), high_rule='sugar',
         explain_high='Your average blood sugar over the last 3 months is above normal (5.7-6.4% is prediabetes, 6.5% or more is the diabetes range).'),
    Test('glucose_fasting', 'Fasting glucose', 'mg/dL', (r'(fasting|fbs|f\.?b\.?s|glucose[\s,-]*fasting|fasting\s+(blood\s+)?(sugar|glucose))',), (20, 1000),
         {'any': (70, 99)}, convert={'mmol/l': 18.0}, urgent=(54, 300), soon=(None, 200), high_rule='sugar', low_rule='glucose_low',
         exclude=(r'post', r'pp', r'random', r'average', r'insulin'),
         explain_high='Your fasting sugar is above normal (100-125 is prediabetes, 126 or more is the diabetes range).', explain_low='Your fasting sugar is low.'),
    Test('glucose_pp', 'Post-meal glucose', 'mg/dL', (r'post\s*prandial', r'\bpp(bs)?\b', r'2\s*h(ou)?rs?\s+(post|after)'), (20, 1000),
         {'any': (None, 139)}, convert={'mmol/l': 18.0}, urgent=(54, 300), high_rule='sugar', exclude=(r'average',),
         explain_high='Your sugar 2 hours after a meal is above normal.'),
    Test('cholesterol', 'Total cholesterol', 'mg/dL', (r'(total\s+)?cholesterol(,|\s)*(total|serum)?(?!.*(ldl|hdl|vldl|ratio))',), (50, 800),
         {'any': (None, 199)}, convert={'mmol/l': 38.67}, high_rule='cholesterol', exclude=(r'ldl', r'hdl', r'vldl', r'ratio', r'non'),
         explain_high='Your total cholesterol is above the desirable level of under 200.'),
    Test('ldl', 'LDL cholesterol', 'mg/dL', (r'ldl', r'low\s+density\s+lipoprotein'), (10, 500),
         {'any': (None, 129)}, convert={'mmol/l': 38.67}, soon=(None, 190), high_rule='cholesterol', exclude=(r'vldl', r'ratio', r'hdl\s*/'),
         explain_high='Your LDL ("bad" cholesterol, which can clog arteries) is above the healthy level.'),
    Test('hdl', 'HDL cholesterol', 'mg/dL', (r'hdl', r'high\s+density\s+lipoprotein'), (5, 200),
         {'female': (50, None), 'male': (40, None), 'any': (40, None)}, convert={'mmol/l': 38.67}, low_rule='hdl_low', exclude=(r'ratio', r'/\s*hdl', r'non'),
         explain_low='Your HDL ("good" cholesterol, which protects the heart) is lower than ideal.'),
    Test('triglycerides', 'Triglycerides', 'mg/dL', (r'triglycerides?', r'\btg\b'), (20, 5000),
         {'any': (None, 149)}, convert={'mmol/l': 88.57}, urgent=(None, 1000), soon=(None, 500), high_rule='triglycerides', exclude=(r'ratio',),
         explain_high='Your triglycerides (fat in the blood, raised by sugar, refined carbs and alcohol) are above normal.'),
    Test('hemoglobin', 'Haemoglobin', 'g/dL', (r'ha?emoglobin(?!\s*a1c)', r'\bhb\b(?!\s*a1c)', r'\bhgb\b'), (2, 25),
         {'female': (12.0, 15.5), 'male': (13.0, 17.0), 'any': (12.0, 17.0)}, convert={'g/l': 0.1}, urgent=(7, 20), soon=(9, None), low_rule='iron',
         exclude=(r'glyc', r'a1c', r'mean\s+corpuscular', r'mch'),
         explain_low='Your haemoglobin is low (anaemia), so your blood carries less oxygen. This often causes tiredness.'),
    Test('ferritin', 'Ferritin', 'ng/mL', (r'ferritin',), (1, 5000),
         {'female': (15, 150), 'male': (30, 400), 'any': (15, 400)}, convert={'ug/l': 1.0, 'µg/l': 1.0}, low_rule='iron',
         explain_low='Your iron stores (ferritin) are low.', explain_high='Your ferritin is high. This can have several causes; ask your doctor.'),
    Test('vitamin_d', 'Vitamin D', 'ng/mL', (r'vitamin\s*d', r'25[\s-]*(\(oh\)|oh|hydroxy)', r'cholecalciferol', r'calcidiol'), (2, 300),
         {'any': (30, 100)}, convert={'nmol/l': 0.4}, soon=(None, 150), low_rule='vitamin_d',
         explain_low='Your vitamin D is low (under 20 is deficient, 20-29 insufficient). It matters for bones, muscles and immunity.'),
    Test('vitamin_b12', 'Vitamin B12', 'pg/mL', (r'(vitamin\s*)?b\s*-?\s*12', r'cobalamin', r'cyanocobalamin'), (20, 5000),
         {'any': (200, 900)}, convert={'pmol/l': 1.355}, low_rule='b12',
         explain_low='Your vitamin B12 is low. It is common in vegetarians and matters for nerves and energy.'),
    Test('tsh', 'TSH (thyroid)', 'mIU/L', (r'\btsh\b', r'thyroid\s+stimulating\s+hormone'), (0.001, 200),
         {'any': (0.4, 4.5)}, convert={'uiu/ml': 1.0, 'µiu/ml': 1.0, 'miu/ml': 1.0}, soon=(0.1, 10), high_rule='thyroid_low', low_rule='thyroid_high',
         explain_high='Your TSH is high, which usually means an underactive thyroid. It can slow metabolism and cause tiredness.',
         explain_low='Your TSH is low, which can mean an overactive thyroid. Please discuss it with your doctor.'),
    Test('creatinine', 'Creatinine (kidney)', 'mg/dL', (r'creatinine(?!\s*(clearance|kinase|ratio))', r's\.?\s*creat'), (0.1, 20),
         {'female': (0.5, 1.1), 'male': (0.7, 1.3), 'any': (0.5, 1.3)}, convert={'umol/l': 1 / 88.4, 'µmol/l': 1 / 88.4}, urgent=(None, 4), soon=(None, 2), high_rule='kidney',
         exclude=(r'urine', r'ratio', r'clearance', r'kinase'),
         explain_high='Your creatinine is above normal, which can mean your kidneys are under strain. Your doctor should review this.'),
    Test('uric_acid', 'Uric acid', 'mg/dL', (r'uric\s+acid', r'urate'), (0.5, 25),
         {'female': (2.4, 6.0), 'male': (3.4, 7.0), 'any': (2.4, 7.0)}, convert={'umol/l': 1 / 59.48, 'µmol/l': 1 / 59.48}, soon=(None, 10), high_rule='uric_acid',
         explain_high='Your uric acid is high, which can cause gout (painful joints) and kidney stones.'),
    Test('alt', 'ALT (liver)', 'U/L', (r'\balt\b', r'sgpt', r'alanine\s+(amino)?transaminase'), (1, 5000),
         {'female': (None, 35), 'male': (None, 45), 'any': (None, 45)}, soon=(None, 200), high_rule='liver',
         explain_high='Your ALT (a liver enzyme) is raised. The most common cause is a fatty liver, which improves with weight loss and activity.'),
    Test('ast', 'AST (liver)', 'U/L', (r'\bast\b', r'sgot', r'aspartate\s+(amino)?transaminase'), (1, 5000),
         {'any': (None, 40)}, soon=(None, 200), high_rule='liver', exclude=(r'ratio', r'alt\s*/'),
         explain_high='Your AST (a liver enzyme) is raised.'),
    Test('potassium', 'Potassium', 'mmol/L', (r'potassium', r'\bk\+?\b'), (1, 10),
         {'any': (3.5, 5.1)}, convert={'meq/l': 1.0}, urgent=(3.0, 6.0),
         explain_high='Your potassium is outside the normal range.', explain_low='Your potassium is outside the normal range.'),
    Test('sodium', 'Sodium', 'mmol/L', (r'sodium', r'\bna\+?\b'), (90, 200),
         {'any': (135, 145)}, convert={'meq/l': 1.0}, urgent=(125, 155),
         explain_high='Your sodium is outside the normal range.', explain_low='Your sodium is outside the normal range.'),
)
BY_CODE = {t.code: t for t in TESTS}


def normal_range(test: Test, sex: str):
    return test.normal.get(sex) or test.normal.get('any') or next(iter(test.normal.values()))


def to_canonical(test: Test, value: float, unit: str | None):
    """The value in the test's own unit, or None when the unit can't be converted."""
    if not unit:
        return value
    u = unit.strip().lower().replace('mcg', 'ug').replace('μ', 'µ')
    if u == test.unit.lower() or u.replace('µ', 'u') == test.unit.lower().replace('µ', 'u'):
        return value
    for other, factor in test.convert.items():
        if u == other or u.replace('µ', 'u') == other.replace('µ', 'u'):
            return round(value * factor, 3)
    return None
