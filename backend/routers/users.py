"""users.py — User profile, settings, allergens, data export, account deletion"""
from flask_app.params import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Literal
from database import get_db
import models
from routers.auth import get_current_active_user
import json
import math
import re
import hashlib
from timeutil import utcnow



class WorkspaceBackup(BaseModel):
    entries: dict
    expected_revision: str | None = Field(default=None, max_length=64)
    owner_id: str | None = Field(default=None, max_length=36)

    @classmethod
    def validate_entries(cls, entries):
        if len(json.dumps(entries)) > 900000 or len(entries) > 1500:
            raise HTTPException(413, "Backup exceeds the size limit")
        for key, value in entries.items():
            if not re.fullmatch(r"trackcal:(play:(calm|character|theme|motion)|appearance|comfort|reminders|preferences|journal:\d{4}-\d{2}-\d{2}|wellness:\d{4}-\d{2}-\d{2}|target:[a-zA-Z_]+|burn:\d{4}-\d{2}-\d{2}|recipe:(name|servings|ingredients)|guide:done|companion-offset|studio:(recipes|pantry|shopping|workouts|plans|circuits|circuit-run|fast|next-targets|program-days|checkins))", key):
                raise HTTPException(422, "Unsupported workspace key")
            def check(node, depth=0):
                if depth > 8:
                    raise HTTPException(422, "Invalid workspace structure")
                if isinstance(node, float) and not math.isfinite(node):
                    raise HTTPException(422, "Invalid number")
                if isinstance(node, dict):
                    for item in node.values(): check(item, depth + 1)
                if isinstance(node, list):
                    for item in node: check(item, depth + 1)
            check(value)


