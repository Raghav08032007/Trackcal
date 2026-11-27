// "Get in position" before counting starts. Pose models still return confident points for body parts outside the
// picture (a person too close gets a small made-up skeleton), so counting waits until the whole picture makes sense:
// one person, the head in view, the joints this exercise needs inside the frame, a sensible distance and enough light.
import { msg } from "@/lib/i18n";
import { ONE_ANGLE, type ExerciseConfig } from "./exercise-config";
import { MOVES } from "./exercise-motions";
import type { Landmark, PoseFrame } from "./types";

export type FramingId = "person" | "head" | "body" | "distance" | "angle" | "light";
export type FramingCheck = { id: FramingId; ok: boolean; tip: string };
export type Framing = { ready: boolean; checks: FramingCheck[] };

export const FRAMING_LABELS: Record<FramingId, string> = {
  person: msg("Only you in view"), head: msg("Head in the picture"), body: msg("Whole movement in the frame"),
  distance: msg("Good distance"), angle: msg("Camera angle"), light: msg("Enough light"),
};

const HEAD = [0, 2, 5, 7, 8];
const MARGIN = 0.02, SEEN = 0.5;
const inside = (p: Landmark | undefined) => !!p && (p.visibility ?? 0) >= SEEN && p.x >= MARGIN && p.x <= 1 - MARGIN && p.y >= MARGIN && p.y <= 1 - MARGIN;
const conf = (pts: Landmark[], ids: number[]) => ids.length ? ids.reduce((n, i) => n + (pts[i]?.visibility ?? 0), 0) / ids.length : 0;

/** Push-ups count side-on only (head-on the straight arm reads bent and the shape check rejects the rep: docs/VIDEO_BENCH.md). */
const SIDE_ONLY = new Set(["pushup", "widepush", "diamondpush", "decline"]);
function needsView(config: ExerciseConfig): "side" | "front" | null {
  if (SIDE_ONLY.has(config.id)) return "side";
  return ONE_ANGLE.has(config.id) ? (MOVES[config.id]?.view ?? null) as "side" | "front" | null : null;
}

/** Pure: the same frame always gives the same answer, so it is unit-tested without a camera. */
export function checkFraming(frame: PoseFrame, config: ExerciseConfig): Framing {
  const people = frame.landmarks.length, pts = frame.landmarks[0] ?? [];
  const checks: FramingCheck[] = [];
  const add = (id: FramingId, ok: boolean, tip: string) => checks.push({ id, ok, tip });
  add("person", people === 1, people === 0 ? msg("Stand in front of the camera.") : msg("Only one person should be in view."));
  if (people === 0) {
    for (const id of ["head", "body", "distance"] as const) add(id, false, msg("Stand in front of the camera."));
  } else {
    add("head", HEAD.some(i => inside(pts[i])), msg("Step back so I can see your head and hips."));
    // the side the camera sees better carries the exercise
    const side = conf(pts, config.required[0]) >= conf(pts, config.required[1]) ? 0 : 1;
    const needed = [...config.required[side], ...(config.inFrame?.[side] ?? [])];
    add("body", needed.every(i => inside(pts[i])), msg("Step back until the whole movement fits in the frame."));
    // Distance from the body's size in the picture (aspect-corrected): shoulders across, and shoulder-to-hip down.
    const aspect = frame.width && frame.height ? frame.width / frame.height : 4 / 3;
    const [ls, rs, lh, rh] = [pts[11], pts[12], pts[23], pts[24]];
    const shoulders = ls && rs ? Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y) : 0;
    const torso = ls && rs && lh && rh ? Math.hypot(((ls.x + rs.x - lh.x - rh.x) / 2) * aspect, (ls.y + rs.y - lh.y - rh.y) / 2) : 0;
    const size = Math.max(shoulders, torso);              // side-on the shoulders overlap, the torso still shows size
    add("distance", size > 0.1 && size < 0.5, size >= 0.5 ? msg("Step back a little.") : msg("Come a little closer."));
    // Camera angle, for moves that only count from one view: shoulders look wide face-on and overlap side-on.
    const view = needsView(config);
    if (view && torso > 0) {
      const facing = shoulders / torso;
      add("angle", view === "side" ? facing < 0.55 : facing > 0.3, view === "side" ? msg("Turn side-on to the camera.") : msg("Face the camera."));
    }
  }
  add("light", frame.brightness === undefined || frame.brightness >= 28, msg("Try a brighter, evenly lit space."));
  return { ready: checks.every(c => c.ok), checks };
}

/** Counting starts once the framing has stayed right for HOLD_MS, so one lucky frame doesn't start it. */
export const HOLD_MS = 1200;
