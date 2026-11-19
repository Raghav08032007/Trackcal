# Release checklist

One page, in order. Details live in `infrastructure/OPERATIONS.md` (deploying, backups, recovery) and `docs/GO_LIVE_KEYS.md`
(the keys only you can add). Tick each item on the real production host, not on a laptop.

## Before the release

- [ ] **Host**: a Linux Docker host with a domain pointing at it; only ports 80/443 open (OPERATIONS.md, Release 1).
- [ ] **Production settings** in the ignored `.env.production` (OPERATIONS.md, Release 2). `release_preflight.py` must pass:
      `APP_ENV=production`, a unique signing secret, HTTPS `PUBLIC_APP_URL` and allowed origins, real (non-mock) AI, SMTP.
      Run `backend/.venv/Scripts/python backend/scripts/release_preflight.py --env-file .env.production` (it never prints values).
- [ ] **Keys** (GO_LIVE_KEYS.md): SMTP, Razorpay **Test Mode** first, `TICK_SECRET`, VAPID (already generated).
- [ ] **Never set in production**: `RAZORPAY_SIMULATED`, `MAIL_OUTBOX`, `DAILY_AI_LIMIT=100` (development value; production default is 15).
- [ ] **Database**: take a backup, then apply migrations up to `0027` (challenge flag review).
- [ ] **Backup drill**: `infrastructure/backup.sh`, then `restore-check.sh` on a test host; write down how long it took.

## Release

- [ ] Build and start with Docker Compose (OPERATIONS.md, Release 3 and 5). Health checks green; HTTPS works.
- [ ] **Scheduler**: something calls `POST /internal/tick` every minute (a cron job or an always-on worker). Without it no
      reminders, social notifications or Monday emails go out.
- [ ] **Uptime monitor** on the login page and the API readiness check, alerting a real person (OPERATIONS.md, Release 6).

## Smoke test on the live site (a fresh account)

- [ ] Sign up, verify the email, reset the password (real email arrives).
- [ ] Log a meal by search; log a camera workout; record a short GPS walk (location permission works: fixed in Phase I).
- [ ] Turn notifications on; give kudos from a second account; one notification arrives.
- [ ] Premium with a Razorpay **test** card: trial starts; cancel keeps Premium to the trial end.
- [ ] Phone and laptop, light and dark: no sideways scrolling, no errors in the console.

## After switching Razorpay to Live Mode

- [ ] Replace the test keys and plans with live ones; repeat the Premium smoke test with a real card and refund it.

## Known limits at launch (Phase I measurements)

| Area | Measured | What it means |
|---|---|---|
| Page speed (Lighthouse mobile, simulated slow 4G) | scores 62–82; first paint 2.4 s; main content 3.9–5.0 s | A static first screen now paints from the HTML, and the sign-in check starts with it. The rest still waits for the app's scripts and data; server rendering and a CDN are the next steps. |
| Layout stability (Today) | layout shift 0.007–0.06 | Good (under 0.1): nothing jumps while the page loads. |
| API, 50 users at once, 20 accounts | p50 0.35–2.0 s; 24–150 requests a second | One Windows test process. Production runs 2 processes, so about twice that. Food search is the slowest; it is cached for 10 minutes per search. |
| Dependencies | 0 advisories in shipped packages | 7 moderate in development-only lint tools (not shipped). |
| Secrets | none in the code or git history | Keep it that way: secrets only in ignored `.env` files. |
