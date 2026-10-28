"""Remove expired security metadata. Does not remove customer nutrition/account records."""
import sys
from pathlib import Path
from datetime import datetime
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import SessionLocal
from models import AccountActionToken, RateBucket
with SessionLocal() as db:
    tokens = db.query(AccountActionToken).filter(AccountActionToken.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    buckets = db.query(RateBucket).filter(RateBucket.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    db.commit()
print(f"Expired security metadata removed: {tokens} action tokens, {buckets} request buckets.")
