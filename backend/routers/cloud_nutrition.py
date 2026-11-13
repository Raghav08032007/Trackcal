"""Cloud diary and owned reusable foods, reusing canonical meal and saved-meal models."""
from datetime import datetime,timezone,timedelta
from uuid import UUID
from zoneinfo import ZoneInfo
from flask_app.params import Depends, HTTPException, Query
import re
from sqlalchemy import case,or_,text
from sqlalchemy.orm import Session,selectinload
from database import get_db
from routers.auth import get_current_active_user
from services import adventure,gamification,personalization as personal
from services.personalization_inputs import Preferences
from services.wellness_inputs import DiaryInput,DiaryItem,Nutrients,SaveMealInput,FavoriteInput
from services.abuse_limits import consume
import models
SOURCE_LABELS={'ifct':'IFCT 2017, National Institute of Nutrition, Hyderabad','usda':'USDA FoodData Central','open_food_facts':'Open Food Facts (community data)'}
LANGUAGE_NAMES={'hi':'Hindi','ta':'Tamil','te':'Telugu','kn':'Kannada','ml':'Malayalam','mr':'Marathi','bn':'Bengali','gu':'Gujarati','pa':'Punjabi','or':'Odia','as':'Assamese','ur':'Urdu','ks':'Kashmiri','mni':'Manipuri','ne':'Nepali','sa':'Sanskrit','kha':'Khasi','kok':'Konkani','en':'English'}
def canonical_term(db,query):
 """Spelling variants (idly, dosai, thayir...) map to one term via the search_synonyms table."""
 row=db.get(models.SearchSynonym,query) if query else None
 return row.canonical if row else query
def fulltext_terms(term):
 """Boolean-mode prefix terms for MySQL FULLTEXT; operators are stripped so user input cannot change the query."""
 words=[w for w in re.findall(r'[\w]+',term,flags=re.UNICODE) if len(w)>=3]
 return ' '.join(w+'*' for w in words)
def lock(db,user):db.query(models.User).filter_by(id=user.id).with_for_update().one()
def prefs(db,user):
 row=db.get(models.PersonalizationProfile,user.id)
 return Preferences.model_validate(row.preferences) if row else Preferences()
def now():return adventure.now().astimezone(timezone.utc)
def today(db,user):return now().astimezone(ZoneInfo(prefs(db,user).timezone)).date()
def complete(db,user,**data):
 db.commit();return {**data,'summary':adventure.summary(db,user)}
def award_meal(db,user,source):
 profile=adventure.profile(db,user,locked=True)
 if not profile:return 0
 day=adventure.local_day(profile);points=gamification.award(db,user,'meal',day,source_id=source)
 monday=day-timedelta(days=day.weekday())
 days={e.local_day for e in db.query(models.RewardEvent).filter_by(user_id=user.id,kind='meal').with_for_update().all() if str(monday)<=e.local_day<=str(day)}
 if len(days)>=3:points+=gamification.award(db,user,'weekly',day,key=f'v1:weekly:{monday}')
 return points

def food_view(food):
 nutrients={n.nutrient_def.slug:n.amount_per_100g for n in food.nutrients if n.nutrient_def}
 return {'id':food.id,'food_id':food.id,'name':food.name,'grams':food.serving_size_g or 100,'nutrients':{'calories':nutrients.get('energy_kcal'),'protein':nutrients.get('protein'),'carbs':nutrients.get('carbohydrates'),'fat':nutrients.get('fat')},'estimated':not food.is_verified or any(n.is_estimated for n in food.nutrients),'source':food.data_source.value if food.data_source else 'Catalog source unspecified','source_label':SOURCE_LABELS.get(food.data_source.value if food.data_source else '','Catalog'),'category':food.category,'cuisine':food.cuisine_region}

