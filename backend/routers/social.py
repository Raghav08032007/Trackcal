"""Social feed (Phase 7, flag `social_feed`): public profiles, follows, posts with app milestones, reactions with
counts, comments, and safety tools for everyone (report, block, mute, private accounts, moderation).

Visibility rule (one place, `can_view`): blocked people never see each other; hidden or deleted content is visible
only to its author; a private account's posts and a 'followers' post need an active follow.
Milestones are attached by reference and snapshotted by the server, so they can't be forged and never contain
health numbers (no weights, calories or body data)."""
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers.auth import get_current_active_user
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from timeutil import utcnow

REACTIONS = ('like', 'cheer', 'clap', 'hug')
RESERVED = {'admin', 'trackcal', 'support', 'help', 'moderator', 'official', 'root', 'system', 'me', 'settings'}
CHARACTERS = ('pip', 'nova', 'milo', 'luna', 'rio', 'sage')
AUTO_HIDE_REPORTS = 3
PAGE = 20


def require_flag(db):
    if not is_enabled(db, 'social_feed'): raise HTTPException(404, 'The feed is not available yet.')


def profile_of(db, user_id):
    return db.get(models.SocialProfile, str(user_id))


def my_profile(db, user):
    row = profile_of(db, user.id)
    if not row: raise HTTPException(409, 'Choose a handle first to join the feed.')
    return row


def by_handle(db, handle):
    row = db.query(models.SocialProfile).filter_by(handle=(handle or '').lower()).first()
    if not row: raise HTTPException(404, 'Profile not found.')
    return row


def blocked_ids(db, user_id):
    """People hidden from this viewer: blocks in either direction, and people they muted."""
    rows = db.query(models.SocialBlock).filter(or_(models.SocialBlock.user_id == user_id, (models.SocialBlock.target_id == user_id) & (models.SocialBlock.kind == 'block'))).all()
    return {r.target_id if r.user_id == user_id else r.user_id for r in rows}


def blocks_between(db, a, b):
    return db.query(models.SocialBlock).filter(models.SocialBlock.kind == 'block', or_((models.SocialBlock.user_id == a) & (models.SocialBlock.target_id == b), (models.SocialBlock.user_id == b) & (models.SocialBlock.target_id == a))).first() is not None


def follows(db, follower, followee):
    row = db.get(models.Follow, (str(follower), str(followee)))
    return row.status if row else None


def community_access(db, viewer_id, community_id):
    """Can this viewer see a community's posts? Public communities: anyone not banned. Private: active members."""
    community = db.get(models.Community, community_id)
    if not community or not is_enabled(db, 'communities'): return False
    member = db.get(models.CommunityMember, (community_id, str(viewer_id)))
    if member and member.status == 'banned': return False
    return (community.visibility == 'public' and not community.archived) or bool(member and member.status == 'active')


def can_view(db, viewer_id, post, author=None):
    if post.community_id and not community_access(db, viewer_id, post.community_id): return False
    if post.author_id == viewer_id: return True
    if post.deleted_at or post.hidden or blocks_between(db, viewer_id, post.author_id): return False
    if post.community_id: return True  # the community's rules decide, not the author's account privacy
    author = author or profile_of(db, post.author_id)
    if author is None: return False
    if post.visibility == 'followers' or author.private: return follows(db, viewer_id, post.author_id) == 'active'
    return True


def profile_view(db, row, viewer_id=None):
    counts = {'followers': db.query(func.count()).select_from(models.Follow).filter_by(followee_id=row.user_id, status='active').scalar(),
              'following': db.query(func.count()).select_from(models.Follow).filter_by(follower_id=row.user_id, status='active').scalar(),
              'posts': db.query(func.count(models.Post.id)).filter(models.Post.author_id == row.user_id, models.Post.deleted_at.is_(None), models.Post.hidden.is_(False)).scalar()}
    view = {'handle': row.handle, 'display_name': row.display_name, 'bio': row.bio, 'character_id': row.character_id, 'private': row.private, 'counts': counts}
    if viewer_id and viewer_id != row.user_id:
        view['relationship'] = {'following': follows(db, viewer_id, row.user_id), 'follows_you': follows(db, row.user_id, viewer_id) == 'active',
                                'blocked': db.query(models.SocialBlock).filter_by(user_id=viewer_id, target_id=row.user_id).first() is not None}
    return view


