"""App settings and lists that sync between devices, one entry per key with a version.

A save names the version it was based on. If another device saved since, the save for that key is refused and the
current copy is sent back, so the device can merge and try again; nothing is overwritten unseen.
"""
import json
import math
import re
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

import models

# Data that only lives in this app's own settings and lists. Diary, targets, days and workouts have their own tables.
SYNC_KEY = re.compile(r'^trackcal:(studio:(recipes|pantry|shopping|plans|fast)|recipe:(name|servings|ingredients)|preferences|reminders|appearance|comfort'
                      r'|play:(calm|character|theme|motion)|guide:done|companion-offset)$')
MAX_VALUE = 200_000          # bytes of JSON per key
MAX_TOTAL = 2_000_000        # bytes for one person


class Change(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: str = Field(max_length=80)
    value: Any = None
    base_version: int = Field(ge=0)          # 0: this device has never seen a saved copy
    removed: bool = False


class Changes(BaseModel):
    model_config = ConfigDict(extra='forbid')
    changes: list[Change] = Field(min_length=1, max_length=40)


def check_value(key, value):
    if not SYNC_KEY.match(key): raise ValueError(f'{key} is not saved to the account.')
    def walk(node, depth=0):
        if depth > 8: raise ValueError('Too deeply nested.')
        if isinstance(node, float) and not math.isfinite(node): raise ValueError('Invalid number.')
        if isinstance(node, dict):
            for k, item in node.items():
                if not isinstance(k, str) or len(k) > 80: raise ValueError('Invalid field name.')
                walk(item, depth + 1)
        elif isinstance(node, list):
            for item in node: walk(item, depth + 1)
        elif not (node is None or isinstance(node, (str, int, float, bool))): raise ValueError('Unsupported value.')
    walk(value)
    size = len(json.dumps(value, separators=(',', ':')))
    if size > MAX_VALUE: raise ValueError(f'{key} is too large to save.')
    return size


def view(row):
    return {'value': row.value, 'version': row.version}


def entries(db, user_id):
    return {r.key: view(r) for r in db.query(models.WorkspaceEntry).filter_by(user_id=user_id)}


def seed_from_backup(db, user_id):
    """The first time, anything in an earlier manual backup becomes the starting copy."""
    if db.query(models.WorkspaceEntry.key).filter_by(user_id=user_id).first(): return False
    backup = db.get(models.UserWorkspace, user_id)
    added = False
    for key, value in ((backup.entries or {}) if backup else {}).items():
        try: check_value(key, value)
        except ValueError: continue
        db.add(models.WorkspaceEntry(user_id=user_id, key=key, value=value, version=1)); added = True
    if added: db.flush()
    return added


def apply(db, user_id, changes: Changes):
    """Saves each change whose base version is current. Returns saved versions and, for the rest, the current copy."""
    rows = {r.key: r for r in db.query(models.WorkspaceEntry).filter_by(user_id=user_id).with_for_update()}
    total = sum(len(json.dumps(r.value, separators=(',', ':'))) for r in rows.values() if r.value is not None)
    saved, conflicts, refused = {}, {}, {}
    for change in changes.changes:
        try: size = check_value(change.key, None if change.removed else change.value)
        except ValueError as failure: refused[change.key] = str(failure); continue
        row = rows.get(change.key)
        current = row.version if row else 0
        if change.base_version != current: conflicts[change.key] = view(row); continue
        old = len(json.dumps(row.value, separators=(',', ':'))) if row and row.value is not None else 0
        if total - old + size > MAX_TOTAL: refused[change.key] = 'Your saved app data is full. Remove some recipes or plans.'; continue
        total += size - old
        value = None if change.removed else change.value
        if row: row.value, row.version = value, row.version + 1
        else: row = rows[change.key] = models.WorkspaceEntry(user_id=user_id, key=change.key, value=value, version=1); db.add(row)
        saved[change.key] = row.version
    return {'saved': saved, 'conflicts': conflicts, 'refused': refused}
