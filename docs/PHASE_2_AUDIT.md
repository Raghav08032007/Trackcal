# Phase 2 pre-implementation audit

28 October 2026. Brief: personalized onboarding, wellness calculations, adaptive plans and integration with Phase 1. Branch: codex/phase-2-personalization in the root repository and embedded frontend checkout; existing changes preserved.

Baseline before implementation: 180 backend tests passed; 170 frontend tests across 29 files passed. No baseline application failures. Existing docs inspected: UI_UX_REDESIGN.md, GAMIFICATION_ARCHITECTURE.md, PHASE_TEST_REPORT.md and LIMITATIONS_REGISTER.md.

Actual MySQL schema inspection found users, user_profiles, user_settings, user_allergens, user_workspaces, adventure_profiles, reward_events, activity_reward_events, achievements and related Phase 1 tables. No personalization progress, timestamped measurement-history, persisted workout-plan or in-app reminder-delivery tables exist. Existing profile stores optional height/weight but not timestamped unit history. These existing records must remain untouched during migration.

Auth uses the existing active-user dependency and server HttpOnly cookie proxy. Meal logs already exist server-side; manual workout sessions are account-scoped device entries. Three-step guest onboarding and local calendar/ICS reminders are implemented. Preserve those guest/calendar functions while adding authenticated eight-step onboarding and server scheduling. Shared JourneyCompanion is root-mounted and reads the central gamification summary; do not create a second character.

Safety audit: the legacy adult calorie calculator accepts age 18+, includes deficit and water formulas, and must not be used by the new youth flow. New personalization will not call it or generate calorie targets. Curated templates are application-reviewed for conservative instructions, not clinically certified exercise prescriptions. Professional free-text restrictions cannot be medically interpreted: suppress automated exercise recommendations when supplied and offer a professional-review state.

No new dependency is needed. Phase 3 remains out of scope. Phase 2 limitations will be appended to the central register and the final report.
