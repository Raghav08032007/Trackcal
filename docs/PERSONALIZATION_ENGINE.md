# Personalization engine

Version 1, 28 October 2026. Rule-based and explainable; no paid model calls. The engine is `backend/services/personalization.py`; request validation is in personalization_inputs.py.

## Priority order

1. Professional free-text restrictions or pain feedback block automated exercise suggestions. Rest remains available on selected rest/unavailable days. The application stores instructions but cannot interpret them medically.
2. Filter templates by actual equipment, setting and accessibility (seated, no-floor, low-impact). No chair/equipment is assumed when absent. No eligible choices produces an explicit empty/review state, not a fabricated program.
3. Preferred rest days override available days. Generate the remaining days of the current Monday-based local week. Starting/completing requires today in the personalization timezone. Rescheduling allows today through 28 days ahead and respects chosen rest days; substitution cannot bypass rest-day protections.
4. Order eligible activities by selected interest overlap, with stable template-ID tie breaking. General, strength, endurance, mobility, running, yoga, home and gym choices come from the curated catalog. Sports maps to general preparation, not sport-specific coaching.
5. Conservative duration is at most 10 minutes for beginner/unspecified experience, 20 otherwise, and never above the selected duration. Too-demanding feedback reduces it by five minutes, with a five-minute floor. Disliked templates are avoided; pain blocks exercise until the user reviews/corrects feedback. Comfortable feedback does not automatically increase load, difficulty or duration.

Height, weight, BMI, XP and streaks are not generator inputs. Templates have version/application-review metadata and explicit recovery/alternative instructions. This is an application safety review, not independent clinical certification. No technique diagnosis or wearable verification is implied.

## Nutrition ordering and trust

Filter by diet and declared known allergens first. Gluten excludes wheat/oats. Unknown allergens or professional instructions suppress meal suggestions for review. Rank cuisine, meal-preparation preference and overlap with available ingredients; stable IDs break ties. Ingredient substitutions are flexible ideas requiring ingredient/packaging/cross-contact checks. No recipe is certified allergy-safe.

Ideas have no invented calories, grams, prices or intake limits. Explicit journal transfer loads a meal description only after a click. Users add actual portions and review the existing scanner/text/manual nutrition workflow before logging. Completing onboarding synchronizes diet/allergy tags/currency and an explicitly supplied budget into the existing account-scoped recipe planner preferences; it does not overwrite calorie targets or fabricate pantry quantities.

## History, choices and future modules

Plans retain explanations in snapshots and recommendation history. Regenerating archives the previous plan, preserving completed history. Users may reject/skip, substitute, pause, edit preferences and review old feedback. Completing exercise activities is self-reported; persistence and idempotency do not prove physical performance.

Relevant community/event categories may be returned as interests with operational=false. There is no social feed, event enrollment or attendance verification in this phase. Community/event/challenge rewards stay disabled. Full multi-skill progression remains outside the single fitness education module.

Two clocks are explicit: editable personalization timezone controls plans/reminders; the existing immutable adventure timezone controls daily XP caps/streaks. Changing reminder timezone never resets the reward day or permits reward replay.
