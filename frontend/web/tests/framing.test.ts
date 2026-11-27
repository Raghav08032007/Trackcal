import { describe, expect, it } from "vitest";
import { checkFraming } from "@/lib/pose/framing";
import { EXERCISE_CONFIG } from "@/lib/pose/exercise-config";
import type { Landmark, PoseFrame } from "@/lib/pose/types";

/** A person standing facing the camera, centred at (cx, cy) and `scale` tall (fraction of the frame height). */
function person(scale = 0.8, cx = 0.5, top = 0.1, vis = 0.95): Landmark[] {
  const p: Landmark[] = Array.from({ length: 33 }, () => ({ x: cx, y: top, visibility: 0.1 }));
  const at = (id: number, dx: number, dy: number) => { p[id] = { x: cx + dx * scale * 0.75, y: top + dy * scale, visibility: vis }; };
  // head (nose, eyes, ears), shoulders, elbows, wrists, hips, knees, ankles, heels, toes
  at(0, 0, 0.06); at(2, -0.02, 0.04); at(5, 0.02, 0.04); at(7, -0.05, 0.05); at(8, 0.05, 0.05);
  at(11, -0.12, 0.17); at(12, 0.12, 0.17); at(13, -0.15, 0.33); at(14, 0.15, 0.33); at(15, -0.15, 0.47); at(16, 0.15, 0.47);
  at(23, -0.08, 0.52); at(24, 0.08, 0.52); at(25, -0.08, 0.74); at(26, 0.08, 0.74); at(27, -0.08, 0.95); at(28, 0.08, 0.95);
  at(29, -0.09, 0.97); at(30, 0.09, 0.97); at(31, -0.06, 0.99); at(32, 0.06, 0.99);
  return p;
}
const frame = (landmarks: Landmark[][], brightness = 120): PoseFrame => ({ landmarks, timestamp: 0, width: 640, height: 480, brightness });
const failing = (f: PoseFrame, kind: keyof typeof EXERCISE_CONFIG = "squat") => checkFraming(f, EXERCISE_CONFIG[kind]).checks.filter(c => !c.ok).map(c => c.id);

describe("getting in position before counting", () => {
  it("a whole person at a normal distance is ready", () => {
    expect(failing(frame([person()]))).toEqual([]);
    expect(checkFraming(frame([person()]), EXERCISE_CONFIG.curl).ready).toBe(true);
  });

  it("nobody, or two people, is not ready", () => {
    expect(failing(frame([]))).toContain("person");
    expect(failing(frame([person(.6, .3), person(.6, .7)]))).toContain("person");
  });

  it("too close: head out of the top, feet out of the bottom (the case in the user's screenshot)", () => {
    const close = person(1.6, 0.5, -0.35);
    const ids = failing(frame([close]));
    expect(ids).toContain("head");
    expect(ids).toContain("body");
    expect(ids).toContain("distance");
  });

  it("too far: a tiny person is asked to come closer", () => {
    expect(failing(frame([person(0.12, 0.5, 0.4)]))).toContain("distance");
  });

  it("an upper-body exercise doesn't need the feet in the frame", () => {
    const halfBody = person(1.3, 0.5, 0.05);   // feet below the frame
    expect(failing(frame([halfBody]), "curl")).toEqual([]);
    expect(failing(frame([halfBody]), "pushup")).toContain("body");   // push-ups need the feet in view (squats can read the shoulder drop)
  });

  it("a dark room is not ready", () => {
    expect(failing(frame([person()], 10))).toEqual(["light"]);
  });
  it("asks for the right camera angle on moves that only count from one view", () => {
    const sideOn = person(); for (const [a, b] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28]]) sideOn[b] = { ...sideOn[a] };
    expect(failing(frame([person()]), "pushup")).toContain("angle");      // push-ups filmed head-on
    expect(failing(frame([sideOn]), "pushup")).not.toContain("angle");
    expect(failing(frame([person()]), "curl")).not.toContain("angle");    // curls count from any view
    expect(failing(frame([sideOn]), "raise")).toContain("angle");         // side arm raises need the front view
  });
});
