// Companion bond on the Play page. It stays hidden while the feature is off.
import { t, msg, localizedMap } from "@/lib/i18n";
import { useEffect, useState } from "react";

type Bond = { companion: string; xp: number; stage_name: string; next: { name: string; xp: number; remaining: number } | null; auras: string[]; titles: string[]; aura: string; title: string; others: { companion: string; xp: number; stage_name: string }[] };
const AURA_NAMES: Record<string, string> = { none: msg("No aura"), glow: msg("Soft glow"), sparkle: msg("Sparkle"), halo: msg("Halo") };
localizedMap(AURA_NAMES);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function BondCard() {
  const [bond, setBond] = useState<Bond | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { fetch("/api/adventure/bond").then(r => r.ok ? r.json() : null).then(data => setBond(Array.isArray(data?.auras) ? data : null), () => setBond(null)); }, []);
  if (!bond) return null;
  const choose = async (next: { aura: string; title: string }) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/adventure/bond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("That didn’t save. Please try again."));
      setBond(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("That didn’t save. Please try again.")); } finally { setBusy(false); }
  };
  const share = bond.next ? Math.round(bond.xp / bond.next.xp * 100) : 100;
  return <section className="play-section bond-card" aria-labelledby="bond-title">
    <span className="play-stat-label">{t("YOU AND {n}", { n: bond.companion.toUpperCase() })}</span>
    <h2 id="bond-title">{bond.stage_name}</h2>
    <p>{bond.next ? t("{remaining} XP to {name}. A bond never goes down, so take your time.", { remaining: bond.next.remaining, name: bond.next.name }) : t("You’ve reached the highest bond. A bond never goes down.")}</p>
    <progress aria-label={t("Bond progress")} max={100} value={share} />
    <div className="bond-choices">
      <label>{t("Aura")}<select aria-label={t("Aura")} value={bond.aura} disabled={busy} onChange={event => void choose({ aura: event.target.value, title: bond.title })}>{bond.auras.map(id => <option key={id} value={id}>{AURA_NAMES[id] || id}</option>)}</select></label>
      <label>{t("Title")}<select aria-label={t("Title")} value={bond.title} disabled={busy} onChange={event => void choose({ aura: bond.aura, title: event.target.value })}><option value="">{t("No title")}</option>{bond.titles.map(title => <option key={title} value={title}>{title}</option>)}</select></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {bond.others.length > 0 && <p>{t("Also: {n}", { n: bond.others.map(o => `${capital(o.companion)} (${o.stage_name})`).join(", ") })}</p>}
  </section>;
}
