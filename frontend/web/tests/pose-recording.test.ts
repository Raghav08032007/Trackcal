// Rep recordings: only body points are kept, a recording replays through the same counter as the live camera, files
// from volunteers are checked before use, and the accuracy summary is right.
import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Recorder, evaluate, framesOf, replay, validate, FORMAT } from "@/lib/pose/recording";
import type { PoseFrame } from "@/lib/pose/types";

type Fixture = { fps: number; width: number; height: number; base: number[][]; frames: { t: number; p: Record<string, number[]> }[] };
const fixture = (name: string): Fixture => JSON.parse(gunzipSync(readFileSync(`tests/fixtures/pose/${name}.json.gz`)).toString());
const live = (f: Fixture): PoseFrame[] => f.frames.map(fr => ({ landmarks: [f.base.map((b, i) => { const q = fr.p[i] ?? b; return { x: q[0], y: q[1], z: 0.123456, visibility: q[2], presence: 1 }; })], timestamp: 5000 + fr.t, width: f.width, height: f.height }));

function record(name: string, counted: number) {
  const rec = new Recorder();
  for (const frame of live(fixture(name))) rec.add(frame);
  return rec.build({ exercise: name.split("-")[0] as never, level: "beginner", counted_reps: counted, app_reps: 0, day: "2026-11-20" });
}

it("keeps only rounded body points, from the first frame's time, and the facts needed to measure", () => {
  const r = record("squat-clean", 5);
  expect(r.format).toBe(FORMAT);
  expect(Object.keys(r).sort()).toEqual(["app_reps", "counted_reps", "device", "exercise", "format", "fps", "frames", "height", "level", "model", "recorded_on", "synthetic", "version", "width"]);
  expect(r.frames[0].t).toBe(0);
  expect(r.frames[0].l).toHaveLength(33);
  expect(r.frames.every(f => f.l.every(p => p.length === 3 && p.every(v => Math.round(v * 1000) === v * 1000)))).toBe(true);   // no z, 3 decimals
  expect(r.fps).toBe(20);
});

it("replays through the same counter as the live camera", () => {
  expect(replay(record("squat-clean", 5))).toBe(5);
  expect(replay(record("curl-half_reps", 3))).toBe(3);
  expect(framesOf(record("press-clean", 5))).toHaveLength(fixture("press-clean").frames.length);
});

it("checks files from volunteers before replaying them", () => {
  const good = record("squat-clean", 5);
  expect(validate(JSON.parse(JSON.stringify(good))).counted_reps).toBe(5);
  expect(() => validate({ ...good, format: "other" })).toThrow();
  expect(() => validate({ ...good, counted_reps: -1 })).toThrow();
  expect(() => validate({ ...good, frames: [{ t: 0, l: [[0, 0]] }, ...good.frames] })).toThrow();
});

it("summarises accuracy against the ±1 rep target", () => {
  const { overall, by_exercise } = evaluate([
    { exercise: "squat", counted: 10, app: 10 }, { exercise: "squat", counted: 10, app: 9 }, { exercise: "squat", counted: 10, app: 7 },
    { exercise: "curl", counted: 12, app: 12 },
  ]);
  expect(overall).toEqual({ sets: 4, within_one: 0.75, exact: 0.5, mean_abs_error: 1 });
  expect(by_exercise[0]).toMatchObject({ exercise: "squat", sets: 3, within_one: 2 / 3 });
});
