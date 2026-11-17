# Handoff: where the work stands (17 November 2026)

Read this first in a new session, then `docs/LANGUAGES.md`, `docs/RELEASE_CHECKLIST.md` and `docs/GO_LIVE_KEYS.md`.

## Done and committed (local git only, nothing pushed)

- Product phases 1–10 and D–I (food, Move and camera workouts, Play and social, Me, billing, push, email, release prep).
- Languages, steps 1–7: the whole web app in hi, bn, mr, te, ta, es, pt (Brazil), id and ar (right to left), 4,505
  texts each, plus tab titles and the offline journal.

## In progress: step 8, the server's messages in the person's language

Groundwork committed in "wip(i18n): step 8 groundwork":
- `backend/services/i18n.py`: `tr()`, `tr_n()` (plurals), `msg()` (marks texts in data tables), and `number()` (digits
  styled like the browser's). The language comes from `lang=` or the request's Accept-Language, else English.
- `backend/i18n/build.py` builds `backend/i18n/messages/*.json` from `backend/i18n/tables/*.py`, using the same table format
  as the web app.
- `flask_app/errors.py` translates every string error message in one place.
- `flask_app/__init__.py` sets `Content-Language`.
- Web: `sendLanguageToServer()` in `src/lib/i18n/index.ts`, installed in `src/main.tsx`, adds the chosen language to
  every `/api` request.
- `backend/tests/test_i18n.py` **fails on purpose** until every wrapped text and the `data/motivation.json` quotes are
  translated. That is the to-do list below.

Still to do, in order:
1. Today: `services/daily_tasks.py` (task titles, reasons, the Health Score note), the streak rule in `routers/today.py`,
   `services/targets.py` explanations, `services/training_load.py` and `routers/training.py` notes, and
   `data/motivation.json` quotes.
2. Suggestions: `services/personalization.py` (meal and exercise ideas, tips), `services/health_plan.py`,
   `services/recovery.py` and `services/lab_reference.py`.
3. About 300 error messages (`HTTPException(..., "...")` in `routers/` and `services/`). Plain strings are already
   handled by errors.py once they are in a table. Rewrite f-strings as `tr("... {name}", name=...)`.
4. Emails (`services/account_mail.py`, `services/weekly_email.py`) and push (`services/notifications.py`): pass
   `lang=` with the account's saved `ui_language`.
5. Run `backend/.venv/Scripts/python backend/i18n/build.py`, then the backend tests (about 7 minutes, so run them in the
   background), the web tests, and a browser check in Hindi, Arabic and Spanish. Commit the web repo first, then the root.

Keep server values the web app translates itself in English: roles, statuses and challenge goal labels.

## House rules

- Secrets stay only in the git-ignored `backend/.env`. Never print, commit or put them in `VITE_` variables.
- Don't push to any remote. Use the test database `trackcal_phase3_test` for checks and delete test accounts afterwards.
- Leave these pre-existing uncommitted files alone: `backend/routers/workout_history.py`, `docs/bench/*`, `docs/p*.png`,
  `docs/phase*`.
- Explain each phase before doing it, and report scores out of 100 per area.

## Only the owner can do

Run `alembic upgrade head`; add the SMTP and Razorpay (Test Mode first) keys; decide GST, terms of sale and a refund policy;
set up a host, a domain and the every-minute scheduler; decide the under-18 rules for the feed; get native and legal review
of the translations.
