"""community.py — Community food submissions"""
from flask_app.params import Depends
from pydantic import BaseModel
from typing import Any, Dict
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user



class SubmissionCreate(BaseModel):
    submission_type: str  # missing_food, barcode_correction, local_name, recipe
    data: Dict[str, Any]


def submit(
    data: SubmissionCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    sub = models.CommunitySubmission(
        user_id=user.id,
        submission_type=data.submission_type,
        data=data.data,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": "pending",
            "message": "Thank you! A moderator will review your submission."}


def my_submissions(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    subs = db.query(models.CommunitySubmission).filter(models.CommunitySubmission.user_id == user.id).all()
    return [{"id": s.id, "type": s.submission_type, "status": s.status,
             "created_at": s.created_at.isoformat()} for s in subs]
