# Closed beta runbook

How to run TrackCal for a small group of invited testers, and what must be true before it starts.

## Go / no-go checklist

| # | Gate | Status on 29 Oct 2026 | Owner |
|---|---|---|---|
| 1 | Off-machine copy of the code (private remote, e.g. GitHub private repo) | **Missing**: all work is local commits (KI-00) | You |
| 2 | HTTPS deployment with the edge Caddyfile (security headers, CSP, `/internal/*`) | Config ready, not deployed | You |
| 3 | Production secrets in a secret store (DB, `APP_SECRET_KEY`, OpenRouter, VAPID, `TICK_SECRET`, Razorpay) | `.env` on this machine only | You |
| 4 | Rotate the OpenRouter key that was pasted in chat | Not done | You |
| 5 | Database backups + a restore drill on the deployed database | Drill done locally in Phase 1 only | You |
| 6 | Daily jobs scheduled: `scripts/maintain_security.py` (retention), `account-purge`; tick every minute if push is on | Scripts ready | You |
| 7 | Operator identity, support contact and hosting region on the privacy page and terms | Placeholders | You |
| 8 | AI provider choice for real users: free OpenRouter models may log or train on prompts (KI-07) | Decision pending | You |
| 9 | IFCT data: NIN permission needed before **public** launch; beta use is OK | Pending | You |
| 10 | Feature flags for beta (below) | Set per environment | You |

## Flags for the beta

| Flag | Beta setting | Why |
|---|---|---|
| `closed_beta` | **on** | Only invited people can sign up; existing accounts unaffected |
| `web_push` | on only after the real-device push check (KI-25) and the tick is running | Otherwise reminders silently don't arrive |
| `billing` | **off** until Razorpay Test Mode is verified (KI-30) and GST/terms are done (KI-31) | Never take money in a beta by accident |
| everything else | off | Not built yet |

Each flag is a kill switch: `FEATURE_<NAME>=false` (or the `feature_flags` row) turns a module off without a deploy.

## Inviting testers

```
cd backend
python scripts/invites.py create --label "college group A" --uses 20 --days 30   # prints TC-XXXX-XXXX once
python scripts/invites.py list
python scripts/invites.py revoke --label "college group A"
```
Codes are stored only as hashes; if you lose one, revoke it and create a new one. Sign-up attempts are rate-limited
per address (20/hour) to slow guessing.

## Feedback and support

- Testers use **Send feedback** in the footer. It arrives as a support ticket with category `beta_feedback`, the
  message and the page path, and nothing else.
- Triage weekly. Note recurring issues in `docs/KNOWN_ISSUES.md`.
- Health or safety concerns in feedback: reply personally, never in bulk, and don't copy them elsewhere.

## Watching the beta

- Push guardrails: `GET /internal/notification-metrics` (opt-outs and failure rate should stay low).
- Errors: API logs are structured JSON with request ids (no meal content, no addresses).
- Don't optimise for streaks or opens. The success signals are people coming back of their own accord and
  low opt-out and uninstall rates.

## If something goes wrong

1. Turn the module's flag off (kill switch).
2. Suspected leak of a secret: rotate it (VAPID rotation needs everyone to re-subscribe, see `PUSH_NOTIFICATIONS.md`).
3. Bad deploy: redeploy the previous image; database migrations are reversible (`alembic downgrade -1`, dry-run
   first with `scripts/dry_run_migrations.py`).
4. Tell affected testers plainly what happened and what changed.
