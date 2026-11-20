"""The accuracy report for TrackCal's team (site admins): how far estimates were from what people kept.
See services/accuracy.py for what is measured and why."""
from flask_app.params import Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_active_user
from services import accuracy


def report(days: int = Query(90, ge=7, le=365), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    if user.role != models.UserRole.admin: raise HTTPException(403, 'Moderators only.')
    return accuracy.report(db, days)
