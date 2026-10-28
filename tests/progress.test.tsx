import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Progress from "../src/app/progress/page";
it("summarizes real journal entries and excludes empty days from the average", () => {
  localStorage.setItem("trackcal:journal:2026-10-20", JSON.stringify([{ name: "Egg", time: "12:00", method: "Manual", calories: 78, protein: 6, carbs: 1, fat: 5 }]));
  localStorage.setItem("trackcal:journal:2026-10-21", "[]");
  render(<Progress />);
  expect(screen.getByText("78 kcal")).toBeTruthy();
  expect(screen.getByText("6.0 g")).toBeTruthy();
  expect(screen.getByText("2026-10-20")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Print / Save as PDF" }) as HTMLButtonElement).disabled).toBe(false);
});
it("shows a truthful empty state", () => { render(<Progress />); expect(screen.getByText(/No meals logged yet/)).toBeTruthy(); });
