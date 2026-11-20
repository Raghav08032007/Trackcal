# TrackCal

TrackCal is a nutrition, fitness and wellbeing app for phone and laptop. You can log food by photo, barcode or search,
track workouts with the camera and GPS, build healthy habits with games and friends, and use it in 10 languages.

The web app is built with Vite, React 19 and React Router. The API runs on Flask with MySQL 8.0.

---

## What it does

**Today**
- Three daily tasks based on your own data, and a fair streak (one missed day a week is forgiven; planned rest days count).
- A Health Score, coach lines, a recovery check-in, water, sleep and calories burned.

**Food**
- 542 Indian foods from IFCT 2017 and 90 everyday cooked dishes (dal, roti, idli, biryani, chai...) calculated from them,
  with katori and roti portions and local names.
- A food diary, food search with real portions, an AI photo scanner and "describe a meal".
- Barcode scanning with allergen warnings.
- Recipes: import, studio and library. A menu picker, a meal planner, pantry, shopping lists and price checks.
- Label reading, voice input, daily targets from your profile, and fasting.
- An offline journal that works without internet.

**Move**
- Camera workouts that count reps on your device. Video is never recorded or uploaded.
- A spoken voice coach, holds, choosing by muscle group, a workout builder and programs.
- GPS recording, routes, activities with privacy zones, and timed segments.
- Weekly effort (MET-minutes), a fitness trend, a recovery map, workout history and safety checks for injuries.

**Play**
- Quests, XP, levels, badges, Pip's garden and six companion characters.
- Label Detective and camera sports games: skip rope, shadow boxing, cricket drive and badminton smash.
- Challenges, a feed with posts, kudos and comments, communities, and events with QR-code check-in.
- An accuracy report for the team (`/accuracy`): AI photo calories against what people kept, camera rep counts against corrections, and barcode coverage, from corrections people already make.
- Reporting and moderation: a word screen that holds hurtful or self-harm posts for review (with a helpline), flagged challenge entries, ban appeals to TrackCal, and an overview of how each community is moderated. People get notified of new followers, comments and kudos (opt-in, bundled).

**Me**
- An 8-step onboarding, account and security, history export and import, and account closure (data is erased after 30 days).
- A blood-report reader that shapes the diet and exercise plan.
- Progress and training load, push notifications and reminders, and an optional Monday summary email.
- Premium through Razorpay (₹99 a month or ₹799 a year, with a free trial), coach booking, help and a guided test drive.
- A trainer dashboard (`/coach/clients`, flag `organizer_saas`): a client enters a coach's one-time code and chooses what
  to share (daily food totals, workouts, weight); the coach sees 7- and 14-day summaries of only that; either side can stop.

**Everywhere**
- Works on phone and laptop, with light and dark mode, Comfort mode and reduced motion.
- Languages: English, हिन्दी, বাংলা, मराठी, తెలుగు, தமிழ், Español, Português (Brasil), Bahasa Indonesia and العربية
  (right to left), plus ಕನ್ನಡ and മലയാളം for the main screens (wave 2, in phases). The translations are drafts waiting
  for review by native speakers.
- Ctrl+K search, a "+" quick add from anywhere, and account sync.

---

## Folders

```text
track-cal/
├── backend/            Flask API: routers/, services/, models.py, alembic/ (migrations), i18n/ (server translations), tests/
├── frontend/web/       Vite + React web app: src/, public/ (offline journal, service worker), scripts/i18n/ (translation tables), tests/
├── frontend/mobile/    Early Expo prototype
├── infrastructure/     Caddy, backups and the operations guide
├── tools/              Local helpers (scheduler tick, benchmarks)
└── docs/               Architecture, release checklist, known issues, languages and more
```

---

## Running it locally

### 1. API (Flask and MySQL 8.0)

