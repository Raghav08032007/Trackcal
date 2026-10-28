"""Explicit additive schema bootstrap. Run as a release job, never during API startup."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import Base, engine, SessionLocal
import models  # noqa: F401
Base.metadata.create_all(engine)
from services.gamification import seed
with SessionLocal() as db:
    seed(db)
    db.commit()
print("Additive schema bootstrap complete. Existing columns/data were not altered.")
