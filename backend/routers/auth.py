"""
auth.py — Authentication router: signup, login, token refresh, password reset
"""
import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

from flask_app.params import Depends, HTTPException, status
from flask_app.params import OAuth2PasswordRequestForm, Request, bearer_token
import jwt
from jwt import InvalidTokenError as JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from database import get_db
import models


# ── Security setup ──────────────────────────────────────────────
SECRET_KEY = os.environ.get("APP_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ─────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: Optional[str] = Field(default=None, max_length=100)
    country_code: Optional[str] = "US"
    language_code: Optional[str] = "en"

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    token_type: Optional[str] = None
    credential: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────────

def _hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def _verify_password(raw: str, hashed: str) -> bool:
    if len(raw.encode("utf-8")) > 72:
        return False
    return pwd_context.verify(raw, hashed)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.utcnow() + expires_delta}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def credential_stamp(password: str | None) -> str:
    return hmac.new(SECRET_KEY.encode(), (password or "").encode(), hashlib.sha256).hexdigest()


def _create_access_token(user_id: str, password: str | None = None) -> str:
    return _create_token({"sub": user_id, "type": "access", **({"credential": credential_stamp(password)} if password is not None else {})}, timedelta(minutes=ACCESS_EXPIRE))


def _create_refresh_token(user_id: str, password: str | None = None) -> str:
    return _create_token({"sub": user_id, "type": "refresh", **({"credential": credential_stamp(password)} if password is not None else {})}, timedelta(days=REFRESH_EXPIRE))


