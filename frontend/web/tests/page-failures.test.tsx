import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Communities from "@/app/communities/page";
import Events from "@/app/events/page";
import Challenges from "@/app/challenges/page";

vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: { id: "member" } }), useWorkspaceScope: () => "member" }));
const pages = [["communities", Communities], ["events", Events], ["challenges", Challenges]] as const;
const show = (Page: (typeof pages)[number][1]) => render(<MemoryRouter><Page /></MemoryRouter>);

describe.each(pages)("%s when its first request fails", (name, Page) => {
  it("says the feature is off only for a 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Not available" }, { status: 404 }))); show(Page);
    expect(await screen.findByText(/aren.t available yet/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("offers Try again for a server failure and recovers", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: "down" }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock); show(Page);
    expect((await screen.findByRole("alert")).textContent).toContain(`We couldn’t load ${name}`.replace("’", "'"));
    expect(screen.queryByText(/aren.t available yet/)).toBeNull();
    fetchMock.mockImplementation(async () => Response.json({ profile: { handle: "me" }, communities: [], events: [], challenges: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
