// Free-licence photos (Wikimedia Commons), self-hosted in /public/photos with credits at /credits.
// Photo: responsive <picture>. PhotoCarousel: a swipeable, draggable strip of ideas with arrow buttons.
import { t, msg } from "@/lib/i18n";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import Link from "@/lib/navigation";

export const PHOTOS = {
  toast: msg("Avocado toast topped with tomatoes and poached eggs"),
  bowl: msg("A grain bowl with rice, tofu, avocado, radish and greens"),
  plate: msg("Grilled chicken on mashed potato with fresh vegetables"),
  fruit: msg("Two bowls of mixed fresh fruit"),
  salad: msg("A bowl of avocado and tomato salad"),
  smoothie: msg("A green kiwi smoothie with fresh kiwi halves"),
  track: msg("Running track lanes at the start line, numbered 1, 2 and 3"),
  yoga: msg("A woman stretching on a yoga mat in a sunny park"),
  pushup: msg("Friends doing incline push-ups on a park bench"),
} as const;
export type PhotoId = keyof typeof PHOTOS;

export function Photo({ id, className = "", eager = false, sizes = "(max-width: 700px) 100vw, 600px" }: { id: PhotoId; className?: string; eager?: boolean; sizes?: string }) {
  return <img className={`photo ${className}`} src={`/photos/${id}-640.webp`} srcSet={`/photos/${id}-640.webp 640w, /photos/${id}-1200.webp 1200w`} sizes={sizes}
    alt={t(PHOTOS[id])} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" draggable={false} />;
}

type Idea = { id: PhotoId; title: string; text: string; href: string };
const IDEAS: Idea[] = [
  { id: "toast", title: msg("A good breakfast"), text: msg("Search any food by name, in your own language."), href: "/nutrition#food-search" },
  { id: "yoga", title: msg("Ten calm minutes"), text: msg("A gentle stretch counts. Rest days count too."), href: "/workouts" },
  { id: "bowl", title: msg("Log a full plate"), text: msg("Add each part or snap a photo for an estimate."), href: "/scanner" },
  { id: "track", title: msg("A short run or walk"), text: msg("Track it manually or with the camera."), href: "/workouts" },
  { id: "smoothie", title: msg("Something fresh"), text: msg("Smoothies, fruit, salads: whatever you enjoy."), href: "/nutrition#food-search" },
  { id: "pushup", title: msg("Move with friends"), text: msg("Find a community for your kind of movement."), href: "/communities" },
];

export function PhotoCarousel({ title = msg("Ideas for today") }: { title?: string }) {
  const track = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  // Mouse drag to scroll (touch already swipes natively). A drag never counts as a click on a card.
  const down = (e: ReactPointerEvent) => { if (e.pointerType === "mouse" && track.current) drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false }; };
  const move = (e: ReactPointerEvent) => { const d = drag.current; if (!d || !track.current) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 5) { d.moved = true; track.current.dataset.dragging = "true"; } track.current.scrollLeft = d.left - dx; };
  const up = () => { setTimeout(() => { if (track.current) delete track.current.dataset.dragging; drag.current = null; }, 0); };
  return <section className="photo-carousel" aria-labelledby="ideas-title">
    <div className="photo-carousel-head"><h2 id="ideas-title">{t(title)}</h2><div><button type="button" aria-label={t("Previous ideas")} onClick={() => scroll(-1)}>‹</button><button type="button" aria-label={t("More ideas")} onClick={() => scroll(1)}>›</button></div></div>
    <div className="photo-track" ref={track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      onClickCapture={e => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}>
      {IDEAS.map(idea => <Link key={idea.id} href={idea.href} className="photo-card" draggable={false}><Photo id={idea.id} sizes="280px" /><span><strong>{t(idea.title)}</strong><small>{t(idea.text)}</small></span></Link>)}
    </div>
    <p className="photo-credit">{t("Photos: Wikimedia Commons contributors.")}{" "}<Link href="/credits">{t("Credits")}</Link></p>
  </section>;
}
