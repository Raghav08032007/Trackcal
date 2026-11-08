"""
models.py — Complete SQLAlchemy ORM models for Global AI Food Intelligence Platform
MySQL 8.0 + utf8mb4
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint,
    func,
)
from sqlalchemy.dialects.mysql import CHAR, LONGTEXT, MEDIUMTEXT
from sqlalchemy.orm import relationship

from database import Base
from timeutil import utcnow


class UserWorkspace(Base):
    """Explicit account backup of the web workspace, isolated by owner."""
    __tablename__ = "user_workspaces"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    entries = Column(JSON, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class AdventureProfile(Base):
    __tablename__ = "adventure_profiles"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    timezone = Column(String(80), nullable=False, default="UTC")
    created_at = Column(DateTime, nullable=False, default=utcnow)


class RewardEvent(Base):
    __tablename__ = "reward_events"
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_key = Column(String(100), nullable=False)
    kind = Column(String(30), nullable=False)
    local_day = Column(String(10), nullable=False)
    xp = Column(Integer, nullable=False)
    companion_id = Column(String(20), nullable=True)  # active companion when earned (bond, Phase 11); NULL before Phase 11
    created_at = Column(DateTime, nullable=False, default=utcnow)
    __table_args__ = (UniqueConstraint("user_id", "reward_key", name="uq_reward_user_key"),)


class AdventureMeal(Base):
    __tablename__ = "adventure_meals"
    id = Column(CHAR(36), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    local_day = Column(String(10), nullable=False)
    snapshot = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class GameSession(Base):
    __tablename__ = "game_sessions"
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    completed = Column(Boolean, nullable=False, default=False)
    attempts = Column(Integer, nullable=False, default=0)


class BarcodeCache(Base):
    """Open Food Facts lookups: found products for 30 days, "not found" for 24 hours (services.barcode_lookup)."""
    __tablename__ = "barcode_cache"
    barcode = Column(String(14), primary_key=True)
    found = Column(Boolean, nullable=False)
    product = Column(JSON, nullable=True)
    fetched_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False, index=True)


class FeatureFlag(Base):
    """Runtime switch for a module listed in services.feature_flags.REGISTRY. No row means the registry default (off)."""
    __tablename__ = "feature_flags"
    key = Column(String(64), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    updated_by = Column(String(100), nullable=True)


class GamificationRule(Base):
    __tablename__ = "gamification_rules"
    key = Column(String(50), primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    enabled = Column(Boolean, nullable=False, default=False)
    xp = Column(Integer, nullable=False, default=0)
    daily_cap = Column(Integer, nullable=False, default=0)
    settings = Column(JSON, nullable=False, default=dict)


class ActivityRewardEvent(Base):
    __tablename__ = "activity_reward_events"
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    source_id = Column(String(100), nullable=False)
    local_day = Column(String(10), nullable=False)
    rule_version = Column(Integer, nullable=False)
    awarded_xp = Column(Integer, nullable=False, default=0)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    __table_args__ = (UniqueConstraint("user_id", "category", "source_id", name="uq_activity_reward_source"),)


class AchievementDefinition(Base):
    __tablename__ = "achievements"
    code = Column(String(50), primary_key=True)
    title = Column(String(100), nullable=False)
    metric = Column(String(40), nullable=False)
    threshold = Column(Integer, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code = Column(String(50), ForeignKey("achievements.code"), primary_key=True)
    unlocked_at = Column(DateTime, nullable=False, default=utcnow)


class CharacterCustomization(Base):
    __tablename__ = "character_customizations"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    character_id = Column(String(20), nullable=False, default="pip")
    accessory = Column(String(20), nullable=False, default="none")
    enabled = Column(Boolean, nullable=False, default=True)
    minimized = Column(Boolean, nullable=False, default=True)
    muted = Column(Boolean, nullable=False, default=False)
    position = Column(String(10), nullable=False, default="right")
    protection_enabled = Column(Boolean, nullable=False, default=True)
    aura = Column(String(20), nullable=False, default='none')  # earned through bond stages (Phase 11)
    title = Column(String(40), nullable=False, default='')


class CharacterUnlock(Base):
    __tablename__ = "character_unlocks"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    character_id = Column(String(20), primary_key=True)
    unlocked_at = Column(DateTime, nullable=False, default=utcnow)


class StreakRecord(Base):
    __tablename__ = "streak_records"
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    local_day = Column(String(10), primary_key=True)
    kind = Column(String(12), nullable=False, default="rest")
    created_at = Column(DateTime, nullable=False, default=utcnow)


class AccountActionToken(Base):
    __tablename__ = "account_action_tokens"
    digest = Column(String(64), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose = Column(String(20), nullable=False)
    credential = Column(String(64), nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    used_at = Column(DateTime, nullable=True)


class RateBucket(Base):
    __tablename__ = "rate_buckets"
    key = Column(String(64), primary_key=True)
    hits = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=False, index=True)


class CoachSlot(Base):
    __tablename__ = "coach_slots"
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coach_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    starts_at = Column(DateTime, nullable=False, index=True)
    ends_at = Column(DateTime, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    reserved_booking_id = Column(CHAR(36), nullable=True)
    published_at = Column(DateTime, nullable=True)  # Premium members can book from here; everyone 24 h later (NULL: open to all)


class CoachBooking(Base):
    __tablename__ = "coach_bookings"
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slot_id = Column(CHAR(36), ForeignKey("coach_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="confirmed")
    created_at = Column(DateTime, nullable=False, default=utcnow)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return utcnow()


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class UserRole(str, enum.Enum):
    user = "user"
    premium = "premium"
    family_admin = "family_admin"
    professional = "professional"
    admin = "admin"


class SubscriptionStatus(str, enum.Enum):
    free = "free"
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    cancelled = "cancelled"
    expired = "expired"


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"
    drink = "drink"
    other = "other"


class LogMethod(str, enum.Enum):
    photo = "photo"
    barcode = "barcode"
    ocr = "ocr"
    manual = "manual"
    voice = "voice"
    text = "text"
    recipe = "recipe"
    saved = "saved"
    copied = "copied"
    restaurant = "restaurant"


class ScanStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    needs_review = "needs_review"


class NutritionDataSource(str, enum.Enum):
    usda = "usda"
    open_food_facts = "open_food_facts"
    user_created = "user_created"
    community = "community"
    ocr_extracted = "ocr_extracted"
    ai_estimated = "ai_estimated"
    restaurant_official = "restaurant_official"
    ifct = "ifct"  # Indian Food Composition Tables 2017, NIN Hyderabad (docs/DATA_SOURCES.md)


class ConsentType(str, enum.Enum):
    terms = "terms"
    privacy = "privacy"
    marketing = "marketing"
    health_data = "health_data"
    ai_training = "ai_training"
    analytics = "analytics"


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class GenderIdentity(str, enum.Enum):
    male = "male"
    female = "female"
    non_binary = "non_binary"
    prefer_not = "prefer_not"


# ──────────────────────────────────────────────
# Users & Auth
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, default=False)
    hashed_password = Column(String(255), nullable=True)  # null for SSO-only
    role = Column(Enum(UserRole), default=UserRole.user)
    is_active = Column(Boolean, default=True)
    is_minor = Column(Boolean, default=False)
    date_of_birth = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    deleted_at = Column(DateTime, nullable=True)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    auth_identities = relationship("AuthIdentity", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    consents = relationship("ConsentRecord", back_populates="user", cascade="all, delete-orphan")
    devices = relationship("UserDevice", back_populates="user", cascade="all, delete-orphan")
    meal_logs = relationship("MealLog", back_populates="user", cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="user", cascade="all, delete-orphan")
    saved_meals = relationship("SavedMeal", back_populates="user", cascade="all, delete-orphan")
    water_entries = relationship("WaterEntry", back_populates="user", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    food_corrections = relationship("FoodCorrection", back_populates="user", cascade="all, delete-orphan")
    community_submissions = relationship("CommunitySubmission", back_populates="user", cascade="all, delete-orphan")
    custom_foods = relationship("CustomFood", back_populates="user", cascade="all, delete-orphan")
    allergen_preferences = relationship("UserAllergen", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active"),
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    gender_identity = Column(Enum(GenderIdentity), nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    activity_level = Column(String(50), nullable=True)
    dietary_preferences = Column(JSON, nullable=True)  # ["vegetarian", "gluten_free", ...]
    health_goals = Column(JSON, nullable=True)
    country_code = Column(String(2), nullable=True)
    language_code = Column(String(10), default="en")
    timezone = Column(String(64), default="UTC")
    measurement_system = Column(String(10), default="metric")  # metric / imperial
    currency_code = Column(String(3), default="USD")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="profile")


class AuthIdentity(Base):
    __tablename__ = "auth_identities"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    provider = Column(String(50))  # google, apple, email
    provider_user_id = Column(String(255))
    access_token_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="auth_identities")
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    daily_calorie_goal = Column(Integer, nullable=True)
    daily_protein_goal_g = Column(Float, nullable=True)
    daily_carb_goal_g = Column(Float, nullable=True)
    daily_fat_goal_g = Column(Float, nullable=True)
    daily_water_goal_ml = Column(Float, default=2000.0)
    meal_reminder_times = Column(JSON, nullable=True)
    notifications_enabled = Column(Boolean, default=True)
    share_data_for_improvement = Column(Boolean, default=False)
    high_contrast_mode = Column(Boolean, default=False)
    reduce_motion = Column(Boolean, default=False)
    text_size_multiplier = Column(Float, default=1.0)
    rtl_layout = Column(Boolean, default=False)
    show_calorie_counts = Column(Boolean, default=True)  # disabled for minors
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="settings")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    consent_type = Column(Enum(ConsentType))
    granted = Column(Boolean)
    version = Column(String(20))
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    granted_at = Column(DateTime, default=_now)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="consents")


class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    device_token = Column(String(500), nullable=True)
    platform = Column(String(20))  # ios, android, web
    device_name = Column(String(100), nullable=True)
    last_seen_at = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="devices")


# ──────────────────────────────────────────────
# Food & Nutrition Data
# ──────────────────────────────────────────────

class Food(Base):
    __tablename__ = "foods"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False, index=True)
    name_normalized = Column(String(255), nullable=False, index=True)
    brand_id = Column(CHAR(36), ForeignKey("brands.id"), nullable=True)
    data_source = Column(Enum(NutritionDataSource), default=NutritionDataSource.usda)
    external_id = Column(String(100), nullable=True)  # USDA fdc_id, OFF barcode, etc.
    is_verified = Column(Boolean, default=False)
    is_generic = Column(Boolean, default=True)
    category = Column(String(100), nullable=True)
    cuisine_region = Column(String(100), nullable=True)
    serving_size_g = Column(Float, nullable=True)
    serving_size_unit = Column(String(50), nullable=True)
    serving_size_description = Column(String(100), nullable=True)
    data_completeness_score = Column(Float, default=0.0)  # 0-1
    allergen_ids = Column(JSON, nullable=True)
    ingredients = Column(JSON, nullable=True)  # names, for mixed dishes
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    brand = relationship("Brand", back_populates="foods")
    portions = relationship("FoodPortion", back_populates="food", cascade="all, delete-orphan")
    nutrients = relationship("FoodNutrient", back_populates="food", cascade="all, delete-orphan")
    barcodes = relationship("Barcode", back_populates="food", cascade="all, delete-orphan")
    translations = relationship("FoodTranslation", back_populates="food", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_foods_source_ext", "data_source", "external_id"),
        Index("ix_food_category_name","category","name_normalized"),
        Index("ft_foods_name", "name", mysql_prefix="FULLTEXT"),  # word-anywhere search ("milled" in "Rice, raw, milled")
    )


class FoodTranslation(Base):
    __tablename__ = "food_translations"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    food_id = Column(CHAR(36), ForeignKey("foods.id", ondelete="CASCADE"))
    language_code = Column(String(10), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    food = relationship("Food", back_populates="translations")
    __table_args__ = (UniqueConstraint("food_id", "language_code"),)


class Brand(Base):
    __tablename__ = "brands"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    country_code = Column(String(2), nullable=True)
    website = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=_now)

    foods = relationship("Food", back_populates="brand")


class Barcode(Base):
    __tablename__ = "barcodes"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    food_id = Column(CHAR(36), ForeignKey("foods.id", ondelete="CASCADE"))
    barcode_value = Column(String(100), nullable=False, unique=True, index=True)
    barcode_type = Column(String(20))  # EAN-13, UPC-A, QR, etc.

    food = relationship("Food", back_populates="barcodes")


class FoodPortion(Base):
    """A real serving size: "1 cup, chopped" is 150 g."""
    __tablename__ = "food_portions"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    food_id = Column(CHAR(36), ForeignKey("foods.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(120), nullable=False)
    grams = Column(Float, nullable=False)
    position = Column(Integer, nullable=False, default=0)

    food = relationship("Food", back_populates="portions")


class NutrientDefinition(Base):
    __tablename__ = "nutrient_definitions"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, nullable=False)
    unit = Column(String(20))  # g, mg, mcg, kcal, IU
    category = Column(String(50))  # macro, vitamin, mineral, energy
    display_order = Column(Integer, default=0)

    food_nutrients = relationship("FoodNutrient", back_populates="nutrient_def")


class FoodNutrient(Base):
    __tablename__ = "food_nutrients"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    food_id = Column(CHAR(36), ForeignKey("foods.id", ondelete="CASCADE"))
    nutrient_def_id = Column(CHAR(36), ForeignKey("nutrient_definitions.id"))
    amount_per_100g = Column(Float, nullable=False)
    is_estimated = Column(Boolean, default=False)
    source_note = Column(String(255), nullable=True)

    food = relationship("Food", back_populates="nutrients")
    nutrient_def = relationship("NutrientDefinition", back_populates="food_nutrients")

    __table_args__ = (UniqueConstraint("food_id", "nutrient_def_id"),)


class Allergen(Base):
    __tablename__ = "allergens"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    name = Column(String(100), unique=True)
    slug = Column(String(50), unique=True)
    eu_listed = Column(Boolean, default=False)


class UserAllergen(Base):
    __tablename__ = "user_allergens"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    allergen_id = Column(CHAR(36), ForeignKey("allergens.id"))
    severity = Column(String(20), default="avoid")  # avoid, intolerant, allergy

    user = relationship("User", back_populates="allergen_preferences")
    allergen = relationship("Allergen")


# ──────────────────────────────────────────────
# Custom Foods
# ──────────────────────────────────────────────

class CustomFood(Base):
    __tablename__ = "custom_foods"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    brand_name = Column(String(255), nullable=True)
    serving_size_g = Column(Float, default=100.0)
    calories_per_100g = Column(Float, nullable=False)
    protein_per_100g = Column(Float, default=0.0)
    carbs_per_100g = Column(Float, default=0.0)
    fat_per_100g = Column(Float, default=0.0)
    fiber_per_100g = Column(Float, nullable=True)
    sugar_per_100g = Column(Float, nullable=True)
    sodium_per_100g = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="custom_foods")


# ──────────────────────────────────────────────
# Recipes
# ──────────────────────────────────────────────

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    servings = Column(Integer, default=1)
    total_weight_g = Column(Float, nullable=True)
    cooked_weight_g = Column(Float, nullable=True)
    preparation_method = Column(String(100), nullable=True)
    cuisine_region = Column(String(100), nullable=True)
    is_family_recipe = Column(Boolean, default=False)
    is_shared = Column(Boolean, default=False)
    image_url = Column(String(500), nullable=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="recipes")
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    recipe_id = Column(CHAR(36), ForeignKey("recipes.id", ondelete="CASCADE"))
    food_id = Column(CHAR(36), ForeignKey("foods.id"), nullable=True)
    custom_food_id = Column(CHAR(36), ForeignKey("custom_foods.id"), nullable=True)
    name_override = Column(String(255), nullable=True)
    quantity_g = Column(Float, nullable=False)
    unit_label = Column(String(50), nullable=True)
    order_index = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="ingredients")
    food = relationship("Food")
    custom_food = relationship("CustomFood")


# ──────────────────────────────────────────────
# Meal Logging
# ──────────────────────────────────────────────

class MealLog(Base):
    __tablename__ = "meal_logs"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    logged_at = Column(DateTime, nullable=False)
    meal_type = Column(Enum(MealType), default=MealType.other)
    log_method = Column(Enum(LogMethod), default=LogMethod.manual)
    notes = Column(Text, nullable=True)
    image_id = Column(CHAR(36), ForeignKey("food_images.id"), nullable=True)
    scan_job_id = Column(CHAR(36), ForeignKey("ai_scan_jobs.id"), nullable=True)
    total_calories = Column(Float, nullable=True)
    total_protein_g = Column(Float, nullable=True)
    total_carbs_g = Column(Float, nullable=True)
    total_fat_g = Column(Float, nullable=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="meal_logs")
    items = relationship("MealItem", back_populates="meal_log", cascade="all, delete-orphan")
    image = relationship("FoodImage")

    __table_args__ = (
        Index("ix_meal_logs_user_date", "user_id", "logged_at"),
    )


class MealItem(Base):
    __tablename__ = "meal_items"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    meal_log_id = Column(CHAR(36), ForeignKey("meal_logs.id", ondelete="CASCADE"))
    food_id = Column(CHAR(36), ForeignKey("foods.id"), nullable=True)
    custom_food_id = Column(CHAR(36), ForeignKey("custom_foods.id"), nullable=True)
    recipe_id = Column(CHAR(36), ForeignKey("recipes.id"), nullable=True)
    display_name = Column(String(255), nullable=False)
    quantity_g = Column(Float, nullable=False)
    serving_label = Column(String(100), nullable=True)
    calories = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)
    sugar_g = Column(Float, nullable=True)
    sodium_mg = Column(Float, nullable=True)
    data_source = Column(Enum(NutritionDataSource), nullable=True)
    is_ai_estimated = Column(Boolean, default=False)
    confidence_score = Column(Float, nullable=True)
    user_confirmed = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)

    meal_log = relationship("MealLog", back_populates="items")
    food = relationship("Food")
    custom_food = relationship("CustomFood")
    recipe = relationship("Recipe")


# ──────────────────────────────────────────────
# AI Scanning
# ──────────────────────────────────────────────

class FoodImage(Base):
    __tablename__ = "food_images"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    storage_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    width_px = Column(Integer, nullable=True)
    height_px = Column(Integer, nullable=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user = relationship("User")


class AIScanJob(Base):
    __tablename__ = "ai_scan_jobs"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    image_id = Column(CHAR(36), ForeignKey("food_images.id"), nullable=True)
    scan_type = Column(String(50))  # photo, barcode, ocr, voice, text
    status = Column(Enum(ScanStatus), default=ScanStatus.pending)
    provider = Column(String(50), nullable=True)
    input_text = Column(Text, nullable=True)
    raw_response = Column(MEDIUMTEXT, nullable=True)
    error_message = Column(Text, nullable=True)
    cost_units = Column(Float, nullable=True)  # API cost tracking
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_now)
    completed_at = Column(DateTime, nullable=True)

    image = relationship("FoodImage")
    predictions = relationship("AIPrediction", back_populates="scan_job", cascade="all, delete-orphan")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    scan_job_id = Column(CHAR(36), ForeignKey("ai_scan_jobs.id", ondelete="CASCADE"))
    food_id = Column(CHAR(36), ForeignKey("foods.id"), nullable=True)
    predicted_name = Column(String(255), nullable=False)
    alternative_names = Column(JSON, nullable=True)
    estimated_quantity_g = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    portion_method = Column(String(100), nullable=True)
    visible_ingredients = Column(JSON, nullable=True)
    unknown_ingredients = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    user_accepted = Column(Boolean, nullable=True)
    corrected_food_id = Column(CHAR(36), ForeignKey("foods.id"), nullable=True)
    corrected_quantity_g = Column(Float, nullable=True)

    scan_job = relationship("AIScanJob", back_populates="predictions")
    food = relationship("Food", foreign_keys=[food_id])
    corrected_food = relationship("Food", foreign_keys=[corrected_food_id])


class FoodCorrection(Base):
    __tablename__ = "food_corrections"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    prediction_id = Column(CHAR(36), ForeignKey("ai_predictions.id"), nullable=True)
    correction_type = Column(String(50))  # wrong_food, wrong_portion, missing_ingredient, etc.
    original_value = Column(JSON, nullable=True)
    corrected_value = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="food_corrections")


# ──────────────────────────────────────────────
# Saved Meals & Templates
# ──────────────────────────────────────────────

class SavedMeal(Base):
    __tablename__ = "saved_meals"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    meal_type = Column(Enum(MealType), nullable=True)
    items_snapshot = Column(JSON, nullable=False)
    total_calories = Column(Float, nullable=True)
    use_count = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="saved_meals")


# ──────────────────────────────────────────────
# Water / Hydration
# ──────────────────────────────────────────────

class WaterEntry(Base):
    __tablename__ = "water_entries"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"))
    amount_ml = Column(Float, nullable=False)
    logged_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="water_entries")
    __table_args__ = (Index("ix_water_user_date", "user_id", "logged_at"),)


# ──────────────────────────────────────────────
# Subscriptions & Billing
# ──────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan_id = Column(String(50), default="free")  # free, premium_monthly, premium_annual, family, professional
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.free)
    platform = Column(String(20), nullable=True)  # ios, android, web, stripe
    external_subscription_id = Column(String(255), nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    ai_scans_used_today = Column(Integer, default=0)
    ai_scans_reset_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="subscription")
    payments = relationship("Payment", back_populates="subscription")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    subscription_id = Column(CHAR(36), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(50))  # succeeded, failed, refunded
    provider = Column(String(50))
    external_payment_id = Column(String(255), nullable=True, unique=True)  # one row per provider payment
    created_at = Column(DateTime, default=_now)

    subscription = relationship("Subscription", back_populates="payments")


# ──────────────────────────────────────────────
# Support
# ──────────────────────────────────────────────

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(255))
    body = Column(Text)
    category = Column(String(50))  # billing, scan, bug, account, other
    status = Column(Enum(TicketStatus), default=TicketStatus.open)
    priority = Column(String(20), default="normal")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="support_tickets")


# ──────────────────────────────────────────────
# Community & Audit
# ──────────────────────────────────────────────

class CommunitySubmission(Base):
    __tablename__ = "community_submissions"

    id = Column(CHAR(36), primary_key=True, default=_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submission_type = Column(String(50))  # missing_food, barcode_correction, local_name, recipe
    data = Column(JSON, nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    moderator_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="community_submissions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(36), nullable=True)
    meta_data = Column("metadata", JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (Index("ix_audit_user_action", "user_id", "action"),)

class PersonalizationProfile(Base):
    __tablename__ = 'personalization_profiles'
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    preferences = Column(JSON, nullable=False)
    step = Column(Integer, nullable=False, default=1)
    revision = Column(Integer, nullable=False, default=1)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

class WellnessMeasurement(Base):
    __tablename__ = 'wellness_measurements'
    id = Column(CHAR(36), primary_key=True, default=lambda:str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(12), nullable=False)
    canonical_value = Column(Float, nullable=False)
    recorded_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    __table_args__ = (Index('ix_measurement_user_kind_time','user_id','kind','recorded_at'),)

class ActivityPlan(Base):
    __tablename__ = 'activity_plans'
    id = Column(CHAR(36), primary_key=True, default=lambda:str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    week_start = Column(String(10), nullable=False)
    status = Column(String(12), nullable=False, default='active')
    snapshot = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)

class PlanActivity(Base):
    __tablename__ = 'plan_activities'
    id = Column(CHAR(36), primary_key=True, default=lambda:str(uuid.uuid4()))
    plan_id = Column(CHAR(36), ForeignKey('activity_plans.id', ondelete='CASCADE'), nullable=False, index=True)
    template_id = Column(String(40), nullable=False)
    scheduled_day = Column(String(10), nullable=False)
    minutes = Column(Integer, nullable=False)
    status = Column(String(12), nullable=False, default='pending')
    feedback = Column(String(20), nullable=True)
    completed_at = Column(DateTime, nullable=True)

class RecommendationHistory(Base):
    __tablename__ = 'recommendation_history'
    id = Column(CHAR(36), primary_key=True, default=lambda:str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    plan_id = Column(CHAR(36), ForeignKey('activity_plans.id', ondelete='CASCADE'), nullable=False)
    explanation = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)

class ReminderDelivery(Base):
    __tablename__ = 'reminder_deliveries'
    id = Column(CHAR(36), primary_key=True, default=lambda:str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    category = Column(String(20), nullable=False)
    local_day = Column(String(10), nullable=False)
    status = Column(String(12), nullable=False, default='open')
    snoozed_until = Column(DateTime, nullable=True)
    __table_args__ = (UniqueConstraint('user_id','category','local_day',name='uq_reminder_category_day'),)

class PushSubscription(Base):
    """One browser or installed app that agreed to receive push. Endpoint URLs can be long, so uniqueness is on a hash."""
    __tablename__ = 'push_subscriptions'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    endpoint_hash = Column(CHAR(64), nullable=False, unique=True)
    p256dh = Column(String(200), nullable=False)
    auth = Column(String(100), nullable=False)
    user_agent = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    last_success_at = Column(DateTime, nullable=True)


class NotificationSettings(Base):
    """Push preferences. Time zone and quiet hours come from the person's existing preferences (one source of truth)."""
    __tablename__ = 'notification_settings'
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=False)  # global switch: off sends nothing
    types = Column(JSON, nullable=False)  # {type: {"enabled": bool, "time": "HH:MM"}}
    max_per_day = Column(Integer, nullable=False, default=2)
    snooze_until = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class ScheduledNotification(Base):
    """Job table for the push scheduler. idempotency_key (user:type:local day:slot) makes planning repeatable, and
    workers claim due rows with SELECT ... FOR UPDATE SKIP LOCKED so two workers never send the same one."""
    __tablename__ = 'scheduled_notifications'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    type = Column(String(20), nullable=False)
    local_day = Column(String(10), nullable=False)
    scheduled_for_utc = Column(DateTime, nullable=False)
    idempotency_key = Column(String(120), nullable=False, unique=True)
    status = Column(String(12), nullable=False, default='pending')  # pending, sending, sent, failed, skipped
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime, nullable=True)
    last_error = Column(String(200), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    __table_args__ = (Index('ix_scheduled_notifications_due', 'status', 'scheduled_for_utc'),)


class NotificationEvent(Base):
    """Guardrail metrics (opt-in, opt-out, sent, failed, opened, expired). No user id: counts only."""
    __tablename__ = 'notification_events'
    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)


