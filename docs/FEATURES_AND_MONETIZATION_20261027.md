# TrackCal features and monetization options

27 October 2026. Product inventory based on local implementation and the existing verification reports. Proposed paid offers below are not active billing plans.

## Features in the application

| Area | Implemented capability | Boundary |
|---|---|---|
| Accounts | Signup/login/logout, sessions, profile, password changes, verification/reset flows, account export and deactivation | Real SMTP delivery awaits operator setup |
| Food journal | Dated meal add/edit/repeat/delete, calorie/macronutrient totals, editable goals, manual water/activity/weight records | Nutrition estimates and self-reports require review |
| AI and food lookup | Text/photo nutrition inference, barcode lookup/decoding, USDA search and Open Food Facts | AI/provider quotas apply; physical-camera accuracy not independently certified |
| Smart tools | Recipe URL extraction, ingredient parsing, constrained meal planning, pantry, shopping subtraction and public price observations | Valid recipe/nutrition input needed; infeasible plans are reported |
| Media | Local label OCR and local speech transcription adapters | Workers/models must be running; device permissions remain platform-dependent |
| Progress | Journal-based trends, CSV interchange and print/save-as-PDF report | Reports use the active workspace's available records |
| Routines | Recurring calendar reminders/export and coach availability, booking, rescheduling and cancellation | External calendar sync/closed-browser delivery and real coach approval are separate prerequisites |
| Persistence | Account-scoped browser storage, IndexedDB recovery, backup/restore and revision-aware cloud snapshots | Not a complete cold-start offline native app |
| Gamification | Server XP, daily/weekly quests, streaks, badges, Label Detective and guest practice | Pantry Puzzle and Garden Dash remain planned |
| Companions | Six detailed 3D-style characters, progress unlocks, encouragement, reactions and following dock | Scripted interaction, not conversational AI or medical coaching |
| Guided daily plan | Progress-aware tasks, three effort levels, gentle/ready check-ins, focus view and actionable links | Participation plan; no invented meal prescription or reward for opening links |
| Household adapters | Grocy and Mealie adapters/configuration | Household owner binding and Mealie deployment remain unfinished |

## Proposed offers to validate

These INR prices are experiment starting points, not observed willingness-to-pay, revenue projections or current checkout offers.

| Offer | Proposed contents | Price experiment |
|---|---|---|
| Free | Manual journal, basic trends, data export, essential reminders, starter AI allowance, earned XP/characters and practice | Free |
| Plus | Larger measured AI allowance, advanced planning controls, reusable routines and richer reports | ₹299–499/month; test annual after retention evidence |
| Coach workspace | Multi-client management, consent-based sharing, client plans, scheduling and practice reports | ₹999–2,499/practice/month pilot; requires additional coach tooling |
| Cosmetic packs | Optional character outfits, backgrounds and celebration styles | ₹99–299 one-time; additional assets/store required |
| Coaching marketplace | Optional commission on completed paid sessions | Test 10–15%; payment, coach vetting and dispute operations required |
| Organization plans | Opt-in programs for gyms, dietitian practices or employers with tenant isolation and appropriate consent | Custom pilot; not implemented |

Start with a single Plus offer and a clear Free tier. Limit expensive AI usage based on measured costs; do not promise unlimited inference on a free upstream provider. Earned character unlocks should stay earned, and exporting a user's own data should remain available. Do not fund the product by selling identifiable food, weight or health-related records.

Use willingness-to-pay interviews and a consenting paid pilot before committing to prices. Track activation, weekly retention, AI cost per active member, conversion, cancellations and support time. Subscription benchmarks differ by category and access model: RevenueCat's 2026 report provides context, not proof that these proposed TrackCal prices will work: https://www.revenuecat.com/state-of-subscription-apps

## Before charging

Billing is currently disconnected. A paid release needs checkout, signed/idempotent provider webhooks, server-side entitlements and quotas, cancellation/refund handling, invoices/tax configuration and test/live reconciliation. Domain/HTTPS, email delivery, recovery drills, monitoring and outstanding security/device/accuracy checks remain launch gates. The user previously deferred deployment and SMTP setup. No customer payment or provider subscription was created in this update.

## Current interaction verification

Full frontend suite: 155 passed across 25 files. Production webpack build, TypeScript and ESLint passed. New tests cover incomplete-quest planning, pace changes, check-in responses, focus view, guest practice and completed-day rest. Opening or changing a plan makes no reward API calls. Character assets and prior unlock rules remain unchanged.
