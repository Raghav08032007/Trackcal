"""Private, transactional coach reservations. No nutrition records or email invitations are shared."""
from datetime import datetime, timedelta, timezone
import os
from flask_app.params import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_active_user
import models
from timeutil import utcnow

def request_limit(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if os.getenv("APP_ENV")=="production":
        from services.abuse_limits import consume
        consume(db,"coaching",str(user.id),120,3600)


def coach_only(user):
    if user.role not in (models.UserRole.professional, models.UserRole.admin) or not user.email_verified:
        raise HTTPException(403, "Availability publishing requires an operator-approved coach account and verified email.")

def utc(value):
    if value.tzinfo is None: raise HTTPException(422, "Include a timezone offset in appointment times.")
    return value.astimezone(timezone.utc).replace(tzinfo=None)

def name(db, identifier):
    profile = db.query(models.UserProfile).filter_by(user_id=identifier).first()
    return profile.display_name if profile and profile.display_name else "TrackCal member"

def priority_until(slot,db):
    """With billing on, a new slot is bookable by Premium members first, by everyone PRIORITY_HOURS later."""
    from services.billing import PRIORITY_HOURS
    from services.feature_flags import is_enabled
    if not slot.published_at or not is_enabled(db,"billing"): return None
    until=slot.published_at+timedelta(hours=PRIORITY_HOURS)
    return until if until>utcnow() else None

def slot_data(slot,db=None):
    until=priority_until(slot,db) if db is not None else None
    return {"id":slot.id,"coach_id":slot.coach_id,"starts_at":slot.starts_at.isoformat()+"Z","ends_at":slot.ends_at.isoformat()+"Z","premium_until":until.isoformat()+"Z" if until else None}

class NewSlot(BaseModel):
    starts_at: datetime
    minutes: int = Field(ge=15, le=120)

class Reserve(BaseModel):
    slot_id: str = Field(min_length=36, max_length=36)

def coaches(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    rows=db.query(models.User).filter(models.User.role.in_([models.UserRole.professional,models.UserRole.admin]),models.User.email_verified.is_(True),models.User.is_active.is_(True),models.User.deleted_at.is_(None)).limit(100).all()
    return {"coaches":[{"id":row.id,"name":name(db,row.id)} for row in rows],"can_publish":user.role in (models.UserRole.professional,models.UserRole.admin) and user.email_verified}

def publish(data:NewSlot,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    coach_only(user)
    start=utc(data.starts_at);end=start+timedelta(minutes=data.minutes)
    if not utcnow()+timedelta(minutes=5)<start<utcnow()+timedelta(days=180): raise HTTPException(422,"Publish slots between five minutes and 180 days in the future.")
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    overlap=db.query(models.CoachSlot).filter(models.CoachSlot.coach_id==user.id,models.CoachSlot.active.is_(True),models.CoachSlot.starts_at<end,models.CoachSlot.ends_at>start).with_for_update().first()
    if overlap: raise HTTPException(409,"This availability overlaps an existing slot.")
    slot=models.CoachSlot(coach_id=user.id,starts_at=start,ends_at=end,published_at=utcnow());db.add(slot);db.commit();db.refresh(slot);return slot_data(slot,db)

def slots(coach_id:str,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    coach=db.query(models.User).filter_by(id=coach_id,is_active=True,email_verified=True).first()
    if not coach or coach.deleted_at or coach.role not in (models.UserRole.professional,models.UserRole.admin): raise HTTPException(404,"Coach not found.")
    rows=db.query(models.CoachSlot).filter(models.CoachSlot.coach_id==coach_id,models.CoachSlot.active.is_(True),models.CoachSlot.starts_at>utcnow(),models.CoachSlot.reserved_booking_id.is_(None)).order_by(models.CoachSlot.starts_at).limit(200).all()
    return {"slots":[slot_data(row,db) for row in rows]}

def unpublish(slot_id:str,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    coach_only(user)
    slot=db.query(models.CoachSlot).filter_by(id=slot_id,coach_id=user.id).with_for_update().first()
    if not slot: raise HTTPException(404,"Slot not found.")
    if slot.reserved_booking_id: raise HTTPException(409,"Cancel the appointment before removing this slot.")
    slot.active=False;db.commit();return {"status":"Availability removed"}

def validate_slot(slot,user,db,exclude=None):
    if not slot or not slot.active or slot.starts_at<=utcnow(): raise HTTPException(409,"This slot is no longer available.")
    coach=db.get(models.User,slot.coach_id)
    if not coach or not coach.is_active or coach.deleted_at or not coach.email_verified or coach.role not in (models.UserRole.professional,models.UserRole.admin): raise HTTPException(409,"Coach unavailable.")
    if coach.id==user.id: raise HTTPException(422,"Choose another coach to book an appointment.")
    if slot.reserved_booking_id and slot.reserved_booking_id!=exclude: raise HTTPException(409,"Another member has reserved this slot. Choose another time.")
    overlaps=db.query(models.CoachBooking).join(models.CoachSlot,models.CoachBooking.slot_id==models.CoachSlot.id).filter(models.CoachBooking.user_id==user.id,models.CoachBooking.status=="confirmed",models.CoachSlot.starts_at<slot.ends_at,models.CoachSlot.ends_at>slot.starts_at)
    if exclude: overlaps=overlaps.filter(models.CoachBooking.id!=exclude)
    if overlaps.with_for_update().first(): raise HTTPException(409,"This time overlaps one of your appointments.")

def reserve(data:Reserve,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if not user.email_verified: raise HTTPException(403,"Verify your email before booking a coach.")
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    slot=db.query(models.CoachSlot).filter_by(id=data.slot_id).with_for_update().first();validate_slot(slot,user,db)
    until=priority_until(slot,db)
    if until:
        from services.billing import entitlements
        if not entitlements(db,user)["priority_booking"]: raise HTTPException(403,f"Premium members can book this new slot first. It opens to everyone at {until.isoformat()}Z.")
    booking=models.CoachBooking(slot_id=slot.id,user_id=user.id);db.add(booking);db.flush();slot.reserved_booking_id=booking.id;db.commit();db.refresh(booking)
    return {**slot_data(slot),"id":booking.id,"status":booking.status,"slot_id":slot.id}

def bookings(user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    rows=db.query(models.CoachBooking,models.CoachSlot).join(models.CoachSlot,models.CoachBooking.slot_id==models.CoachSlot.id).filter((models.CoachBooking.user_id==user.id)|(models.CoachSlot.coach_id==user.id)).order_by(models.CoachSlot.starts_at.desc()).limit(200).all()
    return {"bookings":[{**slot_data(slot),"id":booking.id,"slot_id":slot.id,"status":booking.status,"coach_name":name(db,slot.coach_id),"member_name":name(db,booking.user_id) if slot.coach_id==user.id else None,"hosting":slot.coach_id==user.id} for booking,slot in rows]}

def reschedule(booking_id:str,data:Reserve,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    booking=db.query(models.CoachBooking).filter_by(id=booking_id,user_id=user.id,status="confirmed").with_for_update().first()
    if not booking: raise HTTPException(404,"Active appointment not found.")
    locked=db.query(models.CoachSlot).filter(models.CoachSlot.id.in_([booking.slot_id,data.slot_id])).order_by(models.CoachSlot.id).with_for_update().all()
    old=next((row for row in locked if row.id==booking.slot_id),None)
    if not old or old.starts_at<=utcnow(): raise HTTPException(409,"Past appointments cannot be rescheduled.")
    slot=next((row for row in locked if row.id==data.slot_id),None);validate_slot(slot,user,db,booking.id)
    old.reserved_booking_id=None;slot.reserved_booking_id=booking.id;booking.slot_id=slot.id;db.commit();return {"status":"Appointment rescheduled"}

def cancel(booking_id:str,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    booking=db.query(models.CoachBooking).filter_by(id=booking_id).with_for_update().first()
    if not booking: raise HTTPException(404,"Appointment not found.")
    slot=db.query(models.CoachSlot).filter_by(id=booking.slot_id).with_for_update().first()
    if booking.user_id!=user.id and slot.coach_id!=user.id: raise HTTPException(404,"Appointment not found.")
    if slot.starts_at<=utcnow(): raise HTTPException(409,"Past appointments cannot be cancelled.")
    booking.status="cancelled"
    if slot.reserved_booking_id==booking.id:slot.reserved_booking_id=None
    db.commit();return {"status":"Appointment cancelled"}
