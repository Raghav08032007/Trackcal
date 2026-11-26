// Replays landmarks saved by the video bench (node tools/video-bench/run.mjs <folder> --dump) and prints, per frame window,
// what the counter's body checks saw: REPLAY=<file.landmarks.json> REPLAY_KIND=curl npx vitest run tests/video-replay.test.ts
import { readFileSync } from "node:fs";
import { it } from "vitest";
import { readBody, type Body } from "@/lib/pose/body-shape";
import { normalize } from "@/lib/pose/landmarks";
import { SessionTracker } from "@/lib/pose/session-tracker";
import type { ExerciseKind, PoseFrame } from "@/lib/pose/types";

it.skipIf(!process.env.REPLAY)("replay saved landmarks", () => {
  const frames = JSON.parse(readFileSync(process.env.REPLAY!, "utf8")) as PoseFrame[], kind = (process.env.REPLAY_KIND ?? "curl") as ExerciseKind;
  const tracker = new SessionTracker(kind), form = tracker.config.form;
  const rows: string[] = [];
  let longest = 0, box: Record<string, [number, number, number, number]> = {}, last = "";
  for (const f of frames) {
    const r = tracker.frame(f), p = normalize(f); if (!r || !p) continue;
    const b: Body = readBody(p, longest); if (Number.isFinite(b.scale)) longest = Math.max(longest * .9995, b.scale);
    for (const [part, pts] of Object.entries(b.points)) pts.forEach((l, i) => { if (!l) return; const k = part + i, q = box[k] ?? [l.x, l.x, l.y, l.y]; box[k] = [Math.min(q[0], l.x), Math.max(q[1], l.x), Math.min(q[2], l.y), Math.max(q[3], l.y)]; });
    const failing = form?.never ? Object.entries({ never: form.never(b) }).filter(([, v]) => v).map(([k]) => k).join("") : "";
    rows.push(`${(f.timestamp / 1000).toFixed(1)}s ${r.phase.padEnd(10)} reps=${r.reps} angle=${Math.round(tracker.lastObservation?.angle ?? -1)} side=${tracker.lastObservation?.side ?? "-"} facing=${b.facing.toFixed(2)} tilt=${Math.round(b.tilt)} knee=${Math.round(b.knee)} hip=${Math.round(b.hip)} handH=${b.handHeight.toFixed(2)} headDown=${b.headDown.toFixed(2)} wristUp=${b.wristUp.toFixed(2)} ${failing ? "NEVER" : ""}`);
    if (r.phase !== last && (r.phase === "UP" || r.phase === "SETUP")) {
      const scale = longest || 1, d = (k: string) => box[k] ? (Math.hypot(box[k][1] - box[k][0], box[k][3] - box[k][2]) / scale).toFixed(2) : "-";
      rows.push(`   travel/torso since last top: elbows L ${d("elbows0")} R ${d("elbows1")} · wrists L ${d("wrists0")} R ${d("wrists1")} · shoulders L ${d("shoulders0")} R ${d("shoulders1")}`);
      box = {};
    }
    last = r.phase;
  }
  console.log(rows.filter((_, i) => i % 3 === 0 || rows[i].startsWith("   ")).join("\n"));
  console.log("mismatches", tracker.counter.mismatches, "reps", tracker.counter.reps);
});
