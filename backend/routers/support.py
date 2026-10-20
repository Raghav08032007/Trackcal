"""support.py — Support ticket submission and status"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()


class TicketCreate(BaseModel):
    subject: str
    body: str
    category: str = "other"  # billing, scan, bug, account, other
    priority: str = "normal"


@router.post("", status_code=201)
def create_ticket(
    data: TicketCreate,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    ticket = models.SupportTicket(user_id=user.id, **data.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "status": ticket.status.value,
            "message": "Ticket submitted. We typically respond within 24 hours."}


@router.get("")
def list_tickets(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    tickets = db.query(models.SupportTicket).filter(models.SupportTicket.user_id == user.id).all()
    return [{"id": t.id, "subject": t.subject, "category": t.category,
             "status": t.status.value, "created_at": t.created_at.isoformat()} for t in tickets]


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(models.SupportTicket).filter(
        models.SupportTicket.id == ticket_id, models.SupportTicket.user_id == user.id
    ).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    return {"id": ticket.id, "subject": ticket.subject, "body": ticket.body,
            "category": ticket.category, "status": ticket.status.value,
            "priority": ticket.priority, "created_at": ticket.created_at.isoformat(),
            "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None}
