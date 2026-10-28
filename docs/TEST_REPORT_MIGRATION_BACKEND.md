# Migration report — backend: FastAPI → Flask

Date: 28 October 2026. Branch `codex/phase-4-camera-tracking`. The frontend (Next.js → Vite) is the next part of this migration and is not covered here.

**Simulated vs real:** camera results use Chromium's fake media device. No phone, Docker host, push service or payment provider was used.

## Outcome

The API now runs on **Flask 3.1.3**. FastAPI, Starlette, uvicorn and python-multipart are removed from the code, the requirements and the virtual environment. The database schema, every endpoint path, the request and response shapes, the authentication tokens and the web client are unchanged.

| Area | Result | Detail |
|---|---|---|
| Reversible migrations (KI-05) | **PASS** | Alembic is the migration authority. `0001` reproduces the Phase 1 schema exactly (0 differences against the live database); `0002` adds `feature_flags`. Upgrade, downgrade to base and re-upgrade pass on an empty schema and on a faithful copy of the dev data, with 0 rows lost and no drift |
| Feature flags (KI-06) | **PASS** | 8 registered module flags, all off by default; database row or `FEATURE_<KEY>` override; unknown keys raise; operator CLI `scripts/set_feature_flag.py`. 4 tests |
| Endpoint coverage | **PASS** | 16 blueprints declare all 112 endpoints, plus `/api/health`, `/api/live` and development `/uploads`. Both backends discovered the same 104 private routes before FastAPI was removed |
| Backend suite | **PASS** | **282/282**, three consecutive runs, with FastAPI uninstalled |
| Behavioral parity (before removal) | **PASS** | 226 no-session probes (every endpoint, with and without a JSON body) returned identical status, error detail or validation error types, CORS and security headers on both backends |
| Web app against Flask (real Chromium) | **PASS (SIMULATED camera)** | Privacy 16/16 ×3; studio 14/14, 0 page errors; live account smoke: signup, secure cookies, session, profile, backup, logout, invalid login, login and refresh |
| OCR worker | **PASS** | Ported to self-contained Flask. Health, validation (422), bad image (422) and wrong method (405) checked; real PaddleOCR inference not rerun (needs the separate OCR environment) |
| Production image | **NOT VERIFIED** | `Dockerfile` and `Dockerfile.ocr` now run gunicorn. The Docker engine was not running on this machine, so neither image was built or started |
| CI | **NOT VERIFIED** | Workflow updated; the release job now runs Alembic. No remote exists, so it has not run |

## How the port works

- `flask_app/__init__.py`: the application factory. It carries the previous middleware (request ID, `nosniff`, `no-store`, JSON request log), the CORS allowlist, health and liveness checks, development uploads and production start-up validation.
- `flask_app/blueprints/*.py`: one explicit `route(bp, METHOD, rule, handler, status=…)` line per endpoint.
- `flask_app/binding.py`: binds each handler's typed parameters to the request (JSON body model, form and file fields, path values, query values, `Depends(...)` resolved once per request, yield-style dependencies finished at teardown). It reproduces the 422 validation shape and the JSON encoding of dates, UUIDs, decimals and enums.
- `flask_app/params.py`: the local `Query/Form/File/Path/Depends/HTTPException/UploadFile/Request` markers the handlers declare, plus `bearer_token` and the OAuth2 password form.
- `routers/*.py`: now plain handler modules. Their business logic was not changed.

## Defects found and fixed during the port

| Defect | Cause | Fix |
|---|---|---|
| Data written in one request vanished by the next (53 failures) | The auth lookup opened a second database session; closing it rolled back the handler's savepoint | One session per request, shared by the auth lookup and the handler |
| Login and form endpoints returned 422 | `FieldInfo.from_field()` returns a plain `FieldInfo`, so form markers were not recognized | Construct the marker subclasses directly |
| **Phase 1 privacy test was flaky (about 50%)** | The consent positive control started waiting for the request after the click, so a fast request was missed. Its earlier 16/16 result was partly luck | Wait is armed before the click; 14 consecutive 16/16 runs since |
| Desktop camera sometimes failed to start in headless Chrome | Chromium's fake device is occasionally unavailable ("Requested device not found") | At most 2 retries through the app's own button, each recorded in the evidence file; 0 retries were needed in the final runs |

## Changes in behavior

- **The automatic API documentation pages (`/api/docs`, `/api/redoc`, `/api/openapi.json`) no longer exist.** `docs/INVENTORY.md` is the endpoint reference. A generated OpenAPI file can be added later if a consumer needs one.
- Production serves the API with gunicorn (2 workers × 4 threads), with access logging off as before. The OCR worker runs as 1 sync worker.
- Tests import `tests/client.py` instead of a framework test client.

## Dependencies

| Added | Licence | Purpose |
|---|---|---|
| flask 3.1.3 | BSD-3-Clause | Web framework |
| werkzeug 3.1.9 | BSD-3-Clause | Flask's WSGI layer (pinned) |
| gunicorn 26.2.0 (Linux only) | MIT | Production WSGI server |
| alembic 1.14.0 (was pinned, not installed) | MIT | Migrations (with Mako 1.4.3, MIT) |

Removed: fastapi, starlette, uvicorn, python-multipart.

## Migrations

`alembic/versions/0001_baseline_schema_57_tables_as_of_phase_1.py`, `0002_feature_flags.py`. The live dev database was stamped at `0001` (after a read-only comparison showed 0 differences) and upgraded to `0002`. The old SQL files in `backend/migrations/` are frozen as history.

## Follow-up: KI-01 to KI-04 fixed on Flask (28 October 2026)

| Issue | Result | Evidence |
|---|---|---|
| KI-01 deadlock 500s | **PASS** | XP blueprints retry a deadlocked request (max 3, backoff); exhaustion is a 503 with `Retry-After`; other blueprints and other database errors are not retried. 4 deterministic tests |
| KI-02 real erasure | **PASS** (job **NOT VERIFIED** in Docker) | Erasure removes every user-owned row, the 3 `SET NULL` content tables and photo files; other accounts untouched; files outside uploads never deleted; closure returns the erasure date. 5 tests. Daily `account-purge` compose service added. Running the purge command against the dev database was declined by the permission check; a read-only preview showed 0 accounts due |
| KI-03 export coverage | **PASS** | 11 sections added; credentials omitted (`device_token`, `storage_path`); register test fails on any unaccounted user-owned table. 2 tests |
| KI-04 per-IP limits | **PASS** | Login 30 / 15 min and signup 10 / h per address in production; `X-Forwarded-For` trusted only for `TRUSTED_PROXY_HOPS` (forged first entries ignored); invalid settings stop start-up; the web server forwards the address. 4 backend + 2 web tests |

Totals after the follow-up: **297/297 backend** (three runs), **223/223 web**, TypeScript passes, lint 0 errors / 3 accepted warnings.

**Owner decision:** the 30-day erasure window is a default I chose. Confirm it, or set `ACCOUNT_ERASURE_DAYS` and update the two notices that state 30 days.

## Next

The Vite frontend migration, including moving the 10 Next.js server routes into Flask.

## Manual checks for the owner

1. Start Docker Desktop, then build and run both images (`docker compose -f compose.production.yml up --build`) and confirm `/api/health` returns 200.
2. Once a remote exists, confirm the CI workflow passes, including the Alembic release step on a fresh MySQL.
3. Run real label OCR once in the OCR environment (`.venv-ocr`) after reinstalling `requirements-ocr.txt`.
