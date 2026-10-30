// Free-licence photos (Wikimedia Commons), self-hosted in /public/photos with credits at /credits.
// Photo: responsive <picture>. PhotoCarousel: a swipeable, draggable strip of ideas with arrow buttons.
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import Link from "@/lib/navigation";

export const PHOTOS = {
  idli: "Idli with sambar and chutneys on a banana leaf",
  dosa: "Masala dosa with a vada, sambar and chutney",
  thali: "An Indian thali with rice, dals, curries and roti",
  fruit: "Two bowls of mixed fresh fruit",
  salad: "A bowl of avocado and tomato salad",
  smoothie: "A green kiwi smoothie with fresh kiwi halves",
  jogging: "A runner jogging down a quiet street",
  yoga: "A woman stretching on a yoga mat in a sunny park",
  pushup: "Friends doing incline push-ups on a park bench",
} as const;
export type PhotoId = keyof typeof PHOTOS;

export function Photo({ id, className = "", eager = false, sizes = "(max-width: 700px) 100vw, 600px" }: { id: PhotoId; className?: string; eager?: boolean; sizes?: string }) {
  return <img className={`photo ${className}`} src={`/photos/${id}-640.webp`} srcSet={`/photos/${id}-640.webp 640w, /photos/${id}-1200.webp 1200w`} sizes={sizes}
    alt={PHOTOS[id]} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />;
}

type Idea = { id: PhotoId; title: string; text: string; href: string };
const IDEAS: Idea[] = [
  { id: "idli", title: "A light South Indian breakfast", text: "Search idli or dosa: values come from IFCT.", href: "/nutrition#food-search" },
  { id: "yoga", title: "Ten calm minutes", text: "A gentle stretch counts. Rest days count too.", href: "/workouts" },
  { id: "thali", title: "Log a full thali", text: "Add each dish or snap a photo for an estimate.", href: "/scanner" },
  { id: "jogging", title: "A short run or walk", text: "Track it manually or with the camera.", href: "/workouts" },
  { id: "smoothie", title: "Something fresh", text: "Smoothies, fruit, salads: whatever you enjoy.", href: "/nutrition#food-search" },
  { id: "pushup", title: "Move with friends", text: "Find a community for your kind of movement.", href: "/communities" },
];

export function PhotoCarousel({ title = "Ideas for today" }: { title?: string }) {
  const track = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  // Mouse drag to scroll (touch already swipes natively). A drag never counts as a click on a card.
  const down = (e: ReactPointerEvent) => { if (e.pointerType === "mouse" && track.current) drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false }; };
  const move = (e: ReactPointerEvent) => { const d = drag.current; if (!d || !track.current) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 5) { d.moved = true; track.current.dataset.dragging = "true"; } track.current.scrollLeft = d.left - dx; };
  const up = () => { setTimeout(() => { if (track.current) delete track.current.dataset.dragging; drag.current = null; }, 0); };
  return <section className="photo-carousel" aria-labelledby="ideas-title">
    <div className="photo-carousel-head"><h2 id="ideas-title">{title}</h2><div><button type="button" aria-label="Previous ideas" onClick={() => scroll(-1)}>‹</button><button type="button" aria-label="More ideas" onClick={() => scroll(1)}>›</button></div></div>
    <div className="photo-track" ref={track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      onClickCapture={e => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}>
      {IDEAS.map(idea => <Link key={idea.id} href={idea.href} className="photo-card" draggable={false}><Photo id={idea.id} sizes="280px" /><span><strong>{idea.title}</strong><small>{idea.text}</small></span></Link>)}
    </div>
    <p className="photo-credit">Photos: Wikimedia Commons contributors. <Link href="/credits">Credits</Link></p>
  </section>;
}
