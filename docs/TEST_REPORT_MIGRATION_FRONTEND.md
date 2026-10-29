# Migration report — frontend: Next.js → Vite

Date: 29 October 2026. With this step the migration to the plan's stack is complete: a **Vite + React 19 + React Router** single-page app, and a **Flask** API that also serves the browser's `/api/*` routes.

**Simulated vs real:** camera results use Chromium's fake media device. No phone, Docker host or public deployment was used.

## Outcome

| Area | Result | Detail |
|---|---|---|
| Pages | **PASS** | All 27 pages plus a new "page not found" route render in production Chromium at 360 px with their own titles, a heading, no JavaScript errors and no horizontal scrolling |
| Browser routes moved to Flask | **PASS** | The 10 Next.js server routes (account, adventure, coaching, personalization, wellness, tools, AI analyze, barcode, food search, health) now live in `backend/flask_app/web_gateway.py` at the **same paths**, so the React code's `fetch()` calls did not change. 46 pytest cases replace the 55 vitest route cases; every assertion carried over |
| Sessions | **PASS** | Flask stores the API tokens in HttpOnly, SameSite=Lax cookies (Secure in production), refreshes an expired session once, and checks the request origin on every change. The live account smoke passed: signup, secure cookies, session, profile, backup, logout, invalid login, login, refresh |
| Web suite | **PASS** | 168/168 vitest (31 files); TypeScript passes; lint 0 errors, 2 accepted warnings (KI-10) |
| Backend suite | **PASS** | 357/357 pytest |
| Browser suites | **PASS (SIMULATED camera)** | Studio 14/14, 0 page errors. Privacy 16/16 on the final run; flaky in this environment (KI-14) |
| Secrets | **PASS** | The built bundle contains no API keys (scanned for `sk-or-v1`). Only `VITE_`-prefixed variables can reach the browser, and none are used |
| Production images | **NOT VERIFIED** | The web image now builds the app and serves static files with Caddy; the edge Caddy routes `/api/*` to Flask. The Docker engine was not running, so nothing was built or started |

## What changed

- **Build and dev server:** `vite.config.ts` and `index.html`. The dev server and `vite preview` proxy `/api` to Flask (`TRACKCAL_API_URL`, default `http://127.0.0.1:8000`) without rewriting the Host header, so cookies and origin checks behave as in production.
- **Routing:** `src/routes.tsx` lazy-loads every page (one chunk per page) and sets the tab title from each page's existing `metadata` export. `src/app/root-layout.tsx` is the old root layout.
- **Navigation:** `src/lib/navigation.tsx` provides `Link` (`href`), `useRouter` (`push/replace/back`) and `usePathname` on React Router, so the 157 links and 17 hook calls kept their code. Outside a router they fall back to plain browser navigation.
- **Images and fonts:** the 8 `next/image` uses are plain `<img>` (with `fetchPriority="high"` where they had `priority`). The Geist fonts are loaded in `index.html`.
- **PWA:** `public/manifest.webmanifest` replaces the generated manifest; the service worker and offline journal are unchanged.
- **Security headers:** moved from `next.config.ts` to the edge Caddy (`nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS).
- **Public health check:** `/api/health` now returns only `{"status"}`, because it shares the public origin with the web app (it previously also showed the environment and database state).
- **AI settings:** `ENABLE_AUTHENTICATED_AI` and `ENABLE_LOCAL_AI` moved from the web service to the API. The AI key belongs in `backend/.env`; `frontend/web/.env.local` is no longer read.

## Fixes made during the migration

| Problem | Fix |
|---|---|
| `/routine` scrolled sideways at 360 px. A file input's built-in minimum width stretched grid columns; the same CSS existed before, so this predates the migration | Grid columns `minmax(0,1fr)`, shrinkable labels and inputs, file inputs capped at their container, long words wrap |
| Three `useState(() => crypto.randomUUID())` states were inferred as the narrow UUID type and then assigned plain strings | Typed as `string` |
| Two browser test scripts had empty `catch {}` blocks that the stricter lint base rules flag | Commented as intentional |

## Dependencies

| Added (exact) | Licence | Released |
|---|---|---|
| react-router 8.4.0 | MIT | 2026-09-15 |
| vite 8.3.4 (was already present through vitest) | MIT | — |
| @vitejs/plugin-react 6.1.2 | MIT | 2026-10-05 |
| @tailwindcss/vite 4.3.3 | MIT | 2026-07-16 |
| typescript-eslint 8.71.2, eslint-plugin-react-hooks 7.1.1, @eslint/js 9.39.5, globals 17.13.0 | MIT | all at least 14 days old |

Removed: next, eslint-config-next, @tailwindcss/postcss, @tailwindcss/turbopack. `npm audit`: 0 vulnerabilities after the removal.

## Manual checks for the owner

1. Start Docker Desktop and run `docker compose -f compose.production.yml up --build`; open the site and sign in. This verifies the two Caddyfiles, which were not run here.
2. Delete `frontend/web/.env.local` once `backend/.env` has your OpenRouter key.
3. On a phone, open the installed PWA and confirm the offline journal still opens without a connection.