class BillingEvent(Base):
    """Each verified Razorpay webhook, stored once by its event id so retries and duplicates are ignored.
    Holds no card or payment details."""
    __tablename__ = 'billing_events'
    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_event_id = Column(String(100), nullable=False, unique=True)
    event = Column(String(60), nullable=False)
    received_at = Column(DateTime, nullable=False, default=utcnow)


class InviteCode(Base):
    """Closed-beta invite. Only the SHA-256 of the code is stored; the code itself is shown once when created."""
    __tablename__ = 'invite_codes'
    code_hash = Column(CHAR(64), primary_key=True)
    label = Column(String(80), nullable=False)
    max_uses = Column(Integer, nullable=False, default=1)
    uses = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=True)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


# ── Social feed (Phase 7, flag social_feed) ─────────────────────────────────

class SocialProfile(Base):
    """Public face of an account in the feed. Created when someone picks a handle; nothing is public before that."""
    __tablename__ = 'social_profiles'
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    handle = Column(String(30), nullable=False, unique=True)
    display_name = Column(String(60), nullable=False)
    bio = Column(String(160), nullable=False, default='')
    character_id = Column(String(20), nullable=False, default='pip')
    private = Column(Boolean, nullable=False, default=False)  # followers must be approved
    posting_disabled = Column(Boolean, nullable=False, default=False)  # set by a moderator
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Follow(Base):
    __tablename__ = 'follows'
    follower_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    followee_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    status = Column(String(10), nullable=False, default='active')  # active, pending (private accounts)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class SocialBlock(Base):
    """kind 'block' hides both people from each other and removes follows; 'mute' only hides from the muter."""
    __tablename__ = 'social_blocks'
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    target_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    kind = Column(String(5), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Post(Base):
    __tablename__ = 'posts'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = Column(String(500), nullable=False, default='')
    milestone = Column(JSON, nullable=True)  # server-made snapshot of an achievement, workout or level
    visibility = Column(String(10), nullable=False, default='public')  # public, followers
    community_id = Column(CHAR(36), ForeignKey('communities.id', ondelete='CASCADE'), nullable=True, index=True)  # set: shown only in that community
    activity_id = Column(CHAR(36), ForeignKey('activities.id', ondelete='CASCADE'), nullable=True, unique=True)  # a shared GPS activity's card
    hidden = Column(Boolean, nullable=False, default=False)  # by reports or a moderator
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)


