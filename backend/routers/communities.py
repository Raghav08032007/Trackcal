"""Communities (Phase 8, flag `communities`; needs the feed's `social_feed` too, for handles and safety tools).

Anyone with a feed profile can create up to 5 communities. Public communities can be read by any signed-in member
and joined at once; private ones need a moderator's approval and their posts are visible only to members.
Community posts appear only inside their community (never in Following, Discover or profiles).
Roles: owner (one), moderators, members. Moderators approve, remove and ban members and hide reported posts and
comments in their community; site admins can do the same everywhere. Reactions and comments reuse the feed's
endpoints, whose visibility rule (`social.can_view`) knows about communities."""
import re
from datetime import timedelta
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers import social
from routers.auth import get_current_active_user
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from timeutil import utcnow
from services.i18n import tr
from services import screening

CATEGORIES = ('running', 'walking', 'yoga', 'strength', 'cycling', 'sports', 'cooking', 'nutrition', 'mindfulness', 'college', 'other')
MAX_OWNED = 5
DEFAULT_RULES = 'Be kind. No harassment, hate, body shaming or pro-eating-disorder content. No medical advice; share experiences, not prescriptions.'


def require_flags(db):
    if not (is_enabled(db, 'communities') and is_enabled(db, 'social_feed')): raise HTTPException(404, 'Communities are not available yet.')


def by_slug(db, slug, lock=False):
    query = db.query(models.Community).filter_by(slug=(slug or '').lower())
    row = (query.with_for_update() if lock else query).first()
    if not row: raise HTTPException(404, 'Community not found.')
    return row


def membership(db, community, user_id):
    return db.get(models.CommunityMember, (community.id, str(user_id)))


def is_moderator(db, community, user):
    if user.role == models.UserRole.admin: return True
    m = membership(db, community, user.id)
    return bool(m and m.status == 'active' and m.role in ('owner', 'moderator'))


def require_moderator(db, community, user):
    if not is_moderator(db, community, user): raise HTTPException(403, 'Community moderators only.')


def can_read(db, community, user):
    m = membership(db, community, user.id)
    if m and m.status == 'banned': return False
    return (community.visibility == 'public' and not community.archived) or bool(m and m.status == 'active') or user.role == models.UserRole.admin


def view(db, community, user):
    m = membership(db, community, user.id)
    members = db.query(func.count()).select_from(models.CommunityMember).filter_by(community_id=community.id, status='active').scalar()
    out = {'slug': community.slug, 'name': community.name, 'description': community.description, 'category': community.category,
           'visibility': community.visibility, 'rules': community.rules, 'archived': community.archived, 'members': members,
           'membership': {'role': m.role, 'status': m.status} if m else None, 'can_moderate': is_moderator(db, community, user)}
    if out['can_moderate']:
        out['pending'] = db.query(func.count()).select_from(models.CommunityMember).filter_by(community_id=community.id, status='pending').scalar()
    return out


class CommunityInput(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    slug: str = Field(min_length=3, max_length=40)
    description: str = Field(default='', max_length=500)
    category: Literal[CATEGORIES] = 'other'
    visibility: Literal['public', 'private'] = 'public'
    rules: str = Field(default=DEFAULT_RULES, min_length=10, max_length=2000)

    @field_validator('slug')
    @classmethod
    def valid_slug(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])', value) or '--' in value or value in social.RESERVED:
            raise ValueError('Use 3–40 lowercase letters, numbers and single hyphens for the address.')
        return value


