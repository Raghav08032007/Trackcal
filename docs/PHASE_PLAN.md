# TrackCal phase plan: every competitor feature, one at a time

28 November 2026. One feature per phase. A phase is finished only when all of these are true:
1. **End to end:** it works from the first screen to saved data, on phone and laptop, in all 16 languages, light and dark.
2. **Real samples:** it is tested on real inputs (photos, videos, foods, people), not only on made-up test data.
3. **Measured:** accuracy and precision are scored out of 100 against a target set before building it.
4. **Beginner test:** a first-time user can finish the task without help (click-through test, no dead ends).
5. **Beats the competitor:** it passes the "better than" check in its row.
6. **Automated tests:** app and server tests pass, then it is pushed.

After each phase I report the scores and wait for your "continue" before starting the next.

Scores are out of 100. "Now" is what we measured on 27–28 November 2026.

---

## Phase 1: Accuracy and precision of what already exists

| Area | Now | Target | How we raise it | Real-sample test |
|---|---|---|---|---|
| Food photo: right dish first | 69% (Gemini) / 61% (own classifier) | 80% | Classifier and Gemini agree-check; your labelled meal photos as examples; stronger model only for unsure photos | 48 bench photos + your 50–100 meal photos |
| Food photo: right dish in the top 4 | 81% / 83% | 95% | Same | Same |
| Food photo: veg vs non-veg | 97% | 100% | Never offer a veg name when meat or egg is seen | Same |
| Photo calories (portion) | not measured | within ±25% on 8 of 10 meals | Plate and spoon size reference, typical portions per dish | 20 weighed meals (kitchen scale) |
| Food search (everyday Indian words) | 100% (34 foods) | 100% on 200 foods | Larger test list, regional spellings, Hindi/Tamil/Telugu typing | 200 searches |
| Camera rep count within ±1 | 95% (3D coach videos) | 95% on real people | Your recordings and open datasets; per-exercise thresholds | Your 5–10 videos + Mendeley set |
| Form tips correct | not measured | 85% | Label 100 reps good/bad | Same videos |

**Better than:** Cal AI and HealthifyMe publish no Indian-dish accuracy. We publish ours (see Phase 20).

---

## Phase 2: Yoga, breathing and meditation with posture scoring (your idea; no competitor has all of it)

