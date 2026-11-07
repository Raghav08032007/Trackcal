// Page-wide motion that needs no markup changes:
// - cards and photos below the fold fade up as they scroll into view (once each);
// - the floating companion can be dragged anywhere and remembers where it was put (double-click resets).
// Everything is skipped with reduced motion, and content is never hidden if this script doesn't run.
import { useEffect } from "react";
import { usePathname } from "@/lib/navigation";

const REVEAL = ".account-card,.social-post,.community-card,.photo-card,.destination-card,.wellness-card-grid>article,.premium-plan,.play-card";
const KEY = "trackcal:companion-offset";
const calm = () => document.documentElement.dataset.motion === "reduced" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function MotionLayer() {
  const path = usePathname();
  useEffect(() => {
    if (calm() || typeof IntersectionObserver === "undefined") return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = "in"; io.unobserve(e.target); } }, { rootMargin: "0px 0px -6% 0px" });
    const scan = () => document.querySelectorAll<HTMLElement>(REVEAL).forEach((el, i) => {
      if (seen.has(el)) return; seen.add(el);
      if (el.getBoundingClientRect().top < innerHeight) return; // already on screen: never hide it
      el.dataset.reveal = "pending"; el.style.setProperty("--reveal-delay", `${(i % 4) * 60}ms`); io.observe(el);
    });
    scan();
    const mo = new MutationObserver(() => scan()); mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); document.querySelectorAll<HTMLElement>("[data-reveal=pending]").forEach(el => { el.dataset.reveal = "in"; }); };
  }, [path]);

  useEffect(() => {
    let drag: { el: HTMLElement; x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") as { x: number; y: number } | null; } catch { return null; } };
    const place = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect(), bx = r.left - (Number(el.dataset.dx) || 0), by = r.top - (Number(el.dataset.dy) || 0);
      const cx = Math.max(-bx + 8, Math.min(innerWidth - bx - r.width - 8, x)), cy = Math.max(-by + 8, Math.min(innerHeight - by - r.height - 8, y));
      el.dataset.dx = String(cx); el.dataset.dy = String(cy); el.style.translate = `${cx}px ${cy}px`;
    };
    /** After a resize, pull a dragged companion back into view instead of leaving it off the edge. */
    const keepInView = () => { const el = document.querySelector<HTMLElement>(".journey-float"); if (el?.dataset.dx) place(el, Number(el.dataset.dx), Number(el.dataset.dy)); else apply(); };
    const apply = () => { const saved = read(), el = document.querySelector<HTMLElement>(".journey-float"); if (el && saved && !el.dataset.dx) place(el, saved.x, saved.y); };
    const down = (e: PointerEvent) => {
      const orb = (e.target as Element | null)?.closest?.(".journey-orb"), el = orb?.closest<HTMLElement>(".journey-float");
      if (!el || e.button !== 0) return;
      drag = { el, x: e.clientX, y: e.clientY, ox: Number(el.dataset.dx) || 0, oy: Number(el.dataset.dy) || 0, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      drag.moved = true; drag.el.dataset.dragging = "true"; place(drag.el, drag.ox + dx, drag.oy + dy);
    };
    const up = () => {
      if (!drag) return; const d = drag; drag = null; delete d.el.dataset.dragging;
      if (d.moved) { try { localStorage.setItem(KEY, JSON.stringify({ x: Number(d.el.dataset.dx), y: Number(d.el.dataset.dy) })); } catch { /* storage off */ }
        const swallow = (c: Event) => { c.stopPropagation(); c.preventDefault(); }; window.addEventListener("click", swallow, { capture: true, once: true }); setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0); }
    };
    const noNativeDrag = (e: DragEvent) => { if ((e.target as Element | null)?.closest?.(".journey-orb")) e.preventDefault(); };  // image drag would cancel the gesture
    const reset = (e: MouseEvent) => { const el = (e.target as Element | null)?.closest?.(".journey-orb")?.closest<HTMLElement>(".journey-float"); if (!el) return; el.style.translate = ""; delete el.dataset.dx; delete el.dataset.dy; try { localStorage.removeItem(KEY); } catch { /* storage off */ } };
    apply(); const mo = new MutationObserver(apply); mo.observe(document.body, { childList: true, subtree: true });
    addEventListener("pointerdown", down); addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up); addEventListener("dblclick", reset); addEventListener("resize", keepInView); addEventListener("dragstart", noNativeDrag);
    return () => { mo.disconnect(); removeEventListener("pointerdown", down); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); removeEventListener("dblclick", reset); removeEventListener("resize", keepInView); removeEventListener("dragstart", noNativeDrag); };
  }, []);
  return null;
}
