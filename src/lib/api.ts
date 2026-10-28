import { calculatePlan } from "./nutrition";
/**
 * api.ts — TrackCal Full-Stack API Client
 * Local calculations and same-origin server requests. Provider failures remain visible.
 */



export interface OnboardingParams {
  age: number;
  gender: "male" | "female" | "other";
  weight_kg: number;
  height_cm: number;
  activity_level: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active";
  primary_goal: "lose_weight" | "maintain" | "gain_muscle" | "recomposition";
  speed_kg_per_week?: number;
  dietary_preference?: string;
  regional_cuisine?: string;
}

export interface OnboardingPlanResult {
  bmr: number;
  tdee: number;
  calorie_target: number;
  deficit_or_surplus: number;
  macros: {
    protein_g: number;
    protein_kcal: number;
    protein_pct: number;
    carbs_g: number;
    carbs_kcal: number;
    carbs_pct: number;
    fat_g: number;
    fat_kcal: number;
    fat_pct: number;
  };
  recommended_water_ml: number;
  strategy_notes: string;
}

export interface BarcodeProductResult {
  source: string;
  barcode: string;
  product_name: string;
  brand?: string;
  serving_size: string;
  nova_group: number | null;
  nutriscore_grade?: string;
  nutrients_per_100g: {
    energy_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugars_g?: number;
    sodium_mg?: number;
  };
  allergens?: string[];
  ingredients_text?: string;
}

export async function calculateOnboardingPlan(params: OnboardingParams): Promise<OnboardingPlanResult> {
  return calculatePlan(params);
}

/**
 * Look up barcode via Open Food Facts / USDA
 */
export async function lookupBarcodeNutrition(code: string): Promise<BarcodeProductResult> {
  if (!/^\d{8,14}$/.test(code)) throw new Error("Enter an 8–14 digit UPC/EAN barcode.");
  const response = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Product lookup failed.");
  return data;
}

/**
 * Parse a meal description through the server AI route.
 */
export async function parseMealWithAI(prompt: string): Promise<import("./meal-analysis").MealAnalysis> {
  return analyzeMeal({ text: prompt });
}

async function analyzeMeal(input: { text?: string; image?: string }): Promise<import("./meal-analysis").MealAnalysis> {
  const response = await fetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(70000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to analyze this meal.");
  return data;
}

export async function analyzeMealPhoto(file: File) {
  if (!file.size) throw new Error("Choose a nonempty image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image under 10 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
  return analyzeMeal({ image });
}
