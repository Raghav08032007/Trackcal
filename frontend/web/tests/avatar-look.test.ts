import { describe, expect, it } from "vitest";
import { ACCESSORIES, DEFAULT_LOOK, HAIR, OUTFIT, SKIN, avatarLevel, nearest, unlocked } from "@/lib/avatar-look";

describe("your character", () => {
  it("levels up every 4 active days, up to 10", () => {
    expect(avatarLevel(0)).toMatchObject({ level: 1, next: 4 });
    expect(avatarLevel(7)).toMatchObject({ level: 2, next: 8 });
    expect(avatarLevel(400)).toMatchObject({ level: 10, next: null });
  });
  it("starts with basics unlocked and keeps the best kit for later", () => {
    expect(OUTFIT.filter(o => unlocked(1, o.level)).length).toBeGreaterThanOrEqual(4);
    expect(OUTFIT.every(o => unlocked(10, o.level))).toBe(true);
    expect(ACCESSORIES.filter(a => unlocked(1, a.level)).map(a => a.id)).toEqual(["none"]);
    expect([DEFAULT_LOOK.top, DEFAULT_LOOK.shorts, DEFAULT_LOOK.shoes].every(c => OUTFIT.some(o => o.color === c && o.level === 1))).toBe(true);
  });
  it("matches a sampled colour to the nearest swatch only", () => {
    expect(nearest([240, 200, 170], SKIN)).toBe(SKIN[0]);
    expect(nearest([70, 44, 28], SKIN)).toBe(SKIN[SKIN.length - 1]);
    expect(nearest([20, 18, 16], HAIR)).toBe(HAIR[0]);
    expect(nearest([160, 160, 160], HAIR)).toBe("#9a9a9a");
  });
});
