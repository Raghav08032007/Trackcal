// Report: every exercise, filmed many ways. Writes a table of how many real reps were counted.
import { it } from "vitest";
// On demand only (SIM_REPORT=1), as it films every exercise many times.
import { writeFileSync } from "node:fs";
import { EXERCISES, EXERCISE_VARIANTS, type ExerciseKind } from "@/lib/pose/types";
import { countExercise, exerciseSet } from "./sim/move-sim";
it.skipIf(!process.env.SIM_REPORT)("all exercises", () => {
  const kinds = (Object.keys(EXERCISES) as ExerciseKind[]).filter(k => !EXERCISE_VARIANTS[k]), rows: [string, number, number, string][] = [];
  const n = Number(process.env.SIM_N || 12);
  let real = 0, got = 0; const byView: Record<string, [number, number]> = {};
  for (const kind of kinds) {
    let r = 0, g = 0; const why: Record<string, number> = {};
    for (let seed = 1; seed <= n; seed++) { const s = exerciseSet(kind, seed + Number(process.env.SIM_SEED || 0), { depth: process.env.SIM_DEPTH ? process.env.SIM_DEPTH.split(",").map(Number) as [number, number] : undefined }); const c = countExercise(kind, s.frames); r += s.reps; g += Math.min(s.reps, c.counted);
      const v = `${Math.abs(Number(s.meta.yaw)) < 25 ? "front" : Math.abs(Number(s.meta.yaw)) < 65 ? "angled" : "side"} ${s.meta.device}`; byView[v] = byView[v] ?? [0, 0]; byView[v][0] += Math.min(s.reps, c.counted); byView[v][1] += s.reps;
      for (const [k, v] of Object.entries(c.rejected)) if (v) why[k] = (why[k] || 0) + v; for (const m of c.mismatches) why["shape:" + m] = (why["shape:" + m] || 0) + 1; }
    real += r; got += g; rows.push([kind, g, r, JSON.stringify(why)]);
  }
  rows.sort((a, b) => a[1] / a[2] - b[1] / b[2]);
  writeFileSync(process.env.SIM_OUT || "all.txt", `ALL ${got}/${real} = ${(100 * got / real).toFixed(1)}%\n` + Object.entries(byView).sort().map(([k, [g, r]]) => `VIEW ${k}: ${(100 * g / r).toFixed(1)}% of ${r}\n`).join("") + rows.map(([k, g, r, w]) => `${k.padEnd(12)} ${String(Math.round(100 * g / r)).padStart(3)}% ${g}/${r} ${w}`).join("\n"));
}, 900000);
