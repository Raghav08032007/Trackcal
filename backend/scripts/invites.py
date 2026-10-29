"""Closed-beta invite codes (operator only).

  python scripts/invites.py create --label "college friends" --uses 20 --days 30   # prints the code once
  python scripts/invites.py list                                                   # labels and usage, never codes
  python scripts/invites.py revoke --label "college friends"
Turn the gate on with FEATURE_CLOSED_BETA=true (or the feature_flags row)."""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import models  # noqa: E402
from database import SessionLocal  # noqa: E402
from services import invites  # noqa: E402

parser = argparse.ArgumentParser(description='Closed-beta invite codes')
parser.add_argument('action', choices=['create', 'list', 'revoke'])
parser.add_argument('--label', default='')
parser.add_argument('--uses', type=int, default=1)
parser.add_argument('--days', type=int, default=30, help='0 = no expiry')
args = parser.parse_args()
with SessionLocal() as db:
    if args.action == 'create':
        if not args.label: parser.error('--label is required')
        print(invites.create(db, args.label, args.uses, args.days), '(shown once; store it somewhere safe)')
    elif args.action == 'list':
        for row in db.query(models.InviteCode).order_by(models.InviteCode.created_at).all():
            print(f'{row.label:30} {row.uses}/{row.max_uses} used  expires {row.expires_at or "never"}  {"REVOKED" if row.revoked else ""}')
    else:
        rows = db.query(models.InviteCode).filter_by(label=args.label).all()
        for row in rows: row.revoked = True
        db.commit(); print(f'revoked {len(rows)} code(s)')
