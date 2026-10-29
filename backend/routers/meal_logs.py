"""meal_logs.py — Meal logging endpoints: create, list, edit, delete, copy"""
from datetime import datetime, date
from typing import Optional, List
from flask_app.params import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user
from timeutil import utcnow



class MealItemCreate(BaseModel):
    food_id: Optional[str] = None
    custom_food_id: Optional[str] = None
    recipe_id: Optional[str] = None
    display_name: str = Field(min_length=1, max_length=200)
    quantity_g: float = Field(gt=0, le=20000, allow_inf_nan=False)
    serving_label: Optional[str] = None
    calories: Optional[float] = Field(default=None, ge=0, le=20000, allow_inf_nan=False)
    protein_g: Optional[float] = Field(default=None, ge=0, le=20000, allow_inf_nan=False)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=20000, allow_inf_nan=False)
    fat_g: Optional[float] = Field(default=None, ge=0, le=20000, allow_inf_nan=False)
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    data_source: Optional[str] = None
    is_ai_estimated: bool = False
    confidence_score: Optional[float] = None


class MealLogCreate(BaseModel):
    logged_at: Optional[datetime] = None
    meal_type: models.MealType = models.MealType.other
    log_method: models.LogMethod = models.LogMethod.manual
    notes: Optional[str] = None
    image_id: Optional[str] = None
    scan_job_id: Optional[str] = None
    items: List[MealItemCreate] = Field(min_length=1, max_length=100)


def _calculate_totals(items: List[MealItemCreate]) -> dict:
    """Deterministic calculation — not AI."""
    total_cal = sum((i.calories or 0) for i in items)
    total_pro = sum((i.protein_g or 0) for i in items)
    total_carb = sum((i.carbs_g or 0) for i in items)
    total_fat = sum((i.fat_g or 0) for i in items)
    return {"calories": round(total_cal, 1), "protein_g": round(total_pro, 1),
            "carbs_g": round(total_carb, 1), "fat_g": round(total_fat, 1)}


def create_meal_log(
    data: MealLogCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    totals = _calculate_totals(data.items)
    log = models.MealLog(
        user_id=user.id,
        logged_at=data.logged_at or utcnow(),
        meal_type=data.meal_type,
        log_method=data.log_method,
        notes=data.notes,
        image_id=data.image_id,
        scan_job_id=data.scan_job_id,
        total_calories=totals["calories"],
        total_protein_g=totals["protein_g"],
        total_carbs_g=totals["carbs_g"],
        total_fat_g=totals["fat_g"],
    )
    db.add(log)
    db.flush()

    for idx, item in enumerate(data.items):
        meal_item = models.MealItem(
            meal_log_id=log.id,
            food_id=item.food_id,
            custom_food_id=item.custom_food_id,
            recipe_id=item.recipe_id,
            display_name=item.display_name,
            quantity_g=item.quantity_g,
            serving_label=item.serving_label,
            calories=item.calories,
            protein_g=item.protein_g,
            carbs_g=item.carbs_g,
            fat_g=item.fat_g,
            fiber_g=item.fiber_g,
            sugar_g=item.sugar_g,
            sodium_mg=item.sodium_mg,
            is_ai_estimated=item.is_ai_estimated,
            confidence_score=item.confidence_score,
            order_index=idx,
        )
        db.add(meal_item)

    db.commit()
    db.refresh(log)
    return {"id": log.id, "logged_at": log.logged_at.isoformat(), "totals": totals, "item_count": len(data.items)}


def list_meal_logs(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    meal_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.MealLog).filter(
        models.MealLog.user_id == user.id,
        models.MealLog.is_deleted == False,
    )
    if date_from:
        q = q.filter(models.MealLog.logged_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(models.MealLog.logged_at <= datetime.combine(date_to, datetime.max.time()))
    if meal_type:
        q = q.filter(models.MealLog.meal_type == meal_type)
    total = q.count()
    logs = q.order_by(models.MealLog.logged_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": l.id,
                "logged_at": l.logged_at.isoformat(),
                "meal_type": l.meal_type.value,
                "log_method": l.log_method.value,
                "total_calories": l.total_calories,
                "total_protein_g": l.total_protein_g,
                "total_carbs_g": l.total_carbs_g,
                "total_fat_g": l.total_fat_g,
                "item_count": len(l.items),
            }
            for l in logs
        ],
    }


def get_meal_log(log_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    log = db.query(models.MealLog).filter(
        models.MealLog.id == log_id,
        models.MealLog.user_id == user.id,
        models.MealLog.is_deleted == False,
    ).first()
    if not log:
        raise HTTPException(404, "Meal log not found")
    return {
        "id": log.id,
        "logged_at": log.logged_at.isoformat(),
        "meal_type": log.meal_type.value,
        "log_method": log.log_method.value,
        "notes": log.notes,
        "total_calories": log.total_calories,
        "total_protein_g": log.total_protein_g,
        "total_carbs_g": log.total_carbs_g,
        "total_fat_g": log.total_fat_g,
        "items": [
            {
                "id": i.id,
                "display_name": i.display_name,
                "quantity_g": i.quantity_g,
                "serving_label": i.serving_label,
                "calories": i.calories,
                "protein_g": i.protein_g,
                "carbs_g": i.carbs_g,
                "fat_g": i.fat_g,
                "fiber_g": i.fiber_g,
                "sugar_g": i.sugar_g,
                "sodium_mg": i.sodium_mg,
                "is_ai_estimated": i.is_ai_estimated,
                "confidence_score": i.confidence_score,
                "user_confirmed": i.user_confirmed,
            }
            for i in log.items
        ],
    }


def delete_meal_log(log_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    log = db.query(models.MealLog).filter(
        models.MealLog.id == log_id, models.MealLog.user_id == user.id
    ).first()
    if not log:
        raise HTTPException(404, "Meal log not found")
    log.is_deleted = True
    db.commit()
    return {"status": "deleted"}


def copy_meal_log(log_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Duplicate a previous meal log to today."""
    original = db.query(models.MealLog).filter(
        models.MealLog.id == log_id, models.MealLog.user_id == user.id
    ).first()
    if not original:
        raise HTTPException(404, "Meal log not found")

    new_log = models.MealLog(
        user_id=user.id,
        logged_at=utcnow(),
        meal_type=original.meal_type,
        log_method="copied",
        total_calories=original.total_calories,
        total_protein_g=original.total_protein_g,
        total_carbs_g=original.total_carbs_g,
        total_fat_g=original.total_fat_g,
    )
    db.add(new_log)
    db.flush()
    for item in original.items:
        new_item = models.MealItem(
            meal_log_id=new_log.id,
            food_id=item.food_id,
            custom_food_id=item.custom_food_id,
            display_name=item.display_name,
            quantity_g=item.quantity_g,
            serving_label=item.serving_label,
            calories=item.calories,
            protein_g=item.protein_g,
            carbs_g=item.carbs_g,
            fat_g=item.fat_g,
            is_ai_estimated=item.is_ai_estimated,
        )
        db.add(new_item)
    db.commit()
    return {"id": new_log.id, "status": "copied"}


def confirm_item(
    log_id: str, item_id: str,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark an AI-estimated item as user-confirmed."""
    item = db.query(models.MealItem).join(models.MealLog).filter(
        models.MealLog.id == log_id,
        models.MealLog.user_id == user.id,
        models.MealItem.id == item_id,
    ).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.user_confirmed = True
    db.commit()
    return {"status": "confirmed"}
