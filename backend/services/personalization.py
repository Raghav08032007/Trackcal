"""Deterministic choices; no BMI, body changes, XP or paid inference affect plans."""
from datetime import timedelta

TEMPLATES={
 'walk':dict(name='Comfortable walk',interests=['fitness','endurance','sports','routine'],equipment=[],setting=['home','outdoor','gym'],seated=False,floor=False,instructions='Choose a familiar clear route. Begin slowly, keep a comfortable pace and take breaks whenever needed.',alternative='chair',difficulty='gentle'),
 'chair':dict(name='Seated movement break',interests=['fitness','mobility','routine'],equipment=['chair'],setting=['home','gym','outdoor'],seated=True,floor=False,instructions='Use a stable non-wheeled chair. Sit supported and gently move hands and shoulders within a comfortable range. Rest as needed.',alternative='recovery',difficulty='gentle'),
 'strength':dict(name='Wall push fundamentals',interests=['strength','fitness'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Stand comfortably facing a stable wall. Place hands against it, bend elbows slightly and return gently. Choose a few comfortable repetitions; do not push to fatigue.',alternative='chair',difficulty='beginner'),
 'gym':dict(name='Light resistance familiarization',interests=['strength'],equipment=['dumbbells'],setting=['gym','home'],seated=False,floor=False,instructions='Use a light weight you already know how to handle. Review technique with a qualified instructor before trying unfamiliar movements. Pause rather than increase load automatically.',alternative='strength',difficulty='beginner'),
 'run':dict(name='Walk and optional easy jog',interests=['running'],equipment=[],setting=['outdoor','gym'],seated=False,floor=False,instructions='Begin with a comfortable walk. Only if already comfortable with jogging, alternate a brief easy jog with longer walking breaks. Walking the whole session is a valid alternative.',alternative='walk',difficulty='beginner'),
 'mobility':dict(name='Gentle mobility practice',interests=['mobility','sports','fitness'],equipment=[],setting=['home','gym','outdoor'],seated=False,floor=False,instructions='Explore slow shoulder circles and gentle ankle movements while supported. Use only a comfortable range and avoid forcing stretches.',alternative='chair',difficulty='gentle'),
 'yoga':dict(name='Standing yoga introduction',interests=['yoga','mobility'],equipment=[],setting=['home','gym','outdoor'],seated=False,floor=False,instructions='Stand with support nearby. Try a comfortable upright posture and natural breathing. Avoid forced holds or breath retention; use seated movement if preferred.',alternative='chair',difficulty='gentle'),
 'cycle':dict(name='Easy familiar cycling',interests=['endurance'],equipment=['bicycle'],setting=['gym','outdoor'],seated=False,floor=False,instructions='Use a familiar, maintained bicycle in a safe setting. Begin easily and take breaks. Choose walking if cycling is unfamiliar.',alternative='walk',difficulty='gentle'),
 'recovery':dict(name='Planned recovery pause',interests=[],equipment=[],setting=['home','gym','outdoor'],seated=True,floor=False,instructions='Make time for a quiet pause, comfortable rest or reflection. No movement or performance target is required.',alternative='recovery',difficulty='rest'),
}
TEMPLATES.update({
 'camera_squat':dict(name='Camera squat practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use only a familiar squat variation and comfortable range. Keep a stable side-on camera view and clear space; counts are estimates and can be corrected.',alternative='chair',difficulty='familiar practice',camera_only=True),
 'camera_pushup':dict(name='Camera floor push-up practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use only a familiar floor push-up variation on a stable surface. Position the camera side-on with your whole body visible. Rest whenever needed; use manual logging if tracking is unclear.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_curl':dict(name='Camera single-arm curl practice',interests=['strength'],equipment=['dumbbells'],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar light weight and comfortable range. Keep one arm and hip visible side-on. Track one arm per set; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
})
for template in TEMPLATES.values():template.update({'version':1,'review':'Application safety review 2026-10-28; not a clinical prescription'})
RECOVERY='Stop if an activity causes pain, dizziness or unusual symptoms. Use your professional guidance; these templates are not treatment plans.'
MEALS=[
 dict(id='lentil',name='Lentil, rice and vegetable bowl',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='Indian',ingredients=['lentils','rice','vegetables'],allergens=[],tip='Combine a grain, a protein food and vegetables in portions that suit you.',substitution='Swap rice for a familiar grain after checking allergens.'),
 dict(id='chickpea',name='Chickpea and vegetable salad',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='Mediterranean',ingredients=['chickpeas','vegetables','olive oil'],allergens=[],tip='Rinse cooked chickpeas, add vegetables and a dressing you enjoy.',substitution='Use lentils instead of chickpeas if suitable for your own needs.'),
 dict(id='tofu',name='Tofu, rice and greens',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='global',ingredients=['tofu','rice','greens'],allergens=['soy'],tip='Include protein foods, grains and a variety of vegetables.',substitution='Lentils can replace tofu when soy is excluded; check all ingredients.'),
 dict(id='yogurt',name='Yogurt, fruit and oats',diet=['balanced','vegetarian','pescatarian'],cuisine='global',ingredients=['yogurt','fruit','oats'],allergens=['milk','oats'],tip='Choose fruit and a yogurt you enjoy; check packaging for allergens.',substitution='Use a suitable plant yogurt after checking soy, nut and other allergens.'),
 dict(id='egg',name='Egg, wholegrain toast and vegetables',diet=['balanced','vegetarian'],cuisine='global',ingredients=['egg','wheat bread','vegetables'],allergens=['egg','wheat'],tip='Review bread and toppings as well as the main ingredient.',substitution='Try lentils and rice as an alternative after reviewing ingredients.'),
 dict(id='fish',name='Fish, rice and vegetables',diet=['balanced','pescatarian'],cuisine='global',ingredients=['fish','rice','vegetables'],allergens=['fish'],tip='Use familiar preparation and food-safety practices.',substitution='Choose chickpeas as a plant protein alternative if appropriate.'),
]
KNOWN_ALLERGENS={'milk','egg','peanut','tree nuts','soy','wheat','fish','shellfish','sesame','mustard','celery','lupin','sulphites','oats','gluten'}
EDUCATION={
 'planner':dict(title='Use your personal planner',text='A plan is editable. Start an activity, take breaks, reschedule or substitute it. Pausing never deducts XP.',question='What should you do when a plan does not fit your day?',options=['Push through discomfort','Change or pause it','Double tomorrow’s session'],answer=1),
 'fitness':dict(title='Movement at your pace',text='Start with comfortable familiar movement. Stop for pain or unusual symptoms and follow appropriate professional guidance. XP does not determine exercise intensity.',question='What should determine difficulty?',options=['Your XP level','A perfect streak','Your comfort, feedback and professional guidance'],answer=2),
 'nutrition':dict(title='Review a balanced meal idea',text='Meal ideas are flexible, not calorie prescriptions. Check ingredients, packaging, portions and allergens. Scanner results are estimates and can be corrected.',question='A scanner estimate should be…',options=['Reviewed and corrected when needed','Used as a strict intake limit','A reason to skip meals'],answer=0),
}

def eligible_templates(prefs,include_camera=False):
 if prefs.professional_restrictions:return []
 equipment=set(prefs.equipment)
 result=[]
 for key,t in TEMPLATES.items():
  if t.get('camera_only') and not include_camera:continue
  if key=='recovery':continue
  if prefs.setting not in t['setting'] or not set(t['equipment'])<=equipment:continue
  if 'seated' in prefs.accessibility and not t['seated']:continue
  if 'no_floor' in prefs.accessibility and t['floor']:continue
  if 'low_impact' in prefs.accessibility and key=='run':continue
  result.append(key)
 return sorted(result,key=lambda k:(-len(set(TEMPLATES[k]['interests'])&set(prefs.interests)),k))

def recommendations(prefs):
 allergens=set(prefs.allergies)
 if 'gluten' in allergens:allergens|={'wheat','oats'}
 unknown=bool(allergens-KNOWN_ALLERGENS)
 meals=[] if unknown or prefs.professional_restrictions else [m for m in MEALS if prefs.diet in m['diet'] and not allergens.intersection(m['allergens'])]
 preferred={'quick':{'yogurt','egg','chickpea'},'batch':{'lentil','tofu','fish'},'flexible':set()}[prefs.preparation]
 meals=sorted(meals,key=lambda m:(m['cuisine']!=prefs.cuisine,m['id'] not in preferred,-len(set(m['ingredients'])&set(prefs.ingredients)),m['id']))
 return {'meals':[{**m,'reason':f"Matches your {prefs.diet} preference; known declared allergens excluded. Cuisine/available ingredients determine ordering."} for m in meals[:4]],'nutrition_note':'Check every ingredient and cross-contact information. These ideas do not certify allergen safety. No calorie or water target is generated.','needs_review':unknown or bool(prefs.professional_restrictions),'community_categories':[{'category':v,'operational':False} for v in prefs.interests],'event_categories':[{'category':v,'operational':False} for v in prefs.interests],'message':'Choose one small activity at your own pace.' if prefs.motivation else '', 'budget_note':'Budget is a planning preference; these ideas have no invented prices. Use the existing reviewed recipe cost planner.'}

def generate(prefs,today,previous_feedback):
 choices=eligible_templates(prefs)
 if previous_feedback.get('pain'):choices=[]
 minutes=min(prefs.duration,10 if prefs.experience in ('beginner','unspecified') else 20)
 if previous_feedback.get('too_hard'):minutes=max(5,minutes-5)
 if previous_feedback.get('not_enjoyed'):choices=[k for k in choices if k not in previous_feedback['not_enjoyed']] or ['recovery']
 monday=today-timedelta(days=today.weekday());activities=[]
 for i in range(7):
  day=monday+timedelta(days=i)
  if day<today:continue
  rest=i in prefs.rest_days or i not in prefs.available_days
  template='recovery' if rest else choices[len(activities)%len(choices)] if choices else None
  if template is None:continue
  activities.append({'template_id':template,'scheduled_day':str(day),'minutes':5 if template=='recovery' else minutes})
 return activities,{'priorities':['Professional restrictions and pain feedback block automated exercise','Accessibility, equipment and setting eligibility','Explicit rest and available days','Interests and comfort feedback','Conservative duration; never XP/BMI-based progression'],'preferred_time':prefs.workout_time,'professional_review':bool(prefs.professional_restrictions or previous_feedback.get('pain')),'reason':'Only rest options are offered where professional review is needed.' if not choices else 'Activities fit your selected setting, equipment, interests and available days. No automatic difficulty increase.'}

def normalize_measurement(kind,value,unit):
 rules={'height':({'cm':1,'in':2.54},30,275),'weight':({'kg':1,'lb':0.45359237},1,500),'duration':({'minutes':1},0,180),'repetitions':({'reps':1},0,500),'frequency':({'days/week':1},0,7),'hydration':({'ml':1},0,10000),'sleep':({'hours':1},0,24)}
 factors,low,high=rules[kind]
 if unit not in factors:raise ValueError('Unit does not match measurement type.')
 result=value*factors[unit]
 if not low<=result<=high:raise ValueError('Measurement is outside the supported range.')
 return result

def bmi(height_cm,weight_kg,age_group):
 if height_cm is None or weight_kg is None:return {'value':None,'classification':None,'context':'Height and weight are optional. No BMI is calculated without both.'}
 value=round(weight_kg/(height_cm/100)**2,1)
 return {'value':value,'classification':None,'context':'BMI is a screening calculation, not a diagnosis, and does not describe body composition or individual health. No plan uses it.' if age_group in ('20_64','65plus') else 'No adult classification is provided for younger or unspecified ages. Age- and sex-specific clinical interpretation is not implemented.'}

def quiet(time,start,end):
 if start==end:return False
 return start<=time<end if start<end else time>=start or time<end


def convert_measurement(kind,value,from_unit,to_unit):
 canonical=normalize_measurement(kind,value,from_unit)
 factors={'height':{'cm':1,'in':2.54},'weight':{'kg':1,'lb':0.45359237}}
 if kind not in factors or to_unit not in factors[kind]:raise ValueError('Unsupported conversion.')
 return canonical/factors[kind][to_unit]
