# Personalized onboarding flow

28 October 2026. Authenticated /onboarding uses eight steps; guest onboarding remains the existing three-step device flow. /plan is the returning-user plan, nutrition-ideas, education, reminders and private-measurement screen.

| Step | Data and behavior |
|---|---|
| 1 Welcome | Benefits, privacy, optional measurement explanation and existing Pip companion guidance |
| 2 Profile | Existing display name, optional age group/language/country, IANA timezone, units and optional explicit measurement saving |
| 3 Interests | Fitness, strength, endurance, mobility, yoga, running, sports and routine |
| 4 Experience | Beginner/intermediate/experienced/unspecified, accessibility and optional professional instructions |
| 5 Schedule | Available/rest days, duration/time, setting and actual equipment |
| 6 Nutrition | Diet, declared allergies, cuisine, preparation, available ingredients, optional budget/currency |
| 7 Reminders | Five optional categories, times/frequency, quiet hours and motivational preference |
| 8 Review | Summary, Back to edit, explicit completion and first-plan save |

Back, Next and Save & resume persist a validated cloud draft with a revision number. Stale revisions produce a conflict rather than overwriting another page's edits. Optional questions can be skipped by leaving them blank/defaulted. Saved steps resume across sign-in. Unsaved keystrokes are memory-only; do not claim offline autosave. A failed save preserves the current form until the page closes. Completion and plan creation are separate retry-safe operations: onboarding is not rewarded twice if plan generation fails and is retried.

Measurements are explicitly saved through a separate button and never required for Next/Finish. Profile preferences store no fabricated measurement timestamps. Language choice is retained; current interface/education remain English. Timezone validation uses IANA names; personalization timezone may change, while the established reward timezone does not.

Accessibility: labeled native controls, fieldsets/legends, progress and status/error semantics, keyboard-operable controls and reduced-motion CSS. Mobile shows the introductory character in document flow to avoid covering forms; existing users retain minimize/disable preferences. Dark surfaces use the existing shared theme.

In-app reminders poll while visible and on focus. Enable/disable each category, choose daily/weekdays/weekends, set times/quiet hours and snooze/dismiss. At most one delivery per category/local day; equal quiet times disable the quiet window. No Notification permission, external push delivery or hidden closed-browser scheduler is introduced. Existing local calendar exports remain separate snapshots.

See PHASE_TEST_REPORT.md and LIMITATIONS_REGISTER.md for observed browser coverage and unverified manual/physical scenarios.