Create `backend/.env`. It is git-ignored, so never commit it.

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=global_food_ai
AI_MOCK_MODE=true
```

```bash
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe seed_data.py
.venv\Scripts\python.exe scripts\seed_ifct.py               # 542 Indian foods (IFCT 2017)
.venv\Scripts\python.exe scripts\seed_standard_recipes.py   # 90 cooked dishes calculated from them
.venv\Scripts\python.exe -m flask --app "flask_app:create_app()" run --port 8000 --debug
```

### 2. Web app

```bash
cd frontend/web
npm install
npm run dev
```

Open http://127.0.0.1:3000. The dev server forwards `/api` to the API on port 8000 (set `TRACKCAL_API_URL` to change it).
`npm run build` writes the app to `dist/`, and `npm run preview` serves that build.

### 3. Optional services

- **AI estimates:** set `OPENROUTER_API_KEY` in `backend/.env`. Keep keys on the server and never in a `VITE_` variable.
- **Email:** set the SMTP settings, or use `MAIL_OUTBOX=runtime/outbox` while developing.
- **Payments:** Razorpay keys, Test Mode first.
- **Reminders and notifications:** run `backend/.venv/Scripts/python tools/tick.py` locally (production calls `POST /internal/tick` every minute).

Details: [docs/GO_LIVE_KEYS.md](docs/GO_LIVE_KEYS.md) and [docs/INTEGRATIONS_IMPLEMENTATION.md](docs/INTEGRATIONS_IMPLEMENTATION.md).

---

## Tests

```bash
cd frontend/web && npm test          # web tests (about 950)
cd backend && .venv\Scripts\python.exe -m pytest tests -q   # API tests (rollback-only transactions on a test database)
```

### Measuring rep counting on real people

Volunteers open `/workouts/camera/lab`, record one set and enter how many reps they really did. The page saves a file
with body points only (no video, no name) to their own device. Put the files you receive in `recordings/` at the repo
root (git ignores it) and run:

```bash
cd frontend/web
npm run rep-eval      # share of sets within ±1 rep per exercise; the target is 90%
```

---

## Translations

Texts are written in English and wrapped in `t("...")`. The translations live in tables, one row per text and one column
per language: `frontend/web/scripts/i18n/` for the web app and `backend/i18n/tables/` for the server. Rebuild with the
`build.py` next to them. A test fails if any text is missing in any language. See [docs/LANGUAGES.md](docs/LANGUAGES.md).

---

## What's next (future work)

New to the project? Read [docs/HANDOFF.md](docs/HANDOFF.md) first. It gives the exact files and the order.

### 1. Languages

The web app and the server's messages, emails and notifications are translated into all 9 wave-1 languages (see
[docs/LANGUAGES.md](docs/LANGUAGES.md)). What remains is review by native speakers, plus clinical review of the health
texts and legal review of the privacy notice and terms.

### 2. Features still to build

- A report button for events, and checks on event locations.
- Event reminder notifications, and a billing reminder before a trial ends.
- Ranking, paging and spam controls for the Discover feed as it grows.
- A lighter pose model for low-end phones.
- Faster first load on slow mobile connections (Lighthouse mobile is 62–82 today).
- Wave-2 languages (for example French, German, Turkish, Vietnamese, Japanese and Russian), once wave 1 is reviewed.

### 3. Checks on real devices and real services

- Measure rep-counting accuracy with real people and phones (it is labelled "Experimental" until then).
- Confirm push notifications arrive on a real phone after the app has been closed for hours.
- Make a real Razorpay payment in Test Mode, then in Live Mode.
- Review every language with a native speaker, and the privacy notice and terms with a lawyer in each language.

### 4. Owner decisions before launch

- The rules for under-18 users in the public feed and communities (India's DPDP Act needs verifiable parental consent).
- GST, terms of sale and a refund policy (Razorpay Live needs them).
- Who handles moderation reports, and how fast.
- A paid or private AI model for meal photos (free models may log what they receive).

---

## Going live

Follow [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md): host and domain, production settings, keys, the database
update, backups, the every-minute scheduler, an uptime monitor and a live smoke test. Known limits are listed in
[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

Where the work stands right now: [docs/HANDOFF.md](docs/HANDOFF.md).

---

## Privacy and credits

- Camera workouts run on your device. Meal photos are shrunk and stripped of location data before AI analysis, and are not stored.
- Food photos are from Wikimedia Commons under CC licences; see the in-app credits page and [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
