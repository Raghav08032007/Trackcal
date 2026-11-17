import { it, expect } from "vitest";
import { fitWithin } from "../src/lib/photo-prep";
it("shrinks the longest side to 1024 px, keeps proportions and never enlarges", () => {
  expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 });
  expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 });
  expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  expect(fitWithin(20000, 10)).toEqual({ width: 1024, height: 1 });
});
