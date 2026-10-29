# Phase 6 test report: hardening, privacy and closed-beta readiness

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0,
headless Chrome stable. Browser journeys on the disposable `trackcal_phase3_test` schema, ports 3004/8004 (another
local tool held 3003/8003; it was left alone).

**Simulated vs real:** everything here ran locally. The policy and headers were tested through `vite preview`, which
reads the same Content Security Policy line as the production `Caddyfile`. The edge proxy itself was not deployed.

## Results

| Area | Result | Detail |
|---|---|---|
| Dependencies | **PASS WITH 1 ACCEPTED** | npm audit: 0 (prod and dev). OSV scan of 38 pinned and 113 installed Python packages: only `nltk` 3.10.3 (optional recipe parser; affected APIs unused; upgrade after the two-week rule, KI-34) |
| Content Security Policy | **PASS** | `default-src 'self'`; scripts self + `'wasm-unsafe-eval'` (pose model) + Razorpay checkout; **no `'unsafe-inline'`**; frames/API Razorpay only; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action` self. 0 violations on 36 page views, the running camera model, Razorpay (stand-in) checkout, photo upload, push settings |
| Other headers | **PASS** | `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Razorpay popups still work); edge: HSTS, nosniff, no-referrer, `X-Frame-Options: DENY`, Permissions-Policy; API responses get `default-src 'none'` |
| Accessibility (axe-core 4.14, WCAG 2.2 AA) | **PASS** | Guest and member pages, desktop and 360 px: 0 issues of any severity after fixes (below) |
| Lock-free summary (KI-15) | **PASS** | Steady-state reads take no row locks (test fails if any `FOR UPDATE` is issued); new achievements still saved on the locked path |
| Deprecations (KI-11) | **PASS** | `datetime.utcnow` gone from app code; warnings 3,156 → 463 |
| SQL echo (KI-16) | **PASS** | Opt-in `SQL_ECHO=1` |
| Closed beta | **PASS** | `closed_beta` flag: sign-up needs a valid invite (hashed, seats counted atomically, expiry, revoke, loose typing accepted, guess rate-limited); refused sign-ups create no account; form shows the field only when needed |
| Feedback | **PASS** | Footer "Send feedback" → support ticket (`beta_feedback`), only message + page path; text kept if sending fails; tickets now have length/category/priority limits and a rate limit |
| Retention | **PASS** | Daily job: expired tokens, buckets, barcode cache; finished notification jobs > 90 days; searches > 180 days; metric counts > 400 days. Personal records untouched (tested) |
| Privacy page | **UPDATED** | Push, Razorpay, feedback, invites, photo metadata removal, retention schedule |

## Fixed during Phase 6

1. **Accessibility:**
   - Character buttons and the home character card had names that didn't match their visible text.
   - The "Forgot password?" link was too small to tap.
   - The scanner's translucent dark panels kept dark text in the light theme (1.29:1 contrast).
   - Amber text was low contrast (2.9:1).
   - Play-tile captions were low contrast (3.6:1).
   - Calendar bars had a label but no role.
2. **Premium page race:** a slow page-load status could overwrite a fresh checkout result (would show "free" right after
   paying). Now a newer result always wins (regression test added).
3. **Sign-up form:** it now asks the server whether an invite is needed.
4. **Journeys:** the browser journeys accept their URLs from the environment.

## Test counts

| Suite | Before Phase 6 | After |
|---|---|---|
| Backend pytest | 506 | **515 passed** (new: closed beta 7, retention 1, lock-free summary 1) |
| Web vitest | 263 | **267 passed** (41 files; new: beta 3, premium race 1) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p6-hardening.mjs` (new) | — | **pass**: 36 page views + camera + feedback, desktop and 360 px |
| All earlier journeys under the new policy | — | studio 14 · phase3 17 · privacy 16 · search 13 · diary 10 · camera 10 · push 13 · premium 13: **all pass** |

## Before inviting testers

See `BETA_RUNBOOK.md`: off-machine code copy (KI-00), HTTPS deployment, secrets store, OpenRouter key rotation,
backups and a restore drill on the real database, scheduled jobs, operator identity on the privacy page, the AI
provider decision (KI-07), and which flags to turn on.
