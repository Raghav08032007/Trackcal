"""Spam controls for the feed and communities (KI-39). Simple, explainable rules; every refusal says what to do instead.

- Repeats: the same post text again within REPEAT_HOURS is refused (edit or delete the earlier one); the same comment
  COMMENT_REPEATS times within an hour is refused.
- Links: accounts younger than LINK_DAYS can't post links (spam accounts are usually new); for everyone, a post that is
  mostly links, or has more than MAX_LINKS, is refused.
- New accounts: NEW_HOURS of slower posting (NEW_POSTS_PER_HOUR), and their posts reach followers but not Discover yet.
- Discover shows at most PER_AUTHOR posts from one person per page, so nobody can flood it (see social.page).
The word screen (services/screening.py) and reports still apply on top of these."""
import re
from datetime import timedelta

from flask_app.params import HTTPException
from sqlalchemy import func

import models
from services.abuse_limits import consume
from timeutil import utcnow

REPEAT_HOURS, COMMENT_REPEATS = 24, 3
LINK_DAYS, MAX_LINKS = 3, 3
NEW_HOURS, NEW_POSTS_PER_HOUR = 24, 5
PER_AUTHOR = 2

LINK = re.compile(r'(?:https?://|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|in|io|co|xyz|top|info|biz|link|ly|me|app|shop|site|online|store|click)\b(?:/\S*)?', re.I)


def _same(text):
    return re.sub(r'\s+', ' ', (text or '').strip().lower())


def links(text):
    return LINK.findall(text or '')


def account_age(profile, now=None):
    return (now or utcnow()) - profile.created_at


def is_new(profile, now=None):
    return account_age(profile, now) < timedelta(hours=NEW_HOURS)


def check_text(profile, body, now=None):
    """Link rules for a post or comment body."""
    found = links(body)
    if not found: return
    if account_age(profile, now) < timedelta(days=LINK_DAYS):
        raise HTTPException(422, 'New accounts can share links after 3 days. This keeps spam out of the feed.')
    link_chars = sum(len(link) for link in found)
    if len(found) > MAX_LINKS or link_chars > 0.5 * len(body.strip()):
        raise HTTPException(422, 'Posts that are mostly links are not allowed. Add a few words about what you are sharing.')


def check_post(db, profile, body, community_id=None, now=None):
    """Before saving a post (feed or community)."""
    now = now or utcnow()
    if is_new(profile, now): consume(db, 'social-post-new', str(profile.user_id), NEW_POSTS_PER_HOUR, 3600)
    check_text(profile, body, now)
    text = _same(body)
    if text:
        recent = (db.query(models.Post.body).filter(models.Post.author_id == profile.user_id, models.Post.deleted_at.is_(None),
                                                     models.Post.created_at >= now - timedelta(hours=REPEAT_HOURS)).all())
        if any(_same(b) == text for (b,) in recent):
            raise HTTPException(409, 'You posted this already. Edit or delete the earlier post instead of posting it again.')


def check_comment(db, profile, body, now=None):
    now = now or utcnow()
    check_text(profile, body, now)
    text = _same(body)
    recent = (db.query(models.Comment.body).filter(models.Comment.author_id == profile.user_id, models.Comment.deleted_at.is_(None),
                                                    models.Comment.created_at >= now - timedelta(hours=1)).all())
    if sum(1 for (b,) in recent if _same(b) == text) >= COMMENT_REPEATS - 1:
        raise HTTPException(409, 'You have left this same comment several times. Write something different, or wait a while.')


def discover_ready(query, now=None):
    """Discover leaves out posts from accounts younger than NEW_HOURS (they still reach followers)."""
    return query.filter(models.SocialProfile.created_at <= (now or utcnow()) - timedelta(hours=NEW_HOURS))
