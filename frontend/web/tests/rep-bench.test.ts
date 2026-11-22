// Rep-count bench (SIM_BENCH=1 npm test -- rep-bench): every exercise, filmed many ways with the simulated body, scored the
// way a user feels it. For real sets: how often the count is exactly right and within one rep. For half reps (a quarter
// of the movement) and for standing still: how often anything is counted at all, which must be almost never.
// Writes a table to SIM_OUT (default rep-bench.txt). Real volunteers' recordings stay the final judge (npm run rep-eval).
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { EXERCISES, EXERCISE_VARIANTS, type ExerciseKind } from "@/lib/pose/types";
import { countExercise, exerciseSet } from "./sim/move-sim";

const pct = (n: number, d: number) => d ? Math.round(100 * n / d) : 100;
it.skipIf(!process.env.SIM_BENCH)("rep bench", () => {
  const only = process.env.SIM_ONLY?.split(",") as ExerciseKind[] | undefined;
  const kinds = only ?? (Object.keys(EXERCISES) as ExerciseKind[]).filter(k => !EXERCISE_VARIANTS[k]);
  const n = Number(process.env.SIM_N || 10), seed0 = Number(process.env.SIM_SEED || 0);
  const rows: { kind: string; exact: number; one: number; sets: number; reps: number; counted: number; half: number; halfSets: number; still: number }[] = [];
  for (const kind of kinds) {
    let exact = 0, one = 0, reps = 0, counted = 0, half = 0, still = 0;
    for (let s = 1; s <= n; s++) {
      const real = exerciseSet(kind, s + seed0), c = countExercise(kind, real.frames).counted;
      reps += real.reps; counted += Math.min(c, real.reps); if (c === real.reps) exact++; if (Math.abs(c - real.reps) <= 1) one++;
      const quarter = exerciseSet(kind, 1000 + s + seed0, { depth: [.12, .28], reps: 4 });
      if (countExercise(kind, quarter.frames).counted > 0) half++;
      const idle = exerciseSet(kind, 2000 + s + seed0, { reps: 0 });
      if (countExercise(kind, idle.frames).counted > 0) still++;
    }
    rows.push({ kind, exact: pct(exact, n), one: pct(one, n), sets: n, reps, counted, half: pct(half, n), halfSets: n, still: pct(still, n) });
  }
  rows.sort((a, b) => a.one - b.one || a.exact - b.exact);
  const total = (k: "exact" | "one" | "half" | "still") => Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length);
  const repShare = pct(rows.reduce((a, r) => a + r.counted, 0), rows.reduce((a, r) => a + r.reps, 0));
  const lines = [`EXERCISES ${rows.length} · sets each ${n}`, `exact count: ${total("exact")}% · within one rep: ${total("one")}% · real reps counted: ${repShare}%`,
    `half reps counted (should be ~0): ${total("half")}% of sets · standing still counted (should be 0): ${total("still")}% of sets`, "",
    "exercise        exact  ±1   reps counted   half-rep sets counted   still counted",
    ...rows.map(r => `${r.kind.padEnd(14)} ${String(r.exact).padStart(5)}% ${String(r.one).padStart(4)}%  ${String(r.counted).padStart(4)}/${String(r.reps).padEnd(4)}      ${String(r.half).padStart(4)}%                ${String(r.still).padStart(4)}%`)];
  writeFileSync(process.env.SIM_OUT || "rep-bench.txt", lines.join("\n") + "\n");
  console.log(lines.slice(0, 3).join("\n"));
}, 1_800_000);
