"""
main.py — FastAPI application entry point
Global AI Food Intelligence Platform
"""
import os
import sys
import time
import uuid
import logging
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

load_dotenv()
logger = logging.getLogger("trackcal")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

# ── import routers ─────────────────────────────────────────────
from routers import auth, users, foods, meal_logs, ai_scan, recipes, nutrition, subscriptions, support, community, integrations, coaching

# ── database bootstrap ─────────────────────────────────────────
from database import engine, verify_connection, Base
import models  # noqa: F401 — registers all ORM models


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.production_config import validate_production
    validate_production()
    # Create all tables on startup (dev only; production uses Alembic)
    if os.getenv("APP_ENV") == "development":
        Base.metadata.create_all(bind=engine)
    ok = verify_connection()
    if not ok:
        raise RuntimeError("Cannot connect to MySQL. Check the server configuration.")
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
if os.getenv("APP_ENV") != "production":
    app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.middleware("http")
async def request_observability(request, call_next):
    request_id = str(uuid.uuid4())
    start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception as error:
        logger.error(json.dumps({"event":"request_failed","request_id":request_id,"exception_type":type(error).__name__}))
        response = JSONResponse({"detail": "An unexpected error occurred. Please contact support with the request ID.", "request_id": request_id}, status_code=500)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    logger.info(json.dumps({"event":"request","request_id":request_id,"method":request.method,"status":response.status_code,"duration_ms":round((time.monotonic() - start) * 1000)}))
    return response

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
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Open-source integrations"])
from routers import adventure
app.include_router(adventure.router, prefix="/api/v1/adventure", tags=["Habit adventure"])
app.include_router(coaching.router, prefix="/api/v1/coaching", tags=["Coach appointments"])


@app.get("/api/health", tags=["Health"])
async def health():
    db_ok = verify_connection()
    return JSONResponse({
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "version": "1.0.0",
        "environment": os.getenv("APP_ENV", "production"),
    }, status_code=200 if db_ok else 503)


@app.get("/api/live", include_in_schema=False)
async def live():
    return {"status": "alive"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

from routers import personalization
app.include_router(personalization.router,prefix="/api/v1/personalization",tags=["Personal wellness"])

from routers import cloud_nutrition,training
app.include_router(cloud_nutrition.router,prefix="/api/v1/wellness",tags=["Cloud nutrition"])
app.include_router(training.router,prefix="/api/v1/wellness",tags=["Workout sessions"])
