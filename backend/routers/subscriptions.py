"""subscriptions.py — plans, entitlements, Razorpay checkout and cancellation, billing history.

With the `billing` flag off, everything behaves as before Phase 5 (free plan only, nothing can be bought).
With it on, Premium (₹99/month or ₹799/year, 7-day first trial) is offered through Razorpay; see services/billing.py."""
from flask_app.params import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Literal
from datetime import timedelta
import os
from database import get_db
import models
from routers.auth import get_current_active_user
from services import billing
from services.feature_flags import is_enabled


def daily_ai_limit():
    return int(os.getenv("DAILY_AI_LIMIT", "15")) if os.getenv("APP_ENV") == "production" else 5

PLANS = {
    "free": {"name": "Free", "price_usd": 0, "features": ["manual_logging", "basic_history", "saved_meals"]},
}
ALWAYS_FREE = ["Your blood reports, and monthly summaries of all your history", "Your data export, with everything", "Food logging, barcode lookup and the food catalog", "Camera rep counting", "Reminders and notifications", "XP, characters and achievements"]


def iso(value):
    return value.isoformat() + "Z" if value else None


def list_plans(db: Session = Depends(get_db)):
    """Return all available subscription plans."""
    if not is_enabled(db, "billing"):
        return {"plans": {"free": {**PLANS["free"], "ai_scans_per_day": daily_ai_limit()}}, "currency": "USD", "billing_enabled": False, "note": "TrackCal currently offers a free plan. Paid checkout is not connected; no unlimited AI usage is offered."}
    premium = {key: {"name": "Coach" if billing.tier(key) == "coach" else "Premium", "label": spec["label"], "amount_paise": spec["amount_paise"], "period": spec["period"]} for key, spec in billing.PLANS.items()}
    return {"plans": {"free": {**PLANS["free"], "ai_scans_per_day": billing.free_ai_limit()}, **premium}, "currency": "INR", "billing_enabled": True,
            "premium_features": billing.FEATURES, "always_free": ALWAYS_FREE, "trial_days": billing.TRIAL_DAYS,
            "note": "Cancel any time; Premium stays until the end of the period you paid for."}


