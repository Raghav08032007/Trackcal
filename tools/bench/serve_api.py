"""Serve the API for the bench the way production does, as closely as Windows allows.

Production runs gunicorn (gthread, 2 workers x 4 threads), which needs fcntl and cannot run on Windows.
waitress with 8 threads is the closest stand-in. Usage (from the repo root):
  DB_NAME=trackcal_phase3_test APP_ENV=testing backend/.venv/Scripts/python.exe tools/bench/serve_api.py 8006
waitress lives in tools/bench/.pydeps (pip install --target), so the app's own environment is not changed.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = Path(os.environ.get("BENCH_REPO") or HERE.parent.parent)  # the checkout being measured
sys.path[:0] = [str(HERE / ".pydeps"), str(REPO / "backend")]
os.chdir(REPO / "backend")
from dotenv import load_dotenv  # noqa: E402

load_dotenv(HERE.parent.parent / "backend" / ".env")
if not any(word in os.environ.get("DB_NAME", "") for word in ("test", "bench")):
    sys.exit("Refusing to serve: DB_NAME must be a disposable test or bench database.")

from waitress import serve  # noqa: E402
from flask_app import create_app  # noqa: E402

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8006
print(f"bench API (waitress, 8 threads) on http://127.0.0.1:{port}", flush=True)
serve(create_app(), host="127.0.0.1", port=port, threads=8, connection_limit=200, ident="bench")