def posts_view(db, rows, viewer_id):
    """Cards for a page of posts: author, milestone, reaction counts by kind, the viewer's reaction, comment count."""
    if not rows: return []
    ids = [p.id for p in rows]
    authors = {p.user_id: p for p in db.query(models.SocialProfile).filter(models.SocialProfile.user_id.in_({r.author_id for r in rows}))}
    reactions = {}
    for post_id, kind, count in db.query(models.PostReaction.post_id, models.PostReaction.kind, func.count()).filter(models.PostReaction.post_id.in_(ids)).group_by(models.PostReaction.post_id, models.PostReaction.kind):
        reactions.setdefault(post_id, {})[kind] = count
    mine = dict(db.query(models.PostReaction.post_id, models.PostReaction.kind).filter(models.PostReaction.post_id.in_(ids), models.PostReaction.user_id == viewer_id).all())
    comments = dict(db.query(models.Comment.post_id, func.count()).filter(models.Comment.post_id.in_(ids), models.Comment.deleted_at.is_(None), models.Comment.hidden.is_(False)).group_by(models.Comment.post_id).all())
    out = []
    for p in rows:
        a = authors.get(p.author_id)
        if not a: continue
        out.append({'id': p.id, 'community_id': p.community_id, 'author': {'handle': a.handle, 'display_name': a.display_name, 'character_id': a.character_id},
                    'body': p.body, 'milestone': p.milestone, 'visibility': p.visibility, 'created_at': p.created_at.isoformat() + 'Z',
                    'reactions': {k: reactions.get(p.id, {}).get(k, 0) for k in REACTIONS}, 'my_reaction': mine.get(p.id),
                    'comment_count': comments.get(p.id, 0), 'mine': p.author_id == viewer_id, 'hidden': p.hidden})
    return out


def cursor_filter(query, before):
    if not before: return query
    try: stamp, _, post_id = before.partition('|'); when = datetime.fromisoformat(stamp.rstrip('Z'))
    except ValueError: raise HTTPException(422, 'Invalid page cursor.')
    return query.filter(or_(models.Post.created_at < when, (models.Post.created_at == when) & (models.Post.id < post_id)))


def page(db, query, viewer_id, before, filter_visible=True):
    rows = cursor_filter(query, before).order_by(models.Post.created_at.desc(), models.Post.id.desc()).limit(PAGE * 3).all()
    visible = [p for p in rows if not filter_visible or can_view(db, viewer_id, p)][:PAGE]
    last = visible[-1] if len(visible) == PAGE else None
    return {'posts': posts_view(db, visible, viewer_id), 'next': f"{last.created_at.isoformat()}|{last.id}" if last else None}


# ── Profiles ────────────────────────────────────────────────────────────────