def _decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(user_id=payload.get("sub"), token_type=payload.get("type"), credential=payload.get("credential"))
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(token: str = Depends(bearer_token), db: Session = Depends(get_db)) -> models.User:
    data = _decode_token(token)
    if data.token_type != "access" or not data.user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user = db.query(models.User).filter(
        models.User.id == data.user_id,
        models.User.is_active == True,
        models.User.deleted_at.is_(None),
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    check_credential(data, user)
    return user


def check_credential(data, user):
    if (data.credential is None and os.getenv("APP_ENV") == "production") or (data.credential is not None and not hmac.compare_digest(data.credential, credential_stamp(user.hashed_password))):
        raise HTTPException(401, "Session expired. Please sign in again.")


# Per-IP buckets (KI-04). Generous enough for shared networks; per-account limits still apply.
LOGIN_PER_IP = 30     # attempts per 15 minutes
SIGNUP_PER_IP = 10    # accounts per hour


def production_limit(db, action, subject, limit=5, seconds=60):
    if os.getenv("APP_ENV") == "production":
        from services.abuse_limits import consume
        consume(db, action, subject, limit, seconds)


def get_current_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    return current_user


# ── Endpoints ───────────────────────────────────────────────────

def signup(req: SignupRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user."""
    production_limit(db, "signup", req.email.lower(), 3, 3600)
    production_limit(db, "signup-ip", request.client.host or "unknown", SIGNUP_PER_IP, 3600)
    production_limit(db, "signup-global", "all", 100, 3600)
    existing = db.query(models.User).filter(models.User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=req.email.lower(),
        hashed_password=_hash_password(req.password),
        role=models.UserRole.user,
    )
    db.add(user)
    db.flush()

    profile = models.UserProfile(
        user_id=user.id,
        display_name=req.display_name or req.email.split("@")[0],
        country_code=req.country_code,
        language_code=req.language_code,
    )
    db.add(profile)

    settings = models.UserSettings(user_id=user.id)
    db.add(settings)

    subscription = models.Subscription(user_id=user.id)
    db.add(subscription)

    db.commit()
    db.refresh(user)

    return LoginResponse(
        access_token=_create_access_token(user.id, user.hashed_password),
        refresh_token=_create_refresh_token(user.id, user.hashed_password),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email + password."""
    production_limit(db, "login-ip", request.client.host or "unknown", LOGIN_PER_IP, 900)  # many accounts, one source
    production_limit(db, "login", form.username.lower())
    user = db.query(models.User).filter(
        models.User.email == form.username.lower(),
        models.User.is_active == True,
    ).first()
    if not user or not user.hashed_password or not _verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return LoginResponse(
        access_token=_create_access_token(user.id, user.hashed_password),
        refresh_token=_create_refresh_token(user.id, user.hashed_password),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token using a refresh token."""
    data = _decode_token(req.refresh_token)
    if data.token_type != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    user = db.query(models.User).filter(
        models.User.id == data.user_id, models.User.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    check_credential(data, user)

    return LoginResponse(
        access_token=_create_access_token(user.id, user.hashed_password),
        refresh_token=_create_refresh_token(user.id, user.hashed_password),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


def me(current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Return authenticated user profile."""
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "email_verified": current_user.email_verified,
        "is_minor": current_user.is_minor,
        "profile": {
            "display_name": profile.display_name if profile else None,
            "country_code": profile.country_code if profile else "US",
            "language_code": profile.language_code if profile else "en",
            "measurement_system": profile.measurement_system if profile else "metric",
        } if profile else {},
        "created_at": current_user.created_at.isoformat(),
    }


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_bytes(cls, value):
        return SignupRequest.password_bytes(value)


def change_password(req: PasswordChange, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not user.hashed_password or not _verify_password(req.current_password, user.hashed_password):
        raise HTTPException(401, "Current password is incorrect")
    user.hashed_password = _hash_password(req.new_password)
    db.commit()
    return {"status": "Password updated. Sign in again on your devices."}


class RecoveryEmail(BaseModel):
    email: EmailStr


class ActionToken(BaseModel):
    token: str = Field(min_length=40, max_length=200)


class ResetPassword(ActionToken):
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_bytes(cls, value):
        return SignupRequest.password_bytes(value)


def issue_action(user, purpose, db):
    from services import account_mail
    try: account_mail.configuration()
    except RuntimeError: raise HTTPException(503, "Email delivery is not configured. Please contact support.")
    raw = secrets.token_urlsafe(48)
    record = models.AccountActionToken(digest=hashlib.sha256(raw.encode()).hexdigest(), user_id=user.id, purpose=purpose, credential=credential_stamp(user.hashed_password), expires_at=datetime.utcnow() + (timedelta(minutes=30) if purpose == "reset" else timedelta(hours=24)))
    db.add(record)
    db.flush()
    try: account_mail.deliver(user.email, purpose, raw)
    except Exception:
        db.rollback()
        raise HTTPException(503, "Email could not be delivered. Please try again later.")
    db.commit()


def consume_action(data, purpose, db):
    record = db.query(models.AccountActionToken).filter_by(digest=hashlib.sha256(data.token.encode()).hexdigest(), purpose=purpose).with_for_update().first()
    if not record or record.used_at or record.expires_at < datetime.utcnow():
        raise HTTPException(400, "This link is invalid or expired. Request a new one.")
    user = db.query(models.User).filter_by(id=record.user_id, is_active=True).with_for_update().first()
    if not user or user.deleted_at or not hmac.compare_digest(record.credential, credential_stamp(user.hashed_password)):
        raise HTTPException(400, "This link is invalid or expired. Request a new one.")
    record.used_at = datetime.utcnow()
    return user


def forgot_password(data: RecoveryEmail, db: Session = Depends(get_db)):
    from services import account_mail
    try: account_mail.configuration()
    except RuntimeError: raise HTTPException(503, "Email delivery is not configured. Please contact support.")
    production_limit(db, "recovery", data.email.lower(), 3, 3600)
    production_limit(db, "recovery-global", "all", 100, 3600)
    user = db.query(models.User).filter_by(email=data.email.lower(), is_active=True).first()
    if user and not user.deleted_at:
        try: issue_action(user, "reset", db)
        except HTTPException as error:
            if error.status_code != 503: raise
            import logging
            logging.getLogger("trackcal").error("recovery_delivery_failed")
    return {"status": "If an active account exists, a recovery link will be sent. Check your inbox and spam folder."}


def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    user = consume_action(data, "reset", db)
    user.hashed_password = _hash_password(data.new_password)
    db.commit()
    return {"status": "Password reset. Sign in with your new password."}


def request_verification(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    production_limit(db, "verify", str(user.id), 3, 3600)
    if user.email_verified: return {"status": "Email already verified."}
    issue_action(user, "verify", db)
    return {"status": "Verification link sent. Check your inbox and spam folder."}


def verify_email(data: ActionToken, db: Session = Depends(get_db)):
    user = consume_action(data, "verify", db)
    user.email_verified = True
    db.commit()
    return {"status": "Email verified. You can return to your account."}


def consume_ai(user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if os.getenv("APP_ENV") == "production" and not user.email_verified:
        raise HTTPException(403, "Verify your email before using AI estimates.")
    from services.abuse_limits import consume
    remaining = consume(db, "web-ai", str(user.id), int(os.getenv("DAILY_AI_LIMIT", "15")), 86400)
    return {"remaining": remaining}
