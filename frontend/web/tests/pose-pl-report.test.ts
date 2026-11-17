// Report (on demand: SIM_REPORT=1): push-ups and lunges filmed many ways, and movements that must count nothing.
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { count } from "./sim/squat-sim";
import { lungeSet, notARep, pushupSet } from "./sim/moves3d";
it.skipIf(!process.env.SIM_REPORT)("push-ups and lunges", () => {
  const lines: string[] = [];
  for (const [name, make, exercise] of [["pushup", pushupSet, "pushup"], ["lunge", lungeSet, "lunge"]] as const) {
    let real = 0, got = 0, over = 0, exact = 0; const why: Record<string, number> = {}, bad: string[] = [];
    const n = Number(process.env.SIM_N || 120), from = Number(process.env.SIM_FROM || 1);
    for (let seed = from; seed < from + n; seed++) { const s = make(seed), c = count(s, exercise); real += s.reps; got += Math.min(c.counted, s.reps); over += Math.max(0, c.counted - s.reps); if (c.counted === s.reps) exact++;
      for (const [k, v] of Object.entries(c.rejected)) if (v) why[k] = (why[k] || 0) + v; for (const m of c.mismatches) why["shape:" + m] = (why["shape:" + m] || 0) + 1;
      if (c.counted !== s.reps && bad.length < 14) bad.push(`  ${seed} ${c.counted}/${s.reps} ${JSON.stringify(s.meta)} ${JSON.stringify(Object.fromEntries(Object.entries(c.rejected).filter(([, v]) => v)))} ${c.mismatches.slice(0, 3).join(",")}`); }
    lines.push(`${name.toUpperCase()} ${got}/${real} = ${(100 * got / real).toFixed(1)}% exact ${exact}/${n} extra ${over} ${JSON.stringify(why)}`, ...bad);
  }
  for (const [exercise, kinds] of [["pushup", ["plank", "hips", "taps"]], ["lunge", ["step", "stand", "walk"]]] as const) for (const kind of kinds) {
    let n = 0; for (let seed = 1; seed <= 15; seed++) n += count(notARep(seed, kind), exercise).counted; lines.push(`${exercise} on ${kind}: ${n} false`);
  }
  writeFileSync(process.env.SIM_OUT || "pl.txt", lines.join("\n"));
}, 900000);
