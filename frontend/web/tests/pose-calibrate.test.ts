// Report: what the analyzer reads at the start position and at the bottom of every rep, per exercise (SIM_CAL=1).
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { EXERCISES, EXERCISE_VARIANTS, type ExerciseKind } from "@/lib/pose/types";
import { EXERCISE_CONFIG } from "@/lib/pose/exercise-config";
import { EitherSideAnalyzer, JointAnalyzer } from "@/lib/pose/analyzers";
import { exerciseSet } from "./sim/move-sim";
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
it.skipIf(!process.env.SIM_CAL)("calibrate", () => {
  const kinds = (Object.keys(EXERCISES) as ExerciseKind[]).filter(k => !EXERCISE_VARIANTS[k]), out: Record<string, unknown> = {};
  const n = Number(process.env.SIM_N || 12);
  for (const kind of kinds) {
    const c = EXERCISE_CONFIG[kind]; if (!c) continue;
    const tops: number[] = [], bottoms: number[] = [], peaks: number[] = [], durs: number[] = [];
    for (let seed = 1; seed <= n; seed++) {
      const s = exerciseSet(kind, seed + 1000), a = c.either ? new EitherSideAnalyzer(c) : new JointAnalyzer(c);
      const per = new Map<number, { min: number; t0: number; t1: number }>(); let settle = 0;
      s.frames.forEach((f, i) => { const o = a.observe(f), l = s.labels[i]; if (!o.valid || !Number.isFinite(o.angle)) return;
        if (l < 0) { if (++settle > 20) tops.push(o.angle); return; }
        const r = per.get(l) ?? { min: Infinity, t0: f.timestamp, t1: f.timestamp }; r.min = Math.min(r.min, o.angle); r.t1 = f.timestamp; per.set(l, r); });
      for (const r of per.values()) if (Number.isFinite(r.min)) { bottoms.push(r.min); durs.push(r.t1 - r.t0); }
    }
    void peaks;
    out[kind] = { up: c.up, down: c.down, hy: c.hysteresis, range: c.minRangeDeg, minMs: c.minRepMs,
      top10: +q(tops, .1).toFixed(1), top50: +q(tops, .5).toFixed(1), bot50: +q(bottoms, .5).toFixed(1), bot85: +q(bottoms, .85).toFixed(1), bot95: +q(bottoms, .95).toFixed(1), dur10: Math.round(q(durs, .1)) };
  }
  writeFileSync(process.env.SIM_OUT || "cal.json", JSON.stringify(out, null, 0).replace(/\},/g, "},\n"));
}, 900000);
