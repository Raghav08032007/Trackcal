import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BondCard } from "@/components/bond-card";

const bond = { companion: "pip", xp: 300, stage_name: "Good friends", next: { name: "Trusted partners", xp: 750, remaining: 450 }, auras: ["none", "glow"], titles: ["Steady friend"], aura: "none", title: "", others: [{ companion: "nova", xp: 20, stage_name: "New friends" }] };

it("stays hidden while the feature is off", async () => {
  const fetchMock = vi.fn(async () => Response.json({}, { status: 404 })); vi.stubGlobal("fetch", fetchMock);
  const { container } = render(<BondCard />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(container.textContent).toBe("");
});

it("shows progress with no pressure, and saves an earned aura", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === "POST" ? { ...bond, aura: "glow" } : bond));
  vi.stubGlobal("fetch", fetchMock); render(<BondCard />);
  expect(await screen.findByText("Good friends")).toBeTruthy();
  expect(screen.getByText(/450 XP to Trusted partners\. A bond never goes down/)).toBeTruthy();
  expect(screen.getByText(/Nova \(New friends\)/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Aura"), { target: { value: "glow" } });
  await waitFor(() => expect((screen.getByLabelText("Aura") as HTMLSelectElement).value).toBe("glow"));
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ aura: "glow", title: "" });
});

it("shows an error if saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? Response.json({ error: "Not unlocked" }, { status: 409 }) : Response.json(bond)));
  render(<BondCard />); await screen.findByText("Good friends");
  fireEvent.change(screen.getByLabelText("Aura"), { target: { value: "glow" } });
  expect((await screen.findByRole("alert")).textContent).toContain("Not unlocked");
});
