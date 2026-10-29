"""Naive UTC timestamps, the convention used across the database (datetime.utcnow is deprecated in Python 3.12)."""
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
