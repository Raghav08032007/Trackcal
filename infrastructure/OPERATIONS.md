# Production operations

Public deployment and email configuration were deferred by the owner. Docker/WSL are unavailable on the current workstation; container runtime and backup restoration have not been claimed as verified.

## Release

1. Use a Linux Docker host with persistent storage, restricted admin access and a domain resolving to it. Only Caddy ports 80/443 are published; MySQL and the API stay private.
2. Copy `.env.production.example` to ignored `.env.production`. Generate distinct high-entropy application and database secrets. Configure domain, OpenRouter and SMTP locally. Do not paste secrets into logs or commit them. Configure SPF/DKIM/DMARC with the chosen mail provider and test delivery at the final stage.
3. `docker compose --env-file .env.production -f compose.production.yml config --quiet` then `docker compose --env-file .env.production -f compose.production.yml build`. Do not print resolved Compose config: it contains secrets.
4. Take a backup before upgrading an existing deployment. The release job performs additive schema bootstrap; it never drops data. Future column-changing migrations must be reviewed/versioned explicitly rather than relying on `create_all`.
5. `docker compose --env-file .env.production -f compose.production.yml up -d`. Confirm service health, HTTPS, account signup/recovery/verification, production AI limits and backup restore. No public AI is enabled without authentication and a verified email.
6. Configure an external uptime monitor for the public login page and the private API readiness check from inside the host. Readiness is HTTP 503 when MySQL is unavailable; liveness is `/api/live`. Deliver alerts to a real operator. A healthcheck alone does not page anyone or automatically recover a failed dependency.

## Backups and recovery

Run `sh infrastructure/backup.sh` from the root with Docker access. The output contains private records. Store it encrypted off-host, restrict access, and set a retention schedule. Also back up the uploads volume and deployment configuration separately; a SQL dump does not contain uploaded images or model files. Never back up server secrets into an unprotected shared folder.

Run `sh infrastructure/restore-check.sh <archive>` on a Docker test host. It creates a disposable, network-isolated MySQL container, imports the dump, reports counts and removes the container on exit. This is a rehearsal, not a production restore command. Before launch, compare restored counts, log in with a synthetic restored account and verify its workspace. Record recovery time and the age of recovered data. Define acceptable RPO/RTO from the actual drill.

Keep the last working image/release and backup. Rolling back code after a future incompatible schema migration requires a reviewed compatibility plan. Never use `docker compose down -v` on production.

## Request and cost controls

API request logs contain IDs/method/status/duration, not submitted nutrition or action tokens. Run gunicorn without access logs (its default; the image does not enable `--access-logfile`) so recovery link fragments/parameters are not accidentally expanded by custom logging. Do not enable SQL echo in production. Use request IDs for support; infrastructure logs require separate review.

Production AI is bound to verified accounts and a shared MySQL daily quota. Integrations have per-account buckets. Limits count attempts, including failed provider requests, to bound abuse. Monitor actual provider invoices and request volume; these limits do not establish a cost-per-user forecast or protect against every distributed attack. Put additional host/network protections in front of a public release.

## Source packaging and CI

For a read-only configuration preflight, run `backend/.venv/Scripts/python.exe backend/scripts/release_preflight.py --env-file .env.production` from the repository root (use the deployment host's Python executable). It prints only check names/actions, not environment values, and returns nonzero for missing configuration. A successful configuration check does not approve launch or prove credentials work. Docker CLI presence does not establish that the engine is running.

To produce a portable source artifact despite the embedded frontend checkout, run `backend/.venv/Scripts/python.exe backend/scripts/package_source.py --output backend/runtime/trackcal-source-RELEASE.zip`. The output must not already exist. The explicit allowlist excludes real environment files, uploads, installed runtimes and Git metadata; it includes example configuration templates. `SOURCE_MANIFEST.sha256` records each included file. Use a private local destination, review the archive before any external sharing, and configure fresh secrets on the destination. This creates no Git commit, remote repository or deployment. It does not repair the parent checkout's remote-CI gitlink automatically.

The local frontend is currently an embedded Git checkout recorded as a gitlink in the parent repository. Before remote CI or publishing, either configure it as a proper accessible submodule or commit/package its source in the parent repository. Do not assume a fresh parent checkout contains the frontend. No repository history was rewritten as part of this work.

Run python scripts/maintain_security.py as a scheduled maintenance job to remove expired action tokens and rate buckets. Choose scheduling and alert delivery on the deployment host; no system scheduler was installed here.
