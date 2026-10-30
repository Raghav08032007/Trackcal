// Brings every character image (/characters/*.webp) to life, on any page:
// idle breathing (staggered), tilting toward the mouse pointer, a hop with sparkles and a short cheer when tapped,
// and a confetti celebration on every visible character when the server awards XP.
// Uses the individual translate/scale/rotate CSS properties so it composes with existing transform animations.
// Reduced motion (system setting, "Reduce motion", or calm modes) turns all of it off.
import { useEffect } from "react";
import { XP_AWARDED_EVENT } from "@/lib/celebrate";

const CHARACTER = 'img[src*="/characters/"]';
const CHEERS = ["Nice one!", "Let's go!", "You've got this ✨", "Small wins count!", "Look at you go!", "High five!"];
const COLORS = ["#c8f56a", "#8b6cff", "#ff7a59", "#6fd3ff", "#ffd166"];

export function calmMotion() {
  return document.documentElement.dataset.motion === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!document.querySelector(".play-calm,.daily-focus-calm,.journey-calm");
}

function burst(x: number, y: number, count: number, spread: number) {
  const layer = document.createElement("div");
  layer.className = "lc-burst"; layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${x}px`; layer.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span"), angle = (Math.PI * 2 * i) / count + Math.random() * 0.6, distance = spread * (0.6 + Math.random() * 0.6);
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`); piece.style.setProperty("--dy", `${Math.sin(angle) * distance - spread * 0.4}px`);
    piece.style.setProperty("--spin", `${Math.round(Math.random() * 540 - 270)}deg`); piece.style.background = COLORS[i % COLORS.length];
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1100);
}

function cheer(target: HTMLElement) {
  document.querySelectorAll(".lc-cheer").forEach(node => node.remove());
  const rect = target.getBoundingClientRect(), bubble = document.createElement("div");
  bubble.className = "lc-cheer"; bubble.setAttribute("aria-hidden", "true");
  bubble.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  bubble.style.left = `${rect.left + rect.width / 2}px`; bubble.style.top = `${Math.max(8, rect.top - 6)}px`;
  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1600);
}

function react(target: HTMLElement, kind: "hop" | "celebrate") {
  target.dataset.lcReact = kind;
  window.setTimeout(() => { if (target.dataset.lcReact === kind) delete target.dataset.lcReact; }, kind === "hop" ? 700 : 1200);
}

export function LivingCharacters() {
  useEffect(() => {
    const living = new Set<HTMLImageElement>();
    const adopt = (img: HTMLImageElement) => {
      if (living.has(img)) return;
      living.add(img); img.classList.add("living-character");
      img.style.setProperty("--lc-delay", `${-(Math.random() * 4).toFixed(2)}s`);
    };
    const scan = (root: ParentNode) => root.querySelectorAll<HTMLImageElement>(CHARACTER).forEach(adopt);
    scan(document);
    const observer = new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(node => {
        if (node instanceof HTMLImageElement && node.matches(CHARACTER)) adopt(node);
        else if (node instanceof Element) scan(node);
      });
      for (const img of living) if (!img.isConnected) living.delete(img);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let frame = 0, pointer = { x: 0, y: 0 };
    const look = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || calmMotion()) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const img of living) {
          const rect = img.getBoundingClientRect();
          if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;
          const dx = Math.max(-1, Math.min(1, (pointer.x - (rect.left + rect.width / 2)) / 500)), dy = Math.max(-1, Math.min(1, (pointer.y - (rect.top + rect.height / 2)) / 500));
          // Axis-angle rotation: turn toward the pointer by up to ~14 degrees.
          img.style.rotate = `${(-dy).toFixed(3)} ${dx.toFixed(3)} 0 ${(Math.hypot(dx, dy) * 14).toFixed(1)}deg`;
        }
      });
    };
    const settle = () => { for (const img of living) img.style.removeProperty("rotate"); };
    const tap = (event: PointerEvent) => {
      const img = event.target instanceof Element ? event.target.closest<HTMLImageElement>(CHARACTER) : null;
      if (!img || calmMotion()) return;
      react(img, "hop"); burst(event.clientX, event.clientY, 10, 60); cheer(img);
    };
    const celebrate = () => {
      if (calmMotion()) return;
      for (const img of living) {
        const rect = img.getBoundingClientRect();
        if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;
        react(img, "celebrate"); burst(rect.left + rect.width / 2, rect.top + rect.height * 0.3, 18, 110);
      }
    };
    document.addEventListener("pointermove", look, { passive: true });
    document.addEventListener("pointerleave", settle);
    document.addEventListener("pointerdown", tap, { passive: true });
    window.addEventListener(XP_AWARDED_EVENT, celebrate);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", look); document.removeEventListener("pointerleave", settle);
      document.removeEventListener("pointerdown", tap); window.removeEventListener(XP_AWARDED_EVENT, celebrate);
      for (const img of living) { img.classList.remove("living-character"); img.style.removeProperty("rotate"); delete img.dataset.lcReact; }
    };
  }, []);
  return null;
}
