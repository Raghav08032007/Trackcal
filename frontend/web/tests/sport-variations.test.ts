import { describe, expect, it } from "vitest";
import { GAME_GROUPS, SPORTS, stars, starGoals, type GameId } from "@/lib/sport-game";
import { BoxCounter, DrillCounter, SwingCounter, gameCounter } from "@/lib/pose/sports";
import type { ExerciseKind } from "@/lib/pose/types";
import { exerciseSet } from "./sim/move-sim";

const ALL = GAME_GROUPS.flatMap(([, , ids]) => ids);
const count = (id: GameId, frames: ReturnType<typeof exerciseSet>["frames"]) => { const c = gameCounter(SPORTS[id], id); for (const f of frames) c.frame(f); return c.count; };

describe("game variations", () => {
  it("lists every game once, each with a counter built on a proven detector", () => {
    expect(new Set(ALL).size).toBe(ALL.length);
    expect(ALL.sort()).toEqual((Object.keys(SPORTS) as GameId[]).sort());
    expect(gameCounter(SPORTS.tennis, "tennis")).toBeInstanceOf(SwingCounter);
    expect(gameCounter(SPORTS.boxspeed, "boxspeed")).toBeInstanceOf(BoxCounter);
    expect(gameCounter(SPORTS.football, "football")).toBeInstanceOf(DrillCounter);
    for (const id of ALL) expect(starGoals(id, 60)[2]).toBeGreaterThan(starGoals(id, 60)[0]);
    expect(stars("hoops", 35, 60)).toBe(3);
  });

  const DRILLS: [GameId, ExerciseKind, ExerciseKind][] = [["football", "highknee", "squat"], ["hoops", "squatjump", "curl"], ["kabaddi", "sidelunge", "press"], ["sprint", "buttkick", "squat"]];
  for (const [id, own, other] of DRILLS) {
    it(`${id} counts ${own} like the camera exercise, and nothing for ${other}`, () => {
      let close = 0, wrong = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const set = exerciseSet(own, 300 + seed);
        if (Math.abs(count(id, set.frames) - set.reps) <= 1) close++;
        wrong += count(id, exerciseSet(other, 400 + seed).frames);
      }
      expect(close).toBeGreaterThanOrEqual(4);
      expect(wrong).toBe(0);
    }, 60000);
  }
});
