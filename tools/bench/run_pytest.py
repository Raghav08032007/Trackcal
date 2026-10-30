"""Run a checkout's backend tests with secrets from the main .env (a frozen worktree has none of its own)."""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
from dotenv import load_dotenv  # noqa: E402
load_dotenv(HERE / 'backend' / '.env')
repo = Path(os.environ.get('BENCH_REPO') or HERE)
os.chdir(repo / 'backend')
sys.path.insert(0, str(repo / 'backend'))
import pytest  # noqa: E402
sys.exit(pytest.main(sys.argv[1:]))
