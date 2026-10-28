# Cal AI reference and TrackCal account features

Verified 2026-10-21 using the installed REA browser capture provider. No Cal AI account was created, and no private app assets or authenticated screens were accessed.

## Public reference evidence

- The requested `https://www.calai.com` timed out in both web retrieval and REA. The calorie-tracking app was verified at [calai.app](https://www.calai.app/), which had already been inspected in this project.
- [Public login](https://www.calai.app/login): Google and Apple buttons. REA evidence `ev_87f30c808b81951c6572244715361e4ecaea3e33890251f5d32758538cd4afa1`.
- [Public FAQ](https://www.calai.app/faq): photo/barcode/manual search, cloud history, PDF export, health connections, notifications, family plans and store subscription management. REA evidence `ev_e5bf346ce2462beb8213c33eba9b3e8b1393348b5f81383b882700ba451124fa`.

These observations establish public feature descriptions, not private implementation details or a complete mobile feature inventory. TrackCal uses its own design and implementation.

## Implemented in the active web app

| Workflow | TrackCal implementation |
|---|---|
| Accounts | `/signup`, `/login`, `/account`; real database accounts, email/password login, profile edits, password change and sign-out |
| Sessions | Server-side API proxy, HttpOnly SameSite=Lax cookies, Secure in production, automatic access-token refresh; no tokens returned to client JavaScript |
| Personal data | Guest and each account have independent browser workspaces; changing accounts remounts the dashboard |
| Cloud backup | Explicit save and restore of journal history, wellness records, targets and recipe drafts; owner-scoped MySQL rows. Restore requires a reviewable replacement action |
| Guest migration | Explicit copy into an account; guest copy remains intact. Saving a cloud backup is a separate action |
| Meal tools | Existing photo/label estimation, barcode entry/camera, text/speech entry, food search, portion adjustment and journal corrections |
| Daily habits | Existing goals, recipe nutrition, manual water, weight, steps and activity |
| Progress | `/progress`: last 30 dates with logged meals, real daily macro totals, calorie bars and averages excluding unlogged dates |
| Reports | Browser Print / Save as PDF plus existing JSON journal export. No email/Mail-app permission needed |
| Help | `/help`: feature instructions and integration boundaries |

## Remaining integrations

- Google/Apple OAuth needs registered applications and provider credentials. The current login deliberately offers working email/password instead of inactive social buttons.
- Email password recovery and email verification need a configured mail provider. Authenticated password changes work.
- Backups are explicit snapshots, not automatic continuous synchronization. Conflicts across devices are resolved by choosing which snapshot to save/restore.
- Apple Health, Google Fit, native notifications, device-specific mobile flows, family plans and store billing are not implemented in the active web app. There is no fake payment or subscription requirement.
- Physical microphone/camera integration still needs device testing; deterministic device tests simulate permissions and results.
- Free OpenRouter models and public food services may impose their own quotas or availability limits.

## Run and verify

Run FastAPI from `backend` on port 8000 and Next.js from `frontend/web` on port 3002. The Next server proxies account calls to `http://127.0.0.1:8000/api/v1` by default; `BACKEND_API_URL` overrides this server-side.

Development startup creates the new `user_workspaces` table automatically. Existing production installations should apply `backend/migrations/20261021_workspace_backup.sql` before deployment. Production cookies require HTTPS. Use a strong server `APP_SECRET_KEY` and deployment-level abuse controls before exposing accounts publicly.

The opt-in `tests/live-account-smoke.mjs` verifies the actual web-to-API path and deactivates its synthetic account in `finally`. Integration pytest uses rollback-only transactions. Browser verification includes the rendered login design and invalid-credential error. Password change is tested through the API without changing any real user's credentials.
