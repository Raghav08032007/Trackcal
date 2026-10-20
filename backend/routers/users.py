"""users.py — User profile, settings, allergens, data export, account deletion"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    country_code: Optional[str] = None
    language_code: Optional[str] = None
    timezone: Optional[str] = None
    measurement_system: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    dietary_preferences: Optional[List[str]] = None


class SettingsUpdate(BaseModel):
    daily_calorie_goal: Optional[int] = None
    daily_protein_goal_g: Optional[float] = None
    daily_carb_goal_g: Optional[float] = None
    daily_fat_goal_g: Optional[float] = None
    daily_water_goal_ml: Optional[float] = None
    notifications_enabled: Optional[bool] = None
    high_contrast_mode: Optional[bool] = None
    reduce_motion: Optional[bool] = None
    rtl_layout: Optional[bool] = None
    show_calorie_counts: Optional[bool] = None


@router.get("/profile")
def get_profile(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "is_minor": user.is_minor,
        "display_name": profile.display_name,
        "country_code": profile.country_code,
        "language_code": profile.language_code,
        "timezone": profile.timezone,
        "measurement_system": profile.measurement_system,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "dietary_preferences": profile.dietary_preferences or [],
        "health_goals": profile.health_goals or [],
        "currency_code": profile.currency_code,
    }


@router.patch("/profile")
def update_profile(data: ProfileUpdate, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    db.commit()
    return {"status": "updated"}


@router.get("/settings")
def get_settings(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    s = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Settings not found")
    return {
        "daily_calorie_goal": s.daily_calorie_goal,
        "daily_protein_goal_g": s.daily_protein_goal_g,
        "daily_carb_goal_g": s.daily_carb_goal_g,
        "daily_fat_goal_g": s.daily_fat_goal_g,
        "daily_water_goal_ml": s.daily_water_goal_ml,
        "notifications_enabled": s.notifications_enabled,
        "high_contrast_mode": s.high_contrast_mode,
        "reduce_motion": s.reduce_motion,
        "rtl_layout": s.rtl_layout,
        "show_calorie_counts": False if user.is_minor else s.show_calorie_counts,
    }


@router.patch("/settings")
def update_settings(data: SettingsUpdate, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    s = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Settings not found")
    updates = data.model_dump(exclude_none=True)
    # Minors cannot enable calorie goals or counts
    if user.is_minor:
        updates.pop("daily_calorie_goal", None)
        updates.pop("show_calorie_counts", None)
    for k, v in updates.items():
        setattr(s, k, v)
    db.commit()
    return {"status": "updated"}


@router.delete("/account")
def delete_account(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Soft-delete the user account."""
    from datetime import datetime
    user.deleted_at = datetime.utcnow()
    user.is_active = False
    db.commit()
    return {"status": "account_scheduled_for_deletion"}


@router.get("/export")
def export_data(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Return a JSON dump of the user's data for GDPR portability."""
    logs = db.query(models.MealLog).filter(models.MealLog.user_id == user.id).all()
    recipes = db.query(models.Recipe).filter(models.Recipe.user_id == user.id).all()
    return {
        "user_id": user.id,
        "email": user.email,
        "meal_logs": [{"id": l.id, "logged_at": str(l.logged_at), "meal_type": l.meal_type.value} for l in logs],
        "recipes": [{"id": r.id, "name": r.name, "servings": r.servings} for r in recipes],
        "note": "Full data export available on request via support.",
    }


class OnboardingPlanRequest(BaseModel):
    biological_sex: str = "male"  # male or female
    age: int = 25
    weight_kg: float = 70.0
    height_cm: float = 175.0
    activity_level: str = "moderate"  # sedentary, light, moderate, very_active
    goal: str = "lose_weight"  # lose_weight, maintain, build_muscle
    dietary_preference: str = "standard"  # standard, vegetarian, vegan, halal, keto


@router.post("/onboarding/calculate-plan")
def calculate_onboarding_plan(
    data: OnboardingPlanRequest,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Onboarding Engine (Cal AI style):
    Calculates Basal Metabolic Rate (BMR via Mifflin-St Jeor), Total Daily Energy Expenditure (TDEE),
    and sets recommended daily calorie and macro goals.
    """
    if user.is_minor:
        raise HTTPException(400, "Calorie goals are disabled for minor accounts in compliance with safety policy.")

    # BMR: Mifflin-St Jeor Formula
    if data.biological_sex.lower() == "female":
        bmr = 10 * data.weight_kg + 6.25 * data.height_cm - 5 * data.age - 161
    else:
        bmr = 10 * data.weight_kg + 6.25 * data.height_cm - 5 * data.age + 5

    # Activity multiplier
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "very_active": 1.725
    }
    tdee = bmr * multipliers.get(data.activity_level.lower(), 1.4)

    # Goal adjustment
    if data.goal == "lose_weight":
        target_calories = round(max(1200, tdee - 500))
        pace_label = "0.5 kg / week healthy fat loss"
    elif data.goal == "build_muscle":
        target_calories = round(tdee + 300)
        pace_label = "Lean muscle gain with surplus"
    else:
        target_calories = round(tdee)
        pace_label = "Weight maintenance"

    # Macro distribution
    if data.dietary_preference == "keto":
        protein_g = round(data.weight_kg * 1.8)
        carbs_g = 25.0
        fat_calories = target_calories - (protein_g * 4 + carbs_g * 4)
        fat_g = round(max(20, fat_calories / 9))
    else:
        protein_g = round(data.weight_kg * 1.7)
        fat_g = round((target_calories * 0.25) / 9)
        carbs_cal = target_calories - (protein_g * 4 + fat_g * 9)
        carbs_g = round(max(50, carbs_cal / 4))

    # Water target: ~35 ml per kg
    water_ml = round(data.weight_kg * 35)

    # Save to user settings if settings exist
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if settings:
        settings.daily_calorie_goal = target_calories
        settings.daily_protein_goal_g = protein_g
        settings.daily_carb_goal_g = carbs_g
        settings.daily_fat_goal_g = fat_g
        settings.daily_water_goal_ml = water_ml

    # Update profile measurements
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    if profile:
        profile.weight_kg = data.weight_kg
        profile.height_cm = data.height_cm
        profile.health_goals = [data.goal]
        profile.dietary_preferences = [data.dietary_preference]

    db.commit()

    return {
        "status": "plan_activated",
        "bmr": round(bmr),
        "tdee": round(tdee),
        "target_calories": target_calories,
        "macros": {
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g
        },
        "water_target_ml": water_ml,
        "pace": pace_label
    }

