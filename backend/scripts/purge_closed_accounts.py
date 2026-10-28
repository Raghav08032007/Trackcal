"""Erase accounts closed more than ACCOUNT_ERASURE_DAYS ago. Run daily (compose.production.yml does).

Each account is erased in its own transaction, so one failure never blocks the others.
Prints counts only: no IDs, emails or content.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import SessionLocal
from services.account_erasure import due_accounts, erase_account, erasure_days

with SessionLocal() as db:
    due = due_accounts(db)
erased = files = failed = 0
for user_id in due:
    with SessionLocal() as db:
        try:
            files += erase_account(db, user_id); db.commit(); erased += 1
        except Exception as error:  # keep going; report the type only
            db.rollback(); failed += 1; print(f'erasure failed: {type(error).__name__}', file=sys.stderr)
print(f'erasure window {erasure_days()} days: {erased} accounts erased, {files} photo files removed, {failed} failed')
sys.exit(1 if failed else 0)
