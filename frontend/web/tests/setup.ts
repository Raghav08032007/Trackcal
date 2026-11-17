import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { forgetAdventureSummary } from "@/lib/adventure";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => {
  forgetAdventureSummary(); // no cached progress may leak between tests
  if (typeof window === "undefined") return;
  localStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:test"); URL.revokeObjectURL = vi.fn();
});
