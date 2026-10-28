# TrackCal inventory — Phase 1 baseline, 28 October 2026

Generated from the running code, not from earlier reports: the FastAPI OpenAPI schema, the SQLAlchemy metadata, the Next.js build output and source scans. Regenerate after any route, table or setting change.

> **Update, 28 October 2026:** the backend now runs on Flask. All 112 endpoints keep the same methods, paths and no-session responses (TEST_REPORT_MIGRATION_BACKEND.md); `/api/docs`, `/api/redoc` and `/api/openapi.json` were removed with FastAPI. A `feature_flags` table (58 tables) and Alembic's `alembic_version` were added.

## Summary

| Item | Count | Source |
|---|---|---|
| Web pages (Next.js App Router) | 27 | `frontend/web/src/app/**/page.tsx`, confirmed by `next build` |
| Web server routes (Next.js `app/api`) | 10 | `frontend/web/src/app/api/**/route.ts` |
| Backend API endpoints (documented) | 113 | `app.openapi()` |
| Backend endpoints outside the schema | 2 | `GET /api/live`, `/uploads` static mount (disabled when `APP_ENV=production`) |
| Database tables | 57 | `Base.metadata` and the live `global_food_ai` schema (no drift, see TEST_REPORT_P1.md) |
| Scheduled background jobs | 0 | No in-process scheduler or worker. See "Jobs and scripts" |

## Web pages

- `/`
- `/account`
- `/barcode`
- `/describe`
- `/food-library`
- `/forgot-password`
- `/guide`
- `/help`
- `/journal`
- `/login`
- `/nutrition`
- `/offline`
- `/onboarding`
- `/plan`
- `/play`
- `/privacy`
- `/progress`
- `/recipes`
- `/reset-password`
- `/routine`
- `/scanner`
- `/signup`
- `/terms`
- `/tools`
- `/verify-email`
- `/workouts`
- `/workouts/camera`

## Web server routes

Next.js server routes that proxy the backend with HttpOnly cookies or call external services directly. All mutating routes check the request origin.

| Route | Purpose |
|---|---|
| `/api/account/[action]` | Session, signup, login, logout, profile, password, backup, export, recovery, verification, closure (proxies `/auth` and `/users`) |
| `/api/adventure/[action]` | XP, quests, companion settings (proxies `/adventure`) |
| `/api/analyze` | AI meal photo/text estimate. Calls OpenRouter **directly from the web server**. Disabled in production unless `ENABLE_LOCAL_AI` or `ENABLE_AUTHENTICATED_AI` is set |
| `/api/barcode` | Barcode lookup. Calls Open Food Facts directly |
| `/api/coaching/[action]` | Coach slots and bookings (proxies `/coaching`) |
| `/api/foods` | USDA FoodData Central search. Calls USDA directly |
| `/api/health` | Web and backend readiness |
| `/api/personalization/[...path]` | Onboarding, measurements, plans (proxies `/personalization`) |
| `/api/tools/[action]` | Recipe import, OCR, Whisper, pantry, prices (proxies `/integrations`) |
| `/api/wellness/[...path]` | Cloud diary, saved meals, workouts (proxies `/wellness`) |

## Backend API endpoints

Status = response to a request with **no session** (probe in TEST_REPORT_P1.md). 401 = authentication required; 422 = public endpoint that rejected the empty body; 200 = public.