class PostReaction(Base):
    __tablename__ = 'post_reactions'
    post_id = Column(CHAR(36), ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    kind = Column(String(10), nullable=False)  # like, cheer, clap, hug
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Comment(Base):
    __tablename__ = 'comments'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(CHAR(36), ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True)
    author_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = Column(String(300), nullable=False)
    hidden = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class ContentReport(Base):
    __tablename__ = 'content_reports'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reporter_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    target_type = Column(String(10), nullable=False)  # post, comment, profile
    target_id = Column(CHAR(36), nullable=False, index=True)
    reason = Column(String(20), nullable=False)
    note = Column(String(300), nullable=False, default='')
    status = Column(String(10), nullable=False, default='open')  # open, actioned, dismissed
    created_at = Column(DateTime, nullable=False, default=utcnow)
    resolved_at = Column(DateTime, nullable=True)
    __table_args__ = (UniqueConstraint('reporter_id', 'target_type', 'target_id', name='uq_report_once'),)


class Community(Base):
    """A group with its own feed (Phase 8, flag communities). Private communities need approval to join."""
    __tablename__ = 'communities'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(40), nullable=False, unique=True)
    name = Column(String(80), nullable=False)
    description = Column(String(500), nullable=False, default='')
    category = Column(String(20), nullable=False, default='other')
    visibility = Column(String(10), nullable=False, default='public')  # public, private
    rules = Column(Text, nullable=False)
    owner_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class CommunityMember(Base):
    __tablename__ = 'community_members'
    community_id = Column(CHAR(36), ForeignKey('communities.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    role = Column(String(10), nullable=False, default='member')  # owner, moderator, member
    status = Column(String(10), nullable=False, default='active')  # active, pending, banned
    joined_at = Column(DateTime, nullable=False, default=utcnow)


class Event(Base):
    """An in-person event (Phase 9, flag verified_events). Attendance is verified by a rotating QR code shown by the
    organizer, or by the organizer checking someone in. checkin_key never leaves the server."""
    __tablename__ = 'events'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organizer_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    community_id = Column(CHAR(36), ForeignKey('communities.id', ondelete='CASCADE'), nullable=True, index=True)
    title = Column(String(120), nullable=False)
    description = Column(String(1000), nullable=False, default='')
    category = Column(String(20), nullable=False, default='other')
    location = Column(String(200), nullable=False)
    starts_at = Column(DateTime, nullable=False, index=True)  # UTC
    ends_at = Column(DateTime, nullable=False)
    timezone = Column(String(64), nullable=False, default='UTC')
    capacity = Column(Integer, nullable=True)  # None: no limit
    status = Column(String(10), nullable=False, default='scheduled')  # scheduled, cancelled
    checkin_key = Column(CHAR(64), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class EventRegistration(Base):
    __tablename__ = 'event_registrations'
    event_id = Column(CHAR(36), ForeignKey('events.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    status = Column(String(10), nullable=False, default='going')  # going, waitlist, cancelled
    checked_in_at = Column(DateTime, nullable=True)
    check_in_method = Column(String(10), nullable=True)  # qr, organizer
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Challenge(Base):
    """A time-boxed goal (Phase 10, flag verified_challenges). Progress is computed only from records the server
    already verifies (services/challenge_progress.py); nobody can type in a number."""
    __tablename__ = 'challenges'
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    community_id = Column(CHAR(36), ForeignKey('communities.id', ondelete='CASCADE'), nullable=True, index=True)
    title = Column(String(120), nullable=False)
    description = Column(String(1000), nullable=False, default='')
    metric = Column(String(20), nullable=False)  # active_days, workouts, camera_workouts, meal_days, events
    target = Column(Integer, nullable=False)
    starts_on = Column(String(10), nullable=False)  # local dates in `timezone`
    ends_on = Column(String(10), nullable=False)
    timezone = Column(String(64), nullable=False, default='UTC')
    status = Column(String(10), nullable=False, default='active')  # active, cancelled
    created_at = Column(DateTime, nullable=False, default=utcnow)


class ChallengeParticipant(Base):
    __tablename__ = 'challenge_participants'
    challenge_id = Column(CHAR(36), ForeignKey('challenges.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True)
    joined_at = Column(DateTime, nullable=False, default=utcnow)
    left_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    flagged = Column(Boolean, nullable=False, default=False)  # anti-fraud review signal, never shown publicly


class SearchSynonym(Base):
    """Spelling variants mapped to one search term (idly -> idli, thayir -> curd). Editable data, not code."""
    __tablename__ = "search_synonyms"
    term = Column(String(60), primary_key=True)
    canonical = Column(String(60), nullable=False)


class FoodAlias(Base):
    __tablename__='food_aliases'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    food_id=Column(CHAR(36),ForeignKey('foods.id',ondelete='CASCADE'),nullable=False,index=True)
    alias=Column(String(120),nullable=False,index=True)
    __table_args__=(UniqueConstraint('food_id','alias',name='uq_food_alias'),)

class FoodFavorite(Base):
    __tablename__='food_favorites'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    food_key=Column(String(120),nullable=False)
    snapshot=Column(JSON,nullable=False)
    created_at=Column(DateTime,default=_now,nullable=False)
    __table_args__=(UniqueConstraint('user_id','food_key',name='uq_food_favorite_owner'),)

class FoodSearchHistory(Base):
    __tablename__='food_search_history'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    query=Column(String(100),nullable=False)
    updated_at=Column(DateTime,default=_now,onupdate=_now,nullable=False)
    __table_args__=(UniqueConstraint('user_id','query',name='uq_food_search_owner'),)

class WorkoutBlueprint(Base):
    __tablename__='workout_blueprints'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    name=Column(String(120),nullable=False)
    exercises=Column(JSON,nullable=False)
    created_at=Column(DateTime,default=_now,nullable=False)

class WorkoutSession(Base):
    __tablename__='workout_sessions'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    plan_activity_id=Column(CHAR(36),ForeignKey('plan_activities.id',ondelete='SET NULL'),nullable=True,unique=True)
    name=Column(String(120),nullable=False)
    status=Column(String(16),nullable=False,default='active')
    details=Column(JSON,nullable=False)
    revision=Column(Integer,nullable=False,default=1)
    active_seconds=Column(Integer,nullable=False,default=0)
    recorded_minutes=Column(Float,nullable=False,default=0)
    started_at=Column(DateTime,nullable=False,default=_now)
    running_since=Column(DateTime,nullable=True,default=_now)
    completed_at=Column(DateTime,nullable=True)
    is_deleted=Column(Boolean,nullable=False,default=False)
    __table_args__=(Index('ix_workout_owner_started','user_id','started_at'),)


class Activity(Base):
    """A GPS walk, run, hike or ride. Every number is computed on the server from the raw fixes (services/activity_stats.py);
    the stored route is the simplified, smoothed path. Private unless the owner shares it, and shared routes hide their ends."""
    __tablename__='activities'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    session_id=Column(CHAR(36),ForeignKey('workout_sessions.id',ondelete='SET NULL'),nullable=True,unique=True)
    sport=Column(String(12),nullable=False)
    name=Column(String(120),nullable=False)
    notes=Column(Text,nullable=True)
    visibility=Column(String(12),nullable=False,default='private')  # private, followers, everyone
    started_at=Column(DateTime,nullable=False)
    distance_m=Column(Float,nullable=False,default=0)
    moving_s=Column(Float,nullable=False,default=0)
    elapsed_s=Column(Float,nullable=False,default=0)
    elevation_gain_m=Column(Float,nullable=False,default=0)
    stats=Column(JSON,nullable=False)   # splits, best efforts, speeds, fix counts
    route=Column(JSON,nullable=False)   # [[lat, lon, seconds, altitude|null, distance_m], ...]
    created_at=Column(DateTime,nullable=False,default=_now)
    is_deleted=Column(Boolean,nullable=False,default=False)
    __table_args__=(Index('ix_activity_owner_started','user_id','started_at'),)


class PrivacyZone(Base):
    """A circle (home, work) that is cut out of every route other people see."""
    __tablename__='privacy_zones'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    label=Column(String(40),nullable=False)
    lat=Column(Float,nullable=False)
    lon=Column(Float,nullable=False)
    radius_m=Column(Integer,nullable=False,default=300)
    created_at=Column(DateTime,nullable=False,default=_now)


class LabReport(Base):
    """A blood report the person confirmed. Only the values are kept: the uploaded file is read and discarded."""
    __tablename__='lab_reports'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    report_date=Column(String(10),nullable=False)  # YYYY-MM-DD, the date the sample was taken
    lab_name=Column(String(80),nullable=True)
    source=Column(String(12),nullable=False)       # pdf, photo, manual
    created_at=Column(DateTime,nullable=False,default=_now)


class LabResult(Base):
    __tablename__='lab_results'
    id=Column(CHAR(36),primary_key=True,default=_uuid)
    report_id=Column(CHAR(36),ForeignKey('lab_reports.id',ondelete='CASCADE'),nullable=False,index=True)
    user_id=Column(CHAR(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    code=Column(String(24),nullable=False)
    value=Column(Float,nullable=False)
    ref_low=Column(Float,nullable=True)
    ref_high=Column(Float,nullable=True)
