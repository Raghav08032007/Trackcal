# Premium and payments: operator guide

TrackCal Premium: **₹99 a month or ₹799 a year, with a 7-day free trial the first time.** Sold through Razorpay
Subscriptions. Behind the `billing` flag, **off by default**.

| Premium adds | Always free |
|---|---|
| 100 AI estimates a day instead of 15 (`PREMIUM_DAILY_AI_LIMIT`) | Food logging, barcode, the food catalog |
| Book new coach slots 24 hours before everyone else | Camera rep counting |
| Premium companion accessories (star, heart, sparkle) | Reminders and notifications |
| | XP, characters, achievements (Premium never changes XP) |

## How it works

1. **Checkout** (`POST /api/v1/subscriptions/checkout`): the server creates a Razorpay subscription. On a first
   purchase, `start_at` is 7 days away, so Razorpay only authorises the mandate now (it may place a small refundable
   authorisation) and charges when the trial ends. The browser opens Razorpay Checkout, loading
   `checkout.razorpay.com` only after the tap.
2. **Verify** (`POST /verify`): the server checks Razorpay's signature, an HMAC-SHA256 of `payment_id|subscription_id`
   with the key secret, against the person's own subscription. Then Premium starts (`trialing`, or `active` when
   there is no trial).
3. **Webhooks** (`POST /api/v1/billing/webhook`): verified by the `X-Razorpay-Signature` HMAC of the raw body. Each
   `X-Razorpay-Event-Id` is applied once (`billing_events`). Events and their effect:
   `authenticated` → trialing · `activated`/`charged`/`resumed` → active, with the period dates from Razorpay
   (`charged` also records the payment once, by payment id) · `pending` → past_due (Premium kept for a 3-day grace) ·
   `halted`/`completed`/`paused` → expired · `cancelled` → cancelled.
4. **Cancel** (`POST /cancel`): cancelled at the end of the cycle (`cancel_at_cycle_end=1`). Premium continues until
   the period already paid for (or the trial) ends, and nothing more is charged.
5. **Entitlements**: `services/billing.entitlements()` is the only authority. The browser shows what the server says.
   When Premium ends, a Premium accessory displays as none, but the choice is kept for a comeback.

One free trial per person. No card details ever reach TrackCal.

## Setting up Razorpay (Test Mode first)

1. In the Razorpay Dashboard (**Test Mode**): Subscriptions → Plans → create
   - Monthly: ₹99, period monthly, interval 1 → put its id in `RAZORPAY_PLAN_MONTHLY`
   - Yearly: ₹799, period yearly, interval 1 → `RAZORPAY_PLAN_ANNUAL`
2. Settings → API Keys → generate Test Mode keys → `RAZORPAY_KEY_ID` (`rzp_test_…`), `RAZORPAY_KEY_SECRET`.
   Outside `APP_ENV=production` the app refuses anything but `rzp_test_` keys.
3. Settings → Webhooks → URL `https://<your-domain>/api/v1/billing/webhook`, a strong secret →
   `RAZORPAY_WEBHOOK_SECRET`, events: `subscription.authenticated, activated, charged, pending, halted, cancelled,
   completed, paused, resumed`.
4. `FEATURE_BILLING=true`, restart, and run the manual checklist in `TEST_REPORT_P5.md` with Razorpay's test cards/UPI.
5. Live only after the checks below. Live keys go in the production secret store, never in a file.

## Before taking real money (owner)

- **GST:** decide whether ₹99/₹799 include GST and whether you must register. The app makes no GST claim. Razorpay
  invoices and receipts should show it correctly.
- **Terms and refund policy:** publish them (Razorpay requires both for activation) and link them from the Premium
  page.
- **Razorpay KYC and account activation** for Live Mode.
- **Support contact** for payment questions.

## Ethics (kept on purpose)

Price, renewal and trial-end date are shown in plain words before paying. The trial-end reminder appears two days
before the first charge. Cancelling takes two taps (Cancel → confirm) and shows how long Premium lasts. No
countdowns, no "only today" offers, no paywall on the core habit.
