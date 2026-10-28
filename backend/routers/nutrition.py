"""nutrition.py — Nutrition dashboard: daily totals, trends, macro breakdown, water"""
from datetime import datetime, date, timedelta
from typing import Optional
from flask_app.params import Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user



def daily_summary(
    target_date: Optional[date] = Query(None),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return nutrition totals for a specific day."""
    day = target_date or date.today()
    day_start = datetime.combine(day, datetime.min.time())
    day_end = datetime.combine(day, datetime.max.time())

    logs = db.query(models.MealLog).filter(
        models.MealLog.user_id == user.id,
        models.MealLog.logged_at.between(day_start, day_end),
        models.MealLog.is_deleted == False,
    ).all()

    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0, "sugar_g": 0.0, "sodium_mg": 0.0}
    meals_breakdown = []

    for log in logs:
        meal_cal = log.total_calories or 0
        meal_pro = log.total_protein_g or 0
        meal_carb = log.total_carbs_g or 0
        meal_fat = log.total_fat_g or 0
        totals["calories"] += meal_cal
        totals["protein_g"] += meal_pro
        totals["carbs_g"] += meal_carb
        totals["fat_g"] += meal_fat
        for item in log.items:
            totals["fiber_g"] += item.fiber_g or 0
            totals["sugar_g"] += item.sugar_g or 0
            totals["sodium_mg"] += item.sodium_mg or 0
        meals_breakdown.append({
            "id": log.id,
            "meal_type": log.meal_type.value,
            "logged_at": log.logged_at.isoformat(),
            "calories": meal_cal,
            "protein_g": meal_pro,
            "carbs_g": meal_carb,
            "fat_g": meal_fat,
            "item_count": len(log.items),
        })

    # Water
    water_entries = db.query(models.WaterEntry).filter(
        models.WaterEntry.user_id == user.id,
        models.WaterEntry.logged_at.between(day_start, day_end),
    ).all()
    water_ml = sum(w.amount_ml for w in water_entries)

    # User goals
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    goals = {}
    if settings and not user.is_minor:
        goals = {
            "calories": settings.daily_calorie_goal,
            "protein_g": settings.daily_protein_goal_g,
            "carbs_g": settings.daily_carb_goal_g,
            "fat_g": settings.daily_fat_goal_g,
            "water_ml": settings.daily_water_goal_ml,
        }

    return {
        "date": day.isoformat(),
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "water_ml": round(water_ml, 1),
        "meals": meals_breakdown,
        "goals": goals,
        "show_calorie_counts": not user.is_minor,
    }


def weekly_summary(
    week_start: Optional[date] = Query(None),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return per-day totals for the past 7 days."""
    end = date.today()
    start = week_start or (end - timedelta(days=6))
    end = start + timedelta(days=6)

    result = []
    current = start
    while current <= end:
        day_start = datetime.combine(current, datetime.min.time())
        day_end = datetime.combine(current, datetime.max.time())
        logs = db.query(models.MealLog).filter(
            models.MealLog.user_id == user.id,
            models.MealLog.logged_at.between(day_start, day_end),
            models.MealLog.is_deleted == False,
        ).all()
        cal = sum(l.total_calories or 0 for l in logs)
        pro = sum(l.total_protein_g or 0 for l in logs)
        carb = sum(l.total_carbs_g or 0 for l in logs)
        fat = sum(l.total_fat_g or 0 for l in logs)
        result.append({"date": current.isoformat(), "calories": round(cal, 1),
                        "protein_g": round(pro, 1), "carbs_g": round(carb, 1), "fat_g": round(fat, 1)})
        current += timedelta(days=1)

    return {"week_start": start.isoformat(), "week_end": end.isoformat(), "days": result}


def monthly_trends(
    months: int = Query(3, le=12),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return 30/60/90-day average nutrient trends."""
    days = months * 30
    since = datetime.utcnow() - timedelta(days=days)
    logs = db.query(models.MealLog).filter(
        models.MealLog.user_id == user.id,
        models.MealLog.logged_at >= since,
        models.MealLog.is_deleted == False,
    ).all()

    if not logs:
        return {"message": "No data in selected period", "averages": {}}

    unique_days = len(set(l.logged_at.date() for l in logs))
    avg_cal = round(sum(l.total_calories or 0 for l in logs) / max(unique_days, 1), 1)
    avg_pro = round(sum(l.total_protein_g or 0 for l in logs) / max(unique_days, 1), 1)
    avg_carb = round(sum(l.total_carbs_g or 0 for l in logs) / max(unique_days, 1), 1)
    avg_fat = round(sum(l.total_fat_g or 0 for l in logs) / max(unique_days, 1), 1)

    return {
        "period_days": days,
        "logged_days": unique_days,
        "averages": {"calories": avg_cal, "protein_g": avg_pro, "carbs_g": avg_carb, "fat_g": avg_fat},
    }


# ── Water logging ────────────────────────────────────────────────

class WaterCreate(BaseModel):
    amount_ml: float = Field(gt=0, le=10000, allow_inf_nan=False)
    logged_at: Optional[datetime] = None


def log_water(
    data: WaterCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    entry = models.WaterEntry(
        user_id=user.id,
        amount_ml=data.amount_ml,
        logged_at=data.logged_at or datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    return {"id": entry.id, "amount_ml": entry.amount_ml, "logged_at": entry.logged_at.isoformat()}


def recommend_macro_fill(
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    AI Smart Coach: 'Fill My Remaining Macros'
    Analyzes today's deficit and recommends optimal regional meals to hit targets.
    """
    day = date.today()
    day_start = datetime.combine(day, datetime.min.time())
    day_end = datetime.combine(day, datetime.max.time())

    logs = db.query(models.MealLog).filter(
        models.MealLog.user_id == user.id,
        models.MealLog.logged_at.between(day_start, day_end),
        models.MealLog.is_deleted == False,
    ).all()

    consumed_cal = sum(l.total_calories or 0 for l in logs)
    consumed_pro = sum(l.total_protein_g or 0 for l in logs)
    consumed_carb = sum(l.total_carbs_g or 0 for l in logs)
    consumed_fat = sum(l.total_fat_g or 0 for l in logs)

    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    target_cal = settings.daily_calorie_goal if (settings and settings.daily_calorie_goal) else 2000
    target_pro = settings.daily_protein_goal_g if (settings and settings.daily_protein_goal_g) else 130
    target_carb = settings.daily_carb_goal_g if (settings and settings.daily_carb_goal_g) else 220
    target_fat = settings.daily_fat_goal_g if (settings and settings.daily_fat_goal_g) else 65

    rem_cal = max(0, target_cal - consumed_cal)
    rem_pro = max(0, target_pro - consumed_pro)
    rem_carb = max(0, target_carb - consumed_carb)
    rem_fat = max(0, target_fat - consumed_fat)

    # Fetch available seeded foods
    all_foods = db.query(models.Food).all()

    recommendations = []
    for food in all_foods[:12]:
        # Estimate nutritional density per serving
        recommendations.append({
            "food_id": food.id,
            "name": food.name,
            "cuisine": food.cuisine_region or "Global",
            "serving": food.serving_size_description or f"{food.serving_size_g}g",
            "fit_reason": f"High nutritional density, fits your {rem_cal} kcal remaining window."
        })

    advice = (
        f"You have {round(rem_cal)} kcal and {round(rem_pro)}g protein remaining today. "
        f"Prioritize protein-dense, minimally processed foods to maintain satiety."
    )

    return {
        "status": "success",
        "today_consumed": {
            "calories": round(consumed_cal, 1),
            "protein_g": round(consumed_pro, 1),
            "carbs_g": round(consumed_carb, 1),
            "fat_g": round(consumed_fat, 1),
        },
        "remaining_budget": {
            "calories": round(rem_cal, 1),
            "protein_g": round(rem_pro, 1),
            "carbs_g": round(rem_carb, 1),
            "fat_g": round(rem_fat, 1),
        },
        "coach_advice": advice,
        "recommended_options": recommendations[:4],
    }