def search(q:str=Query('',max_length=100),category:str=Query('',max_length=100),offset:int=Query(0,ge=0,le=10000),limit:int=Query(12,ge=1,le=50),user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 query=q.strip().lower();term=canonical_term(db,query)
 base=db.query(models.Food).options(selectinload(models.Food.nutrients).selectinload(models.FoodNutrient.nutrient_def))
 # Search the typed word and its canonical form: catalogs name foods differently (IFCT says "Ragi", the synonym says "finger millet").
 terms=[t for t in dict.fromkeys((query,term)) if t]
 if terms:
  conditions=[]
  for i,t in enumerate(terms):
   aliases=db.query(models.FoodAlias.food_id).filter(models.FoodAlias.alias.like(f'{t}%'))
   translations=db.query(models.FoodTranslation.food_id).filter(models.FoodTranslation.name.like(f'{t}%'))
   conditions+=[models.Food.name_normalized.like(f'{t}%'),models.Food.name.like(f'{t}%'),models.Food.id.in_(aliases),models.Food.id.in_(translations)]
   ft=fulltext_terms(t)
   if ft:conditions.append(text(f'MATCH (foods.name) AGAINST (:ft{i} IN BOOLEAN MODE)').bindparams(**{f'ft{i}':ft}))
  base=base.filter(or_(*conditions))
 if category:base=base.filter(models.Food.category==category)
 # Ranking: the user's favourites, then foods they logged recently, then verified catalog foods, then the rest.
 favorites=[k for (k,) in db.query(models.FoodFavorite.food_key).filter_by(user_id=user.id).limit(200)]
 recent=[f for (f,) in db.query(models.MealItem.food_id).join(models.MealLog,models.MealItem.meal_log_id==models.MealLog.id).filter(models.MealLog.user_id==user.id,models.MealItem.food_id.isnot(None)).order_by(models.MealLog.logged_at.desc()).limit(50)]
 rank=case((models.Food.id.in_(favorites or ['']),0),(models.Food.id.in_(recent or ['']),1),(models.Food.is_verified.is_(True),2),else_=3)
 rows=base.order_by(rank,models.Food.name_normalized,models.Food.id).offset(offset).limit(limit+1).all()
 mode='indexed prefix / aliases'
 if not rows and len(term)>=3 and offset==0:
  fallback=db.query(models.Food).options(selectinload(models.Food.nutrients).selectinload(models.FoodNutrient.nutrient_def)).filter(or_(*[models.Food.name_normalized.like(f'%{t}%') for t in terms]))
  if category:fallback=fallback.filter(models.Food.category==category)
  rows=fallback.order_by(models.Food.name_normalized,models.Food.id).limit(limit+1).all();mode='bounded substring fallback'
 result=[food_view(f) for f in rows[:limit]]
 if terms and result:  # say which local name matched, e.g. "Arisi (Tamil)"
  hits={}
  for t in db.query(models.FoodTranslation).filter(models.FoodTranslation.food_id.in_([r['id'] for r in result]),or_(*[models.FoodTranslation.name.like(f'%{w}%') for w in terms])):
   name=next((n for n in t.name.split(' / ') if any(w in n.lower() for w in terms)),t.name)
   hits.setdefault(t.food_id,f"{name} ({LANGUAGE_NAMES.get(t.language_code,t.language_code)})")
  for r in result:
   if r['id'] in hits and not any(w in r['name'].lower() for w in terms):r['matched_name']=hits[r['id']]
 if query:
  consume(db,'cloud-food-search',str(user.id),240,3600);lock(db,user)
  history=db.query(models.FoodSearchHistory).filter_by(user_id=user.id,query=query).first()
  if history:history.updated_at=now().replace(tzinfo=None)
  else:db.add(models.FoodSearchHistory(user_id=user.id,query=query))
  stale=db.query(models.FoodSearchHistory).filter_by(user_id=user.id).order_by(models.FoodSearchHistory.updated_at.desc()).offset(50).all()
  for row in stale:db.delete(row)
  db.commit()
 return {'results':result,'offset':offset,'limit':limit,'has_more':len(rows)>limit,'query':query,'matched_term':term,'search_mode':mode,'regional_names':[name for name in ('Idli','Dosa','Sambar','Chapati','Rice dishes','Dal','Pasta','Sushi') if term and term in name.lower()],'note':'Catalog values may be missing. Search public sources or enter a reviewed custom food when no record exists.'}

def detail(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 food=db.get(models.Food,str(identifier))
 if not food:raise HTTPException(404,'Food not found.')
 return food_view(food)

def resolved(db,item):
 if item.food_id and not item.manual_override:
  food=db.get(models.Food,str(item.food_id))
  if not food:raise HTTPException(404,'Catalog food not found. Use explicit manual correction instead.')
  data=food_view(food);return DiaryItem(name=item.name,grams=item.grams,food_id=item.food_id,nutrients=Nutrients(**data['nutrients']),estimated=data['estimated'],source=data['source'])
 return item.model_copy(update={'food_id':None,'source':('Reviewed estimate · ' if item.estimated else 'User reviewed · ')+item.source[:65]})
def totals(items):
 return {k:round(sum(getattr(i.nutrients,k)*i.grams/100 for i in items),2) if all(getattr(i.nutrients,k) is not None for i in items) else None for k in ('calories','protein','carbs','fat')}
def put_items(db,log,items):
 log.items.clear();db.flush()
 for i,item in enumerate(items):
  values={k:None if getattr(item.nutrients,k) is None else getattr(item.nutrients,k)*item.grams/100 for k in ('calories','protein','carbs','fat')}
  log.items.append(models.MealItem(display_name=item.name,food_id=str(item.food_id) if item.food_id else None,quantity_g=item.grams,serving_label=(('Reviewed estimate · ' if item.estimated and not item.source.startswith('Reviewed estimate') else '')+item.source)[:100],calories=values['calories'],protein_g=values['protein'],carbs_g=values['carbs'],fat_g=values['fat'],data_source=db.get(models.Food,str(item.food_id)).data_source if item.food_id else models.NutritionDataSource.user_created,is_ai_estimated=bool(item.food_id and db.get(models.Food,str(item.food_id)).data_source==models.NutritionDataSource.ai_estimated),user_confirmed=True,order_index=i))
 value=totals(items);log.total_calories=value['calories'];log.total_protein_g=value['protein'];log.total_carbs_g=value['carbs'];log.total_fat_g=value['fat']
def diary_view(log,zone):
 items=[]
 for item in log.items:
  nutrients={k:None if value is None else round(value/item.quantity_g*100,3) for k,value in {'calories':item.calories,'protein':item.protein_g,'carbs':item.carbs_g,'fat':item.fat_g}.items()}
  items.append({'name':item.display_name,'grams':item.quantity_g,'nutrients':nutrients,'food_id':item.food_id,'manual_override':False,'estimated':bool(item.is_ai_estimated or (item.serving_label or '').startswith('Reviewed estimate')),'source':item.serving_label or (item.data_source.value if item.data_source else 'Source unspecified')})
 local=log.logged_at.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone))
 return {'id':log.id,'day':local.date().isoformat(),'time':local.strftime('%H:%M'),'meal_type':log.meal_type.value,'method':log.log_method.value,'notes':log.notes or '', 'items':items,'totals':{key:round(sum(getattr(i,field) for i in log.items),2) if all(getattr(i,field) is not None for i in log.items) else None for key,field in [('calories','calories'),('protein','protein_g'),('carbs','carbs_g'),('fat','fat_g')]}}

