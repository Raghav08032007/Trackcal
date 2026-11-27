# TrackCal status report: work left, competitors, ratings, food photo accuracy

27 November 2026. Ratings are out of 100. "Measured" means we ran a test today; "estimate" means a judgement.

---

## 1. Work left

### Done in the last two days (all on `main`)
Smooth page changes and error screens · beginner fixes (camera steps, workout starts) · equipment-aware workouts with
swap/skip · camera "get in position" check, too-close and camera-angle guidance · realistic MetaHuman coaches (face, hair,
clothes) · food photo look-alike rules, one-tap correction and photo tips · vitamins & minerals · adaptive calorie target ·
strength progression · pose model comparison · food photo, navigation and camera test tools · competitor analysis.

### What I will do (no input needed from you)

| # | Task | What it means for users | Size |
|---|---|---|---|
| 1 | **Food photo classifier without an LLM** (section 5) | Faster, cheaper, more consistent dish names; works offline | Large |
| 2 | Muscle recovery map | See which muscles are rested before training | Medium |
| 3 | AI nutrition chat in 16 languages | "What should I eat for dinner?" answered from your own log | Medium |
| 4 | Health Connect sync (inside the Android app) | Steps, weight, sleep, heart rate filled in automatically | Medium |
| 5 | Android app package (Play Store build) | Install from the Play Store | Medium |
| 6 | GLP-1 / medication companion | Dose and side-effect log, protein and water focus | Medium |
| 7 | Open Food Facts India + restaurant dishes | Packaged and eating-out foods found by search | Medium |
| 8 | 3D coach blinking and expressions; proper trainers | A coach that feels alive | Medium |
| 9 | 3D coach follow-along classes | Guided sessions in every language | Large |
| 10 | Trained rep counter (synthetic videos of the coaches) | More accurate counting on real bodies | Large |
| 11 | Shorter Workouts and Play pages; Diary vs device journal | Easier for first-time users | Small |
| 12 | Remaining ~1,100 translations (7 newer languages) | Every screen in every language | Large |
| 13 | Polish pass on every page (phone, laptop, dark mode) | Professional finish | Medium |
| 14 | Launch checks: security review, backups, monitoring | Safe to go public | Medium |

### What only you can do

| # | Task | Why it's needed | How |
|---|---|---|---|
| 1 | Run the database update and food import | Vitamins card and adaptive target need it | In `backend`: `.venv\Scripts\python.exe -m alembic upgrade head`, then `.venv\Scripts\python.exe scripts\seed_ifct.py`, then restart the backend |
| 2 | Record 5–10 short exercise videos of yourself | Measure camera accuracy on a real person | Camera page → Record (recording lab); squats, push-ups, curls, 10 reps each, side and front |
| 3 | Download the Mendeley exercise dataset | More real-person test videos | Save into `videos/mendeley` (CC BY 4.0) |
| 4 | Photograph 50–100 of your own meals and note the true dish | The best test set for Indian food | Any phone photos; a list of "file → dish" names |
| 5 | Mail server details in `backend/.env` | Email verification and password reset | SMTP host, user, password, from-address |
| 6 | Razorpay account and keys | Premium payments | Razorpay dashboard → API keys (test mode first) |
| 7 | Google Cloud OAuth client ID | "Sign in with Google" | console.cloud.google.com → Credentials |
| 8 | Google Play developer account | Play Store listing | US$25 one-time, play.google.com/console |
| 9 | ICMR-NIN permission for IFCT data | Legal use of the Indian food table at launch | Email NIN Hyderabad |
| 10 | Legal review of Terms and Privacy; confirm MetaHuman licence for web use | Launch requirements | A lawyer |
| 11 | Native speakers to check translations | Quality in 16 languages | One reviewer per language |
| 12 | Decide the photo model budget (section 5) | Accuracy vs cost | Keep Gemini Flash, or allow a stronger model for hard photos |

---

## 2. Competitors: every feature they have, and where we stand

