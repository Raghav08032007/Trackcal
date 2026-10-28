"""Permanent erasure of closed accounts (KI-02).

Closing an account (DELETE /users/account) disables access immediately. After ACCOUNT_ERASURE_DAYS
(default 30; 0 = the next purge run) scripts/purge_closed_accounts.py erases it: uploaded photo files,
the rows of the three tables whose foreign keys only SET NULL (they hold personal content), then the user
row, which cascades through every other user-owned table.
"""
import os
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import text

import models
from database import Base

OWNER_COLUMNS = ('user_id', 'owner_id', 'client_id', 'coach_id')
SET_NULL_CONTENT = (models.AuditLog, models.CommunitySubmission, models.SupportTicket)


def erasure_days():
    try:
        days = int(os.getenv('ACCOUNT_ERASURE_DAYS', '30'))
        if not 0 <= days <= 365: raise ValueError()
        return days
    except ValueError:
        raise RuntimeError('ACCOUNT_ERASURE_DAYS must be a whole number from 0 to 365.')


def erase_after(closed_at):
    return closed_at + timedelta(days=erasure_days())


def _remove_uploads(db, user_id):
    root = Path(os.getenv('LOCAL_STORAGE_PATH', './uploads')).resolve()
    removed = 0
    for image in db.query(models.FoodImage).filter_by(user_id=user_id).all():
        target = Path(image.storage_path).resolve()
        if root in target.parents and target.is_file():  # never follow a path outside the uploads folder
            target.unlink(); removed += 1
    return removed


def remaining_rows(db, user_id):
    """Rows anywhere in the schema that still point at the user (used to prove erasure)."""
    left = {}
    for table in Base.metadata.sorted_tables:
        for column in (c for c in table.columns if c.name in OWNER_COLUMNS or (table.name == 'users' and c.name == 'id')):
            count = db.execute(text(f'SELECT COUNT(*) FROM `{table.name}` WHERE `{column.name}` = :id'), {'id': user_id}).scalar()
            if count: left[f'{table.name}.{column.name}'] = count
    return left


def erase_account(db, user_id):
    """Erase one closed account. Returns the number of photo files removed. Caller commits."""
    user = db.get(models.User, user_id)
    if user is None: return 0
    if user.deleted_at is None or user.is_active: raise ValueError('Only closed accounts can be erased.')
    files = _remove_uploads(db, user_id)
    for model in SET_NULL_CONTENT:
        db.query(model).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.expunge(user)
    db.execute(text('DELETE FROM users WHERE id = :id'), {'id': user_id})  # database ON DELETE CASCADE does the rest
    db.flush()
    left = remaining_rows(db, user_id)
    if left: raise RuntimeError(f'Erasure left rows behind: {sorted(left)}')
    return files


def due_accounts(db, now=None):
    cutoff = (now or datetime.utcnow()) - timedelta(days=erasure_days())
    return [row.id for row in db.query(models.User.id).filter(models.User.deleted_at.isnot(None), models.User.is_active.is_(False), models.User.deleted_at <= cutoff)]
