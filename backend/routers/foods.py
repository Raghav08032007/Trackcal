"""foods.py — Food search, barcode lookup, custom foods, USDA + Open Food Facts integration"""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()

USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")
OFF_APP_NAME = os.getenv("OPEN_FOOD_FACTS_APP_NAME", "GlobalFoodAI")


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


async def lookup_barcode_off(barcode: str) -> Optional[dict]:
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    headers = {"User-Agent": f"{OFF_APP_NAME}/1.0"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                return None
            data = r.json()
            if data.get("status") != 1:
                return None
            product = data["product"]
            n = product.get("nutriments", {})
            return {
                "id": f"off_{barcode}",
                "name": product.get("product_name", "Unknown Product"),
                "brand": product.get("brands"),
                "barcode": barcode,
                "serving_size_g": _parse_float(product.get("serving_size")),
                "calories": n.get("energy-kcal_100g", n.get("energy-kcal")),
                "protein_g": n.get("proteins_100g"),
                "carbs_g": n.get("carbohydrates_100g"),
                "fat_g": n.get("fat_100g"),
                "fiber_g": n.get("fiber_100g"),
                "sugar_g": n.get("sugars_100g"),
                "sodium_mg": (n.get("sodium_100g") or 0) * 1000,
                "saturated_fat_g": n.get("saturated-fat_100g"),
                "ingredients_text": product.get("ingredients_text"),
                "allergens": product.get("allergens_tags", []),
                "image_url": product.get("image_url"),
                "source": "Open Food Facts",
                "data_source": "open_food_facts",
                "completeness_score": product.get("completeness", 0),
            }
    except Exception as e:
        print("Open Food Facts lookup failed")
        return None


def _parse_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace("g", "").replace("ml", "").strip())
    except (ValueError, TypeError):
        return None


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/search")
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


@router.get("/barcode/{barcode}")
async def lookup_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Look up a product by barcode via local DB or Open Food Facts."""
    # Check local DB first
    local = db.query(models.Barcode).filter(models.Barcode.barcode_value == barcode).first()
    if local and local.food:
        f = local.food
        return {"source": "local", "food": {"id": f.id, "name": f.name}}

    # Open Food Facts
    result = await lookup_barcode_off(barcode)
    if result:
        return {"source": "open_food_facts", "food": result}

    raise HTTPException(404, detail="Product not found. You can submit it via Community > Add Missing Food.")


@router.get("/{food_id}")
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


@router.post("/custom", status_code=201)
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


@router.get("/custom/mine")
def list_custom_foods(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    foods = db.query(models.CustomFood).filter(models.CustomFood.user_id == user.id).all()
    return [{"id": f.id, "name": f.name, "calories_per_100g": f.calories_per_100g} for f in foods]
