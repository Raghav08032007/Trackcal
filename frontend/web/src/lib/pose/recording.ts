// Rep recordings for measuring counting accuracy on real people (KI-21, KI-23). A recording holds only body points
// (33 landmarks per frame, x/y/visibility rounded to 3 decimals) and the reps the person really did: no video, no
// image, no name or account. The volunteer page saves it to the volunteer's own device; they choose whether to send it.
// The same functions replay recordings through the counter (SessionTracker) and summarise accuracy.
import { SessionTracker } from "./session-tracker";
import { focusPerson } from "./landmarks";
import type { ExerciseKind, ExerciseLevel, PoseFrame } from "./types";

export const FORMAT = "trackcal-pose-recording";
export const MAX_SECONDS = 180;           // one set; also keeps a file around 0.5 MB compressed
const POINTS = 33;

export type PoseRecording = {
  format: typeof FORMAT; version: 1; synthetic: false;
  exercise: ExerciseKind; level: ExerciseLevel;
  counted_reps: number;                   // what the person really did (counted by them or a helper)
  app_reps: number;                       // what the app counted live, for reference
  fps: number; width: number; height: number;
  model: "full" | "lite" | "";
  device: { mobile: boolean; cores?: number; memory?: number };
  recorded_on: string;                    // the day only
  frames: { t: number; l: number[][] }[]; // t: ms from the first frame; l: [x, y, visibility] for each of 33 points
};

const r3 = (n: number | undefined) => Math.round((Number.isFinite(n) ? n! : 0) * 1000) / 1000;

/** Collects the frames of one set. Only the first person in each frame is kept (the same person the counter follows). */
export class Recorder {
  private frames: PoseRecording["frames"] = [];
  private start = -1; private size = { width: 640, height: 480 };
  get seconds() { return this.frames.length ? this.frames[this.frames.length - 1].t / 1000 : 0; }
  get full() { return this.seconds >= MAX_SECONDS; }
  get count() { return this.frames.length; }
  add(frame: PoseFrame) {
    if (this.full) return;
    const person = focusPerson(frame).landmarks[0];
    if (!person || person.length < POINTS) return;
    if (this.start < 0) { this.start = frame.timestamp; this.size = { width: frame.width, height: frame.height }; }
    this.frames.push({ t: Math.round(frame.timestamp - this.start), l: person.slice(0, POINTS).map(p => [r3(p.x), r3(p.y), r3(p.visibility ?? 1)]) });
  }
  build(meta: { exercise: ExerciseKind; level: ExerciseLevel; counted_reps: number; app_reps: number; model?: PoseRecording["model"]; device?: PoseRecording["device"]; day?: string }): PoseRecording {
    const span = this.seconds;
    return { format: FORMAT, version: 1, synthetic: false, exercise: meta.exercise, level: meta.level, counted_reps: meta.counted_reps, app_reps: meta.app_reps,
      fps: span > 0 ? Math.round((this.frames.length - 1) / span) : 0, width: this.size.width, height: this.size.height, model: meta.model ?? "",
      device: meta.device ?? { mobile: false }, recorded_on: meta.day ?? new Date().toISOString().slice(0, 10), frames: this.frames };
  }
}

/** Checks a file a volunteer sent before it is replayed. Throws with the reason. */
export function validate(data: unknown): PoseRecording {
  const r = data as PoseRecording;
  if (!r || r.format !== FORMAT || r.version !== 1) throw Error("not a TrackCal pose recording");
  if (typeof r.exercise !== "string" || !Number.isInteger(r.counted_reps) || r.counted_reps < 0 || r.counted_reps > 500) throw Error("missing exercise or counted reps");
  if (!Array.isArray(r.frames) || r.frames.length < 2 || r.frames.length > MAX_SECONDS * 40) throw Error("frame count out of range");
  for (const f of r.frames) {
    if (!Number.isFinite(f.t) || !Array.isArray(f.l) || f.l.length !== POINTS || f.l.some(p => !Array.isArray(p) || p.length !== 3 || p.some(v => !Number.isFinite(v)))) throw Error("malformed frame");
  }
  return r;
}

export function framesOf(r: PoseRecording): PoseFrame[] {
  return r.frames.map(f => ({ landmarks: [f.l.map(([x, y, visibility]) => ({ x, y, visibility, presence: 1 }))], timestamp: f.t, width: r.width, height: r.height }));
}

/** The counter's answer for a recording, replayed exactly as the live camera feeds it. */
export function replay(r: PoseRecording, level: ExerciseLevel = r.level) {
  const tracker = new SessionTracker(r.exercise, level);
  for (const frame of framesOf(r)) tracker.frame(focusPerson(frame));
  return tracker.counter.reps;
}

export type Accuracy = { sets: number; within_one: number; exact: number; mean_abs_error: number };

/** Accuracy per exercise and overall: the share of sets within ±1 rep (target 90%), exact matches, average miss. */
export function evaluate(results: { exercise: string; counted: number; app: number }[]) {
  const summary = (rows: typeof results): Accuracy => ({
    sets: rows.length,
    within_one: rows.length ? rows.filter(r => Math.abs(r.app - r.counted) <= 1).length / rows.length : 0,
    exact: rows.length ? rows.filter(r => r.app === r.counted).length / rows.length : 0,
    mean_abs_error: rows.length ? rows.reduce((s, r) => s + Math.abs(r.app - r.counted), 0) / rows.length : 0,
  });
  const groups = new Map<string, typeof results>();
  for (const row of results) groups.set(row.exercise, [...(groups.get(row.exercise) ?? []), row]);
  return { overall: summary(results), by_exercise: [...groups].map(([exercise, rows]) => ({ exercise, ...summary(rows) })).sort((a, b) => b.sets - a.sets) };
}
