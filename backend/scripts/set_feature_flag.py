"""Operator command: python scripts/set_feature_flag.py <key> on|off   (or: list)"""
import getpass, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import SessionLocal
from services import feature_flags

if len(sys.argv) == 2 and sys.argv[1] == 'list':
    with SessionLocal() as db:
        for key, on in feature_flags.all_flags(db).items(): print(f'{key:22} {"on" if on else "off":4} {feature_flags.REGISTRY[key]}')
    sys.exit(0)
if len(sys.argv) != 3 or sys.argv[2] not in ('on', 'off'): sys.exit(__doc__)
with SessionLocal() as db:
    feature_flags.set_flag(db, sys.argv[1], sys.argv[2] == 'on', f'cli:{getpass.getuser()}'); db.commit()
print(f'{sys.argv[1]} is now {sys.argv[2]}')
