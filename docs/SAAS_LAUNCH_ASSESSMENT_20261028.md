# TrackCal SaaS assessment and launch plan — 28 October 2026

Scope: the code and docs in this working tree on branch `codex/phase-4-camera-tracking`. Re-run on 28 October 2026: **221/221 web tests** (39 files) and **274/274 backend tests** passed against the local MySQL schema. The UI was not visually re-inspected for this assessment, and nothing has been deployed, so the scores below come from the code, the test runs and the existing verification records.

## 1. What TrackCal is

An AI-assisted food and nutrition journal with fitness and gamification layers, built as a web app (Next.js 16 / React 19 PWA) on a FastAPI + MySQL API.

| Area | What exists |
|---|---|
| Food logging | Dated meal journal, macros, goals, water, weight, activity, and CSV import/export |
| AI and lookup | Photo/text nutrition estimates via OpenRouter, barcode scanning (live and from a photo), USDA and Open Food Facts search, label OCR, local Whisper speech |
| Planning | Recipe URL import, ingredient parsing, constrained meal planning, pantry and shopping lists |
| Fitness | Personalized weekly activity plans, workout sessions, on-device camera rep counting (squat, push-up, curl) with MediaPipe |
| Engagement | Server-owned XP, quests, streaks, badges, six unlockable companion characters, a Play area with Label Detective |
| Accounts | Signup/login, HttpOnly sessions, email verification and reset flows, export, deactivation, cloud snapshots |
| Coaching | Coach availability, booking, rescheduling and cancellation |
| Ops prep | Dockerfiles, `compose.production.yml`, Caddy HTTPS config, backup/restore scripts, CI workflow, readiness probes |

Size: about 8,000 lines of Python across 70 files, and about 470 KB of TypeScript across 106 files (very long lines; see 3.3). There are 50+ design and verification docs, plus a limitations register (`LIMITATIONS_REGISTER.md`).

## 2. Scorecard (out of 10, as a SaaS product today)

| # | Dimension | Score | Why |
|---|---|---|---|
| 1 | Feature breadth | **8.5** | More features than most funded competitors at launch: journal, AI scan, barcode, planning, workouts, camera reps, gamification |
| 2 | Core value / accuracy | **5** | Nutrition estimates have no weighed-portion benchmark; production uses `openrouter/free` models with no quality or uptime guarantee |
| 3 | Engineering quality | **7** | Modular routers/services, strict production config checks, honest error states. Dense one-line files (e.g. `privacy/page.tsx` is a single line) will slow every future change |
| 4 | Automated testing | **8** | 495 passing tests across web and API, with CI defined. No end-to-end browser tests in CI yet |
| 5 | Security design | **7** | Hashed purpose-bound tokens, PyJWT HS256, credential-bound sessions, atomic rate limits, origin checks, non-root containers. No independent pentest; one open NLTK advisory |
| 6 | Privacy and legal | **3.5** | Privacy and terms pages exist, but the operator identity, contact and retention schedule are blank, and account closure is not erasure. Health data is sent to free AI providers, which may log it |
| 7 | Source control / release hygiene | **1.5** | Only **27 files are committed** in the main repo. `frontend/web` is a separate nested repo with 3 commits, 57 uncommitted changes and **no remote**. About 4 GB of unrelated material sits in the working tree and is not ignored. One disk failure would lose almost everything |
| 8 | Deployment / infrastructure | **3** | Good configs, never run. Docker images, HTTPS, persistence and rollback are unverified on any host |
| 9 | Operations and observability | **3.5** | Liveness/readiness probes and backup scripts exist. No error tracking, uptime alerts, log shipping or restore drill |
| 10 | Monetization / billing | **1.5** | `billing_enabled: False`. No checkout, webhooks, entitlements, refunds or invoices |
| 11 | Unit economics | **3** | AI cost per active user is unmeasured; the free tier depends on free upstream models |
| 12 | UX and design | **7** | Studio redesign, guided onboarding, `/guide` test drive, reduced-motion support. Scored from tests and docs, not a fresh visual review |
| 13 | Accessibility | **6** | Keyboard focus, reduced motion and semantic controls. No screen-reader or real-device audit |
| 14 | Mobile | **3** | The PWA works in a browser; the Expo app is an uncertified prototype. Calorie tracking is a phone-first habit |
| 15 | Market differentiation | **5.5** | Crowded market (MyFitnessPal, HealthifyMe, Cronometer, Cal AI). Real edges: gamified companions, Indian cuisine seeds, INR pricing, unusually honest estimates |
| 16 | Go-to-market readiness | **2** | No landing page, pricing page, product analytics, waitlist or beta users |
| 17 | Documentation | **8.5** | Exceptionally thorough and honest, but sprawling: 50+ dated files with no single index for a new teammate |
| 18 | Scalability | **5** | Fine for a beta. Streaks, history and search are unbenchmarked at scale (register P1-04, P2-11, P3-07) |

