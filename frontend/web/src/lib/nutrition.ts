import { t } from "@/lib/i18n";
import type { OnboardingParams, OnboardingPlanResult } from "./api";

export function calculatePlan(params: OnboardingParams): OnboardingPlanResult {
  const ranges = [[params.age, 20, 100], [params.weight_kg, 30, 350], [params.height_cm, 100, 230]];
  if (!Number.isInteger(params.age) || ranges.some(([value, min, max]) => !Number.isFinite(value) || value < min || value > max)) throw new Error(t("Enter an age of 20–100, weight of 30–350 kg and height of 100–230 cm."));
  const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extremely_active: 1.9 };
  if (!(params.activity_level in multipliers) || !["male", "female", "other"].includes(params.gender) || !["lose_weight", "maintain", "gain_muscle", "recomposition"].includes(params.primary_goal)) throw new Error(t("Choose valid goal and activity options."));
  const bmr = Math.round(10 * params.weight_kg + 6.25 * params.height_cm - 5 * params.age + (params.gender === "male" ? 5 : -161));
  const tdee = Math.round(bmr * multipliers[params.activity_level]);
  const target = params.primary_goal === "lose_weight" ? Math.max(1200, tdee - 500) : params.primary_goal === "gain_muscle" ? tdee + 300 : tdee;
  const fat = Math.round(target * .25 / 9);
  const protein = Math.min(Math.round(params.weight_kg * 1.7), Math.floor(target * .4 / 4));
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  return { bmr, tdee, calorie_target: target, deficit_or_surplus: target - tdee,
    macros: { protein_g: protein, protein_kcal: protein * 4, protein_pct: Math.round(protein * 4 / target * 100), carbs_g: carbs, carbs_kcal: carbs * 4, carbs_pct: Math.round(carbs * 4 / target * 100), fat_g: fat, fat_kcal: fat * 9, fat_pct: Math.round(fat * 9 / target * 100) },
    recommended_water_ml: Math.round(params.weight_kg * 35), strategy_notes: t("Calculated locally from the values you entered. Adjust targets with your nutrition professional if needed.") };
}

export function scaleNutrition(food: { calories: number; protein: number; carbs: number; fat: number }, factor: number, caloriesMultiplier = 1, fatMultiplier = 1) {
  if (![factor, caloriesMultiplier, fatMultiplier, ...Object.values(food)].every(n => Number.isFinite(n) && n >= 0)) throw new Error(t("Invalid nutrition or portion."));
  const round = (n: number) => Math.round(n * 10) / 10;
  return { calories: Math.round(food.calories * factor * caloriesMultiplier), protein: round(food.protein * factor), carbs: round(food.carbs * factor), fat: round(food.fat * factor * fatMultiplier) };
}
