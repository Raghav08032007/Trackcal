// The screens whose every text is translated in each wave-1 language. tests/i18n.test.ts fails if any text in these files is
// missing from a catalog, so a finished screen never falls back to English. Screens are added here as they are translated.
export const TRANSLATED_FILES = [
  "src/lib/sections.ts",
  "src/components/app-navigation.tsx",
  "src/components/section-hub.tsx",
  "src/components/language-picker.tsx",
  "src/app/root-layout.tsx",
  "src/app/food/page.tsx",
  "src/app/me/page.tsx",
  "src/app/move/page.tsx",
  "src/components/quick-add.tsx",
  "src/components/theme-control.tsx",
  "src/components/sync-status.tsx",
  "src/components/beta-feedback.tsx",
  "src/components/auth-form.tsx",
  "src/components/account-recovery.tsx",
  "src/components/home-dashboard.tsx",
  "src/components/coach-card.tsx",
  "src/components/today-tasks.tsx",
  "src/components/recovery-checkin.tsx",
  "src/components/retest-reminder.tsx",
  "src/components/day-card.tsx",
  "src/components/first-steps.tsx",
  "src/components/daily-progress-hub.tsx",
  "src/components/photos.tsx",
  "src/components/quick-log.tsx",
  "src/lib/coach.ts",
];
/** Texts that reach t() only at run time (from the server, or a variable): listed so every language must have them too. */
export const RUNTIME_KEYS = [
  "calories", "protein", "carbs", "fat",                                  // nutrient names in the daily progress card
  "Resting it", "Easing back", "Recovered",                               // recovery stages (services/recovery.py)
  "Activity", "Sleep", "Nutrition", "Water", "Steadiness",                // Health Score parts (services/daily_tasks.py)
  "Numbness or tingling", "New swelling or warmth", "Pain that wakes you at night", "Weakness or giving way", "A new fall or injury", "Fever or feeling unwell",
];
export const WAVE_1 = ["hi", "bn", "mr", "te", "ta", "es", "pt", "id", "ar"] as const;