| No-session status | Method | Path | Tag |
|---|---|---|---|
| 200 | GET | `/api/health` | Health |
| 401 | POST | `/api/v1/adventure/companion-settings` | Habit adventure |
| 401 | POST | `/api/v1/adventure/game/start` | Habit adventure |
| 401 | POST | `/api/v1/adventure/game/submit` | Habit adventure |
| 401 | POST | `/api/v1/adventure/initialize` | Habit adventure |
| 401 | POST | `/api/v1/adventure/rest-day` | Habit adventure |
| 401 | POST | `/api/v1/adventure/review-meal` | Habit adventure |
| 401 | POST | `/api/v1/adventure/review-workout` | Habit adventure |
| 401 | GET | `/api/v1/adventure/summary` | Habit adventure |
| 401 | POST | `/api/v1/auth/consume-ai` | Authentication |
| 422 | POST | `/api/v1/auth/forgot-password` | Authentication |
| 422 | POST | `/api/v1/auth/login` | Authentication |
| 401 | GET | `/api/v1/auth/me` | Authentication |
| 401 | POST | `/api/v1/auth/password` | Authentication |
| 422 | POST | `/api/v1/auth/refresh` | Authentication |
| 401 | POST | `/api/v1/auth/request-verification` | Authentication |
| 422 | POST | `/api/v1/auth/reset-password` | Authentication |
| 422 | POST | `/api/v1/auth/signup` | Authentication |
| 422 | POST | `/api/v1/auth/verify-email` | Authentication |
| 401 | GET | `/api/v1/coaching/bookings` | Coach appointments |
| 401 | POST | `/api/v1/coaching/bookings` | Coach appointments |
| 401 | PATCH | `/api/v1/coaching/bookings/{booking_id}` | Coach appointments |
| 401 | DELETE | `/api/v1/coaching/bookings/{booking_id}` | Coach appointments |
| 401 | GET | `/api/v1/coaching/coaches` | Coach appointments |
| 401 | POST | `/api/v1/coaching/slots` | Coach appointments |
| 401 | GET | `/api/v1/coaching/slots` | Coach appointments |
| 401 | DELETE | `/api/v1/coaching/slots/{slot_id}` | Coach appointments |
| 401 | POST | `/api/v1/community` | Community |
| 401 | GET | `/api/v1/community/mine` | Community |
| 401 | GET | `/api/v1/foods/barcode/{barcode}` | Foods & Nutrition |
| 401 | POST | `/api/v1/foods/custom` | Foods & Nutrition |
| 401 | GET | `/api/v1/foods/custom/mine` | Foods & Nutrition |
| 401 | GET | `/api/v1/foods/search` | Foods & Nutrition |
| 401 | GET | `/api/v1/foods/{food_id}` | Foods & Nutrition |
| 401 | GET | `/api/v1/integrations/exercises` | Open-source integrations |
| 401 | GET | `/api/v1/integrations/grocy` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/ingredients` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/label` | Open-source integrations |
| 401 | GET | `/api/v1/integrations/mealie` | Open-source integrations |
| 401 | GET | `/api/v1/integrations/mealie-recipe` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/plan` | Open-source integrations |
| 401 | GET | `/api/v1/integrations/prices` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/recipe-import` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/shopping` | Open-source integrations |
| 401 | GET | `/api/v1/integrations/status` | Open-source integrations |
| 401 | POST | `/api/v1/integrations/transcribe` | Open-source integrations |
| 401 | POST | `/api/v1/meal-logs` | Meal Logging |
| 401 | GET | `/api/v1/meal-logs` | Meal Logging |
| 401 | GET | `/api/v1/meal-logs/{log_id}` | Meal Logging |
| 401 | DELETE | `/api/v1/meal-logs/{log_id}` | Meal Logging |
| 401 | POST | `/api/v1/meal-logs/{log_id}/copy` | Meal Logging |
| 401 | PATCH | `/api/v1/meal-logs/{log_id}/items/{item_id}/confirm` | Meal Logging |
| 401 | GET | `/api/v1/nutrition/coach/recommend-fill` | Nutrition Dashboard |
| 401 | GET | `/api/v1/nutrition/daily` | Nutrition Dashboard |
| 401 | GET | `/api/v1/nutrition/trends` | Nutrition Dashboard |
| 401 | POST | `/api/v1/nutrition/water` | Nutrition Dashboard |
| 401 | GET | `/api/v1/nutrition/weekly` | Nutrition Dashboard |
| 401 | POST | `/api/v1/personalization/activities/{identifier}` | Personal wellness |
| 401 | POST | `/api/v1/personalization/education` | Personal wellness |
| 401 | POST | `/api/v1/personalization/measurements` | Personal wellness |
| 401 | DELETE | `/api/v1/personalization/measurements/{identifier}` | Personal wellness |
| 401 | POST | `/api/v1/personalization/onboarding` | Personal wellness |
| 401 | POST | `/api/v1/personalization/plans` | Personal wellness |
| 401 | POST | `/api/v1/personalization/plans/{identifier}` | Personal wellness |
| 401 | GET | `/api/v1/personalization/reminders` | Personal wellness |
| 401 | POST | `/api/v1/personalization/reminders/{identifier}` | Personal wellness |
| 401 | GET | `/api/v1/personalization/state` | Personal wellness |
| 401 | GET | `/api/v1/recipes` | Recipes |
| 401 | POST | `/api/v1/recipes` | Recipes |
| 401 | GET | `/api/v1/recipes/{recipe_id}` | Recipes |
| 401 | DELETE | `/api/v1/recipes/{recipe_id}` | Recipes |
| 422 | POST | `/api/v1/scan/adjust-cooking-style` | AI Scanning |
| 401 | GET | `/api/v1/scan/barcode/{barcode_value}` | AI Scanning |
| 401 | POST | `/api/v1/scan/corrections` | AI Scanning |
| 401 | DELETE | `/api/v1/scan/images/{image_id}` | AI Scanning |
| 401 | GET | `/api/v1/scan/jobs/{job_id}` | AI Scanning |
| 401 | POST | `/api/v1/scan/photo` | AI Scanning |
| 401 | POST | `/api/v1/scan/text` | AI Scanning |
| 401 | POST | `/api/v1/subscriptions/cancel` | Subscriptions |
| 401 | GET | `/api/v1/subscriptions/history` | Subscriptions |
| 200 | GET | `/api/v1/subscriptions/plans` | Subscriptions |
| 401 | GET | `/api/v1/subscriptions/status` | Subscriptions |
| 401 | GET | `/api/v1/support` | Support |
| 401 | POST | `/api/v1/support` | Support |
| 401 | GET | `/api/v1/support/{ticket_id}` | Support |
| 401 | DELETE | `/api/v1/users/account` | Users |
| 401 | GET | `/api/v1/users/export` | Users |
| 401 | POST | `/api/v1/users/onboarding/calculate-plan` | Users |
| 401 | GET | `/api/v1/users/profile` | Users |
| 401 | PATCH | `/api/v1/users/profile` | Users |
| 401 | GET | `/api/v1/users/settings` | Users |
| 401 | PATCH | `/api/v1/users/settings` | Users |
| 401 | GET | `/api/v1/users/workspace` | Users |
| 401 | PUT | `/api/v1/users/workspace` | Users |
| 401 | GET | `/api/v1/wellness/diary` | Cloud nutrition |
| 401 | POST | `/api/v1/wellness/diary` | Cloud nutrition |
| 401 | PUT | `/api/v1/wellness/diary/{identifier}` | Cloud nutrition |
| 401 | DELETE | `/api/v1/wellness/diary/{identifier}` | Cloud nutrition |
| 401 | GET | `/api/v1/wellness/exercises` | Workout sessions |
| 401 | GET | `/api/v1/wellness/exercises/{identifier}` | Workout sessions |
| 401 | POST | `/api/v1/wellness/favorites` | Cloud nutrition |
| 401 | DELETE | `/api/v1/wellness/favorites/{identifier}` | Cloud nutrition |
| 401 | GET | `/api/v1/wellness/foods` | Cloud nutrition |
| 401 | GET | `/api/v1/wellness/foods/{identifier}` | Cloud nutrition |
| 401 | POST | `/api/v1/wellness/saved-meals` | Cloud nutrition |
| 401 | DELETE | `/api/v1/wellness/saved-meals/{identifier}` | Cloud nutrition |
| 401 | POST | `/api/v1/wellness/sessions` | Workout sessions |
| 401 | GET | `/api/v1/wellness/sessions/{identifier}` | Workout sessions |
| 401 | PUT | `/api/v1/wellness/sessions/{identifier}` | Workout sessions |
| 401 | DELETE | `/api/v1/wellness/sessions/{identifier}` | Workout sessions |
| 401 | POST | `/api/v1/wellness/templates` | Workout sessions |
| 401 | DELETE | `/api/v1/wellness/templates/{identifier}` | Workout sessions |
| 401 | GET | `/api/v1/wellness/training` | Workout sessions |

## Database tables (57)

`account_action_tokens`, `achievements`, `activity_plans`, `activity_reward_events`, `adventure_meals`, `adventure_profiles`, `ai_predictions`, `ai_scan_jobs`, `allergens`, `audit_logs`, `auth_identities`, `barcodes`, `brands`, `character_customizations`, `character_unlocks`, `coach_bookings`, `coach_slots`, `community_submissions`, `consent_records`, `custom_foods`, `food_aliases`, `food_corrections`, `food_favorites`, `food_images`, `food_nutrients`, `food_search_history`, `food_translations`, `foods`, `game_sessions`, `gamification_rules`, `meal_items`, `meal_logs`, `nutrient_definitions`, `payments`, `personalization_profiles`, `plan_activities`, `rate_buckets`, `recipe_ingredients`, `recipes`, `recommendation_history`, `reminder_deliveries`, `reward_events`, `saved_meals`, `streak_records`, `subscriptions`, `support_tickets`, `user_achievements`, `user_allergens`, `user_devices`, `user_profiles`, `user_settings`, `user_workspaces`, `users`, `water_entries`, `wellness_measurements`, `workout_blueprints`, `workout_sessions`


## Jobs and scripts

There is no scheduler. Everything below runs only when someone starts it.

| Item | Trigger | Purpose |
|---|---|---|
| `backend/scripts/maintain_security.py` | Manual / external cron | Deletes expired action tokens and rate buckets |
| `backend/scripts/bootstrap_schema.py` | Release job | Additive `create_all` and gamification rule seed |
| `backend/scripts/migrate_*.py` | Release job | Seed achievements/rules for camera, gamification, personalization, wellness |
| `backend/scripts/dry_run_migrations.py` | Manual | Phase 1 migration dry run on the disposable test schema |
| `infrastructure/backup.sh`, `restore-check.sh` | Manual / cron (Docker host) | SQL backup and disposable restore check |
| `frontend/web/public/backup-sync.js` | Browser: startup, reconnect, focus, every minute, Background Sync | Upload explicitly queued workspace snapshots |
| `frontend/web/public/pose-worker.js` | Browser web worker, camera page only | On-device pose inference |

## Feature flags

| Flag | Where | Default | Effect |
|---|---|---|---|
| `ENABLE_LOCAL_AI` | Web env | off | Allows unauthenticated `/api/analyze` in production. **Do not enable publicly** |
| `ENABLE_AUTHENTICATED_AI` | Web env | off | Production `/api/analyze` through an authenticated backend quota |
| `AI_MOCK_MODE` | Backend env | off | Mock scan results. Production startup refuses it |
| `gamification_rules.enabled` | Database rows | per rule | Turns individual XP producers on/off. `community_contribution`, `verified_event_attendance`, `verified_challenge_completion` are off |

There is no general per-module feature-flag system yet; your Master Rule 8 requires one for every new module.

## Environment variables

Backend (read by code): `ACCESS_TOKEN_EXPIRE_MINUTES`, `AI_MOCK_MODE`, `APP_ENV`, `APP_SECRET_KEY`, `CORS_ORIGINS`, `DAILY_AI_LIMIT`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `DB_USER`, `GEMINI_API_KEY`, `INTEGRATION_OWNER_ID`, `JWT_ALGORITHM`, `KEEP_BROWSER_QA`, `LOCAL_STORAGE_PATH`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPEN_FOOD_FACTS_APP_NAME`, `OPEN_FOOD_FACTS_APP_VERSION`, `PADDLEOCR_URL`, `PUBLIC_APP_URL`, `REFRESH_TOKEN_EXPIRE_DAYS`, `RUN_LIVE_ADVENTURE`, `RUN_LIVE_COACHING`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PASSWORD`, `SMTP_PORT`, `SMTP_SSL`, `SMTP_USER`, `USDA_API_KEY`, `WGER_URL`, `WHISPER_URL`, plus `GROCY_URL`, `GROCY_API_KEY`, `MEALIE_URL`, `MEALIE_API_KEY` from `.env.production.example`.

Web: `BACKEND_API_URL`, `PUBLIC_APP_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `USDA_API_KEY`, `ENABLE_LOCAL_AI`, `ENABLE_AUTHENTICATED_AI`, `NODE_ENV`.

Names only; no values were read or recorded.