def diary(day:str|None=None,offset:int=Query(0,ge=0,le=10000),limit:int=Query(30,ge=1,le=100),user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 from datetime import date,time
 settings=prefs(db,user)
 try:selected=date.fromisoformat(day) if day else today(db,user)
 except ValueError:raise HTTPException(422,'Choose a valid diary date.')
 from services.history_access import access,too_old,utc_start,OLDER
 acc=access(db,user,today(db,user))
 if too_old(acc,str(selected)):raise HTTPException(402,OLDER)
 start=datetime.combine(selected,time.min,ZoneInfo(settings.timezone)).astimezone(timezone.utc).replace(tzinfo=None);end=datetime.combine(selected+timedelta(days=1),time.min,ZoneInfo(settings.timezone)).astimezone(timezone.utc).replace(tzinfo=None)
 base=db.query(models.MealLog).filter_by(user_id=user.id,is_deleted=False).filter(models.MealLog.logged_at>=start,models.MealLog.logged_at<end)
 rows=base.options(selectinload(models.MealLog.items)).order_by(models.MealLog.logged_at.desc(),models.MealLog.id).offset(offset).limit(limit+1).all()
 favorites=db.query(models.FoodFavorite).filter_by(user_id=user.id).order_by(models.FoodFavorite.created_at.desc()).limit(50).all()
 saved=db.query(models.SavedMeal).filter_by(user_id=user.id).order_by(models.SavedMeal.created_at.desc()).limit(50).all()
 recent=db.query(models.MealLog).filter_by(user_id=user.id,is_deleted=False).filter(models.MealLog.logged_at>=(utc_start(acc,settings.timezone) or datetime(1970,1,1))).order_by(models.MealLog.logged_at.desc()).limit(10).all()
 history=db.query(models.FoodSearchHistory).filter_by(user_id=user.id).order_by(models.FoodSearchHistory.updated_at.desc()).limit(8).all()
 return {'history':acc,'today':str(today(db,user)),'day':str(selected),'timezone':settings.timezone,'entries':[diary_view(r,settings.timezone) for r in rows[:limit]],'has_more':len(rows)>limit,'favorites':[{'id':r.id,'food_key':r.food_key,'item':r.snapshot} for r in favorites],'saved_meals':[saved_view(s) for s in saved],'recent':[diary_view(r,settings.timezone) for r in recent],'recent_searches':[r.query for r in history],'suggestions':personal.recommendations(settings)}

def save_diary(data:DiaryInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'cloud-diary',str(user.id),90,3600);lock(db,user)
 existing=db.get(models.MealLog,str(data.id))
 if existing:
  if existing.user_id!=user.id:raise HTTPException(404,'Entry not found.')
  return complete(db,user,entry=diary_view(existing,prefs(db,user).timezone),awarded_xp=0)
 return write_diary(db,user,data)
def write_diary(db,user,data,existing=None):
 if data.day>today(db,user):raise HTTPException(422,'Future food entries are not supported.')
 zone=prefs(db,user).timezone
 stamp=now().replace(tzinfo=None) if data.day==today(db,user) else datetime.combine(data.day,datetime.min.time().replace(hour=12),ZoneInfo(zone)).astimezone(timezone.utc).replace(tzinfo=None)
 log=existing or models.MealLog(id=str(data.id),user_id=user.id)
 # An edit that keeps the day keeps the original time, so the meal doesn't jump to "now" or to noon.
 if existing and existing.logged_at.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone)).date()==data.day:stamp=existing.logged_at
 log.logged_at=stamp;log.meal_type=models.MealType(data.meal_type);log.log_method=models.LogMethod(data.method);log.notes=data.notes
 items=[resolved(db,i) for i in data.items];db.add(log);db.flush();put_items(db,log,items);db.flush()
 points=award_meal(db,user,log.id) if not existing and data.day==today(db,user) else 0
 return complete(db,user,entry=diary_view(log,zone),awarded_xp=points)
