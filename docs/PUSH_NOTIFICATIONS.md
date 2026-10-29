# Push notifications: operator guide

Opt-in reminders that arrive once, at the person's local time, never during their quiet hours, at most N a day,
and can be turned off in two taps (Me → switch). Behind the `web_push` flag, **off by default**.

## How it works

| Piece | Where |
|---|---|
| Preferences (types, times, daily limit, pause, global switch) | `notification_settings`; time zone and quiet hours come from the existing personal preferences |
| Devices | `push_subscriptions` (one row per browser/installed app, unique by endpoint hash) |
| Jobs | `scheduled_notifications`: idempotency key `user:type:local day:time` (unique) |
| Scheduler | `services/notifications.py`: `plan` → `claim` (`SELECT … FOR UPDATE SKIP LOCKED`) → `deliver` |
| Trigger | `POST /internal/tick` with header `X-Tick-Secret: $TICK_SECRET` |
| Browser | `public/sw.js` (push, notificationclick, pushsubscriptionchange), `components/push-settings.tsx` |

At send time the scheduler checks again: the global switch, the type, a pause, quiet hours, the daily limit, and
whether the notification is more than 2 hours late (then it is skipped, never sent late). A 404/410 from the push
service deletes that device. 5xx, 429 and network errors retry after 2, 4, 8 and 16 minutes, then the job is marked
failed. Payloads contain only a title, a neutral body, a link and an id; logs contain only the HTTP status and type.

Notification types: today's plan, activity reminder, meal check-in, rest-day note, a thought for today (original
lines in `backend/data/motivation.json`), milestones (sent when an achievement unlocks; after quiet hours if needed).

## Turning it on

1. Keys: `backend/.env` already has a generated pair (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) and a `TICK_SECRET`.
   For production, generate new ones in your secret store (snippet below). Never commit or share the private key.
2. Set `VAPID_SUBJECT` to a real contact (`mailto:` address or `https:` page). Push services use it to reach you.
3. Set `FEATURE_WEB_PUSH=true` (or set the `web_push` row in `feature_flags`).
4. Make sure `/internal/*` reaches the API (done in `infrastructure/Caddyfile`).
5. Call the tick every minute (next section).

Key generation (Python, in the backend venv):
```python
import base64; from cryptography.hazmat.primitives.asymmetric import ec; from cryptography.hazmat.primitives import serialization
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode(); k = ec.generate_private_key(ec.SECP256R1())
print('VAPID_PRIVATE_KEY=' + b64(k.private_numbers().private_value.to_bytes(32, 'big')))
print('VAPID_PUBLIC_KEY=' + b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)))
```

## Rotating the VAPID keys

Every existing subscription is tied to the public key it was created with, so a new key pair means everyone has to
subscribe again. Rotate only if the private key leaks.
1. Generate a new pair and deploy it.
2. Delete all rows in `push_subscriptions`. Sends to old devices would fail with 403 anyway.
3. People see "Turn on notifications" again on the Routine page. Their preferences are kept.

## The tick: free hosting warning

**Free hosts sleep, so scheduled notifications will arrive late or not at all.** Something outside the app must call
the tick every minute:
```
curl -fsS -X POST https://<your-domain>/internal/tick -H "X-Tick-Secret: $TICK_SECRET"
```
- cron-job.org (free) or any cron service can call it every minute.
- GitHub Actions `schedule` runs **at most every 5 minutes** and is often delayed by 10 minutes or more under load.
  It's fine for a demo but not for reminders.
- **Before public launch: run an always-on worker** (a small container that loops the tick every 60 s, or a
  paid plan that doesn't sleep). Two workers at once are safe: rows are claimed with `SKIP LOCKED`, and the job
  table makes each send unique.

The tick answers 404 without the right secret (at least 32 characters), and 503 if the VAPID keys are missing.

## Platform limits (shown in the app)

| Platform | Works? |
|---|---|
| Chrome, Edge, Firefox on desktop; Chrome on Android | Yes, in the browser (permission asked after a tap) |
| iPhone / iPad | **Only after Add to Home Screen from Safari, iOS/iPadOS 16.4 or later**, then permission from inside the installed app. Chrome/Firefox on iOS cannot subscribe |
| Anything else / permission blocked | In-app reminders while TrackCal is open (existing inbox), calendar export |

Checked 29 October 2026 against current guidance:
[OneSignal: Web push for iOS](https://documentation.onesignal.com/docs/web-push-for-ios),
[Pushpad: iOS requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications),
[MoEngage: Safari web push for iOS and iPadOS](https://developers.moengage.com/hc/en-us/articles/13906923326100).
Apple's own WebKit announcement is the authority; re-check it before launch.

## Metrics (guardrails, not targets)

`GET /internal/notification-metrics?days=30` with the secret header gives opt-ins, opt-outs, devices,
delivery-failure rate and open rate. The events table holds counts only, no user ids. Watch for a rising opt-out or
failure rate: it means notifications are unwelcome or broken. Never optimise opens for their own sake.