| Part | What we build |
|---|---|
| Asana library | 40 asanas in 4 levels from the Ministry of AYUSH Common Yoga Protocol: Tadasana, Vrikshasana, Utkatasana, Trikonasana, Virabhadrasana I/II/III, Parsvakonasana, Adho Mukha Svanasana, Phalakasana, Bhujangasana, Shalabhasana, Dhanurasana, Setu Bandhasana, Naukasana, Paschimottanasana, Ardha Matsyendrasana, Vajrasana, Sukhasana, Padmasana, Malasana, Balasana, Marjaryasana-Bitilasana, Ustrasana, Garudasana, Natarajasana, Ardha Chakrasana, Uttanasana, Makarasana, Pawanmuktasana, Sarvangasana (advanced, with warning), Shavasana and more |
| Each asana | Steps, benefits, who should avoid it (pregnancy, blood pressure, back and knee problems), hold time, breathing cue, easier and harder variation |
| Demos | Our own 3D coaches perform every pose (no real people's videos). Websites and YouTube are used only as references for correct form, never copied |
| Posture scoring (camera) | Joint angles compared with the correct pose: a 0–100 match score, hold timer (counts only while the pose is held), balance steadiness, left/right symmetry, spoken corrections such as "straighten your back knee" |
| Surya Namaskar | 12-step flow, counts rounds, checks each step |
| Pranayama | Guided breathing with an animated circle and sound: Anulom Vilom, Bhramari, Ujjayi, box breathing; Kapalbhati with safety notes |
| Meditation | Guided sessions of 3, 5, 10 and 20 minutes in 16 languages, body scan, sleep wind-down, streaks |
| Programmes | "Yoga for back pain", "Morning 15 minutes", "Flexibility in 30 days", "Office desk yoga"; added to workout plans and the game layer |

**Real-sample test:** pose-match score on the Yoga-82 research images (licence checked) plus your recordings.
**Targets:** asana recognised correctly 90%; "pose correct vs not" agrees with a teacher's judgement 85%; hold timer within ±1 s.

**Better than:** cult.fit has video yoga but no posture check; yoga apps such as Down Dog and Glo have no food tracking and no camera scoring.

---

## Phases 3–20: one competitor feature each

| Phase | Feature (competitor) | What we build to win | Real-sample test and target | Needs from you |
|---|---|---|---|---|
| 3 | Muscle recovery map (Fitbod) | Front and back body map coloured by fatigue from logged sets, camera workouts and yoga; "ready today" workout suggestion | 4 weeks of real logs give sensible maps; a trainer agrees on 9 of 10 | — |
| 4 | AI nutrition chat (HealthifyMe Ria, MyFitnessPal) | Answers from your own diary, targets, pantry and budget, in 16 languages, voice in and out; one tap to log what it suggests; safety rules for minors and medical topics | 100 real questions: helpful and correct 90%, unsafe advice 0 | A free LLM key (below) |
| 5 | GLP-1 / weight-loss medicine companion (Noom, HealthifyMe) | Dose schedule and reminders, side-effect log, protein and water targets, muscle-loss guard (strength and protein nudges), a report for the doctor | Walk through 4 weeks of sample doses | Medical review of the wording |
| 6 | Huge restaurant and packaged database (MyFitnessPal, Lose It!) | Open Food Facts India import, restaurant chain menus (with permission or public nutrition pages), "eating out" estimates for common restaurant dishes | 200 real packaged barcodes found 90%; 100 restaurant dishes within ±20% | — |
| 7 | Habit and psychology course (Noom) | 10-minute daily lessons (sleep, stress eating, portions, festivals), quizzes, linked to your own data, in 16 languages | 10 testers finish week 1 | Native-speaker review |
| 8 | Sleep, heart rate, readiness (Fitbit, Whoop, Oura) | Readiness score from sleep, resting heart rate, training load and recovery map; manual entry now, automatic after Phase 11 | 2 weeks of real data give sensible scores | — |
| 9 | Live / on-demand classes (cult.fit, Apple Fitness+, Nike Training Club) | 3D coach follow-along classes (strength, HIIT, yoga, mobility) in 16 languages with live camera rep counting and form tips | 10 classes; reps counted within ±1 at 95% | — |
| 10 | Play Store app (all) | Android app (Trusted Web Activity / Capacitor) with the same features, camera and offline mode | Install on 3 real phones (low, mid, high end) | Play developer account (US$25 one-time) |
| 11 | Health Connect / wearables (MyFitnessPal, Cronometer, Strava) | Steps, weight, sleep, heart rate, workouts and blood glucose read automatically; our meals and workouts written back | Real phone with Google Fit or a Samsung watch | An Android phone |
| 12 | GPS run, walk and ride tracking (Strava, Nike Run Club) | Route map (OpenStreetMap), pace, splits, calories, audio cues in 16 languages, community challenges | 5 real runs vs a reference watch: distance within ±3% | — |
| 13 | Smartwatch app (Strava, Nike Training Club, Fitbod) | Wear OS tile: today's calories, start a workout, rep and heart-rate view | Real Wear OS watch | A Wear OS watch (optional) |
| 14 | Google / Apple sign-in (most apps) | One-tap Google sign-in; Apple sign-in when the iOS app comes | Sign up and sign in on phone and laptop | Google OAuth client ID (free) |
| 15 | Payments and subscriptions (all) | Razorpay (UPI, cards), Premium monthly and yearly, trial, refunds, invoices with GST | Test-mode payments, then one real ₹1 payment | Razorpay account and keys |
| 16 | Human coaches and dietitians (HealthifyMe, Noom) | Verified coach profiles, booking, chat, coach sees the diary with your consent, paid sessions | 2 real coaches run 3 sessions | Coaches; Razorpay (Phase 15) |
| 17 | Family plans (MyFitnessPal, Noom) | Up to 5 members, shared meal plans and shopping, child-safe profiles | 2 real families for a week | — |
| 18 | Lab report reading (HealthifyMe) | Read a blood report photo or PDF, explain values in plain words, link to food advice; never diagnose | 20 sample reports: values read correctly 98% | Medical review |
| 19 | Glucose monitor link (HealthifyMe Pro, Levels) | Glucose from Health Connect next to meals: which foods spike you | One user with a CGM for 2 weeks | A CGM user (optional) |
| 20 | Reviews and a published accuracy record (established apps) | Public "How accurate is TrackCal" page with our measured scores, in-app ratings, beta testers, launch checks (security, backups, monitoring) | Security review passes; 50 beta testers | Legal review; ICMR-NIN permission |

Phases 10 onwards depend on your accounts. If those aren't ready when we get there, I'll move to the next phase that needs nothing from you and return later.

---

## Free keys for testing, paid for production

| What for | Free for testing | Paid for production | Key needed now? |
|---|---|---|---|
| AI photo, chat and voice (LLM) | **Google AI Studio Gemini API key**: free tier, rate limited (aistudio.google.com) · **OpenRouter** (already set up): free models · **Groq**: free tier, fast for chat | Gemini paid tier or OpenRouter credits (pay per use) | Yes, by Phase 4: a Gemini AI Studio key |
| Food photo without an LLM | Our own classifier (done): free, no key | Same | No |
| Pose tracking (camera, yoga) | MediaPipe, on the phone: free, no key | Same | No |
| Packaged foods | Open Food Facts: free, no key · USDA FoodData Central: free key (api.data.gov) | Same | Optional: USDA key |
| Maps for GPS | OpenStreetMap / MapLibre: free with attribution | A paid tile host (MapTiler, Stadia) at scale | No |
| Email (verification, reset) | Gmail app password, or Brevo free (300 emails/day) | Brevo, Amazon SES or Postmark | Yes, for sign-up email |
| Google sign-in | Google OAuth client ID: free | Free | Phase 14 |
| Payments | Razorpay test mode: free | Razorpay live (fee per payment) | Phase 15 |
| Error monitoring | Sentry free tier | Sentry Team | Phase 20 |
| Wearables | Health Connect: free, no key | Free | No |
| Play Store | — (US$25 one-time) | Same | Phase 10 |

Keys go only in `backend/.env` (never in the app code or in git).
