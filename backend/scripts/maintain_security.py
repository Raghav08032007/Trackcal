"""Daily maintenance: remove expired security metadata and apply the data retention policy (services/retention.py).
Does not remove customer nutrition, workout or account records."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import SessionLocal  # noqa: E402
from services import retention  # noqa: E402
with SessionLocal() as db:
    counts = retention.apply(db)
print('Retention applied: ' + ', '.join(f'{count} {name}' for name, count in counts.items()) + '.')