def workspace(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    saved = db.get(models.UserWorkspace, user.id)
    return {"entries": saved.entries if saved else {}, "updated_at": saved.updated_at.isoformat() if saved else None, "revision": workspace_revision(saved)}


def workspace_revision(saved):
    return hashlib.sha256(json.dumps(saved.entries if saved else {}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def save_workspace(data: WorkspaceBackup, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if data.owner_id is not None and data.owner_id != str(user.id):
        raise HTTPException(403, "The queued backup belongs to another account. Sign in to its owner before syncing.")
    WorkspaceBackup.validate_entries(data.entries)
    # Lock the owner row too: this serializes concurrent first-backup creation.
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    saved = db.query(models.UserWorkspace).filter_by(user_id=user.id).with_for_update().first()
    if data.expected_revision is not None and data.expected_revision != workspace_revision(saved):
        raise HTTPException(409, "Your cloud backup changed on another device. Review it before replacing it.")
    if saved:
        saved.entries = data.entries
    else:
        saved = models.UserWorkspace(user_id=user.id, entries=data.entries)
        db.add(saved)
    db.commit()
    db.refresh(saved)
    return {"status": "Backup saved", "updated_at": saved.updated_at.isoformat(), "revision": workspace_revision(saved)}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    language_code: Optional[str] = Field(default=None, min_length=2, max_length=10)
    timezone: Optional[str] = Field(default=None, max_length=100)
    measurement_system: Optional[Literal["metric", "imperial"]] = None
    height_cm: Optional[float] = Field(default=None, ge=30, le=300, allow_inf_nan=False)
    weight_kg: Optional[float] = Field(default=None, ge=1, le=500, allow_inf_nan=False)
    dietary_preferences: Optional[List[str]] = Field(default=None, max_length=30)


class SettingsUpdate(BaseModel):
    daily_calorie_goal: Optional[int] = Field(default=None, gt=0, le=20000)
    daily_protein_goal_g: Optional[float] = Field(default=None, ge=0, le=2000, allow_inf_nan=False)
    daily_carb_goal_g: Optional[float] = Field(default=None, ge=0, le=2000, allow_inf_nan=False)
    daily_fat_goal_g: Optional[float] = Field(default=None, ge=0, le=2000, allow_inf_nan=False)
    daily_water_goal_ml: Optional[float] = Field(default=None, gt=0, le=20000, allow_inf_nan=False)
    notifications_enabled: Optional[bool] = None
    high_contrast_mode: Optional[bool] = None
    reduce_motion: Optional[bool] = None
    rtl_layout: Optional[bool] = None
    show_calorie_counts: Optional[bool] = None


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


def update_profile(data: ProfileUpdate, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    db.commit()
    return {"status": "updated"}


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


def update_settings(data: SettingsUpdate, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    s = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Settings not found")
    updates = data.model_dump(exclude_none=True)
    # Minors cannot enable calorie goals or counts
    personalization=db.get(models.PersonalizationProfile,user.id)
    if personalization and personalization.preferences.get("age_group") not in ("20_64","65plus"):
        raise HTTPException(400,"Restrictive calorie plans are unavailable for this age group.")
    if user.is_minor:
        updates.pop("daily_calorie_goal", None)
        updates.pop("show_calorie_counts", None)
    for k, v in updates.items():
        setattr(s, k, v)
    db.commit()
    return {"status": "updated"}


def delete_account(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Close the account now; services.account_erasure permanently erases it after the erasure window."""
    from datetime import datetime
    own_slots=db.query(models.CoachSlot.id).filter(models.CoachSlot.coach_id==user.id)
    appointments=db.query(models.CoachBooking).filter((models.CoachBooking.user_id==user.id)|(models.CoachBooking.slot_id.in_(own_slots))).with_for_update().all()
    for appointment in appointments:
        appointment.status="cancelled"
        slot=db.query(models.CoachSlot).filter_by(id=appointment.slot_id).with_for_update().first()
        if slot and slot.reserved_booking_id==appointment.id:slot.reserved_booking_id=None
    for slot in db.query(models.CoachSlot).filter_by(coach_id=user.id).with_for_update().all():slot.active=False
    user.deleted_at = utcnow().replace(microsecond=0)  # DATETIME keeps whole seconds and MySQL rounds, not truncates
    user.is_active = False
    db.commit()
    from services.account_erasure import erase_after
    return {"status": "account_closed", "erase_after": erase_after(user.deleted_at).date().isoformat(),
            "detail": "Access is disabled now. Your server records will be permanently erased on or after this date."}


def export_data(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Return a JSON dump of the user's data for GDPR portability."""
    logs = db.query(models.MealLog).filter(models.MealLog.user_id == user.id).all()
    recipes = db.query(models.Recipe).filter(models.Recipe.user_id == user.id).all()
    def row(value, omit=()):
        return {column.name: getattr(value, column.name) for column in value.__table__.columns if column.name not in omit} if value is not None else None
    return {
        "user_id": user.id,
        "email": user.email,
        "meal_logs": [{**row(log), "items": [row(item) for item in log.items]} for log in logs],
        "recipes": [{**row(recipe), "ingredients": [row(item) for item in recipe.ingredients]} for recipe in recipes],
        "profile": row(db.query(models.UserProfile).filter_by(user_id=user.id).first()),
        "settings": row(db.query(models.UserSettings).filter_by(user_id=user.id).first()),
        "water_entries": [row(entry) for entry in db.query(models.WaterEntry).filter_by(user_id=user.id).all()],
        "custom_foods": [row(food) for food in db.query(models.CustomFood).filter_by(user_id=user.id).all()],
        "web_workspace_backup": row(db.get(models.UserWorkspace, user.id)),
        "phase3":{name:[row(item) for item in db.query(model).filter_by(user_id=user.id).all()] for name,model in [('food_favorites',models.FoodFavorite),('food_search_history',models.FoodSearchHistory),('workout_blueprints',models.WorkoutBlueprint),('workout_sessions',models.WorkoutSession)]},
        "personalization":{name:[row(item) for item in db.query(model).filter_by(user_id=user.id).all()] for name,model in [('preferences',models.PersonalizationProfile),('measurements',models.WellnessMeasurement),('plans',models.ActivityPlan),('recommendations',models.RecommendationHistory),('reminder_deliveries',models.ReminderDelivery)]},
        "plan_activities":[row(item) for item in db.query(models.PlanActivity).join(models.ActivityPlan).filter(models.ActivityPlan.user_id==user.id).all()],
        "gamification": {name:[row(item) for item in db.query(model).filter_by(user_id=user.id).all()] for name,model in [('activity_events',models.ActivityRewardEvent),('achievements',models.UserAchievement),('character_unlocks',models.CharacterUnlock),('customization',models.CharacterCustomization),('streak_records',models.StreakRecord)]},
        "adventure": {
            "profile": row(db.get(models.AdventureProfile,user.id)),
            "rewards": [row(event) for event in db.query(models.RewardEvent).filter_by(user_id=user.id).all()],
            "reviewed_meals": [row(meal) for meal in db.query(models.AdventureMeal).filter_by(user_id=user.id).all()],
            "game_sessions": [{"id":game.id,"expires_at":game.expires_at,"completed":game.completed,"attempts":game.attempts} for game in db.query(models.GameSession).filter_by(user_id=user.id).all()],
        },
        "account_records": {name: [row(item, omit) for item in db.query(model).filter(getattr(model, column) == user.id).all()] for name, model, omit, column in ((*entry, "user_id")[:4] for entry in ACCOUNT_RECORDS)},
        "note": "Nutrition and optional adventure data export. Uploaded image files are referenced by ID and are not embedded.",
    }


# Export coverage register (KI-03). Every table with a user-owner column is exported or excluded with a
# reason; tests/test_export_coverage.py fails when a new user-owned table is in neither list.
ACCOUNT_RECORDS = [
    ('saved_meals', models.SavedMeal, ()),
    ('allergens', models.UserAllergen, ()),
    ('consents', models.ConsentRecord, ()),
    ('ai_scan_jobs', models.AIScanJob, ()),
    ('food_images', models.FoodImage, ('storage_path',)),  # server-internal file location
    ('food_corrections', models.FoodCorrection, ()),
    ('community_submissions', models.CommunitySubmission, ()),
    ('support_tickets', models.SupportTicket, ()),
    ('coach_bookings', models.CoachBooking, ()),
    ('subscription', models.Subscription, ()),
    ('devices', models.UserDevice, ('device_token',)),  # a push credential, not personal content
    ('notification_settings', models.NotificationSettings, ()),
    ('push_subscriptions', models.PushSubscription, ('endpoint', 'endpoint_hash', 'p256dh', 'auth')),  # push credentials
    ('scheduled_notifications', models.ScheduledNotification, ('idempotency_key',)),  # internal job key
    ('social_profile', models.SocialProfile, ()),
    ('posts', models.Post, (), 'author_id'),
    ('comments', models.Comment, (), 'author_id'),
    ('reactions', models.PostReaction, ()),
    ('following', models.Follow, (), 'follower_id'),
    ('blocks_and_mutes', models.SocialBlock, ()),
    ('reports_you_made', models.ContentReport, (), 'reporter_id'),
    ('communities_you_own', models.Community, (), 'owner_id'),
    ('community_memberships', models.CommunityMember, ()),
    ('events_you_organize', models.Event, ('checkin_key',), 'organizer_id'),  # the QR secret is not personal data
    ('event_registrations', models.EventRegistration, ()),
    ('challenges_you_started', models.Challenge, (), 'creator_id'),
    ('challenge_participation', models.ChallengeParticipant, ('flagged',)),  # internal review signal
    ('activities', models.Activity, ()),
    ('privacy_zones', models.PrivacyZone, ()),
    ('lab_reports', models.LabReport, ()),
    ('lab_results', models.LabResult, ()),
]
EXPORTED_TABLES = {
    'users', 'meal_logs', 'recipes', 'user_profiles', 'user_settings', 'water_entries', 'custom_foods', 'user_workspaces',
    'food_favorites', 'food_search_history', 'workout_blueprints', 'workout_sessions', 'personalization_profiles',
    'wellness_measurements', 'activity_plans', 'recommendation_history', 'reminder_deliveries', 'activity_reward_events',
    'user_achievements', 'character_unlocks', 'character_customizations', 'streak_records', 'adventure_profiles',
    'reward_events', 'adventure_meals', 'game_sessions', *(entry[1].__tablename__ for entry in ACCOUNT_RECORDS),
}
EXPORT_EXCLUDED = {
    'account_action_tokens': 'one-time recovery and verification token digests (secrets, short-lived)',
    'auth_identities': 'sign-in provider token hashes (credentials)',
    'audit_logs': 'security record kept by the operator; available on request',
    'coach_slots': "the coach's own published schedule, not the client's record",
}


class OnboardingPlanRequest(BaseModel):
    biological_sex: Literal["male", "female"] = "male"
    age: int = Field(default=25, ge=20, le=100)
    weight_kg: float = Field(default=70.0, ge=30, le=350, allow_inf_nan=False)
    height_cm: float = Field(default=175.0, ge=100, le=230, allow_inf_nan=False)
    activity_level: Literal["sedentary", "light", "moderate", "very_active"] = "moderate"
    goal: Literal["lose_weight", "maintain", "build_muscle"] = "lose_weight"
    dietary_preference: str = "standard"  # standard, vegetarian, vegan, halal, keto


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
    personalization=db.get(models.PersonalizationProfile,user.id)
    if personalization and personalization.preferences.get("age_group") not in ("20_64","65plus"):
        raise HTTPException(400,"Restrictive calorie plans are unavailable for this age group.")
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

