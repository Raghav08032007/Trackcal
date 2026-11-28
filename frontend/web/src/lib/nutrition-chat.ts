// AI nutrition chat (Phase 4), the browser side. The server (backend/services/nutrition_chat.py) adds the saved diary, diet,
// allergies, budget and health conditions from the account and checks every reply against hard safety rules. The browser adds
// what only it knows (pantry, today's targets and check-in), turns a suggested food into a diary meal, and reads replies aloud.
import { localeOf } from "./i18n/locales";
import { locale, msg } from "./i18n";
import type { CoachDay } from "./coach";
import type { DiaryMeal } from "./diary";
import type { PantryEntry } from "./smart-tools";
import { VOICE_KEY, voiceScore } from "./workout-coach";
import type { LocaleCode } from "./i18n/locales";

export type ChatFood = { name: string; local_name: string; grams: number; source: string; estimated: boolean;
  per_100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number } };
export type ChatReply = { reply: string; foods: ChatFood[]; safety: "crisis" | "eating" | "urgent" | "fallback" | null };
export type ChatTargets = { calories?: number; protein?: number; carbs?: number; fat?: number } | null;

export const CHAT_STARTERS = [msg("What should I eat for dinner?"), msg("Am I getting enough protein this week?"),
  msg("What can I cook from my pantry?"), msg("A healthy snack within my budget?"), msg("Give me a 10 minute workout")];

/** What the browser adds for the AI: the pantry soonest-to-expire first, targets, what is left today and how the person feels. */
export function chatContext(day: CoachDay | null, pantry: PantryEntry[], targets: ChatTargets) {
  const hour = day?.hour ?? new Date().getHours();
  const items = [...pantry].filter(item => item.name.trim() && item.grams > 0)
    .sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999")).slice(0, 30)
    .map(item => ({ name: item.name.slice(0, 60), grams: Math.round(item.grams), ...(item.expires ? { expires: item.expires } : {}) }));
  return {
    time_of_day: hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening", pantry: items,
    ...(day && !day.minor ? { calories_left: Math.round(day.caloriesLeft), protein_left: Math.round(day.proteinTarget - day.proteinEaten),
      targets: Object.fromEntries(Object.entries(targets ?? {}).filter(([, v]) => typeof v === "number" && v > 0)) } : {}),
    workout_streak_days: day?.streak ?? 0, energy_today: day?.checkin?.energy ?? null, soreness_today: day?.checkin?.sore ?? null,
  };
}

/** A suggested food as a diary meal: per-100 g values with the grams, so the diary works out the totals the same way as any meal. */
export function foodToMeal(food: ChatFood, now = new Date()): DiaryMeal {
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const per = food.per_100g, scale = food.grams / 100;
  return {
    id: crypto.randomUUID(), time, name: food.local_name || food.name, method: msg("Coach suggestion"), grams: food.grams,
    calories: Math.round(per.calories * scale), protein: Math.round(per.protein_g * scale * 10) / 10,
    carbs: Math.round(per.carbs_g * scale * 10) / 10, fat: Math.round(per.fat_g * scale * 10) / 10,
    items: [{ name: (food.local_name && food.local_name !== food.name ? `${food.local_name} (${food.name})` : food.name).slice(0, 200), grams: food.grams,
      nutrients: { calories: per.calories, protein: per.protein_g, carbs: per.carbs_g, fat: per.fat_g },
      food_id: null, manual_override: food.estimated, estimated: food.estimated, source: `Coach · ${food.source}`.slice(0, 90) }],
  } as DiaryMeal;
}

/** The speech code browsers use for an app language: "hi" -> "hi-IN", "es" -> "es-ES", "pa" -> "pa-IN". */
export function speechLang(code: LocaleCode = locale()) {
  const format = localeOf(code).format;
  return format.includes("-") ? format : ({ es: "es-ES", ar: "ar-SA", ur: "ur-PK", fr: "fr-FR", de: "de-DE", en: "en-IN" } as Record<string, string>)[format] ?? format;
}

/** Reads a reply aloud in the app's language with the person's chosen coach voice, else the most natural one. False when it can't. */
export function speak(text: string, synth: SpeechSynthesis | undefined = typeof window === "undefined" ? undefined : window.speechSynthesis): boolean {
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang();
  let picked: string | null = null;
  try { picked = localStorage.getItem(VOICE_KEY); } catch { /* private mode */ }
  const voices = (synth.getVoices?.() ?? []).filter(v => voiceScore(v, utterance.lang) > 0).sort((a, b) => voiceScore(b, utterance.lang) - voiceScore(a, utterance.lang));
  const voice = (picked && voices.find(v => v.voiceURI === picked || v.name === picked)) || voices[0];
  if (voice) utterance.voice = voice;
  utterance.rate = .96;
  synth.cancel(); synth.speak(utterance);
  return true;
}
