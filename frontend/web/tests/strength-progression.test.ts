import { describe, expect, it } from "vitest";
import { increment, sameExercise, suggestNext, type LoggedSet } from "@/lib/strength-progression";

const s = (day: string, name: string, sets: number, reps: number, load: number): LoggedSet => ({ day, name, sets, reps, load });

describe("what to try next time", () => {
  it("adds a rep inside the 8-12 range", () => {
    const r = suggestNext("Bench press", [s("2026-11-20", "Bench press", 3, 10, 40)])!;
    expect([r.sets, r.reps, r.load]).toEqual([3, 11, 40]);
  });

  it("adds weight at 12 reps and starts again at 8 (2.5 kg upper body, 5 kg legs, 1 kg light dumbbells)", () => {
    expect(suggestNext("bench press", [s("2026-11-20", "Bench Press", 3, 12, 40)])).toMatchObject({ reps: 8, load: 42.5 });
    expect(suggestNext("Back squat", [s("2026-11-20", "Back squat", 4, 12, 60)])).toMatchObject({ reps: 8, load: 65 });
    expect(suggestNext("Curl", [s("2026-11-20", "Curl", 3, 12, 6)])).toMatchObject({ reps: 8, load: 7 });
    expect(increment("Romanian deadlift", 50)).toBe(5);
  });

  it("holds steady when reps dropped at the same weight", () => {
    const r = suggestNext("Row", [s("2026-11-18", "Row", 3, 11, 30), s("2026-11-21", "Row", 3, 9, 30)])!;
    expect([r.reps, r.load]).toEqual([11, 30]);
  });

  it("bodyweight: one more rep, and a harder version past 20", () => {
    expect(suggestNext("Push-ups", [s("2026-11-20", "Push-ups", 3, 15, 0)])).toMatchObject({ reps: 16, load: 0 });
    expect(suggestNext("Push-ups", [s("2026-11-20", "Push-ups", 3, 20, 0)])).toMatchObject({ reps: 20 });
  });

  it("uses the most recent entry and ignores other exercises and unlogged names", () => {
    const h = [s("2026-11-10", "Bench press", 3, 8, 40), s("2026-11-20", "Bench press", 3, 10, 40), s("2026-11-21", "Squat", 3, 5, 80)];
    expect(suggestNext("Bench press", h)!.last.day).toBe("2026-11-20");
    expect(suggestNext("Deadlift", h)).toBeNull();
    expect(sameExercise("Bench-press ", "bench press")).toBe(true);
  });
});
