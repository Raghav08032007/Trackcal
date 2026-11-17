// The app's structure: every page belongs to a section (so a tab is always marked), each section shows a few main
// pages, and the overview pages link to real destinations.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import routesSource from "../src/routes.tsx?raw";
const route = vi.hoisted(() => ({ path: "/food" }));
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()), usePathname: () => route.path }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: null }), useWorkspaceScope: () => "guest" }));
vi.mock("@/components/feature-companion", () => ({ PageCompanion: () => null }));
import { pageTitle, sectionFor, SECTIONS } from "@/lib/sections";
import { AppNavigation } from "@/components/app-navigation";
import { SectionHub } from "@/components/section-hub";

const paths = [...routesSource.matchAll(/^\s+"(\/[^"]*)": \(\) => import/gm)].map(m => m[1]);
const BARE = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/offline"];
const example = (p: string) => p.replace(/:[a-z]+/g, "x1");

describe("the app's structure", () => {
  it("every page belongs to a section", () => {
    expect(paths.length).toBeGreaterThan(50);
    const orphans = paths.filter(p => !BARE.includes(p) && !sectionFor(example(p)));
    expect(orphans).toEqual([]);
  });
  it("detail pages mark their section", () => {
    expect(sectionFor("/activities/abc")?.id).toBe("move");
    expect(sectionFor("/challenges/abc")?.id).toBe("play");
    expect(sectionFor("/c/runners")?.id).toBe("play");
    expect(sectionFor("/u/asha")?.id).toBe("play");
    expect(sectionFor("/workouts/holds")?.id).toBe("move");
    expect(sectionFor("/health")?.id).toBe("me");
    expect(sectionFor("/progress")?.id).toBe("me");
  });
  it("each section shows at most five main pages, all of them real pages", () => {
    for (const s of SECTIONS) {
      expect(s.pages.length).toBeLessThanOrEqual(5);
      for (const [href] of s.pages) expect(paths).toContain(href);
      for (const g of s.groups ?? []) for (const d of g.items) expect(paths).toContain(d.href.split("?")[0]);
    }
  });
  it("on a page that is not a main page, it is shown at the end and marked", () => {
    route.path = "/barcode";
    render(<AppNavigation />);
    const pages = screen.getByRole("navigation", { name: "Food pages" });
    expect([...pages.querySelectorAll("a")].map(a => a.textContent)).toEqual(["Overview", "Diary", "Log food", "Meal plans", "Recipes", "Scan a barcode"]);
    expect(pages.querySelector('[aria-current="page"]')?.textContent).toBe("Scan a barcode");
    expect(screen.getByRole("navigation", { name: "Main" }).querySelector('[aria-current="page"]')?.textContent).toBe("Food");
    expect(pageTitle("/coach")).toBe("Coach");
  });
  it("the Food overview shows today and every destination", () => {
    route.path = "/food";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    render(<SectionHub id="food" intro="x" />);
    expect(screen.getByRole("heading", { name: "Food", level: 1 })).toBeTruthy();
    expect(screen.getByText("Eaten today")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log food" }).getAttribute("href")).toBe("/scanner");
    for (const href of ["/scanner", "/barcode", "/describe", "/food-library", "/nutrition", "/fasting", "/menu", "/recipes", "/tools?tab=pantry"])
      expect(document.querySelector(`a.hub-card[href="${href}"]`)).toBeTruthy();
  });
  it("the Me overview asks a signed-out person to sign in", () => {
    render(<SectionHub id="me" intro="x" />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(document.querySelector('a.hub-card[href="/health"]')).toBeTruthy();
  });
});
