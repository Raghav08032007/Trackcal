"""
main.py — FastAPI application entry point
Global AI Food Intelligence Platform
"""
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

load_dotenv()

# ── import routers ─────────────────────────────────────────────
from routers import auth, users, foods, meal_logs, ai_scan, recipes, nutrition, subscriptions, support, community

# ── database bootstrap ─────────────────────────────────────────
from database import engine, verify_connection, Base
import models  # noqa: F401 — registers all ORM models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (dev only; production uses Alembic)
    if os.getenv("APP_ENV") == "development":
        Base.metadata.create_all(bind=engine)
    ok = verify_connection()
    if not ok:
        print("FATAL: Cannot connect to MySQL. Check your .env file and MySQL service.", file=sys.stderr)
    else:
        print("[FASTAPI] MySQL connection verified - Global Food AI Platform starting up")
    yield
    print("[FASTAPI] Shutting down Global Food AI Platform")


app = FastAPI(
    title="Global AI Food Intelligence Platform",
    description="AI-powered food and nutrition tracking API — inspired by, not copied from, Cal AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ───────────────────────────────────────────────────────
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (uploaded images in development) ───────
uploads_path = os.getenv("LOCAL_STORAGE_PATH", "./uploads")
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

# ── API Routers ────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Authentication"])
app.include_router(users.router,         prefix="/api/v1/users",         tags=["Users"])
app.include_router(foods.router,         prefix="/api/v1/foods",         tags=["Foods & Nutrition"])
app.include_router(meal_logs.router,     prefix="/api/v1/meal-logs",     tags=["Meal Logging"])
app.include_router(ai_scan.router,       prefix="/api/v1/scan",          tags=["AI Scanning"])
app.include_router(recipes.router,       prefix="/api/v1/recipes",       tags=["Recipes"])
app.include_router(nutrition.router,     prefix="/api/v1/nutrition",     tags=["Nutrition Dashboard"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(support.router,       prefix="/api/v1/support",       tags=["Support"])
app.include_router(community.router,     prefix="/api/v1/community",     tags=["Community"])


@app.get("/api/health", tags=["Health"])
async def health():
    db_ok = verify_connection()
    return JSONResponse({
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "version": "1.0.0",
        "environment": os.getenv("APP_ENV", "production"),
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
