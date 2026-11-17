// The design showcase: every section renders, the body map works without 3D, and the data displays say what they show.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LabRangeBar, ScoreDial } from "@/components/ds/metrics";

describe("design system", () => {
  it("renders every section, and the body map can be used from its list without 3D", async () => {
    const { default: Page } = await import("@/app/design/page");
    render(<Page />);
    for (const name of ["Themes and Comfort mode", "Colour with a meaning", "Type", "Buttons", "Today and the Health Score", "Your report, explained", "Food and exercise", "Surgeries and injuries, on your body", "Movement"])
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Left ankle" }));
    expect(screen.getByRole("heading", { name: "Left ankle" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Healing" }));
    expect(screen.getByText("Now: Healing")).toBeTruthy();
  });
  it("Comfort mode switches the whole page", async () => {
    const { default: Page } = await import("@/app/design/page");
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Aa Comfort mode" }));
    expect(document.documentElement.dataset.comfort).toBe("on");
    fireEvent.click(screen.getByRole("button", { name: "Aa Comfort mode" }));
    expect(document.documentElement.dataset.comfort).toBe("off");
  });
  it("a lab result says whether it is normal, high or low, and the trend", () => {
    render(<LabRangeBar lab={{ name: "LDL", value: 142, unit: "mg/dL", low: 0, high: 100, min: 0, max: 220, previous: 162, note: "x" }} />);
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText(/↓ from 162/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "LDL 142 mg/dL; normal 0 to 100" })).toBeTruthy();
  });
  it("the Health Score names its band", () => {
    render(<ScoreDial score={712} change={38} />);
    expect(screen.getByRole("img", { name: "Health Score 712 out of 900, Good" })).toBeTruthy();
  });
});
