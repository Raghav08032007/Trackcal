// KI-22: low-end phones, Data Saver and slow networks start with the lite pose model; a phone that had to switch to
// lite starts with lite for two weeks; capable or unknown devices keep the more accurate full model.
import { it, expect, afterEach } from "vitest";
import { chooseVariant, rememberLite } from "@/lib/pose/model-choice";

const DAY = 86_400_000, now = Date.UTC(2026, 10, 20);
afterEach(() => { try { localStorage.clear(); } catch { /* none */ } });

it("keeps the full model on capable or unknown devices", () => {
  expect(chooseVariant({ now })).toBe("full");
  expect(chooseVariant({ deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: "4g" }, now })).toBe("full");
  expect(chooseVariant({ deviceMemory: 4, hardwareConcurrency: 6, now })).toBe("full");
});

it("starts low-end phones, Data Saver and slow connections on lite", () => {
  expect(chooseVariant({ deviceMemory: 2, hardwareConcurrency: 8, now })).toBe("lite");
  expect(chooseVariant({ deviceMemory: 8, hardwareConcurrency: 4, now })).toBe("lite");
  expect(chooseVariant({ connection: { saveData: true }, now })).toBe("lite");
  expect(chooseVariant({ connection: { effectiveType: "3g" }, now })).toBe("lite");
});

it("remembers a device that had to switch, for two weeks", () => {
  expect(chooseVariant({ remembered: now - 3 * DAY, now })).toBe("lite");
  expect(chooseVariant({ remembered: now - 15 * DAY, now })).toBe("full");
  rememberLite(now);
  expect(Number(localStorage.getItem("trackcal:pose:lite-since"))).toBe(now);
});
