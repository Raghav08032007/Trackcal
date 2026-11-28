import { describe, expect, it, vi } from "vitest";
import { chatContext, foodToMeal, speak, type ChatFood } from "@/lib/nutrition-chat";
import { toServer } from "@/lib/diary";
import type { CoachDay } from "@/lib/coach";

const day: CoachDay = { diet: "vegetarian", hour: 19, minor: false, meals: 2, caloriesLeft: 640, proteinEaten: 42, proteinTarget: 70, program: null, rested: null, streak: 3, checkin: { date: "2026-11-28", energy: "low", sore: "bit" } };
const paneer: ChatFood = { name: "Paneer bhurji", local_name: "पनीर भुर्जी", grams: 150, source: "IFCT 2017", estimated: false,
  per_100g: { calories: 230, protein_g: 14, carbs_g: 6, fat_g: 17 }, totals: { calories: 345, protein_g: 21, carbs_g: 9, fat_g: 25.5 } };

describe("what the browser adds for the AI", () => {
  it("sends the pantry soonest-to-expire first, what is left today and the check-in", () => {
    const pantry = [{ id: "1", name: "Rice", grams: 2000, expires: "" }, { id: "2", name: "Paneer", grams: 200, expires: "2026-11-30" }, { id: "3", name: "Spinach", grams: 250, expires: "2026-11-29" }, { id: "4", name: " ", grams: 5, expires: "" }];
    const out = chatContext(day, pantry, { calories: 1800, protein: 70, carbs: 0 });
    expect(out.pantry.map(p => p.name)).toEqual(["Spinach", "Paneer", "Rice"]);
    expect(out).toMatchObject({ time_of_day: "evening", calories_left: 640, protein_left: 28, targets: { calories: 1800, protein: 70 }, energy_today: "low", soreness_today: "bit", workout_streak_days: 3 });
  });
  it("never sends calories for an under-18", () => {
    const out = chatContext({ ...day, minor: true }, [], { calories: 1800 });
    expect(out).not.toHaveProperty("calories_left");
    expect(out).not.toHaveProperty("targets");
  });
});

describe("one tap to log a suggested food", () => {
  it("becomes a diary meal with grams and per-100 g values, so totals match the card", () => {
    const meal = foodToMeal(paneer, new Date(2026, 10, 28, 19, 5));
    expect(meal).toMatchObject({ time: "19:05", name: "पनीर भुर्जी", calories: 345, protein: 21, grams: 150 });
    expect(meal.items?.[0]).toMatchObject({ name: "पनीर भुर्जी (Paneer bhurji)", grams: 150, nutrients: { calories: 230, protein: 14 }, estimated: false });
    const body = toServer(meal, "2026-11-28");
    expect(body.meal_type).toBe("dinner");
    expect(body.items[0].grams * body.items[0].nutrients.calories! / 100).toBeCloseTo(345);
  });
  it("marks an AI estimate as estimated", () => {
    expect(foodToMeal({ ...paneer, estimated: true, source: "AI estimate" }).items?.[0]).toMatchObject({ estimated: true, manual_override: true });
  });
});

describe("reading replies aloud", () => {
  it("speaks in the app's language and says so when it can't", () => {
    class Utterance { lang = ""; voice: unknown = null; constructor(public text: string) {} }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    const spoken: Utterance[] = [], synth = { cancel: vi.fn(), speak: (u: Utterance) => spoken.push(u), getVoices: () => [] } as unknown as SpeechSynthesis;
    expect(speak("Hello", synth)).toBe(true);
    expect(spoken[0].text).toBe("Hello");
    expect(spoken[0].lang).toBe("en-IN");
    expect(speak("Hello", undefined)).toBe(false);
    vi.unstubAllGlobals();
  });
});
