// The four community places side by side (clubs, feed, events, challenges), shown at the top of each, so Community is
// one place to find rather than four separate links.
import { t, msg } from "@/lib/i18n";
import { CalendarDays, MessagesSquare, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import Link from "@/lib/navigation";

type Place = "clubs" | "feed" | "events" | "challenges";
const PLACES: [Place, string, string, LucideIcon][] = [
  ["clubs", "/communities", msg("Clubs"), UsersRound], ["feed", "/feed", msg("Feed"), MessagesSquare],
  ["events", "/events", msg("Events"), CalendarDays], ["challenges", "/challenges", msg("Challenges"), Trophy]];

export function CommunityStrip({ current }: { current: Place }) {
  return <nav className="community-strip" aria-label={t("Community")}>
    {PLACES.map(([id, href, label, Icon]) => <Link key={id} href={href} data-place={id} aria-current={id === current ? "page" : undefined}>
      <span aria-hidden="true"><Icon size={20} strokeWidth={2.2} /></span>{t(label)}</Link>)}
  </nav>;
}

/** Today's invitation to the community: the four places as quick links. */
export function CommunityCard() {
  return <section className="community-card" aria-labelledby="community-card-title">
    <div><span className="eyebrow">{t("COMMUNITY")}</span><h2 id="community-card-title">{t("Move with people like you")}</h2>
      <p>{t("Clubs, events, the feed and friendly challenges, in one place.")}</p></div>
    <div className="community-card-links">{PLACES.map(([id, href, label, Icon]) => <Link key={id} href={href} data-place={id}>
      <span aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>{t(label)}</Link>)}</div>
  </section>;
}