Apps compared: MyFitnessPal, HealthifyMe, Cronometer, MacroFactor, Lose It!, Lifesum, Yazio, Fitia, Noom, Fitbod,
Freeletics, Nike Training Club, cult.fit, Apple Fitness+, Strava, camera form apps (Strive, FormCoach, FormLab, Firefly).

| Feature | Who has it | TrackCal | Plan |
|---|---|---|---|
| Food search, barcode, recipes | All | ✅ (barcode free) | — |
| AI photo logging | MFP (Cal AI), HealthifyMe, Lifesum, Fitia | ✅ with one-tap correction | Classifier (section 5) |
| Voice / text meal logging | MFP, Lifesum, Fitia | ✅ | — |
| Vitamins & minerals | Cronometer | ✅ new | Add B12 via USDA import |
| Adaptive calorie target | MacroFactor | ✅ new | — |
| Strength progression | Fitbod, Freeletics | ✅ new | Recovery map next |
| Camera rep counting + form tips | Camera apps | ✅ | Real-person accuracy |
| Workouts that fit your equipment | Fitbod | ✅ | — |
| Meal planner, pantry, shopping, budget | Mealime-type apps | ✅ | — |
| Fasting timer | Zero, MFP | ✅ | — |
| Community, challenges, events | Strava, MFP | ✅ (+QR check-in) | — |
| Games, levels, a character | Rare | ✅ | — |
| Many languages | HealthifyMe (few) | ✅ 16 | Finish 7 newer ones |
| Works offline in a browser | None | ✅ | — |
| Play Store / App Store app | All | ❌ | Item 5 |
| Health Connect / Apple Health / wearables | MFP, Cronometer, HealthifyMe, Strava | ❌ | Item 4 |
| AI nutrition chat | HealthifyMe (Ria), MFP, Fitia | ⚠️ coach lines only | Item 3 |
| Muscle recovery map | Fitbod | ⚠️ muscle finder only | Item 2 |
| GLP-1 programme | HealthifyMe, Noom, MFP | ❌ | Item 6 |
| Restaurant + huge packaged database | MFP, Lose It! | ⚠️ USDA + Indian | Item 7 |
| Live / on-demand classes | cult.fit, Apple Fitness+, NTC | ❌ | Item 9 (3D coach) |
| Google / Apple sign-in | Most | ❌ | Needs your OAuth ID |
| Human coaches / dietitians | HealthifyMe, Noom | ⚠️ booking built, no payments | Needs Razorpay |
| Psychology course (habits) | Noom | ❌ | Later |
| Lab report reading | HealthifyMe | ⚠️ health report exists | Medical review |
| Sleep, heart rate, readiness | Fitbit, Whoop, Oura | ⚠️ manual sleep | After Health Connect |
| Smartwatch app | Strava, NTC, Fitbod | ❌ | After the Android app |
| Glucose monitor (CGM) | HealthifyMe Pro, Levels | ❌ | Not now |
| Family plans | MFP, Noom | ❌ | After payments |

## 3. What only TrackCal has (unique selling points)

1. **Food tracking and a live camera coach in one app**: food apps have no form coach, form apps have no food tracking.
2. **16 languages, 11 of them Indian**, including spoken coaching, right-to-left Urdu and Arabic.
3. **Built for Indian food**: IFCT values, cooked portions first, regional names; biryani is told from pulao.
4. **Free barcode scanning** (MyFitnessPal charges for it).
5. **Workouts that adapt to the equipment you own**, with one-tap swaps.
6. **Private by design**: the camera video never leaves the phone.
7. **Budget meal planner + pantry + prices**, rare in calorie apps.
8. **A game layer and a 3D coach character** that levels up with you.
9. **Community events with QR check-in.**
10. **Works in any browser, even offline, without installing.**

---

## 4. Ratings (out of 100)

### Business
| Area | Score | Why |
|---|---|---|
| Product–market fit (India) | 72 | Strong fit for Indian food and languages; not yet tested with real users |
| Differentiation | 85 | Unique food + camera + languages combination |
| Pricing and monetisation | 35 | Premium designed, payments not connected |
| Distribution (stores, sign-in) | 20 | No store app or Google sign-in yet |
| Brand and trust | 25 | No reviews, no published accuracy yet |
| Legal readiness | 40 | Terms/Privacy drafted; IFCT permission and legal review pending |
| Scalability (tech) | 70 | Rate limits, caching, tests; no production monitoring yet |
| **Business overall** | **50** | Strong product, not yet launch-ready commercially |

