# TrackCal AI — Global AI Food Intelligence Platform

An original, production-grade AI-powered nutrition and food tracking platform inspired by the state of the art in calorie and food intelligence (Cal AI).

---

## 🚀 Key Features & Capabilities

- **AI Photo Food Scanner**: Real-time multi-component segmentation, 3D volumetric depth heuristics, and confidence scoring.
- **Dynamic Portion Adjustment**: Real-time gram adjustment slider with automatic macro recalculation (Calories, Protein, Carbohydrates, Fat).
- **Explainable AI Breakdown**: Plate coverage percentage, density index, and allergen alerts (EU 14 & FDA allergen classes).
- **Global Food Database**: 49+ pre-seeded regional items across Indian, Japanese, Mediterranean, Mexican, and Western cuisines, backed by USDA FoodData Central and Open Food Facts schemas.
- **Meal Journal & Daily Targets**: Multi-meal categorization (Breakfast, Lunch, Dinner, Snack) with circular macro target rings and habit streak counters.
- **Hydration Tracker**: Instant water intake logger with daily hydration goal monitoring.
- **Cross-Platform Experience**:
  - Web client powered by **Vite + React 19 + React Router + Tailwind CSS** (a static app; the Flask API serves its `/api/*` routes).
  - Mobile client powered by **React Native & Expo**.
  - Backend powered by **Flask & MySQL 8.0**, with versioned Alembic migrations.

---

## 📂 Repository Structure

```text
track-cal/
├── backend/
│   ├── flask_app/           # Flask app factory, middleware, blueprints and request binding
│   ├── alembic/             # Versioned, reversible schema migrations
│   ├── database.py          # SQLAlchemy engine, pool & session factory
│   ├── models.py            # Complete MySQL 8.0 relational data models
│   ├── seed_data.py         # 49 global food seeds, 16 nutrients, 14 allergens
│   ├── routers/
│   │   ├── ai_scan.py       # Vision AI scanner (photo, text, barcode)
│   │   ├── auth.py          # JWT authentication & bcrypt password hashing
│   │   ├── foods.py         # Nutrition search & allergen filters
│   │   ├── meal_logs.py     # Meal logging timeline
│   │   ├── nutrition.py     # Aggregated analytics & deficit tracker
│   │   ├── recipes.py       # Custom user recipes & yield factors
│   │   ├── subscriptions.py # Free vs. Pro tier billing & quota limits
│   │   ├── users.py         # User profiles & nutritional goals
│   │   └── support.py       # Ticketing & crowdsourced submissions
│   └── requirements.txt
├── frontend/
│   ├── web/                 # Vite + React web app
│   └── mobile/              # React Native / Expo Mobile App
└── docs/
    └── ARCHITECTURE.md      # Full engineering architecture specification
```

---

## 🛠️ Getting Started

### 1. Backend Setup (Flask & MySQL 8.0)

1. Make sure MySQL 8.0 is running and configure `.env` in `backend/.env`:
   ```ini
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=foodai_app
   DB_PASSWORD=your_password
   DB_NAME=global_food_ai
   AI_MOCK_MODE=true
   ```

2. Create the schema (versioned Alembic migrations), then seed global nutrition records:
   ```bash
   cd backend
   .venv\Scripts\python.exe scripts/bootstrap_schema.py
   .venv\Scripts\python.exe seed_data.py
   ```

3. Launch the Flask API:
   ```bash
   .venv\Scripts\python.exe -m flask --app "flask_app:create_app()" run --port 8000 --debug
   ```
   The endpoint list is in [docs/INVENTORY.md](docs/INVENTORY.md). Production runs the same app under gunicorn (`backend/Dockerfile`).

---

### 2. Web App Setup (Vite)

Start the Flask API first (step 1, port 8000), then:

```bash
cd frontend/web
npm install
npm run dev
```
Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The dev server proxies `/api` to the API on port 8000 (set `TRACKCAL_API_URL` to change it), so sign-in cookies work as in production. `npm run build` writes the static app to `dist/`; `npm run preview` serves that build with the same proxy.

---

### 3. Mobile App Setup (React Native / Expo)

```bash
cd frontend/mobile
npm install
npx expo start
```
Scan the QR code with the Expo Go app on iOS or Android to test the native mobile camera scanner.

---

## Local web mode (2026-10-20)

AI estimates and browser-local tracking do not need MySQL, but they do need the Flask API running:

1. In `backend/.env`, set `OPENROUTER_API_KEY`, and optionally `OPENROUTER_MODEL` (one model or a comma-separated fallback list; the default is two named free vision models). Do not use `openrouter/free`: it picks any free model, including ones that cannot read food. The key stays on the server; never give it a `VITE_` prefix, which would publish it in the browser bundle. `frontend/web/.env.local` is no longer read and can be deleted.
2. Start the API, then run `npm install` and `npm run dev` in `frontend/web`.
3. Upload a meal or nutrition-label photo, describe a meal, scan/type a barcode, or use manual entry in Journal & Coach.

Journals, goals, the recipe draft, water, steps, activity and dated weight values are stored in the current browser. This is not account/cloud synchronization. Export all local data as JSON from the journal before clearing storage. Free AI models have provider availability/rate limits; failures are visible and never converted into fabricated meal results by the new web inference route. Manual tracking remains available without AI. Product nutrition comes from Open Food Facts with editable gram portions.

