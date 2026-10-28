"""Run integration writes inside rollback-only transactions on the existing schema."""
import os
os.environ["APP_ENV"] = "testing"
import pytest
from sqlalchemy.orm import Session
import database
from main import app


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    from routers import ai_scan
    monkeypatch.setattr(ai_scan, "MOCK_MODE", True)
    connection = database.engine.connect()
    transaction = connection.begin()
    def factory():
        return Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    monkeypatch.setattr(database, "SessionLocal", factory)
    def dependency():
        with factory() as session:
            yield session
    app.dependency_overrides[database.get_db] = dependency
    yield
    app.dependency_overrides.clear()
    if transaction.is_active:
        transaction.rollback()
    connection.close()
