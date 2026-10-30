import { act, render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LivingCharacters } from "@/components/living-characters";
import { announceXp, XP_AWARDED_EVENT } from "@/lib/celebrate";

const motion = (reduced: boolean) => vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
const character = (src = "/characters/pip-v2.webp") => {
  const img = document.createElement("img"); img.src = src; img.alt = "";
  img.getBoundingClientRect = () => ({ left: 10, top: 10, width: 100, height: 100, right: 110, bottom: 110, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(img); return img;
};
const pointerDown = (target: Element) => target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 50 }));

beforeEach(() => { document.body.innerHTML = ""; delete document.documentElement.dataset.motion; motion(false); });

it("brings existing and newly added character images to life", async () => {
  const first = character(); render(<LivingCharacters />);
  expect(first.classList.contains("living-character")).toBe(true);
  const later = character("/characters/nova-v2.webp");
  await act(async () => { await Promise.resolve(); });
  expect(later.classList.contains("living-character")).toBe(true);
  expect(character("/icon-192.png").classList.contains("living-character")).toBe(false);
});

it("hops, sparkles and cheers when a character is tapped, and ignores other taps", () => {
  const img = character(); render(<LivingCharacters />);
  act(() => { pointerDown(document.body); });
  expect(document.querySelector(".lc-cheer")).toBeNull();
  act(() => { pointerDown(img); });
  expect(img.dataset.lcReact).toBe("hop");
  expect(document.querySelectorAll(".lc-burst span").length).toBeGreaterThan(0);
  expect(document.querySelector(".lc-cheer")?.getAttribute("aria-hidden")).toBe("true");
});

it("celebrates on every visible character only when XP is actually awarded", () => {
  const a = character(), b = character("/characters/milo-v3.webp"); render(<LivingCharacters />);
  act(() => { announceXp({ awarded_xp: 0 }); announceXp({}); });
  expect(a.dataset.lcReact).toBeUndefined();
  act(() => { announceXp({ awarded_xp: 10 }); });
  expect(a.dataset.lcReact).toBe("celebrate"); expect(b.dataset.lcReact).toBe("celebrate");
});

it("does nothing when motion is reduced", () => {
  motion(true); const img = character(); render(<LivingCharacters />);
  act(() => { pointerDown(img); window.dispatchEvent(new CustomEvent(XP_AWARDED_EVENT, { detail: { xp: 10 } })); });
  expect(img.dataset.lcReact).toBeUndefined();
  expect(document.querySelector(".lc-cheer, .lc-burst")).toBeNull();
});

it("removes its effects when unmounted", () => {
  const img = character(); const view = render(<LivingCharacters />);
  view.unmount();
  expect(img.classList.contains("living-character")).toBe(false);
});
