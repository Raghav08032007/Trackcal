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
];
export const WAVE_1 = ["hi", "bn", "mr", "te", "ta", "es", "pt", "id", "ar"] as const;
