import hashlib
import uuid
from datetime import datetime, timedelta
import pytest
from fastapi import HTTPException
from tests.client import app, client
from services import account_mail
from services.abuse_limits import consume
from services.production_config import validate_production
import database
import models


def account():
    email = f"qa-readiness-{uuid.uuid4().hex}@tests.example.com"
    response = client.post("/api/v1/auth/signup", json={"email":email,"password":"Original-password-123"})
    assert response.status_code == 201
    data = response.json()
    return email, data, {"Authorization":"Bearer "+data["access_token"]}

@pytest.fixture
def mailbox(monkeypatch):
    messages=[]
    monkeypatch.setattr(account_mail,"configuration",lambda:"https://trackcal.example")
    monkeypatch.setattr(account_mail,"deliver",lambda address,purpose,token:messages.append((address,purpose,token)))
    return messages

def test_reset_single_use_revokes_access_refresh_and_other_reset_links(mailbox):
    email, tokens, headers=account()
    for _ in range(2): assert client.post("/api/v1/auth/forgot-password",json={"email":email}).status_code==200
    token=mailbox[0][2]
    with database.SessionLocal() as db:
        row=db.get(models.AccountActionToken,hashlib.sha256(token.encode()).hexdigest())
        assert row and row.digest != token and row.used_at is None
    result=client.post("/api/v1/auth/reset-password",json={"token":token,"new_password":"Replacement-password-123"})
    assert result.status_code==200
    assert client.get("/api/v1/auth/me",headers=headers).status_code==401
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":tokens["refresh_token"]}).status_code==401
    for raw in (token,mailbox[1][2]): assert client.post("/api/v1/auth/reset-password",json={"token":raw,"new_password":"Another-password-123"}).status_code==400
    assert client.post("/api/v1/auth/login",data={"username":email,"password":"Replacement-password-123"}).status_code==200

def test_recovery_response_does_not_disclose_unknown_account(mailbox):
    email,_,_=account()
    known=client.post("/api/v1/auth/forgot-password",json={"email":email})
    unknown=client.post("/api/v1/auth/forgot-password",json={"email":"absent@tests.example.com"})
    assert known.json()==unknown.json() and known.status_code==unknown.status_code==200
    assert len(mailbox)==1 and "token" not in known.text

def test_verification_purpose_expiry_and_replay(mailbox):
    _,_,headers=account()
    assert client.post("/api/v1/auth/request-verification",headers=headers).status_code==200
    raw=mailbox[-1][2]
    assert client.post("/api/v1/auth/reset-password",json={"token":raw,"new_password":"Wrong-purpose-123"}).status_code==400
    assert client.post("/api/v1/auth/verify-email",json={"token":raw}).status_code==200
    assert client.get("/api/v1/auth/me",headers=headers).json()["email_verified"] is True
    assert client.post("/api/v1/auth/verify-email",json={"token":raw}).status_code==400
    email,_,_=account();client.post("/api/v1/auth/forgot-password",json={"email":email}); raw=mailbox[-1][2]
    with database.SessionLocal() as db:
        row=db.get(models.AccountActionToken,hashlib.sha256(raw.encode()).hexdigest());row.expires_at=datetime.utcnow()-timedelta(seconds=1);db.commit()
    assert client.post("/api/v1/auth/reset-password",json={"token":raw,"new_password":"Expired-link-123"}).status_code==400

def test_password_change_revokes_previous_session():
    _,tokens,headers=account()
    assert client.post("/api/v1/auth/password",headers=headers,json={"current_password":"Original-password-123","new_password":"Changed-password-123"}).status_code==200
    assert client.get("/api/v1/auth/me",headers=headers).status_code==401
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":tokens["refresh_token"]}).status_code==401

def test_durable_limit_is_shared_and_keeps_subjects_hashed():
    subject=str(uuid.uuid4())
    with database.SessionLocal() as first:
        assert consume(first,"test",subject,2,60)==1
    with database.SessionLocal() as second:
        assert consume(second,"test",subject,2,60)==0
        with pytest.raises(HTTPException) as error: consume(second,"test",subject,2,60)
        assert error.value.status_code==429
        assert all(subject not in row.key for row in second.query(models.RateBucket).all())

def test_production_configuration_fails_closed(monkeypatch):
    monkeypatch.setenv("APP_ENV","production");monkeypatch.setenv("APP_SECRET_KEY","short")
    with pytest.raises(RuntimeError):validate_production()
    monkeypatch.setenv("APP_SECRET_KEY","x"*64);monkeypatch.setenv("CORS_ORIGINS","https://trackcal.example");monkeypatch.setenv("AI_MOCK_MODE","false")
    validate_production()
    monkeypatch.setenv("AI_MOCK_MODE","true")
    with pytest.raises(RuntimeError):validate_production()

def test_mail_requires_https_and_configuration(monkeypatch):
    monkeypatch.setenv("APP_ENV","production");monkeypatch.setenv("PUBLIC_APP_URL","http://public.example");monkeypatch.setenv("SMTP_HOST","smtp.example");monkeypatch.setenv("SMTP_FROM","app@example.com")
    with pytest.raises(RuntimeError):account_mail.configuration()
    monkeypatch.setenv("PUBLIC_APP_URL","https://public.example");assert account_mail.configuration()=="https://public.example"

@pytest.mark.parametrize("origin", ["https://*.example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?query=1", "https://example.com#fragment", "https://example.com:99999", "https://exa mple.com", "http://example.com"])
def test_production_rejects_non_origin_urls(monkeypatch, origin):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_SECRET_KEY", "x"*64)
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("CORS_ORIGINS", origin)
    with pytest.raises(RuntimeError): validate_production()

def test_production_rejects_template_signing_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_SECRET_KEY", "CHANGE_ME_RANDOM_64_CHAR_HEX_0123456789")
    with pytest.raises(RuntimeError): validate_production()

def test_plan_catalog_does_not_sell_unconnected_features(monkeypatch):
    response=client.get("/api/v1/subscriptions/plans")
    assert response.status_code==200
    data=response.json()
    assert data["billing_enabled"] is False and set(data["plans"])=={"free"}
    assert data["plans"]["free"]["ai_scans_per_day"]==5
    monkeypatch.setenv("APP_ENV","production")
    monkeypatch.setenv("DAILY_AI_LIMIT","17")
    assert client.get("/api/v1/subscriptions/plans").json()["plans"]["free"]["ai_scans_per_day"]==17

def test_readiness_is_not_success_when_database_is_unavailable(monkeypatch):
    import sys, database
    monkeypatch.setattr(database,"verify_connection",lambda:False)
    if "main" in sys.modules: monkeypatch.setattr(sys.modules["main"],"verify_connection",lambda:False)
    response=client.get("/api/health");assert response.status_code==503 and response.headers.get("X-Request-ID")
    assert client.get("/api/live").status_code==200
