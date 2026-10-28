"""Opt-in real OpenRouter smoke test. Isolated DB transaction; synthetic food text only."""
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["APP_ENV"] = "testing"
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from database import engine, get_db
from routers import ai_scan


def run():
    if os.getenv("RUN_LIVE_AI") != "true":
        raise SystemExit("Set RUN_LIVE_AI=true to explicitly enable the real external inference request.")
    connection = engine.connect()
    transaction = connection.begin()
    def database():
        with Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as session:
            yield session
    app.dependency_overrides[get_db] = database
    ai_scan.MOCK_MODE = False
    try:
        with TestClient(app) as client:
            signup = client.post("/api/v1/auth/signup", json={"email": f"live-qa-{uuid.uuid4().hex}@tests.example.com", "password": "Synthetic-live-test-123!"})
            assert signup.status_code == 201, "Live test account could not be created"
            headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
            response = client.post("/api/v1/scan/text", headers=headers, data={"text": "One boiled egg and a slice of whole wheat toast"})
            assert response.status_code == 200, f"Live inference failed ({response.status_code})"
            data = response.json()
            assert data["is_mock"] is False and data["predictions"]
            assert sum(item["calories"] for item in data["predictions"]) > 0
            job = client.get(f"/api/v1/scan/jobs/{data['scan_job_id']}", headers=headers)
            assert job.status_code == 200 and job.json()["provider"] == "openrouter"
            print("Backend authenticated live text-to-scan-job workflow: passed; provider=openrouter; is_mock=false")
    finally:
        app.dependency_overrides.clear()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


if __name__ == "__main__":
    run()
