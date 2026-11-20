// Rep accuracy on real recordings (npm run rep-eval). Put volunteers' files (*.json or *.json.gz from the volunteer
// page, /workouts/camera/lab) in the repo's recordings/ folder, which git ignores. Each is checked, replayed through the
// counter exactly as the live camera feeds it, and compared with the reps the person really did. Skipped when empty.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { evaluate, replay, validate } from "@/lib/pose/recording";

const DIR = process.env.REP_RECORDINGS || join(process.cwd(), "../../recordings");
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => /\.json(\.gz)?$/.test(f) && f !== "report.json") : [];
const pct = (n: number) => `${Math.round(n * 100)}%`;

describe.skipIf(!files.length)("rep accuracy on real recordings", () => {
  it(`replays ${files.length} recordings from ${DIR}`, () => {
    const rows: { exercise: string; counted: number; app: number }[] = [], rejected: string[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(join(DIR, file));
        const rec = validate(JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")));
        rows.push({ exercise: rec.exercise, counted: rec.counted_reps, app: replay(rec) });
      } catch (e) { rejected.push(`${file}: ${e instanceof Error ? e.message : e}`); }
    }
    const { overall, by_exercise } = evaluate(rows);
    const line = (name: string, a: typeof overall) => `${name.padEnd(12)} ${String(a.sets).padStart(4)} sets  within ±1: ${pct(a.within_one).padStart(4)}  exact: ${pct(a.exact).padStart(4)}  average miss: ${a.mean_abs_error.toFixed(2)} reps`;
    console.log(["", "Rep accuracy (target: 90% of sets within ±1 rep)", line("all", overall), ...by_exercise.map(e => line(e.exercise, e)),
      ...(rejected.length ? ["", `Skipped ${rejected.length} file(s):`, ...rejected.map(r => "  " + r)] : [])].join("\n"));
    expect(rows.length + rejected.length).toBe(files.length);
  });
});