**Overall: 5/10.** TrackCal is a strong, well-tested prototype with more features than it needs. It is not yet a product anyone can sign up for or pay for. Every major gap is operational or commercial, not a missing feature. **Stop adding features until section 4, steps 1–4, are done.**

## 3. Critical findings

### 3.1 The work is not saved anywhere safe (fix today)
- In the main repo, `git ls-files` shows 27 files. The backend routers, services, tests, migrations, docs and infrastructure are all untracked or modified-but-uncommitted.
- `frontend/web` is recorded as a gitlink (mode 160000) but has no `.gitmodules` file and no remote, so a clone of the parent repo gets an empty folder. CI explicitly fails on this.
- Untracked clutter that a `git add .` would sweep in: `downloaded-repos/` (3.6 GB), `digidara-leads/` (130 MB), `.skill-installer-python/`, `python-runtime.zip`, plus skill-installer scripts and JSON reports in the repo root. None of these belong to TrackCal.

### 3.2 Brand and trademark risk
- The README describes TrackCal as "inspired by the state of the art in calorie and food intelligence (Cal AI)". The frontend's latest commit is titled "Cal AI interactive dashboard", and `app/api/analyze/route.ts` mentions Cal AI. Remove competitor names from anything public: README, commit history on a public remote, metadata, prompts and marketing.
- Run a trademark search on "TrackCal" in your launch markets (India: IP India public search; US: USPTO) before buying a domain or printing anything.

### 3.3 Maintainability
- The TypeScript sources average about 124 characters per line (470 KB over about 3,800 lines), and many components, such as the privacy and terms pages, are written on a single line. Run Prettier once on `frontend/web/src` in its own commit so later diffs and reviews stay readable.

### 3.4 Privacy conflict with free AI models
- Free OpenRouter models may log and train on prompts. Meal photos and descriptions are health-adjacent personal data. For a public launch, use a paid model whose provider offers no-retention terms, or route only consented requests to free models, and say which one the privacy notice covers.

## 4. Launch plan — everything needed to publish

Do these steps in order. Steps 1–5 lead to a private beta; steps 6–8 lead to a public paid launch.

### Step 1 — Secure the source (day 1)
1. Move `downloaded-repos/`, `digidara-leads/`, `.skill-installer-python/`, `python-runtime.zip` and the root skill-installer files (`download_*.cjs`, `inspect_repo_skills.*`, `install_discovered_skills.py`, `verify_skills.py`, `write_install_summary.py`, `finalize_book.py`, `*-report.json`, `repo-*.json`, `skill-*.json`, `SKILL-INSTALLATION.md`) out of this folder.
2. Decide on one layout. The simplest is to fold `frontend/web` into the main repo: remove the gitlink, then commit its files directly. The alternative is to create a second GitHub repo for it and add a real `.gitmodules`.
3. Create a **private** GitHub repo, commit everything, and push. Confirm that `.env`, `.env.local`, `backend/runtime/` and uploads stay ignored, and run a secret scan (e.g. `gitleaks detect`) before the first push.
4. Confirm the `Verify TrackCal` CI workflow goes green on the remote.

### Step 2 — Business and legal basics (week 1)
| Item | Notes |
|---|---|
| Operator identity | Sole proprietorship or LLP/Pvt Ltd. Payment processors require business KYC |
| Domain and brand | After the trademark check. Set up a support address on the domain |
| Privacy policy | Fill in the operator, contact, hosting region, retention periods, sub-processors (OpenRouter and the model provider, email provider, host) and user rights. For India, follow the **DPDP Act 2023**: consent, notice, a grievance officer and erasure on request. Add GDPR terms if you accept EU users |
| Terms of service | Health and medical disclaimer (already drafted), acceptable use, limitation of liability, governing law |
| Refund / cancellation policy and contact page | Mandatory for Razorpay or Stripe India activation |
| Real account deletion | Deactivation is not enough. Both Google Play and the App Store require in-app account deletion plus a web deletion link. Implement a hard-delete or anonymize job (register P1-08, P3-09) |

