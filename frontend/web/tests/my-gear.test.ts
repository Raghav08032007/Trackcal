import { describe, expect, it } from "vitest";
import { canDo, fitToGear, swapFor } from "@/lib/my-gear";
import { EXERCISES, gearOf, type ExerciseKind } from "@/lib/pose/types";

const all = Object.keys(EXERCISES) as ExerciseKind[];

describe("equipment you have", () => {
  it("unset gear allows everything; bodyweight is always allowed", () => {
    expect(all.every(k => canDo(k, null))).toBe(true);
    expect(all.filter(k => gearOf(k) === "body").every(k => canDo(k, []))).toBe(true);
    expect(canDo("curl", [])).toBe(false);
    expect(canDo("curl", ["dumbbell"])).toBe(true);
  });

  it("every gear exercise has a no-equipment swap you can do, never jumping from easy to hard", () => {
    const level = { easy: 0, medium: 1, hard: 2 };
    for (const k of all.filter(k => gearOf(k) !== "body")) {
      const to = swapFor(k, []);
      expect(to, k).not.toBeNull();
      expect(canDo(to!, []), `${k} -> ${to}`).toBe(true);
      expect(level[EXERCISES[to!].difficulty] - level[EXERCISES[k].difficulty], `${k} -> ${to}`).toBeLessThan(2);
    }
  });

  it("picks what a coach would: the bodyweight form of the same pattern", () => {
    expect(swapFor("wsquat", [])).toBe("squat");
    expect(swapFor("bench", [])).toBe("pushup");
    expect(swapFor("deadlift", [])).toBe("bwgoodmorning");
    expect(swapFor("raise", [])).not.toBe("hspu");
    expect(swapFor("kickback", ["chair"])).toBe("dip");
  });

  it("prefers the same movement with gear you do have", () => {
    expect(swapFor("curl", ["band"])).toBe("bandcurl");
  });

  it("fits a workout: keeps what you can do, swaps the rest without repeating an exercise", () => {
    const { circuit, changes } = fitToGear({ id: "x", name: "Mixed", rest: 30, steps: [{ kind: "squat", target: 10 }, { kind: "curl", target: 10 }, { kind: "press", target: 8 }] }, []);
    expect(circuit.steps[0].kind).toBe("squat");
    expect(changes.map(c => c.from)).toEqual(["curl", "press"]);
    expect(circuit.steps.every(s => canDo(s.kind, []))).toBe(true);
    expect(new Set(circuit.steps.map(s => s.kind)).size).toBe(circuit.steps.length);
    expect(circuit.steps[1].target).toBe(10);
  });

  it("changes nothing while gear is not set", () => {
    const c = { id: "x", name: "W", rest: 30, steps: [{ kind: "curl" as const, target: 10 }] };
    expect(fitToGear(c, null)).toEqual({ circuit: c, changes: [] });
  });
});
