import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReportItem } from "@/components/report-item";

it("sends a report for the item and confirms it", async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ status: "Thanks. Our team will review this." }, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReportItem type="event" id="e1" label="event" />);
  fireEvent.click(screen.getByRole("button", { name: "Report this event" }));
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect((await screen.findByRole("status")).textContent).toContain("Thanks");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ target_type: "event", target_id: "e1" });
});

it("shows an error and keeps the form when sending fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Try later" }, { status: 503 })));
  render(<ReportItem type="challenge" id="c1" label="challenge" />);
  fireEvent.click(screen.getByRole("button", { name: "Report this challenge" }));
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send report" })).toBeTruthy();
});