### Step 3 — Deploy (week 1–2)
Recommended setup for a small team:

| Layer | Option | Notes |
|---|---|---|
| Web | Vercel (Next.js native) or the existing web Dockerfile on the VPS | Set `NEXT_PUBLIC_*` values only for non-secrets |
| API + MySQL | One VPS (Hetzner / DigitalOcean / AWS Lightsail, Mumbai region for Indian users) running `compose.production.yml` behind the included `infrastructure/Caddyfile` | 2 vCPU / 4 GB RAM is enough for the beta |
| Email | Resend, Postmark or Amazon SES | Set up SPF, DKIM and DMARC on the domain, then test real verification and reset emails (gate P6-02) |
| Backups | `infrastructure/backup.sh` to encrypted off-host storage (S3/B2) on a nightly cron | Run `restore-check.sh` once and record the result (gate P6-03) |
| Secrets | Fill `.env.production` from `.env.production.example` on the server only | Strong `APP_SECRET_KEY`, rotation plan |
| Release check | `backend/scripts/release_preflight.py` | Must pass before each deploy |

### Step 4 — Monitoring (with deploy)
- Error tracking: Sentry (free tier) on both web and API.
- Uptime: Better Stack or UptimeRobot on `/api/health/ready` and the home page, alerting to your phone.
- AI spend cap: a provider-side monthly budget limit, plus the existing `DAILY_AI_LIMIT`.

### Step 5 — Private beta (weeks 2–6)
- Recruit 20–50 users, following `BETA_VALIDATION.md`.
- Add product analytics with consent, e.g. PostHog (self-host or EU cloud). Track activation (first meal logged), day-1/7/30 retention, AI scans per user and AI cost per active user.
- Run the accuracy benchmark from register P0-01: about 100 weighed meals with reported error ranges. Make no accuracy claim until this is done.
- Test on real phones: the barcode, camera and permission matrix (P0-02, P4-02).

### Step 6 — Billing (weeks 4–8)
| Path | Use |
|---|---|
| Razorpay Subscriptions (India) or Stripe Billing | Web checkout. Implement checkout → signed, idempotent webhook → server-side entitlement → quota |
| Google Play Billing / Apple StoreKit via RevenueCat | Required if you sell subscriptions inside store apps |
| Tax | GST registration once over the threshold or when selling interstate digital services; invoices from the processor |

Start with Free plus one Plus plan (₹299–499/month, per `FEATURES_AND_MONETIZATION_20261027.md`). Test the full lifecycle in test mode: subscribe, renew, fail, cancel, refund.

### Step 7 — Store presence (optional, week 6+)
- Fastest route: package the PWA for Google Play as a Trusted Web Activity (Bubblewrap) or with Capacitor. Native iOS needs Capacitor or Expo plus App Store review.
- Store requirements: privacy policy URL, data safety form, account deletion, health-app disclaimers, screenshots and a support URL.

### Step 8 — Public launch
- A landing page at `/` for signed-out visitors (value proposition, screenshots, pricing, FAQ), with the app at `/app`. Today `/` is the workspace itself.
- SEO basics: metadata, Open Graph image, `sitemap.xml`, `robots.txt`.
- Launch channels: Product Hunt, Indian fitness communities, dietitian and coach partnerships (the coach booking feature supports this), short-form video of the companions and camera reps.

## 5. Priority checklist

- [ ] Commit and push all source to a private GitHub repo; fix the `frontend/web` gitlink
- [ ] Move about 4 GB of unrelated files out of the project folder
- [ ] Remove "Cal AI" references from public-facing text; run a trademark check on "TrackCal"
- [ ] Format the TypeScript sources with Prettier
- [ ] Choose the operator entity and domain; complete the privacy, terms, refund and contact pages
- [ ] Implement real account deletion (needed for the stores and DPDP)
- [ ] Deploy to a VPS with Caddy HTTPS; set up email with SPF/DKIM/DMARC
- [ ] Set up nightly encrypted off-host backups and one restore drill
- [ ] Add Sentry, uptime alerts and an AI budget cap
- [ ] Switch production AI to a paid no-retention model, or gate free models behind explicit consent
- [ ] Run a private beta with 20–50 users, consented analytics and the accuracy benchmark
- [ ] Connect Razorpay or Stripe billing with webhooks and entitlements
- [ ] Build the landing and pricing pages, plus SEO basics
- [ ] (Optional) Play Store TWA / iOS wrapper

Track each launch gate's closure in `LIMITATIONS_REGISTER.md` as usual.