def edit_diary(identifier:UUID,data:DiaryInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);log=db.query(models.MealLog).filter_by(id=str(identifier),user_id=user.id,is_deleted=False).first()
 if not log:raise HTTPException(404,'Entry not found.')
 if str(data.id)!=str(identifier):raise HTTPException(422,'Entry ID mismatch.')
 return write_diary(db,user,data,log)
def delete_diary(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);log=db.query(models.MealLog).filter_by(id=str(identifier),user_id=user.id,is_deleted=False).first()
 if not log:raise HTTPException(404,'Entry not found.')
 log.is_deleted=True;return complete(db,user,status='removed',awarded_xp=0)
def restore_diary(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 """Undo a delete. Earns nothing: the meal's XP (if any) was never taken away."""
 lock(db,user);log=db.query(models.MealLog).filter_by(id=str(identifier),user_id=user.id,is_deleted=True).first()
 if not log:raise HTTPException(404,'Entry not found.')
 log.is_deleted=False;return complete(db,user,entry=diary_view(log,prefs(db,user).timezone),awarded_xp=0)

def saved_view(row):
 try:items=[DiaryItem.model_validate(i).model_dump(mode='json') for i in row.items_snapshot]
 except Exception:return {'id':row.id,'name':row.name,'meal_type':row.meal_type.value if row.meal_type else 'other','items':[],'requires_review':True}
 return {'id':row.id,'name':row.name,'meal_type':row.meal_type.value if row.meal_type else 'other','items':items,'requires_review':False}
def save_meal(data:SaveMealInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'saved-meal-write',str(user.id),60,3600);lock(db,user);row=db.get(models.SavedMeal,str(data.id))
 if row and row.user_id!=user.id:raise HTTPException(404,'Saved meal not found.')
 if not row:row=models.SavedMeal(id=str(data.id),user_id=user.id);db.add(row)
 items=[resolved(db,i) for i in data.items];row.name=data.name;row.meal_type=models.MealType(data.meal_type);row.items_snapshot=[i.model_dump(mode='json') for i in items];row.total_calories=totals(items)['calories'];db.flush()
 journey=adventure.profile(db,user,locked=True);points=gamification.award(db,user,'saved_meal',adventure.local_day(journey),source_id=str(user.id),key=f'v3:saved-meal:{user.id}') if journey else 0
 return complete(db,user,saved_meal=saved_view(row),awarded_xp=points)
def delete_saved(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 lock(db,user);row=db.query(models.SavedMeal).filter_by(id=str(identifier),user_id=user.id).first()
 if not row:raise HTTPException(404,'Saved meal not found.')
 db.delete(row);return complete(db,user,status='removed',awarded_xp=0)
def favorite(data:FavoriteInput,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'favorite-write',str(user.id),90,3600);lock(db,user);row=db.query(models.FoodFavorite).filter_by(user_id=user.id,food_key=data.food_key).first()
 if not row:row=models.FoodFavorite(user_id=user.id,food_key=data.food_key);db.add(row)
 row.snapshot=resolved(db,data.item).model_dump(mode='json');db.commit();return {'status':'saved'}
def remove_favorite(identifier:UUID,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
 consume(db,'favorite-write',str(user.id),90,3600);lock(db,user);row=db.query(models.FoodFavorite).filter_by(id=str(identifier),user_id=user.id).first()
 if not row:raise HTTPException(404,'Favorite not found.')
 db.delete(row);db.commit();return {'status':'removed'}
