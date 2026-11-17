// Squat counting the way real phones and laptops see people (tests/sim): many body sizes, camera angles, heights and distances,
// arm positions, stance widths, depths from a half squat down, speeds and frame rates, with tracking jitter and dropped frames.
// Real reps must count; movements that only look like squats must not. Set SIM_OUT to also write a breakdown.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { count, lookalike, squatSet } from "./sim/squat-sim";

describe("squats filmed in the real world", () => {
  it("counts at least 96% of real reps across 120 varied sets", () => {
    let real = 0, got = 0, over = 0;
    const by: Record<string, [number, number]> = {};
    const tally = (key: string, r: number, g: number) => { const v = by[key] ||= [0, 0]; v[0] += g; v[1] += r; };
    for (let seed = 1; seed <= 120; seed++) {
      const s = squatSet(seed), c = count(s);
      real += s.reps; got += Math.min(c.counted, s.reps); over += Math.max(0, c.counted - s.reps);
      const yaw = Math.abs(Number(s.meta.yaw)), view = yaw < 30 ? "front" : yaw < 65 ? "angled" : "side";
      for (const key of [`view ${view}`, `device ${s.meta.device}`, `arms ${s.meta.arms}`, `fps ${s.meta.fps}`, `shallowest ${Number(s.meta.depthMin) < 65 ? "half" : "deeper"}`]) tally(key, s.reps, Math.min(c.counted, s.reps));
    }
    if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, `reps counted ${got}/${real} (${(100 * got / real).toFixed(1)}%), extra ${over}\n` + Object.entries(by).sort().map(([k, [g, r]]) => `${k}: ${(100 * g / r).toFixed(1)}% of ${r}`).join("\n"));
    expect(got / real).toBeGreaterThanOrEqual(.96);
    expect(over).toBeLessThanOrEqual(3);
  }, 300000);

  it("counts nothing when someone bows, picks something up, sways, reaches up, sits down, stands still or walks", () => {
    const wrong: string[] = [];
    for (const kind of ["bow", "pickup", "sway", "reach", "sit", "still", "walk"] as const) for (let seed = 1; seed <= 15; seed++) { const n = count(lookalike(seed * 7 + 3, kind)).counted; if (n) wrong.push(`${kind}#${seed}: ${n}`); }
    expect(wrong).toEqual([]);
  }, 300000);
});
