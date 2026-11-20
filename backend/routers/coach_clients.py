"""Trainer dashboard (flag `organizer_saas`, "organizer and trainer workspace"): a coach follows the progress of clients who chose to share it.

Consent first: a verified coach creates a one-time invite code; the client enters it and chooses what to share
(daily food totals, workouts, weight). The client can change that or stop sharing at any time, and so can the coach.
The coach sees only the chosen categories, as daily summaries: never meals, photos, notes or anything else.
Limits: 50 active clients and 20 open invites per coach, 5 coaches per client, codes valid for 7 days, and code entry
is rate-limited so codes can't be guessed."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers.auth import get_current_active_user
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from timeutil import utcnow

MAX_CLIENTS, MAX_INVITES, MAX_COACHES, INVITE_DAYS = 50, 20, 5, 7
ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'   # no 0/O, 1/I/L: easy to read out and type


class Share(BaseModel):
    diary: bool = False
    workouts: bool = False
    weight: bool = False


class JoinInput(BaseModel):
    code: str
    share: Share


def require_flag(db):
    if not is_enabled(db, 'organizer_saas'): raise HTTPException(404, 'The trainer dashboard is not available yet.')


def require_coach(user):
    if user.role not in (models.UserRole.professional, models.UserRole.admin) or not user.email_verified:
        raise HTTPException(403, 'Only verified coach accounts can follow clients.')


def digest(code):
    return hashlib.sha256(code.strip().upper().replace('-', '').replace(' ', '').encode()).hexdigest()


def display_name(db, user_id):
    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    return profile.display_name if profile and profile.display_name else 'TrackCal member'


def zone_of(db, user_id):
    from routers.personalization import prefs_for
    try: return ZoneInfo(prefs_for(db.get(models.PersonalizationProfile, user_id)).timezone or 'UTC')
    except Exception: return ZoneInfo('UTC')


# ── Coach ──────────────────────────────────────────────────────────────────────────────────────────────

def create_invite(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); require_coach(user)
    now = utcnow()
    open_invites = db.query(models.CoachClient).filter(models.CoachClient.coach_id == user.id, models.CoachClient.status == 'invited',
                                                       models.CoachClient.invite_expires_at > now).count()
    if open_invites >= MAX_INVITES: raise HTTPException(409, 'You have 20 open invite codes. Wait for some to be used or to expire.')
    code = ''.join(secrets.choice(ALPHABET) for _ in range(8))
    row = models.CoachClient(coach_id=user.id, status='invited', invite_hash=digest(code), invite_expires_at=now + timedelta(days=INVITE_DAYS), share={})
    db.add(row); db.commit()
    return {'code': f'{code[:4]}-{code[4:]}', 'expires_at': row.invite_expires_at.isoformat() + 'Z'}


def summary(db, link, days=7, now=None):
    """What the coach may see for one client over the last `days` local days, limited to what the client shares."""
    now = now or utcnow(); share = Share(**(link.share or {})); zone = zone_of(db, link.client_id)
    today = now.replace(tzinfo=timezone.utc).astimezone(zone).date(); first = today - timedelta(days=days - 1)
    start = datetime.combine(first, datetime.min.time(), zone).astimezone(timezone.utc).replace(tzinfo=None)
    local = lambda stamp: stamp.replace(tzinfo=timezone.utc).astimezone(zone).date().isoformat()
    out = {'id': link.id, 'name': display_name(db, link.client_id), 'since': link.accepted_at.isoformat() + 'Z' if link.accepted_at else None,
           'share': share.model_dump(), 'days': [(first + timedelta(days=i)).isoformat() for i in range(days)], 'last_active': None}
    seen = []
    if share.diary:
        per_day = {}
        for logged_at, kcal in db.query(models.MealLog.logged_at, models.MealLog.total_calories).filter(models.MealLog.user_id == link.client_id, models.MealLog.logged_at >= start):
            per_day[local(logged_at)] = per_day.get(local(logged_at), 0) + (kcal or 0); seen.append(logged_at)
        from routers.personalization import targets
        client = db.get(models.User, link.client_id)
        target = (targets(client, db) or {}).get('calories') if client else None
        out['diary'] = {'days_logged': len(per_day), 'average_kcal': round(sum(per_day.values()) / len(per_day)) if per_day else None,
                        'target_kcal': round(target) if target else None, 'by_day': {d: round(v) for d, v in per_day.items()}}
    if share.workouts:
        rows = (db.query(models.WorkoutSession.completed_at, models.WorkoutSession.recorded_minutes)
                .filter(models.WorkoutSession.user_id == link.client_id, models.WorkoutSession.status == 'completed',
                        models.WorkoutSession.is_deleted.is_(False), models.WorkoutSession.completed_at >= start).all())
        by_day = {}
        for done, minutes in rows: by_day[local(done)] = by_day.get(local(done), 0) + int(minutes or 0); seen.append(done)
        out['workouts'] = {'count': len(rows), 'minutes': sum(by_day.values()), 'by_day': by_day}
    if share.weight:
        weights = (db.query(models.WellnessMeasurement.recorded_at, models.WellnessMeasurement.canonical_value)
                   .filter(models.WellnessMeasurement.user_id == link.client_id, models.WellnessMeasurement.kind == 'weight')
                   .order_by(models.WellnessMeasurement.recorded_at.desc()).limit(60).all())
        latest = weights[0] if weights else None
        earlier = next((w for w in weights if w[0] <= (latest[0] - timedelta(days=days - 1))), weights[-1] if len(weights) > 1 else None) if latest else None
        out['weight'] = {'latest_kg': round(latest[1], 1) if latest else None, 'measured_on': local(latest[0]) if latest else None,
                         'change_kg': round(latest[1] - earlier[1], 1) if latest and earlier else None}
        if latest and latest[0] >= start: seen.append(latest[0])
    if seen: out['last_active'] = local(max(seen))
    return out


def clients(days: int = Query(7, ge=7, le=14), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); require_coach(user)
    links = db.query(models.CoachClient).filter_by(coach_id=user.id, status='active').order_by(models.CoachClient.accepted_at).all()
    open_invites = db.query(models.CoachClient).filter(models.CoachClient.coach_id == user.id, models.CoachClient.status == 'invited',
                                                       models.CoachClient.invite_expires_at > utcnow()).count()
    return {'clients': [summary(db, link, days) for link in links], 'open_invites': open_invites, 'max_clients': MAX_CLIENTS}


def client_detail(link_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); require_coach(user)
    link = db.query(models.CoachClient).filter_by(id=link_id, coach_id=user.id, status='active').first()
    if not link: raise HTTPException(404, 'This client is not sharing with you.')
    return {'client': summary(db, link, 14)}


# ── Client ─────────────────────────────────────────────────────────────────────────────────────────────

def join(data: JoinInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); consume(db, 'coach-join', str(user.id), 10, 3600)   # codes can't be guessed by trying many
    if not any(data.share.model_dump().values()): raise HTTPException(422, 'Choose at least one thing to share.')
    now = utcnow()
    link = db.query(models.CoachClient).filter_by(invite_hash=digest(data.code), status='invited').with_for_update().first()
    if not link or link.invite_expires_at <= now: raise HTTPException(404, 'This code is not valid or has expired. Ask your coach for a new one.')
    if link.coach_id == user.id: raise HTTPException(409, "You can't follow yourself.")
    if db.query(models.CoachClient).filter_by(coach_id=link.coach_id, client_id=user.id, status='active').first():
        raise HTTPException(409, 'You already share with this coach. Change what you share in the list below.')
    if db.query(models.CoachClient).filter_by(client_id=user.id, status='active').count() >= MAX_COACHES: raise HTTPException(409, 'You can share with up to 5 coaches. Stop sharing with one first.')
    if db.query(models.CoachClient).filter_by(coach_id=link.coach_id, status='active').count() >= MAX_CLIENTS: raise HTTPException(409, 'This coach has no room for new clients right now.')
    link.client_id, link.status, link.share, link.accepted_at, link.invite_hash = user.id, 'active', data.share.model_dump(), now, None
    db.commit()
    return {'coach': mine_view(db, link)}


def mine_view(db, link):
    return {'id': link.id, 'coach': display_name(db, link.coach_id), 'share': Share(**(link.share or {})).model_dump(),
            'since': link.accepted_at.isoformat() + 'Z' if link.accepted_at else None}


def my_coaches(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    return {'coaches': [mine_view(db, l) for l in db.query(models.CoachClient).filter_by(client_id=user.id, status='active').order_by(models.CoachClient.accepted_at)]}


def update_share(link_id: str, data: Share, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    link = db.query(models.CoachClient).filter_by(id=link_id, client_id=user.id, status='active').first()
    if not link: raise HTTPException(404, 'You are not sharing with this coach.')
    if not any(data.model_dump().values()): raise HTTPException(422, 'Choose at least one thing to share, or stop sharing.')
    link.share = data.model_dump(); db.commit()
    return {'coach': mine_view(db, link)}


def end(link_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Either side can stop. The coach loses access at once; nothing that was shown is kept."""
    require_flag(db)
    link = db.get(models.CoachClient, link_id)
    if not link or link.status != 'active' or user.id not in (link.coach_id, link.client_id): raise HTTPException(404, 'Not found.')
    link.status, link.ended_at, link.share = 'ended', utcnow(), {}
    db.commit()
    return {'status': 'ended'}
