# Phase 5 test report: Premium subscriptions (Razorpay)

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0,
headless Chrome stable. Browser journey on the disposable `trackcal_phase3_test` schema.

**Simulated vs real:** no Razorpay keys exist yet, so **no call reached Razorpay**. Backend tests use a fake gateway;
the browser journey uses a gateway allowed only with `APP_ENV=testing` + `RAZORPAY_SIMULATED=1`, plus a stand-in for
Razorpay's checkout script. **Every signature check is real**: the checkout HMAC (`payment_id|subscription_id`, key
secret) and the webhook HMAC (raw body, webhook secret). Real Test Mode checkout is **NOT VERIFIED** (KI-30).
The feature ships **off** (`billing` flag).

Owner decisions applied: ₹99/month, ₹799/year; 7-day free trial (once per person); Premium = more AI estimates,
priority coach booking, cosmetic extras. Logging, barcode, camera counting and reminders stay free.

## Results

| Area | Result | Detail |
|---|---|---|
| Flag off = unchanged | **PASS** | Plans, status, history and cancel behave exactly as before (existing readiness/workflow/preflight tests unchanged); checkout 404 |
| Entitlements | **PASS** | One server function; 10 cases: trial before/after end, active, 3-day grace for a retrying renewal, past due, cancelled until period end, expired, free |
| Checkout | **PASS (SIMULATED)** | First purchase: `start_at` = now + 7 days; repeat after trial: no trial; already Premium → 409; Razorpay down → 502, nothing changed; only `rzp_test_` keys accepted outside production |
| Verify | **PASS** | Forged signature → 400, another person's subscription → 404, neither grants Premium; repeat verify changes nothing |
| Webhooks | **PASS** | Bad signature → 400; each event id once; one payment row per Razorpay payment even across different events (unique constraint); halted ends Premium; unknown subscription ignored |
| Cancel | **PASS (SIMULATED)** | At cycle end; Premium kept until the paid period/trial ends; second cancel makes no second provider call |
| AI limit | **PASS** | 15/day free, 100/day Premium, in both AI paths (`/auth/consume-ai`, `/ai-scan`) |
| Priority coach booking | **PASS** | New slots: Premium can book immediately, others after 24 h (403 says when); old slots and billing-off: open to all |
| Accessories | **PASS** | star/heart/sparkle need Premium (402); after Premium ends they display as none and the choice is kept |
| Honest UI | **PASS** | Price, renewal and trial end in plain words; "Save 33%"; always-free list; Razorpay script loaded only after a tap; cancel = Cancel → confirm, shows keep-until date; trial-end reminder 2 days before the first charge; no GST claim |
| Data | **PASS** | Migration 0006 dry run clean (upgrade/downgrade/re-upgrade, no drift, no loss); no card data stored |

## Test counts

| Suite | Before Phase 5 | After |
|---|---|---|
| Backend pytest | 480 | **506 passed** (`test_billing.py`: 24) |
| Web vitest | 257 | **263 passed** (40 files; `premium.test.tsx`: 6) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p5-premium.mjs` (new, Razorpay SIMULATED) | — | **13/13** desktop + 360 px |
| Browser `e2e-p4-push.mjs` / `e2e-studio.mjs` | 13 / 14 | **pass / 14** |

## Manual checklist: NOT VERIFIED (owner, Razorpay Test Mode)

Set up as in `BILLING.md`, then with Razorpay's test cards/UPI:

| Step | Expected | Result |
|---|---|---|
| Start free trial (monthly) | Checkout opens; small refundable auth; Premium shows "trial ends on …" | |
| Dashboard: subscription | Status authenticated, start date 7 days out; webhook `subscription.authenticated` received (200) | |
| Cancel in the app | Razorpay shows cancel at cycle end; app keeps Premium until the trial date | |
| Subscribe again (annual) | No trial; charged ₹799; `subscription.charged` → payment listed once | |
| Payment fails (test failure card) | Clear message, nothing granted | |
| Trigger a renewal failure (`pending`) then `halted` | Premium kept during grace, then ends | |

## Defects found and fixed during Phase 5

1. Coach slot publish returned no early-access info (it skipped the database lookup).
2. The plans note claimed "Prices include GST": an unverified tax statement, removed (decision for the owner).
3. The cancel path checked the flag before the plan, so a legacy record needed more than it should; legacy plans now
   refuse first.

## Open for the owner

Razorpay Test Mode keys, the two plans and the webhook (KI-30); GST, terms of sale and refund policy before Live
(KI-31). The earlier lists (NIN permission, camera device matrix, real push devices, VAPID subject, tick scheduler,
OpenRouter key rotation) still stand.
