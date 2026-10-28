# Beta evidence and launch decision

No customer demand, retention, accuracy or unit-economics score is assigned until evidence exists. Run a consent-based pilot with 20–30 people from the intended audience, for example budget-conscious home cooks. These are proposed targets, not measured results.

## First-use study

Ask each person to create/recover an account, set preferences, log a real meal, correct a portion, import a recipe and build a pantry-aware shopping list. Observe without coaching. Record completion, time, confusion and why they would switch from their current workflow. Do not record passwords, meal photos or health details in research notes. Fix the repeated blockers before adding more features.

## Metrics to define before recruitment

- Activation: onboarding plus one reviewed saved meal within 24 hours.
- Retention: returning to record a meal in days 6–8 and again in days 27–33. Define denominators and report cohort size, not just a percentage.
- Utility: repeated weekly use of pantry/planning and user-reported time or money saved, without presenting self-reports as controlled evidence.
- Reliability: failed requests by workflow; non-AI and AI latency reported separately; data-loss incidents, successful restore drill and support response time.
- Economics: actual hosting, model, email and support cost divided by active users; compare to an explicitly tested pricing/funding hypothesis. Free dependencies do not establish free operation.

Collect product events only after an operator chooses a privacy-respecting analytics approach and updates the data notice/consent. Until then, a minimal opt-in beta interview/event worksheet can be maintained manually. Do not silently add third-party trackers.

## Accuracy study

Build a consented, independently reviewed set of weighed portions and reference nutrition, including regional/home-cooked foods, mixed dishes, different lighting and portion sizes. Keep test samples separate from prompt tuning. Measure calorie/macro/gram absolute errors and report slices and outliers, not only an average. Track how often users must correct an estimate. Do not claim food-allergy safety or medical suitability from a photo model.

`backend/scripts/evaluate_nutrition.py` accepts records with `id`, `reference_method: weighed_and_reviewed`, and `reference`/`estimate` objects containing calories/protein/carbs/fat/grams. No real benchmark has been supplied; no accuracy score has been manufactured.

## Device and release matrix

Test current supported Android Chrome and iOS Safari on actual devices: camera capture, barcode focus/low light, microphone start/stop/denial, interrupted recording, backgrounding, fresh offline journal startup after installation, queue reconnection, signed-out/wrong-account queues and deletion/export. Test keyboard-only navigation, screen-reader names, 200% zoom and reduced motion. Record device/OS/browser version and failures.

Deploy privately first, test real email delivery and HTTPS cookies, run the disposable database restore drill and a controlled load test using synthetic accounts. Agree on a launch threshold and owner for each gate. Public launch stays closed if recovery, isolation, data preservation or incident response fails.
