import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { it, expect, vi, beforeEach } from "vitest";
const session = vi.hoisted(() => ({ user: { id: "u1" }, ready: true }));  // stable, like the real session context
vi.mock("../src/components/account-session", () => ({ useAccount: () => session, useWorkspaceScope: () => "u1" }));
import Events from "../src/app/events/page";
import EventPage from "../src/app/event/page";
import CheckIn from "../src/app/event-check-in/page";
import { qrSvg, type EventView } from "../src/lib/events";

const base: EventView = { hidden: false, id: "11111111-1111-1111-1111-111111111111", title: "Sunrise run", description: "", category: "running", location: "Cubbon Park gate", starts_at: "2026-11-02T01:30:00Z", ends_at: "2026-11-02T02:30:00Z", timezone: "Asia/Kolkata", capacity: 10, status: "scheduled", going: 3, waitlist: 0, organizer: { handle: "ravi", display_name: "Ravi", character_id: "pip" }, community: null, mine: null, organizing: false, check_in_open: false };
let calls: { url: string; method: string; body: unknown }[] = [];
function api(routes: (url: string, method: string) => unknown) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, o?: RequestInit) => { const method = o?.method || "GET"; calls.push({ url, method, body: o?.body ? JSON.parse(o.body as string) : undefined }); const v = routes(url, method); return v instanceof Response ? v : Response.json(v); }));
}
const at = (path: string, route: string, element: React.ReactNode) => render(<RouterProvider router={createMemoryRouter([{ path: route, element }], { initialEntries: [path] })} />);
beforeEach(() => { window.history.replaceState(null, "", "/"); });

it("lists events in their own time zone and creates one with the browser's zone", async () => {
  api((url, method) => url.endsWith("/api/social/me") ? { profile: { handle: "me" } } : method === "POST" ? { event: base } : { events: [base] });
  render(<Events />);
  expect(await screen.findByRole("heading", { name: "Sunrise run" })).toBeTruthy();
  expect(screen.getByText(/7:00/)).toBeTruthy();  // 01:30 UTC is 7:00 am in Kolkata
  fireEvent.click(screen.getByRole("button", { name: "Organize an event" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Evening walk" } });
  fireEvent.change(screen.getByLabelText("Where"), { target: { value: "Lake path" } });
  fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: "2026-11-03T18:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Create event" }));
  await waitFor(() => expect(calls.some(c => c.method === "POST")).toBe(true));
  const sent = calls.find(c => c.method === "POST")!.body as Record<string, unknown>;
  expect(sent).toMatchObject({ title: "Evening walk", location: "Lake path", starts_at: "2026-11-03T18:00", minutes: 60, capacity: null });
  expect(typeof sent.timezone).toBe("string");
});

it("signs up, and a full event offers the waitlist", async () => {
  api((_url, method) => ({ event: method === "POST" ? { ...base, going: 10, mine: { status: "waitlist", checked_in: false } } : { ...base, going: 10 } }));
  at(`/events/${base.id}`, "/events/:id", <EventPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Join the waitlist" }));
  expect(await screen.findByRole("button", { name: "Leave the waitlist" })).toBeTruthy();
});

it("shows the organizer a live QR code and lets them check someone in by hand", async () => {
  const open = { ...base, organizing: true, check_in_open: true };
  api((url, method) => url.includes("/check-in-code") ? { token: "abc123def456ghi789jk", path: `/events/${base.id}/check-in`, refresh_in: 20, checked_in: 1 }
    : url.endsWith("/attendees") ? { attendees: [{ handle: "asha", display_name: "Asha", status: "going", checked_in: false, method: null }] }
    : method === "POST" ? { status: "checked_in" } : { event: open });
  at(`/events/${base.id}`, "/events/:id", <EventPage />);
  expect(await screen.findByRole("img", { name: "Check-in QR code" })).toBeTruthy();
  expect(screen.getByText(/new code in 20s/)).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Check in" }));
  await waitFor(() => expect(calls.find(c => c.method === "POST" && c.url.endsWith("/check-in"))?.body).toEqual({ handle: "asha" }));
});

it("the QR link checks in with the token from the address and celebrates", async () => {
  window.history.replaceState(null, "", `/events/${base.id}/check-in?t=tok123token456`);
  api(() => ({ awarded_xp: 50, event: base }));
  at(`/events/${base.id}/check-in?t=tok123token456`, "/events/:id/check-in", <CheckIn />);
  expect(await screen.findByRole("heading", { name: "You're checked in!" })).toBeTruthy();
  expect(screen.getByText("+50 XP · verified event")).toBeTruthy();
  expect(calls[0].body).toEqual({ token: "tok123token456" });
});

it("an expired code explains what to do", async () => {
  window.history.replaceState(null, "", `/events/${base.id}/check-in?t=old`);
  api(() => Response.json({ error: "This code has expired. Scan the code on the organizer's screen again." }, { status: 403 }));
  at(`/events/${base.id}/check-in?t=old`, "/events/:id/check-in", <CheckIn />);
  expect((await screen.findByRole("alert")).textContent).toContain("expired");
});

it("draws the QR code as an inline SVG", () => {
  expect(qrSvg("https://trackcal.example/events/x/check-in?t=abc")).toMatch(/^<svg[\s\S]*<\/svg>$/);
});