def listing(q: str = Query('', max_length=60), category: str = Query('', max_length=20), mine: bool = False, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    joined = db.query(models.CommunityMember.community_id).filter(models.CommunityMember.user_id == user.id, models.CommunityMember.status.in_(('active', 'pending')))
    query = db.query(models.Community).filter(models.Community.archived.is_(False))
    query = query.filter(models.Community.id.in_(joined)) if mine else query.filter(or_(models.Community.visibility == 'public', models.Community.id.in_(joined)))
    if q.strip(): query = query.filter(or_(models.Community.name.like(f'%{q.strip()}%'), models.Community.description.like(f'%{q.strip()}%')))
    if category: query = query.filter(models.Community.category == category)
    rows = query.order_by(models.Community.created_at.desc()).limit(50).all()
    return {'communities': [view(db, c, user) for c in rows], 'categories': list(CATEGORIES)}


def create(data: CommunityInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user)
    db.query(models.User).filter_by(id=user.id).with_for_update().one()
    if db.query(func.count(models.Community.id)).filter_by(owner_id=user.id, archived=False).scalar() >= MAX_OWNED:
        raise HTTPException(409, tr('You can run up to {n} communities. Archive one to start another.', n=MAX_OWNED))
    consume(db, 'community-create', str(user.id), 10, 86400)  # after the clear limit above, so its message wins
    if db.query(models.Community).filter_by(slug=data.slug).first(): raise HTTPException(409, 'That address is taken.')
    screening.refuse_if_flagged(data.slug.replace('-', ' '), data.name, data.description, data.rules)
    community = models.Community(slug=data.slug, name=data.name.strip(), description=data.description.strip(), category=data.category, visibility=data.visibility, rules=data.rules.strip(), owner_id=user.id)
    db.add(community); db.flush()
    db.add(models.CommunityMember(community_id=community.id, user_id=user.id, role='owner', status='active'))
    db.commit()
    return {'community': view(db, community, user)}


def detail(slug: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug)
    m = membership(db, community, user.id)
    if m and m.status == 'banned': raise HTTPException(404, 'Community not found.')
    if community.visibility == 'private' and not can_read(db, community, user):  # private: show the cover, not the posts
        return {'community': view(db, community, user), 'locked': True}
    return {'community': view(db, community, user), 'locked': False}


class EditInput(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    description: str = Field(default='', max_length=500)
    category: Literal[CATEGORIES] = 'other'
    visibility: Literal['public', 'private'] = 'public'
    rules: str = Field(min_length=10, max_length=2000)
    archived: bool = False


def edit(slug: str, data: EditInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug, lock=True); require_moderator(db, community, user)
    if data.archived != community.archived and community.owner_id != user.id and user.role != models.UserRole.admin:
        raise HTTPException(403, 'Only the owner can archive or reopen the community.')
    community.name, community.description, community.category, community.rules, community.archived = data.name.strip(), data.description.strip(), data.category, data.rules.strip(), data.archived
    if community.visibility == 'private' and data.visibility == 'public':  # opening up lets everyone who asked in
        db.query(models.CommunityMember).filter_by(community_id=community.id, status='pending').update({'status': 'active'})
    community.visibility = data.visibility
    db.commit()
    return {'community': view(db, community, user)}


def join(slug: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user); consume(db, 'community-join', str(user.id), 60, 3600)
    community = by_slug(db, slug)
    if community.archived: raise HTTPException(409, 'This community is archived.')
    m = membership(db, community, user.id)
    if m and m.status == 'banned': raise HTTPException(404, 'Community not found.')
    if not m:
        m = models.CommunityMember(community_id=community.id, user_id=user.id, role='member', status='pending' if community.visibility == 'private' else 'active'); db.add(m)
    db.commit()
    return {'membership': {'role': m.role, 'status': m.status}}


def leave(slug: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug)
    m = membership(db, community, user.id)
    if m and m.role == 'owner': raise HTTPException(409, 'Owners can archive their community or hand it over, but not leave it.')
    if m and m.status != 'banned': db.delete(m)  # a ban stays even if the person "leaves"
    db.commit()
    return {'membership': None}


def members(slug: str, status: Literal['active', 'pending', 'banned'] = Query('active'), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug)
    if status != 'active': require_moderator(db, community, user)
    elif not can_read(db, community, user): raise HTTPException(403, 'This community is private.')
    rows = db.query(models.CommunityMember, models.SocialProfile).join(models.SocialProfile, models.SocialProfile.user_id == models.CommunityMember.user_id).filter(
        models.CommunityMember.community_id == community.id, models.CommunityMember.status == status).order_by(models.CommunityMember.joined_at).limit(500).all()
    hidden = social.blocked_ids(db, user.id)
    return {'members': [{'handle': p.handle, 'display_name': p.display_name, 'character_id': p.character_id, 'role': m.role} for m, p in rows if m.user_id not in hidden]}


class MemberAction(BaseModel):
    action: Literal['approve', 'remove', 'ban', 'unban', 'make_moderator', 'make_member', 'make_owner']


def manage(slug: str, handle: str, data: MemberAction, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug, lock=True); require_moderator(db, community, user)
    target = social.by_handle(db, handle)
    m = membership(db, community, target.user_id)
    owner = community.owner_id == user.id or user.role == models.UserRole.admin
    if data.action in ('make_moderator', 'make_member', 'make_owner') and not owner: raise HTTPException(403, 'Only the owner changes roles.')
    if m and m.role == 'owner' and data.action != 'make_owner': raise HTTPException(409, "The owner's membership can't be changed.")
    if data.action == 'approve':
        if not m or m.status != 'pending': raise HTTPException(404, 'No request from this person.')
        m.status = 'active'
    elif data.action == 'remove':
        if m: db.delete(m)
    elif data.action == 'ban':
        if not m: m = models.CommunityMember(community_id=community.id, user_id=target.user_id); db.add(m)
        m.status, m.role = 'banned', 'member'
    elif data.action == 'unban':
        if m and m.status == 'banned': db.delete(m)
    elif data.action in ('make_moderator', 'make_member'):
        if not m or m.status != 'active': raise HTTPException(404, 'Not an active member.')
        m.role = 'moderator' if data.action == 'make_moderator' else 'member'
    else:  # hand the community over
        if not m or m.status != 'active': raise HTTPException(404, 'Not an active member.')
        current = membership(db, community, community.owner_id)
        if current: current.role = 'moderator'
        m.role, community.owner_id = 'owner', target.user_id
    db.commit()
    return {'status': 'saved'}


class CommunityPost(BaseModel):
    body: str = Field(default='', max_length=500)
    milestone: social.MilestoneRef | None = None


def posts(slug: str, before: str | None = None, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user)
    community = by_slug(db, slug)
    if not can_read(db, community, user): raise HTTPException(403, 'Join this community to see its posts.')
    hidden = social.blocked_ids(db, user.id)
    query = db.query(models.Post).filter(models.Post.community_id == community.id, models.Post.deleted_at.is_(None), models.Post.hidden.is_(False))
    if hidden: query = query.filter(models.Post.author_id.notin_(hidden))
    return social.page(db, query, user.id, before)


def create_post(slug: str, data: CommunityPost, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); author = social.my_profile(db, user); consume(db, 'social-post', str(user.id), 20, 3600)
    community = by_slug(db, slug)
    m = membership(db, community, user.id)
    if community.archived: raise HTTPException(409, 'This community is archived.')
    if not m or m.status != 'active': raise HTTPException(403, 'Join this community to post.')
    if author.posting_disabled: raise HTTPException(403, 'Posting is paused on this account after a moderation review.')
    if not data.body.strip() and not data.milestone: raise HTTPException(422, 'Write something or share a milestone.')
    snapshot = None
    if data.milestone:
        match = next((x for x in social.shareable(db, user) if x['type'] == data.milestone.type and x['ref'] == data.milestone.ref), None)
        if not match: raise HTTPException(422, "That milestone isn't yours to share.")
        snapshot = {'type': match['type'], 'title': match['title']}
    post = models.Post(author_id=user.id, body=data.body.strip(), milestone=snapshot, visibility='public', community_id=community.id)
    db.add(post); db.flush()
    found = screening.screen(post.body); extra = screening.hold(db, 'post', post, user.id, found) if found else {}
    db.commit()
    return {'post': social.posts_view(db, [post], user.id)[0], **extra}


def moderation(slug: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Open reports on this community's posts and comments, for its moderators."""
    require_flags(db)
    community = by_slug(db, slug); require_moderator(db, community, user)
    post_ids = db.query(models.Post.id).filter_by(community_id=community.id)
    comment_ids = db.query(models.Comment.id).join(models.Post, models.Post.id == models.Comment.post_id).filter(models.Post.community_id == community.id)
    rows = db.query(models.ContentReport).filter(models.ContentReport.status == 'open', or_((models.ContentReport.target_type == 'post') & models.ContentReport.target_id.in_(post_ids),
                                                                                           (models.ContentReport.target_type == 'comment') & models.ContentReport.target_id.in_(comment_ids))).all()
    grouped = {}
    for r in rows:
        item = grouped.setdefault((r.target_type, r.target_id), {'target_type': r.target_type, 'target_id': r.target_id, 'reasons': []})
        item['reasons'].append(r.reason)
    for (kind, ident), item in grouped.items():
        target = db.get(models.Post if kind == 'post' else models.Comment, ident)
        item['content'], item['hidden'] = (target.body, target.hidden) if target else ('(deleted)', None)
    return {'queue': list(grouped.values())}


class ModerationInput(BaseModel):
    target_type: Literal['post', 'comment']
    target_id: str = Field(min_length=36, max_length=36)
    action: Literal['hide', 'restore', 'dismiss']


def moderate(slug: str, data: ModerationInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    community = by_slug(db, slug); require_moderator(db, community, user)
    target = db.get(models.Post if data.target_type == 'post' else models.Comment, data.target_id)
    post = target if data.target_type == 'post' else (db.get(models.Post, target.post_id) if target else None)
    if not target or not post or post.community_id != community.id: raise HTTPException(404, 'Not found in this community.')  # mods act only on their own community
    if data.action == 'hide': target.hidden = True
    if data.action == 'restore': target.hidden = False
    status = 'actioned' if data.action == 'hide' else 'dismissed'
    db.query(models.ContentReport).filter_by(target_type=data.target_type, target_id=data.target_id, status='open').update({'status': status, 'resolved_at': utcnow()})
    db.commit()
    return {'status': status}


# ── Appeals (KI-40) ───────────────────────────────────────────────────────
# A ban can be appealed to TrackCal. The community's own moderators never decide an appeal, so the review is independent.
# Appeals are stored as reports (target_type 'ban', target_id = the community), so no table is needed. One open appeal
# at a time; after a decision the person can appeal again APPEAL_WAIT_DAYS later.
APPEAL_WAIT_DAYS = 30


class AppealInput(BaseModel):
    note: str = Field(min_length=10, max_length=500)


def _last_appeal(db, user_id, community_id):
    return (db.query(models.ContentReport).filter_by(reporter_id=str(user_id), target_type='ban', target_id=community_id)
            .order_by(models.ContentReport.created_at.desc()).first())


def _appeal_state(last, now):
    """(state, can_appeal, next_at): state is open, upheld or None (never appealed, or reinstated before a new ban)."""
    if not last: return None, True, None
    if last.status == 'open': return 'open', False, None
    next_at = (last.resolved_at or last.created_at) + timedelta(days=APPEAL_WAIT_DAYS)
    return ('upheld' if last.status == 'dismissed' else None), next_at <= now, (next_at.isoformat() + 'Z' if next_at > now else None)


def my_bans(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Communities that banned you, and where your appeal stands. Only you see this list."""
    require_flags(db)
    rows = (db.query(models.Community).join(models.CommunityMember, models.CommunityMember.community_id == models.Community.id)
            .filter(models.CommunityMember.user_id == str(user.id), models.CommunityMember.status == 'banned').order_by(models.Community.name).all())
    now, out = utcnow(), []
    for community in rows:
        state, can, next_at = _appeal_state(_last_appeal(db, user.id, community.id), now)
        out.append({'slug': community.slug, 'name': community.name, 'appeal': state, 'can_appeal': can, 'next_appeal_at': next_at})
    return {'bans': out}


def appeal(slug: str, data: AppealInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); consume(db, 'community-appeal', str(user.id), 5, 86400)
    community = by_slug(db, slug)
    m = membership(db, community, user.id)
    if not m or m.status != 'banned': raise HTTPException(404, 'You are not banned from this community.')
    last = _last_appeal(db, user.id, community.id)
    state, can, _ = _appeal_state(last, utcnow())
    if state == 'open': raise HTTPException(409, 'Your appeal is already with our team.')
    if not can: raise HTTPException(409, 'You can appeal again 30 days after the last decision.')
    if last:   # one row per person and community (a unique key): a new appeal reopens it with the new note
        last.status, last.note, last.created_at, last.resolved_at = 'open', data.note.strip(), utcnow(), None
    else: db.add(models.ContentReport(reporter_id=str(user.id), target_type='ban', target_id=community.id, reason='appeal', note=data.note.strip()))
    db.commit()
    return {'status': tr("Thanks. TrackCal's team will review this. The community's own moderators don't decide appeals.")}


def appeals_queue(db):
    """Open appeals for site moderators, oldest first."""
    rows = db.query(models.ContentReport).filter_by(target_type='ban', status='open').order_by(models.ContentReport.created_at).limit(100).all()
    out = []
    for r in rows:
        community = db.get(models.Community, r.target_id); person = social.profile_of(db, r.reporter_id)
        out.append({'id': r.id, 'community': community.name if community else '(deleted)', 'slug': community.slug if community else None,
                    'handle': person.handle if person else None, 'note': r.note, 'created_at': r.created_at.isoformat() + 'Z'})
    return out


def overview(db, limit=50):
    """How each community is moderated: members, moderators, bans, open reports and open appeals. Busiest first."""
    counts = {}
    for cid, status, role, n in (db.query(models.CommunityMember.community_id, models.CommunityMember.status, models.CommunityMember.role, func.count())
                                 .group_by(models.CommunityMember.community_id, models.CommunityMember.status, models.CommunityMember.role)):
        c = counts.setdefault(cid, {'members': 0, 'moderators': 0, 'banned': 0, 'open_reports': 0, 'open_appeals': 0})
        if status == 'banned': c['banned'] += n
        elif status == 'active':
            c['members'] += n
            if role in ('owner', 'moderator'): c['moderators'] += n
    open_reports = db.query(models.ContentReport).filter(models.ContentReport.status == 'open')
    for cid, n in (open_reports.filter(models.ContentReport.target_type == 'post').join(models.Post, models.Post.id == models.ContentReport.target_id)
                   .with_entities(models.Post.community_id, func.count()).filter(models.Post.community_id.isnot(None)).group_by(models.Post.community_id)):
        counts.setdefault(cid, {'members': 0, 'moderators': 0, 'banned': 0, 'open_reports': 0, 'open_appeals': 0})['open_reports'] += n
    for cid, n in (open_reports.filter(models.ContentReport.target_type == 'comment').join(models.Comment, models.Comment.id == models.ContentReport.target_id)
                   .join(models.Post, models.Post.id == models.Comment.post_id).with_entities(models.Post.community_id, func.count())
                   .filter(models.Post.community_id.isnot(None)).group_by(models.Post.community_id)):
        counts.setdefault(cid, {'members': 0, 'moderators': 0, 'banned': 0, 'open_reports': 0, 'open_appeals': 0})['open_reports'] += n
    for cid, n in open_reports.filter(models.ContentReport.target_type == 'ban').with_entities(models.ContentReport.target_id, func.count()).group_by(models.ContentReport.target_id):
        counts.setdefault(cid, {'members': 0, 'moderators': 0, 'banned': 0, 'open_reports': 0, 'open_appeals': 0})['open_appeals'] += n
    ranked = sorted(counts.items(), key=lambda kv: (-(kv[1]['open_reports'] + kv[1]['open_appeals']), -kv[1]['banned'], -kv[1]['members']))[:limit]
    names = {c.id: c for c in db.query(models.Community).filter(models.Community.id.in_([cid for cid, _ in ranked]))} if ranked else {}
    return [{'slug': names[cid].slug, 'name': names[cid].name, 'archived': names[cid].archived, **c} for cid, c in ranked if cid in names]


class AppealDecision(BaseModel):
    appeal_id: str = Field(min_length=36, max_length=36)
    action: Literal['reinstate', 'uphold']


def decide_appeal(data: AppealDecision, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Site moderators only. Reinstate lifts the ban (the person can join again); uphold keeps it."""
    require_flags(db); social.require_moderator(user)
    row = db.query(models.ContentReport).filter_by(id=data.appeal_id, target_type='ban').with_for_update().first()
    if not row or row.status != 'open': raise HTTPException(404, 'Not found.')
    if data.action == 'reinstate':
        m = db.get(models.CommunityMember, (row.target_id, row.reporter_id))
        if m and m.status == 'banned': db.delete(m)
    row.status, row.resolved_at = ('actioned' if data.action == 'reinstate' else 'dismissed'), utcnow()
    db.commit()
    return {'status': 'reinstated' if data.action == 'reinstate' else 'upheld'}
