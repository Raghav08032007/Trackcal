# Handoff: where the work stands (19 November 2026)

Read this first in a new session, then `docs/LANGUAGES.md`, `docs/RELEASE_CHECKLIST.md` and `docs/GO_LIVE_KEYS.md`.

## Done and committed (local git only, nothing pushed)

- Product phases 1–10 and D–I (food, Move and camera workouts, Play and social, Me, billing, push, email, release prep).
- Languages, steps 1–7: the whole web app in hi, bn, mr, te, ta, es, pt (Brazil), id and ar (right to left), 4,505
  texts each, plus tab titles and the offline journal.

## Done: step 8, the server's messages in the person's language

Everything the server sends (tasks, Health Score, plans, meal ideas, blood report, recovery, about 380 error messages,
emails and push notifications) is translated: 1,005 texts per language. How it works and what stays English:
`docs/LANGUAGES.md`, "Server messages". Add a new server text with `tr("...")` (or `msg()` in a data table), add its row to a
table in `backend/i18n/tables/`, then run `backend/.venv/Scripts/python backend/i18n/build.py`; `backend/tests/test_i18n.py`
fails until every language has it.

Backend tests: about 40 fail until `alembic upgrade head` adds migration 0026 (segments) to the test database, and a few
need a writable temp folder on Windows (`pytest --basetemp=<folder>`). One meal-summary test fails between midnight and
05:30 India time (UTC and local days differ).

## Next

See README "What's next": owner tasks (keys, host, policies, under-18 rule, reviews), features still to build (event
reports, moderation screen, the AI coach replying in the person's language, ...) and real-device checks.

## House rules

- Secrets stay only in the git-ignored `backend/.env`. Never print, commit or put them in `VITE_` variables.
- Push to GitHub only when the owner asks. Use the test database `trackcal_phase3_test` for checks and delete test accounts afterwards.
- Leave these pre-existing uncommitted files alone: `backend/routers/workout_history.py`, `docs/bench/*`, `docs/p*.png`,
  `docs/phase*`.
- Explain each phase before doing it, and report scores out of 100 per area.

## Only the owner can do

Run `alembic upgrade head`; add the SMTP and Razorpay (Test Mode first) keys; decide GST, terms of sale and a refund policy;
set up a host, a domain and the every-minute scheduler; decide the under-18 rules for the feed; get native and legal review
of the translations.

## Repository

One git repository since 17 November 2026: `frontend/web` used to be a separate repo inside this one, and its history is
now merged in (its older commits show paths without the `frontend/web/` prefix). GitHub: a private repository; the branch
`bakeoff/version-b` is pushed as `main`.
