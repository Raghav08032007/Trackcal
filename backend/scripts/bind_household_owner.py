"""Bind private household adapters to an existing active TrackCal account."""
import argparse
import os
import sys
from pathlib import Path

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend))
os.environ.setdefault("APP_ENV", "testing")  # Avoid SQL debug logging of account data.
from database import SessionLocal
from models import User

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("email", help="Existing TrackCal account email")
args = parser.parse_args()
with SessionLocal() as session:
    account = session.query(User).filter(User.email == args.email.strip().lower(), User.is_active.is_(True), User.deleted_at.is_(None)).first()
    if not account:
        raise SystemExit("No active account found. Create it through TrackCal signup first; then rerun this command.")
    path = backend / ".env"
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if not line.startswith("INTEGRATION_OWNER_ID=")]
    lines.append("INTEGRATION_OWNER_ID=" + str(account.id))
    temporary = backend / "runtime" / "owner.env.tmp"
    temporary.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_text("\n".join(lines) + "\n")
    temporary.replace(path)
print("Household owner bound. Restart the API to load the change. No keys or tokens were printed.")
