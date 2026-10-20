"""recipes.py — Recipe CRUD with per-serving nutrient calculation"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()


class IngredientIn(BaseModel):
    food_id: Optional[str] = None
    custom_food_id: Optional[str] = None
    name_override: Optional[str] = None
    quantity_g: float
    unit_label: Optional[str] = None


class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    servings: int = 1
    preparation_method: Optional[str] = None
    cuisine_region: Optional[str] = None
    cooked_weight_g: Optional[float] = None
    is_family_recipe: bool = False
    ingredients: List[IngredientIn] = []


def _calculate_recipe_nutrients(ingredients: List[models.RecipeIngredient], db: Session) -> dict:
    """Deterministic per-100g and per-serving nutrient calculation."""
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0}
    total_weight_g = 0.0

    for ing in ingredients:
        weight = ing.quantity_g
        total_weight_g += weight
        food = ing.food or ing.custom_food
        if not food:
            continue

        # Get per-100g values
        if hasattr(food, "nutrients"):
            nutrients = {fn.nutrient_def.slug: fn.amount_per_100g for fn in food.nutrients if fn.nutrient_def}
            cal = nutrients.get("energy_kcal", 0) or 0
            pro = nutrients.get("protein", 0) or 0
            carb = nutrients.get("carbohydrates", 0) or 0
            fat = nutrients.get("fat", 0) or 0
            fiber = nutrients.get("fiber", 0) or 0
        else:  # CustomFood
            cal = food.calories_per_100g or 0
            pro = food.protein_per_100g or 0
            carb = food.carbs_per_100g or 0
            fat = food.fat_per_100g or 0
            fiber = food.fiber_per_100g or 0

        factor = weight / 100.0
        totals["calories"] += cal * factor
        totals["protein_g"] += pro * factor
        totals["carbs_g"] += carb * factor
        totals["fat_g"] += fat * factor
        totals["fiber_g"] += fiber * factor

    return {k: round(v, 2) for k, v in totals.items()}, round(total_weight_g, 2)


@router.post("", status_code=201)
def create_recipe(
    data: RecipeCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    recipe = models.Recipe(
        user_id=user.id,
        name=data.name,
        description=data.description,
        servings=data.servings,
        preparation_method=data.preparation_method,
        cuisine_region=data.cuisine_region,
        cooked_weight_g=data.cooked_weight_g,
        is_family_recipe=data.is_family_recipe,
    )
    db.add(recipe)
    db.flush()

    for idx, ing in enumerate(data.ingredients):
        ri = models.RecipeIngredient(
            recipe_id=recipe.id,
            food_id=ing.food_id,
            custom_food_id=ing.custom_food_id,
            name_override=ing.name_override,
            quantity_g=ing.quantity_g,
            unit_label=ing.unit_label,
            order_index=idx,
        )
        db.add(ri)

    db.commit()
    db.refresh(recipe)
    return {"id": recipe.id, "name": recipe.name, "servings": recipe.servings}


@router.get("")
def list_recipes(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    recipes = db.query(models.Recipe).filter(models.Recipe.user_id == user.id).all()
    return [{"id": r.id, "name": r.name, "servings": r.servings, "cuisine_region": r.cuisine_region} for r in recipes]


@router.get("/{recipe_id}")
def get_recipe(recipe_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(
        models.Recipe.id == recipe_id, models.Recipe.user_id == user.id
    ).first()
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    nutrient_totals, total_weight = _calculate_recipe_nutrients(recipe.ingredients, db)
    per_serving = {
        k: round(v / recipe.servings, 2) for k, v in nutrient_totals.items()
    }

    return {
        "id": recipe.id,
        "name": recipe.name,
        "description": recipe.description,
        "servings": recipe.servings,
        "cuisine_region": recipe.cuisine_region,
        "preparation_method": recipe.preparation_method,
        "total_weight_g": total_weight,
        "cooked_weight_g": recipe.cooked_weight_g,
        "nutrients_total": nutrient_totals,
        "nutrients_per_serving": per_serving,
        "data_source_note": "Calculated from USDA/user data — not laboratory tested",
        "ingredients": [
            {
                "id": i.id,
                "name": i.name_override or (i.food.name if i.food else i.custom_food.name if i.custom_food else "Unknown"),
                "quantity_g": i.quantity_g,
                "unit_label": i.unit_label,
            }
            for i in recipe.ingredients
        ],
    }


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(
        models.Recipe.id == recipe_id, models.Recipe.user_id == user.id
    ).first()
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    db.delete(recipe)
    db.commit()
    return {"status": "deleted"}
