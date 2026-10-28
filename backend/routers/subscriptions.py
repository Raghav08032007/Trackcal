"""subscriptions.py — Subscription plans, entitlements, billing history"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()

def daily_ai_limit():
    import os
    return int(os.getenv("DAILY_AI_LIMIT", "15")) if os.getenv("APP_ENV") == "production" else 5

PLANS = {
    "free": {"name": "Free", "price_usd": 0, "features": ["manual_logging", "basic_history", "saved_meals"]},
}


@router.get("/plans")
def list_plans():
    """Return all available subscription plans."""
    return {"plans": {"free": {**PLANS["free"], "ai_scans_per_day": daily_ai_limit()}}, "currency": "USD", "billing_enabled": False, "note": "TrackCal currently offers a free plan. Paid checkout is not connected; no unlimited AI usage is offered."}


@router.get("/status")
def subscription_status(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub:
        return {"plan": "free", "status": "free", "features": PLANS["free"]["features"], "ai_scans_per_day": daily_ai_limit(), "billing_enabled": False}
    plan_info = PLANS.get(sub.plan_id, PLANS["free"])
    return {
        "plan": sub.plan_id,
        "status": sub.status.value,
        "features": plan_info.get("features", []),
        "ai_scans_per_day": daily_ai_limit(),
        "billing_enabled": False,
        "legacy_plan_requires_review": sub.plan_id != "free",
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
    raise HTTPException(503, "Billing is not connected. No provider subscription has been cancelled or changed; contact the operator to review this legacy record.")
