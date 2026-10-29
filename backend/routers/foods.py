"""foods.py — Food search, barcode lookup, custom foods, USDA + Open Food Facts integration"""
import os
import httpx
from flask_app.params import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
import models
from routers.auth import get_current_active_user


USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")


# ── USDA FoodData Central ───────────────────────────────────────

async def search_usda(query: str, page_size: int = 10) -> list:
    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"query": query, "pageSize": page_size, "api_key": USDA_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
            results = []
            for item in data.get("foods", []):
                nutrients = {n["nutrientName"]: n.get("value", 0) for n in item.get("foodNutrients", [])}
                results.append({
                    "id": f"usda_{item['fdcId']}",
                    "name": item.get("description", "Unknown"),
                    "brand": item.get("brandOwner"),
                    "serving_size_g": 100,
                    "calories": nutrients.get("Energy", 0),
                    "protein_g": nutrients.get("Protein", 0),
                    "carbs_g": nutrients.get("Carbohydrate, by difference", 0),
                    "fat_g": nutrients.get("Total lipid (fat)", 0),
                    "fiber_g": nutrients.get("Fiber, total dietary"),
                    "sugar_g": nutrients.get("Sugars, total including NLEA"),
                    "sodium_mg": nutrients.get("Sodium, Na"),
                    "source": "USDA FoodData Central",
                    "data_source": "usda",
                })
            return results
    except Exception as e:
        print("USDA search request failed")
        return []


# ── Endpoints ───────────────────────────────────────────────────

async def search_foods(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    cuisine: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Multi-source food search: local DB first, then USDA fallback."""
    # Local database search
    local_q = db.query(models.Food).filter(
        or_(
            models.Food.name.ilike(f"%{q}%"),
            models.Food.name_normalized.ilike(f"%{q}%"),
        )
    )
    if cuisine:
        local_q = local_q.filter(models.Food.cuisine_region == cuisine)
    local_foods = local_q.limit(limit).all()

    results = []
    for f in local_foods:
        nutrients = {fn.nutrient_def.slug: fn.amount_per_100g for fn in f.nutrients if fn.nutrient_def}
        results.append({
            "id": f.id,
            "name": f.name,
            "brand": f.brand.name if f.brand else None,
            "serving_size_g": f.serving_size_g or 100,
            "calories": nutrients.get("energy_kcal"),
            "protein_g": nutrients.get("protein"),
            "carbs_g": nutrients.get("carbohydrates"),
            "fat_g": nutrients.get("fat"),
            "fiber_g": nutrients.get("fiber"),
            "sodium_mg": nutrients.get("sodium"),
            "source": f.data_source.value,
            "data_completeness": f.data_completeness_score,
        })

    # USDA fallback
    if len(results) < 5:
        usda_results = await search_usda(q, page_size=limit - len(results))
        results.extend(usda_results)

    return {"results": results, "total": len(results), "query": q}


def lookup_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Look up a product by barcode: the local catalog first, then Open Food Facts (cached, see services.barcode_lookup).
    Unknown nutrients are None, never 0."""
    from services import barcode_lookup
    local = db.query(models.Barcode).filter(models.Barcode.barcode_value == barcode).first()
    if local and local.food:
        f = local.food
        return {"source": "local", "food": {"id": f.id, "name": f.name}}
    try:
        product = barcode_lookup.lookup(db, barcode)
    except barcode_lookup.LookupError_ as failure:
        if failure.status == "not_found":
            raise HTTPException(404, detail="Product not found. You can submit it via Community > Add Missing Food.")
        raise HTTPException(400 if failure.status == "invalid" else 502, detail=str(failure))
    n = product["nutrients_per_100g"]
    return {"source": "open_food_facts", "food": {
        "id": f"off_{product['barcode']}", "name": product["product_name"], "brand": product["brand"], "barcode": product["barcode"],
        "serving_size_g": product["serving_g"], "calories": n["energy_kcal"], "protein_g": n["protein_g"], "carbs_g": n["carbs_g"],
        "fat_g": n["fat_g"], "fiber_g": n["fiber_g"], "sugar_g": n["sugar_g"], "sodium_mg": n["sodium_mg"], "saturated_fat_g": n["saturated_fat_g"],
        "ingredients_text": product["ingredients_text"], "allergens": product["allergens"], "source": "Open Food Facts",
        "data_source": "open_food_facts", "complete": product["complete"], "attribution": product["attribution"],
    }}


def get_food(food_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_active_user)):
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if not food:
        raise HTTPException(404, "Food not found")
    nutrients = {fn.nutrient_def.slug: {"amount": fn.amount_per_100g, "unit": fn.nutrient_def.unit, "estimated": fn.is_estimated}
                 for fn in food.nutrients if fn.nutrient_def}
    return {
        "id": food.id,
        "name": food.name,
        "brand": food.brand.name if food.brand else None,
        "category": food.category,
        "cuisine_region": food.cuisine_region,
        "serving_size_g": food.serving_size_g,
        "serving_size_description": food.serving_size_description,
        "data_source": food.data_source.value,
        "is_verified": food.is_verified,
        "data_completeness_score": food.data_completeness_score,
        "nutrients": nutrients,
        "allergens": food.allergen_ids or [],
    }


# ── Custom Foods ────────────────────────────────────────────────

class CustomFoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brand_name: Optional[str] = None
    serving_size_g: float = Field(default=100.0, gt=0, le=20000, allow_inf_nan=False)
    calories_per_100g: float = Field(ge=0, le=20000, allow_inf_nan=False)
    protein_per_100g: float = Field(default=0.0, ge=0, le=2000, allow_inf_nan=False)
    carbs_per_100g: float = Field(default=0.0, ge=0, le=2000, allow_inf_nan=False)
    fat_per_100g: float = Field(default=0.0, ge=0, le=2000, allow_inf_nan=False)
    fiber_per_100g: Optional[float] = None
    sugar_per_100g: Optional[float] = None
    sodium_per_100g: Optional[float] = None
    notes: Optional[str] = None


def create_custom_food(
    data: CustomFoodCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    food = models.CustomFood(user_id=user.id, **data.model_dump())
    db.add(food)
    db.commit()
    db.refresh(food)
    return {"id": food.id, "name": food.name, "status": "created"}


def list_custom_foods(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    foods = db.query(models.CustomFood).filter(models.CustomFood.user_id == user.id).all()
    return [{"id": f.id, "name": f.name, "calories_per_100g": f.calories_per_100g} for f in foods]
