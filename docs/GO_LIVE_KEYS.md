# Going live: the keys only you can add

Everything below is already built and tested with simulated services. Each step is: put the values in `backend/.env`
(git-ignored; never in a `VITE_` variable, never committed), restart the API, then run the check.

## 1. Database update (do this first)

```
cd backend
.venv/Scripts/python -m alembic upgrade head
```

Applies migrations up to `0026` (segments). Restart the API on port 8000 afterwards.

## 2. Email (password reset, email verification, Monday summary)

| Setting | Example |
|---|---|
| `SMTP_HOST` | `smtp.your-provider.com` |
| `SMTP_PORT` | `587` (or `465` with `SMTP_SSL=true`) |
| `SMTP_USER`, `SMTP_PASSWORD` | from your email provider |
| `SMTP_FROM` | `TrackCal <hello@your-domain>` |
| `PUBLIC_APP_URL` | `https://your-domain` (links in emails use it) |

**Check:** use "Forgot password" with your own address; the email arrives within a minute.
Before you have SMTP, set `MAIL_OUTBOX=runtime/outbox` to have every email written there as a file instead (refused in production).

## 3. Payments (Razorpay), Test Mode first

Follow `docs/BILLING.md` ("Setting up Razorpay"). In short:

| Setting | Where it comes from |
|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Dashboard → Settings → API Keys (Test Mode: `rzp_test_…`) |
| `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_ANNUAL` | Dashboard → Subscriptions → Plans (₹99 monthly, ₹799 yearly) |
| `RAZORPAY_WEBHOOK_SECRET` | Dashboard → Webhooks, pointing at `https://your-domain/api/v1/billing/webhook` |
| `FEATURE_BILLING=true` | turns the Premium page on |

**Check:** on `/premium`, start the trial with a Razorpay test card, then cancel. The page says you keep Premium until the trial ends.
Outside production, the app refuses anything but `rzp_test_` keys, so a live key can't be used by mistake.

## 4. Notifications (already set up)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `TICK_SECRET` are already in `.env`. Something must call the
scheduler once a minute:

- **On your machine:** `backend/.venv/Scripts/python tools/tick.py` (leave it running). `--once` runs one pass.
- **In production:** an always-on worker or a cron job calling `POST /internal/tick` with the `X-Tick-Secret` header
  (`docs/PUSH_NOTIFICATIONS.md`).

**Check:** turn notifications on in Me → Reminders, ask a friend to give your post kudos; one note arrives (at most one per half hour).
