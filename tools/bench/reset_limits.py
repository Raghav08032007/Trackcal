"""Clear the app's rate-limit counters between load runs. Bench and test databases only."""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
from dotenv import load_dotenv  # noqa: E402
load_dotenv(HERE / 'backend' / '.env')
name = os.environ.get('DB_NAME', '')
if 'test' not in name and 'bench' not in name:
    sys.exit(f'Refusing to touch database "{name}".')
sys.path.insert(0, str(HERE / 'backend'))
import database  # noqa: E402
from sqlalchemy import text  # noqa: E402
with database.engine.begin() as c:
    c.execute(text('DELETE FROM rate_buckets'))
