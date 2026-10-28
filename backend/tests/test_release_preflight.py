import json
from scripts.release_preflight import inspect_configuration

def test_preflight_does_not_expose_credentials_or_certify_launch(monkeypatch):
    monkeypatch.setenv("APP_ENV","production")
    monkeypatch.setenv("APP_SECRET_KEY","private-secret-"+"7"*40)
    monkeypatch.setenv("DB_PASSWORD","private-db-password")
    monkeypatch.setenv("OPENROUTER_API_KEY","private-provider-token")
    monkeypatch.setenv("CORS_ORIGINS","https://trackcal.example")
    monkeypatch.setenv("PUBLIC_APP_URL","https://trackcal.example")
    monkeypatch.setenv("AI_MOCK_MODE","false")
    monkeypatch.setenv("SMTP_HOST","smtp.example")
    monkeypatch.setenv("SMTP_FROM","mail@example.com")
    report=inspect_configuration()
    serialized=json.dumps(report)
    for value in ("private-secret", "private-db-password", "private-provider-token"):
        assert value not in serialized
    assert report["launch_ready"] is False
    assert report["scope"]=="configuration_only"
    assert report["required_runtime_evidence"]

def test_preflight_fails_missing_settings_without_network_or_mail(monkeypatch):
    monkeypatch.setenv("APP_ENV","development")
    monkeypatch.setenv("PUBLIC_APP_URL","")
    monkeypatch.setenv("SMTP_HOST","")
    report=inspect_configuration()
    assert report["configuration_passed"] is False
    assert {row["check"] for row in report["checks"] if row["status"]=="blocked"} >= {"production_mode","mail_configuration","public_origin"}

def test_legacy_subscription_cancellation_cannot_claim_provider_success():
    from types import SimpleNamespace
    import pytest
    from fastapi import HTTPException
    from routers.subscriptions import cancel_subscription, CancelRequest
    subscription=SimpleNamespace(plan_id="professional",status="active")
    class Query:
        def filter(self,*args): return self
        def first(self): return subscription
    class Database:
        def query(self,*args): return Query()
        def commit(self): raise AssertionError("No billing mutation is allowed without a provider.")
    with pytest.raises(HTTPException) as error:
        cancel_subscription(CancelRequest(),SimpleNamespace(id="test-member"),Database())
    assert error.value.status_code==503 and subscription.status=="active"