### Features
| Area | Score |
|---|---|
| Food logging (search, barcode, voice, recipes) | 88 |
| Food photo recognition | 70 |
| Nutrition depth (macros, vitamins, adaptive target) | 82 |
| Workouts and planning | 80 |
| Camera coaching | 72 |
| Community and motivation | 82 |
| Languages | 90 |
| Health and wearable sync | 10 |
| **Features overall** | **76** |

### Working (quality)
| Area | Score | Evidence |
|---|---|---|
| Stability | 90 | 1,021 app tests and 1,130 server tests pass; 55-page click-through with 0 errors |
| Ease of use for beginners | 75 | Reviewed screen by screen; long pages remain |
| Speed | 78 | Pages under 0.3 s on most screens (production build) |
| Phone layout | 85 | No sideways scrolling on 16 main screens |
| Accessibility | 70 | Labels and focus in place; full audit pending |
| **Working overall** | **80** | |

### Accuracy and precision (measured)
*Accuracy*: how often the answer is right. *Precision*: when the app says something, how often that is true.

| What | Accuracy | Precision | Test |
|---|---|---|---|
| Food photo: right dish first | 67% | 67% (one answer per photo) | 36 photos, 16 Indian dishes |
| Food photo: right dish first or in the alternatives | 81% | — | same |
| Food photo: vegetarian vs non-vegetarian | 97% (35/36) | 97% | same |
| Food search: right food for everyday Indian searches | 100% | 100% | 100 searches |
| Nutrition values from the IFCT table | matches the published table | — | spot checks (spinach, chana, milk) |
| Photo calories | not measured | — | needs weighed meals |
| Camera rep count within ±1 | 95% | — | 40 videos of the 3D coach |
| Camera rep count, exact | 93% | — | same |
| Camera rep count on real people | not measured | — | needs your recordings |

---

## 5. Food photos: which AI, why it made the mistake, and improving it without an LLM

**What we use now:** the photo goes to **Google Gemini 2.5 Flash** through OpenRouter (falling back to Gemini 2.5
Flash-Lite, then Qwen 3.7 Flash). These are general-purpose AI models: very broad, but not trained specifically on Indian
dishes, and they can confuse look-alike plates (a meat biryani read as vegetable pulao). Since this week they get explicit
look-alike rules, return alternatives, and the user can correct with one tap.

**Can we do it without an LLM? Yes: a dedicated food classifier.**

| | General AI model (now) | Dedicated food classifier (plan) |
|---|---|---|
| How | Describes the photo in words | A small image model trained only on food photos |
| Indian dishes | Good, inconsistent on look-alikes | Very good on the dishes it was trained on |
| Speed | 3–15 s, needs internet | Under 0.5 s, can run on the phone |
| Cost per photo | Paid per request, rate limited | Free after training |
| Portions and mixed plates | Good | Weak (classifier names dishes, doesn't weigh them) |
| Consistency | Can vary between tries | Same photo, same answer |

**Plan (hybrid, the best of both):**
1. Train an image classifier (EfficientNet / MobileNet-class, exported to ONNX for the phone) on openly licensed Indian
   food photos plus photos users correct with consent. A first target is about 120 common Indian dishes.
2. The classifier names the dish and its top 3 alternatives instantly and offline; nutrition comes from our IFCT/recipe
   database, not from an AI guess.
3. The general AI model is used only when the classifier is unsure (low confidence) or for portion size on mixed plates.
4. Every "Not right?" correction becomes training data (with consent), so accuracy keeps rising.
5. Measure with `tools/food-bench` and your own labelled photos; target 85% right first, 95% within the alternatives.

**Quick win without new training:** keep Gemini Flash for most photos, but send low-confidence photos to a stronger
vision model (one extra request only when unsure).
