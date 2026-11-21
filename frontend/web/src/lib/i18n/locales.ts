// The languages TrackCal speaks, in the order the picker shows them. Wave 1 (launch): the largest Indian-language groups and the
// biggest non-English fitness-app markets (India, Brazil, Mexico and Latin America, Indonesia, the Gulf). See docs/LANGUAGES.md.
// reviewed: a native speaker has checked the translation. Until then the picker says "draft".
export type LocaleCode = "en" | "hi" | "bn" | "mr" | "te" | "ta" | "es" | "pt" | "id" | "ar" | "kn" | "ml" | "gu" | "pa" | "ur" | "fr" | "de";
export type Locale = { code: LocaleCode; native: string; english: string; dir: "ltr" | "rtl"; reviewed: boolean;
  /** For numbers and dates: Indian grouping (1,00,000) for Indian languages, regional styles elsewhere. */
  format: string };
export const LOCALES: Locale[] = [
  { code: "en", native: "English", english: "English", dir: "ltr", reviewed: true, format: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", dir: "ltr", reviewed: false, format: "hi-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", dir: "ltr", reviewed: false, format: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", dir: "ltr", reviewed: false, format: "mr-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", dir: "ltr", reviewed: false, format: "te-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", dir: "ltr", reviewed: false, format: "ta-IN" },
  // Wave 2: the core screens are translated; anything else shows in English until its phase (docs/LANGUAGES.md).
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", dir: "ltr", reviewed: false, format: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", dir: "ltr", reviewed: false, format: "ml-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", dir: "ltr", reviewed: false, format: "gu-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", dir: "ltr", reviewed: false, format: "pa-IN" },
  { code: "es", native: "Español", english: "Spanish", dir: "ltr", reviewed: false, format: "es" },
  { code: "pt", native: "Português (Brasil)", english: "Portuguese (Brazil)", dir: "ltr", reviewed: false, format: "pt-BR" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian", dir: "ltr", reviewed: false, format: "id-ID" },
  // Wave 2: Europe's largest fitness-app markets (France, Germany, also Belgium, Switzerland, Austria and francophone Africa).
  { code: "fr", native: "Français", english: "French", dir: "ltr", reviewed: false, format: "fr-FR" },
  { code: "de", native: "Deutsch", english: "German", dir: "ltr", reviewed: false, format: "de-DE" },
  { code: "ar", native: "العربية", english: "Arabic", dir: "rtl", reviewed: false, format: "ar" },
  // Wave 2, right to left like Arabic. Format "ur": Western digits (123,456), as Urdu apps in Pakistan and India use and as
  // the server texts write them; "ur-IN" would switch to Urdu digits and mix the two on one screen.
  { code: "ur", native: "اردو", english: "Urdu", dir: "rtl", reviewed: false, format: "ur" },
];
export const DEFAULT_LOCALE: LocaleCode = "en";
export const isLocale = (value: unknown): value is LocaleCode => LOCALES.some(l => l.code === value);
export const localeOf = (code: LocaleCode) => LOCALES.find(l => l.code === code)!;
