# Daily progress release and product assessment

27 October 2026. Local product assessment, not an independent audit or demonstrated market rating.

## Delivered behavior

The home screen now opens with daily progress instead of the large promotional food illustration. It shows the selected journal date's energy, protein, carbohydrate, fat and water reference values from the existing workspace, with direct journal and goal-edit actions. References with a zero target are handled explicitly; bars cap visually while text retains excess amounts. Nutrition consumption never grants participation XP.

The companion panel shows account quest completions, a completed-day streak, earned XP and the next level unlock. Guests keep manual tracking and see an optional journey sign-in path. Account progress is retrieved from the server and refreshes on window focus or explicit refresh. The adventure date/timezone is shown separately from the selected nutrition journal date.

| Level | Total XP | Companion |
|---|---:|---|
| 1 | 0 | Pip |
| 2 | 250 | Nova |
| 3 | 500 | Milo |
| 4 | 750 | Luna |
| 5 | 1,000 | Rio |
| 6 | 1,250 | Sage |

Each level remains 250 XP. This deliberately replaces the earlier uneven unlock thresholds in response to the user's request for a new character at every level. Existing earned XP is retained; eligibility follows the new thresholds. After level 6, existing cosmetics and further XP progression remain available; no additional character is claimed.

A completed-day streak requires all three server-recorded daily actions: reviewed meal, feasible generated meal plan and completed Label Detective. Partial days do not count. Today's unfinished day can preserve yesterday's streak until tomorrow, using the fixed account timezone. The former meal-review streak is retained separately. The new fields are derived from the existing ledger, so no additional schema migration is needed.

The existing six 3D-style illustrations and original visual theme remain. The companion's guided daily plan/check-ins remain available on `/play`. Shared pointer-origin highlight feedback and press transitions add responsive touch/mouse interaction to buttons and links. Keyboard focus, disabled controls, calm mode and reduced motion remain supported. This is CSS/image animation, not skeletal 3D animation.

## Product rating

These are judgment-based scores using the implementation and verification evidence, not customer survey scores.

| Dimension | Assessment / 10 | Reason |
|---|---:|---|
| Feature breadth | 8 | Nutrition, planning, pantry, routines, progress and gamification exist |
| Daily journey and interface | 8 | Progress-first entry, meaningful actions and consistent companions; real device/accessibility testing still needed |
| Engineering verification | 7 | Broad automated and local live checks; production load/recovery evidence incomplete |
| Nutrition trust/accuracy | 5 | Reviewable estimates and data sources, but no independent weighed-meal benchmark |
| Differentiation | 7 | Coherent companion-led routine plus pantry/budget planning; uniqueness is unproven |
| Launch operations | 4 | Domain/HTTPS, SMTP, monitoring and recovery drills remain unfinished |
| Monetization readiness | 3 | Proposed offers exist; payments and entitlements remain disconnected |
| Demand and retention evidence | Unrated | No consenting customer cohort evidence; not replaced with an invented score |

Overall: approximately **7/10 as a local beta** and **4/10 for a public paid launch**. These are separate assessments, not an arithmetic average of missing evidence.

## Positioning and potential USP

Proposed positioning: **A companion-led nutrition routine that connects daily tracking, practical meal planning and earned progress.** Its stronger angle is the combined workflow: review food, plan within constraints, learn a little, and grow an earned companion collection without calorie competitions. Existing local/offline recovery and optional self-hosted integrations can support users who value data control, but do not imply zero external data processing: AI requests can use an external provider.

AI scanning, barcode tracking and meal planning alone are not unique. MyFitnessPal already documents these capabilities in its Premium/Premium+ offerings: https://support.myfitnesspal.com/hc/en-us/articles/360032625951-MyFitnessPal-Premium-features and https://support.myfitnesspal.com/hc/en-us/articles/34347930588557-Premium . TrackCal's proposed combined positioning needs user research and comparative testing before being marketed as a defensible advantage.

## Free versus paid proposal

Keep free: manual journal and corrections, editable basic targets, barcode/food search where costs permit, water/activity records, basic progress, user data export, starter quests, streaks, earned characters and a small explicitly limited AI allowance. Do not sell XP, require payment to maintain streaks or charge users to export their own records.

Validate a single Plus subscription first: higher measured AI quotas, advanced multi-day planning controls, richer reports and reusable routines. Start interviews/pilots around ₹299–499/month; this is a price hypothesis, not established willingness-to-pay. Higher tiers must cover actual model, hosting and support costs. Do not promise unlimited AI on a free upstream router.

Later options: coach practice subscriptions (requires multi-client/consent tooling), optional character outfits/background packs (requires new assets and storefront), and commissions on paid coaching (requires payment, vetting and dispute workflows). Employer/gym organization accounts require tenant isolation, administration and appropriate consent before sale. No paid offer or checkout was activated in this release.

## Next additions, in order

1. Production domain/HTTPS, email delivery, monitoring, backup restoration and dependency/security review.
2. Real billing lifecycle: checkout, signed/idempotent webhooks, server entitlements/quotas, cancellation/refunds, invoices and reconciliation.
3. Consenting pilot users and activation/weekly-retention/cost measurements; independent food-estimation accuracy evaluation.
4. Customizable daily quest goals, rest-day support and weekly reflection so routines suit users who do not need a new meal plan every day.
5. Consent-based coach dashboards and practical regional recipe/portion coverage.
6. More playable learning games and optional cosmetics after the core retention loop is validated. Pantry Puzzle and Garden Dash are still planned, not shipped.

For the complete existing feature inventory and service prerequisites, see [features and monetization](FEATURES_AND_MONETIZATION_20261027.md), [integration status](INTEGRATIONS_IMPLEMENTATION.md), and [release gates](READINESS_EXECUTION_20261026.md).


## Final verification

- Backend: 168 tests passed, 691 dependency/deprecation warnings.
- Frontend: 158 tests across 26 files passed using `npm test -- --pool=threads --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000` (20.27 seconds). An earlier integration error was corrected; subsequent fork-pool attempts encountered worker startup/termination timeouts. The thread-pool run completed without errors. No test assertions were weakened to get this result.
- Production webpack build, TypeScript and ESLint passed.
- Live web/API smoke: duplicate concurrent meal review awarded exactly once, owner isolation held, quiz scoring ignored forged XP and duplicate submits, and persisted summary remained correct. Disposable accounts were deactivated.
- Browser: refreshed actual home screen, toggled motion, opened journal, entered a disposable 300 kcal / 20 g protein / 30 g carbs / 10 g fat meal and observed all four reference bars update immediately. Removed only that synthetic entry and verified all values returned to zero. Existing account records were not altered.
- Screenshot: `daily-progress-dashboard-verification.png`. The image contains disposable verification data or the restored empty guest journal, not fabricated customer progress.

No production deployment or payment activation was performed.
