"""subscriptions.py — Subscription plans, entitlements, billing history"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()

PLANS = {
    "free": {"name": "Free", "price_usd": 0, "ai_scans_per_day": 5, "features": ["manual_logging", "basic_history", "saved_meals"]},
    "premium_monthly": {"name": "Premium Monthly", "price_usd": 9.99, "ai_scans_per_day": None, "features": ["all_free", "unlimited_scans", "voice_logging", "advanced_insights", "recipe_builder", "regional_foods"]},
    "premium_annual": {"name": "Premium Annual", "price_usd": 59.99, "ai_scans_per_day": None, "features": ["all_premium_monthly", "priority_support"]},
    "family": {"name": "Family", "price_usd": 14.99, "ai_scans_per_day": None, "features": ["all_premium", "shared_recipes", "group_meal_planning"]},
    "professional": {"name": "Professional", "price_usd": 29.99, "ai_scans_per_day": None, "features": ["all_premium", "client_dashboard", "professional_tools"]},
}


@router.get("/plans")
def list_plans():
    """Return all available subscription plans."""
    return {"plans": PLANS, "currency": "USD", "note": "Prices are illustrative. Actual pricing may vary by region."}


@router.get("/status")
def subscription_status(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub:
        return {"plan": "free", "status": "free", "features": PLANS["free"]["features"]}
    plan_info = PLANS.get(sub.plan_id, PLANS["free"])
    return {
        "plan": sub.plan_id,
        "status": sub.status.value,
        "features": plan_info.get("features", []),
        "ai_scans_per_day": plan_info.get("ai_scans_per_day"),
        "ai_scans_used_today": sub.ai_scans_used_today,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
    }


@router.get("/history")
def billing_history(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub:
        return {"payments": []}
    payments = db.query(models.Payment).filter(models.Payment.subscription_id == sub.id).order_by(models.Payment.created_at.desc()).all()
    return {
        "payments": [{"id": p.id, "amount_usd": p.amount_cents / 100, "currency": p.currency,
                      "status": p.status, "created_at": p.created_at.isoformat()} for p in payments]
    }


class CancelRequest(BaseModel):
    reason: str = ""


@router.post("/cancel")
def cancel_subscription(req: CancelRequest, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub or sub.plan_id == "free":
        raise HTTPException(400, "No active subscription to cancel")
    sub.status = models.SubscriptionStatus.cancelled
    sub.cancelled_at = datetime.utcnow()
    db.commit()
    return {"status": "cancelled", "note": "You retain access until the end of your billing period."}
