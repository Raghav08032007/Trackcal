"""Atomic MySQL request buckets shared by API workers; subjects are HMAC hashes."""
import hashlib
import hmac
import os
import time
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.dialects.mysql import insert
from models import RateBucket

def consume(db, action: str, subject: str, limit: int, seconds: int):
    window = int(time.time()) // seconds
    key = hmac.new(os.environ.get("APP_SECRET_KEY", "dev-secret-change-me").encode(), f"{action}:{subject}:{window}".encode(), hashlib.sha256).hexdigest()
    statement = insert(RateBucket).values(key=key, hits=1, expires_at=datetime.utcfromtimestamp((window + 2) * seconds))
    db.execute(statement.on_duplicate_key_update(hits=RateBucket.hits + 1))
    bucket = db.query(RateBucket).filter_by(key=key).populate_existing().first()
    hits = bucket.hits
    db.commit()
    if hits > limit:
        raise HTTPException(429, "Request limit reached. Please try again later.", headers={"Retry-After": str(seconds - int(time.time()) % seconds)})
    return max(0, limit - hits)