The new local inference endpoint is disabled in production by default. `ENABLE_LOCAL_AI=true` permits private production-mode testing; public deployment requires authenticated access and durable rate limits. The backend API routes and mobile client remain separate and need integration testing.

See [feature audit](docs/CAL_AI_FEATURE_AUDIT.md), [implementation and verification](docs/IMPLEMENTATION_STATUS.md), and [third-party notices](docs/THIRD_PARTY_NOTICES.md).

## Feature tests

The current web and backend feature checks are documented in [FEATURE_TEST_REPORT.md](docs/FEATURE_TEST_REPORT.md). Run `npm test`, `npm run build` and `npm run lint` from `frontend/web`; run `.venv\Scripts\python.exe -m pytest tests -q` from `backend`. Backend tests use rollback-only database transactions and need the existing schema and seed data. The local Python environment is in `backend/.venv`.

Live USDA search is available in Food Library; an optional server-only `USDA_API_KEY` raises the limits above the public demo key. Barcode lookup and AI provider failures remain visible, and manual logging remains available offline.

## Architectural Note on REA (Reverse Engineer Anything)

- REA was used to inspect Cal AI's public rendered website for a bounded feature audit. No Cal AI mobile binary, authenticated flow, proprietary code or private dataset was inspected or copied.
- TrackCal is built as an original, greenfield clean-room platform using standard open web and mobile frameworks and public nutrition datasets.

Smart tools: recipe import, constrained meal planning, pantry/shopping, label OCR, local speech, workout discovery and IndexedDB recovery. See [integration setup and verification](docs/INTEGRATIONS_IMPLEMENTATION.md).

Nutrition routines: `/routine` adds recurring calendar reminders, approved-coach booking/rescheduling/cancellation, reviewed food-history CSV imports and workspace appearance preferences. See [Cal product research, repository shortlist and verification](docs/CAL_PRODUCTS_RESEARCH_20261022.md) for implementation boundaries and setup.

CSV history export now completes the meal interchange workflow with date filtering, workspace isolation and spreadsheet formula protection. See the [23 October follow-up](docs/CAL_PRODUCTS_FOLLOWUP_20261023.md) for refreshed REA evidence, verification and remaining release work.

Latest readiness work: [26 October execution record](docs/READINESS_EXECUTION_20261026.md) covers REA verification, production configuration validation, truthful subscription capabilities, authentication timeouts, source packaging and the configuration preflight.

Latest full verification: [live workflow and browser results](docs/FULL_VERIFICATION_20261026.md), including runtime repairs and explicit blocked/unverified features.

Production readiness: see [readiness plan](docs/PRODUCT_READINESS_PLAN.md), [verification and launch gates](docs/RELEASE_READINESS_RESULTS.md), [security review](docs/SECURITY_REVIEW.md), and [operations](infrastructure/OPERATIONS.md). Production API dependencies use backend/requirements-production.txt plus backend/requirements-integrations.txt. Deployment and SMTP configuration remain deferred.

TrackCal Play: `/play` adds original mascot-led quests, server-owned XP, streaks, badges and Label Detective. See [implementation, migration and verification](docs/GAMIFICATION_IMPLEMENTATION_20261027.md) for delivered scope and remaining work.

Daily progress: home now puts nutrition references, daily quests, completed-day streaks and level-based companion unlocks first. See [release verification and product assessment](docs/DAILY_PROGRESS_AND_MARKET_REVIEW_20261027.md).

Barcode reliability: camera selection, high-resolution preference, supported focus/zoom and local barcode-photo decoding now provide recovery paths when live detection fails. See [scanner verification and paid-launch acceptance gates](docs/BARCODE_RELIABILITY_20261027.md).

TrackCal 4.0 Phase 0: see [current state](docs/CURRENT_STATE.md), [UI depth design and verification](docs/UI_UX_REDESIGN.md), and [phased architecture plan](docs/PHASED_IMPLEMENTATION.md). Existing characters are preserved; future product modules remain proposals.

Phase delivery gates: read [GLOBAL_UX_REQUIREMENTS.md](docs/GLOBAL_UX_REQUIREMENTS.md) for the user's cross-phase typography, accessibility, motion and positive-engagement requirements. Preserve existing features, run previous regressions, and append limitations at every handoff.


Phase 4 camera tracking: see [implementation](docs/PHASE_4_IMPLEMENTATION.md), [privacy](docs/CAMERA_PRIVACY.md), [pose architecture](docs/POSE_ESTIMATION_ARCHITECTURE.md) and [rep engine](docs/REP_COUNTING_ENGINE.md). Frontend `npm run prepare:pose` prepares checksum-pinned local model/WASM assets (also predev/prebuild). Apply `backend/scripts/migrate_camera.py` for missing central achievement definitions; no new session table. Physical-device/accuracy acceptance remains separate; no Phase 5 is started.


SaaS readiness: [scorecard and launch plan](docs/SAAS_LAUNCH_ASSESSMENT_20261028.md) rates the product dimension by dimension and lists every step to publish.

TrackCal Studio redesign: [design and test notes](docs/STUDIO_REDESIGN_20261028.md). Open `/guide` for the interactive user test drive. Appearance and global Reduce motion controls are in the footer.