class ProfileInput(BaseModel):
    handle: str = Field(min_length=3, max_length=30)
    display_name: str = Field(min_length=1, max_length=60)
    bio: str = Field(default='', max_length=160)
    character_id: Literal[CHARACTERS] = 'pip'
    private: bool = False

    @field_validator('handle')
    @classmethod
    def valid_handle(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[a-z0-9_.]{3,30}', value) or value in RESERVED or value.startswith('.') or '..' in value:
            raise ValueError('Use 3–30 letters, numbers, _ or . for your handle.')
        return value


def me(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = profile_of(db, user.id)
    return {'profile': profile_view(db, row) if row else None, 'requests': db.query(func.count()).select_from(models.Follow).filter_by(followee_id=user.id, status='pending').scalar() if row else 0}


def save_profile(data: ProfileInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); consume(db, 'social-profile', str(user.id), 20, 3600)
    clash = db.query(models.SocialProfile).filter(models.SocialProfile.handle == data.handle, models.SocialProfile.user_id != user.id).first()
    if clash: raise HTTPException(409, 'That handle is taken.')
    row = profile_of(db, user.id) or models.SocialProfile(user_id=user.id)
    was_private = bool(row.private)
    row.handle, row.display_name, row.bio, row.character_id, row.private = data.handle, data.display_name.strip(), data.bio.strip(), data.character_id, data.private
    db.add(row)
    if was_private and not data.private:  # going public approves everyone who asked
        db.query(models.Follow).filter_by(followee_id=user.id, status='pending').update({'status': 'active'})
    db.commit()
    return {'profile': profile_view(db, row)}


def profile(handle: str, before: str | None = None, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = by_handle(db, handle)
    if row.user_id != user.id and blocks_between(db, user.id, row.user_id): raise HTTPException(404, 'Profile not found.')
    view = profile_view(db, row, user.id)
    locked = row.private and row.user_id != user.id and follows(db, user.id, row.user_id) != 'active'
    posts = {'posts': [], 'next': None} if locked else page(db, db.query(models.Post).filter(models.Post.author_id == row.user_id, models.Post.community_id.is_(None)), user.id, before)
    return {'profile': view, 'locked': locked, **posts}


# ── Follows, requests, blocks ───────────────────────────────────────────────

def follow(handle: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); my_profile(db, user); consume(db, 'social-follow', str(user.id), 100, 3600)
    target = by_handle(db, handle)
    if target.user_id == user.id: raise HTTPException(422, "You can't follow yourself.")
    if blocks_between(db, user.id, target.user_id): raise HTTPException(404, 'Profile not found.')
    row = db.get(models.Follow, (user.id, target.user_id))
    if not row: row = models.Follow(follower_id=user.id, followee_id=target.user_id, status='pending' if target.private else 'active'); db.add(row)
    db.commit()
    return {'status': row.status}


def unfollow(handle: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    target = by_handle(db, handle)
    db.query(models.Follow).filter_by(follower_id=user.id, followee_id=target.user_id).delete(); db.commit()
    return {'status': None}


def requests(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    rows = db.query(models.SocialProfile).join(models.Follow, models.Follow.follower_id == models.SocialProfile.user_id).filter(models.Follow.followee_id == user.id, models.Follow.status == 'pending').all()
    return {'requests': [profile_view(db, r) for r in rows]}


class RequestAction(BaseModel):
    action: Literal['approve', 'decline']


def answer_request(handle: str, data: RequestAction, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    requester = by_handle(db, handle)
    row = db.query(models.Follow).filter_by(follower_id=requester.user_id, followee_id=user.id, status='pending').first()
    if not row: raise HTTPException(404, 'Request not found.')
    if data.action == 'approve': row.status = 'active'
    else: db.delete(row)
    db.commit()
    return {'status': 'approved' if data.action == 'approve' else 'declined'}


def connections(handle: str, kind: Literal['followers', 'following'] = Query('followers'), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = by_handle(db, handle)
    if row.user_id != user.id and (blocks_between(db, user.id, row.user_id) or (row.private and follows(db, user.id, row.user_id) != 'active')):
        raise HTTPException(403, 'This account is private.')
    join, match = (models.Follow.follower_id, models.Follow.followee_id) if kind == 'followers' else (models.Follow.followee_id, models.Follow.follower_id)
    hidden = blocked_ids(db, user.id)
    people = db.query(models.SocialProfile).join(models.Follow, join == models.SocialProfile.user_id).filter(match == row.user_id, models.Follow.status == 'active').order_by(models.Follow.created_at.desc()).limit(200).all()
    return {'people': [{'handle': p.handle, 'display_name': p.display_name, 'character_id': p.character_id} for p in people if p.user_id not in hidden]}


class BlockInput(BaseModel):
    kind: Literal['block', 'mute'] = 'block'


def block(handle: str, data: BlockInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    target = by_handle(db, handle)
    if target.user_id == user.id: raise HTTPException(422, "You can't block yourself.")
    row = db.get(models.SocialBlock, (user.id, target.user_id)) or models.SocialBlock(user_id=user.id, target_id=target.user_id)
    row.kind = data.kind; db.add(row)
    if data.kind == 'block':  # blocking ends follows both ways
        db.query(models.Follow).filter(or_((models.Follow.follower_id == user.id) & (models.Follow.followee_id == target.user_id), (models.Follow.follower_id == target.user_id) & (models.Follow.followee_id == user.id))).delete(synchronize_session=False)
    db.commit()
    return {'status': data.kind}


def unblock(handle: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    target = by_handle(db, handle)
    db.query(models.SocialBlock).filter_by(user_id=user.id, target_id=target.user_id).delete(); db.commit()
    return {'status': None}


# ── Posts, milestones, feed ─────────────────────────────────────────────────

class MilestoneRef(BaseModel):
    type: Literal['achievement', 'workout', 'level']
    ref: str = Field(min_length=1, max_length=50)


class PostInput(BaseModel):
    body: str = Field(default='', max_length=500)
    visibility: Literal['public', 'followers'] = 'public'
    milestone: MilestoneRef | None = None


def shareable(db, user):
    """What this person can share: unlocked achievements, recent completed workouts, their level."""
    achievements = db.query(models.UserAchievement, models.AchievementDefinition).join(models.AchievementDefinition, models.UserAchievement.code == models.AchievementDefinition.code).filter(models.UserAchievement.user_id == user.id).all()
    workouts = db.query(models.WorkoutSession).filter_by(user_id=user.id, status='completed', is_deleted=False).order_by(models.WorkoutSession.completed_at.desc()).limit(10).all()
    xp = db.query(func.coalesce(func.sum(models.RewardEvent.xp), 0)).filter_by(user_id=user.id).scalar() or 0
    from services import gamification
    level = 1 + int(xp) // gamification.policy(db)['level_step']
    return ([{'type': 'achievement', 'ref': a.code, 'title': f'Unlocked “{d.title}”'} for a, d in achievements]
            + [{'type': 'workout', 'ref': w.id, 'title': f'Finished a workout: {w.name}'} for w in workouts]
            + ([{'type': 'level', 'ref': str(level), 'title': f'Reached level {level}'}] if level > 1 else []))


def milestones(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    return {'milestones': shareable(db, user)}


def create_post(data: PostInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); author = my_profile(db, user); consume(db, 'social-post', str(user.id), 20, 3600)
    if author.posting_disabled: raise HTTPException(403, 'Posting is paused on this account after a moderation review.')
    if not data.body.strip() and not data.milestone: raise HTTPException(422, 'Write something or share a milestone.')
    snapshot = None
    if data.milestone:
        match = next((m for m in shareable(db, user) if m['type'] == data.milestone.type and m['ref'] == data.milestone.ref), None)
        if not match: raise HTTPException(422, "That milestone isn't yours to share.")
        snapshot = {'type': match['type'], 'title': match['title']}
    post = models.Post(author_id=user.id, body=data.body.strip(), visibility=data.visibility, milestone=snapshot)
    db.add(post); db.commit()
    return {'post': posts_view(db, [post], user.id)[0]}


def delete_post(post_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    post = db.query(models.Post).filter_by(id=post_id, author_id=user.id).first()
    if not post: raise HTTPException(404, 'Post not found.')
    post.deleted_at = utcnow(); db.commit()
    return {'status': 'deleted'}


def feed(tab: Literal['following', 'discover'] = Query('following'), before: str | None = None, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); my_profile(db, user)
    hidden = blocked_ids(db, user.id)
    query = db.query(models.Post).filter(models.Post.deleted_at.is_(None), models.Post.hidden.is_(False), models.Post.community_id.is_(None))  # community posts stay in their community
    if hidden: query = query.filter(models.Post.author_id.notin_(hidden))
    if tab == 'following':
        followed = db.query(models.Follow.followee_id).filter_by(follower_id=user.id, status='active')
        query = query.filter(or_(models.Post.author_id.in_(followed), models.Post.author_id == user.id))
    else:  # newest public posts from public accounts; no ranking algorithm
        query = query.join(models.SocialProfile, models.SocialProfile.user_id == models.Post.author_id).filter(models.Post.visibility == 'public', models.SocialProfile.private.is_(False))
    return page(db, query, user.id, before)


def visible_post(db, user, post_id):
    post = db.get(models.Post, post_id)
    if not post or not can_view(db, user.id, post): raise HTTPException(404, 'Post not found.')
    return post


# ── Reactions and comments ──────────────────────────────────────────────────

class ReactionInput(BaseModel):
    kind: Literal[REACTIONS] = 'like'


def react(post_id: str, data: ReactionInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); my_profile(db, user); consume(db, 'social-react', str(user.id), 300, 3600)
    post = visible_post(db, user, post_id)
    row = db.get(models.PostReaction, (post.id, user.id)) or models.PostReaction(post_id=post.id, user_id=user.id)
    row.kind = data.kind; db.add(row); db.commit()
    return {'post': posts_view(db, [post], user.id)[0]}


def unreact(post_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    post = visible_post(db, user, post_id)
    db.query(models.PostReaction).filter_by(post_id=post.id, user_id=user.id).delete(); db.commit()
    return {'post': posts_view(db, [post], user.id)[0]}


def comment_view(c, author, viewer_id, post_author):
    return {'id': c.id, 'body': c.body, 'created_at': c.created_at.isoformat() + 'Z', 'author': {'handle': author.handle, 'display_name': author.display_name, 'character_id': author.character_id},
            'can_delete': viewer_id in (c.author_id, post_author)}


def comments(post_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    post = visible_post(db, user, post_id)
    hidden = blocked_ids(db, user.id)
    rows = db.query(models.Comment, models.SocialProfile).join(models.SocialProfile, models.SocialProfile.user_id == models.Comment.author_id).filter(
        models.Comment.post_id == post.id, models.Comment.deleted_at.is_(None), models.Comment.hidden.is_(False)).order_by(models.Comment.created_at).limit(200).all()
    return {'comments': [comment_view(c, a, user.id, post.author_id) for c, a in rows if c.author_id not in hidden]}


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=300)


def add_comment(post_id: str, data: CommentInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); author = my_profile(db, user); consume(db, 'social-comment', str(user.id), 60, 3600)
    if author.posting_disabled: raise HTTPException(403, 'Commenting is paused on this account after a moderation review.')
    post = visible_post(db, user, post_id)
    if not data.body.strip(): raise HTTPException(422, 'Write a comment first.')
    row = models.Comment(post_id=post.id, author_id=user.id, body=data.body.strip()); db.add(row); db.commit()
    return {'comment': comment_view(row, author, user.id, post.author_id)}


def delete_comment(comment_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = db.get(models.Comment, comment_id)
    post = db.get(models.Post, row.post_id) if row else None
    if not row or user.id not in (row.author_id, post.author_id): raise HTTPException(404, 'Comment not found.')
    row.deleted_at = utcnow(); db.commit()
    return {'status': 'deleted'}


# ── Reports and moderation ──────────────────────────────────────────────────

class ReportInput(BaseModel):
    target_type: Literal['post', 'comment', 'profile']
    target_id: str = Field(min_length=3, max_length=36)  # post/comment id, or a profile handle
    reason: Literal['harassment', 'hate', 'self_harm', 'sexual', 'spam', 'misinformation', 'other']
    note: str = Field(default='', max_length=300)


def target_of(db, kind, ident):
    if kind == 'post': return db.get(models.Post, ident)
    if kind == 'comment': return db.get(models.Comment, ident)
    return db.query(models.SocialProfile).filter_by(handle=ident.lower()).first()


def report(data: ReportInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); consume(db, 'social-report', str(user.id), 30, 3600)
    target = target_of(db, data.target_type, data.target_id)
    if not target: raise HTTPException(404, 'Not found.')
    key = target.user_id if data.target_type == 'profile' else target.id
    if not db.query(models.ContentReport).filter_by(reporter_id=user.id, target_type=data.target_type, target_id=key).first():
        db.add(models.ContentReport(reporter_id=user.id, target_type=data.target_type, target_id=key, reason=data.reason, note=data.note.strip()))
        db.flush()
        reporters = db.query(func.count(func.distinct(models.ContentReport.reporter_id))).filter_by(target_type=data.target_type, target_id=key, status='open').scalar()
        if data.target_type != 'profile' and reporters >= AUTO_HIDE_REPORTS: target.hidden = True  # until a moderator decides
    db.commit()
    return {'status': 'Thanks. Our team will review this.'}


def require_moderator(user):
    if user.role != models.UserRole.admin: raise HTTPException(403, 'Moderators only.')


def moderation_queue(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); require_moderator(user)
    rows = db.query(models.ContentReport).filter_by(status='open').order_by(models.ContentReport.created_at).limit(200).all()
    grouped = {}
    for r in rows:
        item = grouped.setdefault((r.target_type, r.target_id), {'target_type': r.target_type, 'target_id': r.target_id, 'reasons': [], 'report_ids': []})
        item['reasons'].append(r.reason); item['report_ids'].append(r.id)
    out = []
    for (kind, ident), item in grouped.items():
        target = db.get({'post': models.Post, 'comment': models.Comment}[kind], ident) if kind != 'profile' else profile_of(db, ident)
        item['content'] = (target.body if kind != 'profile' else f'{target.display_name} (@{target.handle}): {target.bio}') if target else '(deleted)'
        item['hidden'] = getattr(target, 'hidden', None)
        out.append(item)
    return {'queue': out}


class ModerationInput(BaseModel):
    target_type: Literal['post', 'comment', 'profile']
    target_id: str = Field(min_length=3, max_length=36)
    action: Literal['hide', 'restore', 'dismiss', 'pause_posting']


def moderate(data: ModerationInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); require_moderator(user)
    target = db.get({'post': models.Post, 'comment': models.Comment}[data.target_type], data.target_id) if data.target_type != 'profile' else profile_of(db, data.target_id)
    if not target: raise HTTPException(404, 'Not found.')
    if data.action == 'hide' and data.target_type != 'profile': target.hidden = True
    if data.action == 'restore' and data.target_type != 'profile': target.hidden = False
    if data.action == 'pause_posting':
        owner = profile_of(db, target.user_id if data.target_type == 'profile' else target.author_id)
        if owner: owner.posting_disabled = True
    status = 'dismissed' if data.action in ('dismiss', 'restore') else 'actioned'
    db.query(models.ContentReport).filter_by(target_type=data.target_type, target_id=data.target_id, status='open').update({'status': status, 'resolved_at': utcnow()})
    db.commit()
    return {'status': status}
