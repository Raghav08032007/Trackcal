// Phase C1: every camera exercise has a coach (pattern, steps, mistakes with fixes), the tabs work by mouse and keyboard,
// easier/harder switches exercise, and the set report names the one thing to fix from the most common miss.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CoachGuide, SetReport, SportCoachGuide } from "../src/components/coach-guide";
import { EXERCISES, type ExerciseKind } from "../src/lib/pose/types";
import { PATTERNS, SPORT_COACH, coachFor, patternOf } from "../src/lib/pose/coach";

describe("coach content", () => {
  it("gives every exercise a pattern with steps, three mistakes with fixes and a breathing cue", () => {
    for (const kind of Object.keys(EXERCISES) as ExerciseKind[]) {
      const c = coachFor(kind);
      expect(PATTERNS[patternOf(kind)]).toBe(c);
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.mistakes).toHaveLength(3);
      for (const m of c.mistakes) { expect(m.mistake.length).toBeGreaterThan(3); expect(m.fix.length).toBeGreaterThan(10); }
      expect(c.breath).toMatch(/breathe/i);
    }
  });
  it("covers every sport", () => {
    for (const s of Object.values(SPORT_COACH)) { expect(s.steps).toHaveLength(4); expect(s.mistakes).toHaveLength(3); expect(s.drill).toMatch(/practice/i); }
  });
});

describe("CoachGuide", () => {
  it("switches tabs by click and arrow keys, and picks an easier or harder exercise", () => {
    const pick = vi.fn();
    render(<CoachGuide kind="squat" onPick={pick} />);
    expect(screen.getByRole("tab", { name: "Technique" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Push your hips back and bend your knees/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Common mistakes" }));
    expect(screen.getByText("Knees falling inwards")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Common mistakes" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Easier & harder" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Sumo squats/ }));
    expect(pick).toHaveBeenCalledWith("sumo");
  });
  it("shows a sport's drill and has no levels tab", () => {
    render(<SportCoachGuide kind="box" />);
    expect(screen.getByText(/rounds of 1 minute jab-cross/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Easier & harder" })).toBeNull();
  });
});

describe("SetReport", () => {
  it("names the most common miss as the one thing to fix", () => {
    render(<SetReport result={{ kind: "squat", reps: 8, missed: { too_shallow: 3, too_fast: 1, too_slow: 0, lost_tracking: 0, wrong_exercise: 0 } }} />);
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();                       // 8 of 12 attempts
    expect(screen.getByText(/Go a little deeper on each rep/)).toBeTruthy();
    expect(screen.getByText("Not deep enough")).toBeTruthy();
  });
  it("praises a clean set", () => {
    render(<SetReport result={{ kind: "pushup", reps: 10, missed: { too_shallow: 0, too_fast: 0, too_slow: 0, lost_tracking: 0, wrong_exercise: 0 } }} />);
    expect(screen.getByText(/Every rep counted/)).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