def subscription_status(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not is_enabled(db, "billing"):
        if not sub:
            return {"plan": "free", "status": "free", "features": PLANS["free"]["features"], "ai_scans_per_day": daily_ai_limit(), "billing_enabled": False}
        plan_info = PLANS.get(sub.plan_id, PLANS["free"])
        return {
            "plan": sub.plan_id, "status": sub.status.value, "features": plan_info.get("features", []), "ai_scans_per_day": daily_ai_limit(),
            "billing_enabled": False, "legacy_plan_requires_review": sub.plan_id != "free", "ai_scans_used_today": sub.ai_scans_used_today,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        }
    perks = billing.entitlements(db, user)
    return {"plan": sub.plan_id if sub and perks["premium"] else "free", "status": sub.status.value if sub else "free", "billing_enabled": True, **perks,
            "ai_scans_per_day": perks["ai_daily_limit"], "trial_ends_at": iso(sub.trial_ends_at) if sub else None,
            "current_period_end": iso(sub.current_period_end) if sub else None, "cancelled_at": iso(sub.cancelled_at) if sub else None,
            "trial_available": not (sub and sub.trial_ends_at), "checkout_configured": billing.gateway() is not None}


def billing_history(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub:
        return {"payments": []}
    payments = db.query(models.Payment).filter(models.Payment.subscription_id == sub.id).order_by(models.Payment.created_at.desc()).all()
    return {
        "payments": [{"id": p.id, "amount_usd": p.amount_cents / 100, "amount": p.amount_cents / 100, "currency": p.currency,
                      "status": p.status, "created_at": p.created_at.isoformat()} for p in payments]
    }


class CancelRequest(BaseModel):
    reason: str = ""


def cancel_subscription(req: CancelRequest, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub or sub.plan_id == "free":
        raise HTTPException(400, "No active subscription to cancel")
    if sub.plan_id not in billing.PLANS or not sub.external_subscription_id or not is_enabled(db, "billing"):  # legacy plans refuse first
        raise HTTPException(503, "Billing is not connected. No provider subscription has been cancelled or changed; contact the operator to review this legacy record.")
    sub = billing.subscription(db, user.id, lock=True)
    if sub.status.value in ("cancelled", "expired"): return subscription_status(user, db)
    gateway = billing.gateway()
    if gateway is None: raise HTTPException(503, "Payments aren't configured yet. Nothing was changed.")
    try: gateway.cancel(sub.external_subscription_id)
    except Exception: raise HTTPException(502, "Razorpay didn't confirm the cancellation. Nothing was changed; please try again.")
    sub.status, sub.cancelled_at = models.SubscriptionStatus.cancelled, billing.utcnow()
    db.commit()
    return subscription_status(user, db)


class CheckoutRequest(BaseModel):
    plan: Literal["premium_monthly", "premium_annual", "coach_monthly", "coach_annual"]


def checkout(data: CheckoutRequest, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not is_enabled(db, "billing"): raise HTTPException(404, "Premium isn't available yet.")
    if not user.email_verified and os.getenv("APP_ENV") == "production": raise HTTPException(403, "Verify your email before subscribing.")
    coach_plan = billing.tier(data.plan) == "coach"
    if coach_plan and user.role not in (models.UserRole.professional, models.UserRole.admin): raise HTTPException(403, "The Coach plan is for verified coach accounts.")
    from services.abuse_limits import consume
    consume(db, "billing-checkout", str(user.id), 10, 3600)
    gateway = billing.gateway()
    plan_id = os.getenv(billing.PLANS[data.plan]["env"], "")
    if gateway is None or not plan_id: raise HTTPException(503, "Payments aren't configured yet. You haven't been charged.")
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    sub = billing.subscription(db, user.id, lock=True)
    if sub and billing.entitled(sub):
        if coach_plan and billing.tier(sub.plan_id) != "coach": raise HTTPException(409, "Cancel Premium first: the Coach plan includes everything in Premium. You keep Premium until the end of the period you paid for.")
        raise HTTPException(409, "You already have Premium.")
    trial = not (sub and sub.trial_ends_at)  # one free trial per person
    now = billing.utcnow()
    try:
        created = gateway.create_subscription(plan_id, billing.PLANS[data.plan]["total_count"], now + timedelta(days=billing.TRIAL_DAYS) if trial else None, {"user_id": str(user.id), "plan": data.plan})
    except Exception:
        raise HTTPException(502, "Razorpay is unavailable right now. You haven't been charged; please try again.")
    if not sub: sub = models.Subscription(user_id=user.id); db.add(sub)
    sub.plan_id, sub.platform, sub.external_subscription_id = data.plan, "razorpay", created["id"]
    sub.status, sub.cancelled_at, sub.current_period_start, sub.current_period_end = models.SubscriptionStatus.free, None, None, None
    sub.trial_ends_at = sub.trial_ends_at if not trial else None  # set when the mandate is verified
    db.commit()
    return {"subscription_id": created["id"], "key_id": gateway.key_id, "trial_days": billing.TRIAL_DAYS if trial else 0,
            "name": "TrackCal Coach" if coach_plan else "TrackCal Premium", "description": billing.PLANS[data.plan]["label"] + (f" after a {billing.TRIAL_DAYS}-day free trial" if trial else ""),
            "prefill": {"email": user.email}}


class VerifyRequest(BaseModel):
    razorpay_payment_id: str = Field(min_length=6, max_length=64)
    razorpay_subscription_id: str = Field(min_length=6, max_length=64)
    razorpay_signature: str = Field(min_length=32, max_length=128)


def verify(data: VerifyRequest, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Called by the browser after Razorpay Checkout. Webhooks remain the source of truth for later changes."""
    if not is_enabled(db, "billing"): raise HTTPException(404, "Premium isn't available yet.")
    gateway = billing.gateway()
    if gateway is None: raise HTTPException(503, "Payments aren't configured yet.")
    sub = billing.subscription(db, user.id, lock=True)
    if not sub or sub.external_subscription_id != data.razorpay_subscription_id: raise HTTPException(404, "Subscription not found.")
    if not gateway.verify_checkout(data.razorpay_payment_id, data.razorpay_subscription_id, data.razorpay_signature):
        raise HTTPException(400, "The payment confirmation didn't check out. You haven't been given Premium; contact support if you were charged.")
    now = billing.utcnow()
    if sub.status.value == "free":  # first confirmation only; a repeat changes nothing
        trial = sub.trial_ends_at is None and not db.query(models.Payment).filter_by(subscription_id=sub.id).first()
        if trial: sub.status, sub.trial_ends_at = models.SubscriptionStatus.trialing, now + timedelta(days=billing.TRIAL_DAYS)
        else: sub.status, sub.current_period_start, sub.current_period_end = models.SubscriptionStatus.active, now, now + timedelta(days=billing.PLANS[sub.plan_id]["days"])
    db.commit()
    return subscription_status(user, db)
