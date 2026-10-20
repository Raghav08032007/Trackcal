"""
auth.py — Authentication router: signup, login, token refresh, password reset
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter()

# ── Security setup ──────────────────────────────────────────────
SECRET_KEY = os.environ.get("APP_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Schemas ─────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    country_code: Optional[str] = "US"
    language_code: Optional[str] = "en"


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


# ── Helpers ─────────────────────────────────────────────────────

def _hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def _verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.utcnow() + expires_delta}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _create_access_token(user_id: str) -> str:
    return _create_token({"sub": user_id, "type": "access"}, timedelta(minutes=ACCESS_EXPIRE))


def _create_refresh_token(user_id: str) -> str:
    return _create_token({"sub": user_id, "type": "refresh"}, timedelta(days=REFRESH_EXPIRE))


def _decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(user_id=payload.get("sub"), token_type=payload.get("type"))
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
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
    return user


def get_current_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    return current_user


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/signup", response_model=LoginResponse, status_code=201)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user."""
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
        access_token=_create_access_token(user.id),
        refresh_token=_create_refresh_token(user.id),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email + password."""
    user = db.query(models.User).filter(
        models.User.email == form.username.lower(),
        models.User.is_active == True,
    ).first()
    if not user or not user.hashed_password or not _verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return LoginResponse(
        access_token=_create_access_token(user.id),
        refresh_token=_create_refresh_token(user.id),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


@router.post("/refresh", response_model=LoginResponse)
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

    return LoginResponse(
        access_token=_create_access_token(user.id),
        refresh_token=_create_refresh_token(user.id),
        user_id=user.id,
        email=user.email,
        role=user.role.value,
    )


@router.get("/me")
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
