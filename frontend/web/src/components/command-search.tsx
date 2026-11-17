// Search everything: Ctrl+K (Cmd+K) or "/" from anywhere, or the search button. Pages and quick actions match as you
// type, even offline; foods come from the food catalogue and your recent workouts from your account.
import { t, msg, localized } from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Dumbbell, Search, Utensils, X, Zap, FileText } from "lucide-react";
import { useRouter, usePathname } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { useWellness } from "@/lib/days";
import { useLocalDate } from "@/lib/use-local-state";
import { historyRequest, type HistoryItem } from "@/lib/workouts";
import { ACTIONS, score, searchLocal, type Hit } from "@/lib/search";

const RECENT = "trackcal-search-recent";             // not a "trackcal:" key: never synced or backed up
const ICONS = { page: FileText, action: Zap, food: Utensils, workout: Dumbbell };
const GROUPS: [Hit["kind"], string][] = [["action", msg("Quick actions")], ["page", msg("Pages")], ["food", msg("Foods")], ["workout", msg("Your workouts")]];
localized(GROUPS, ["1"]);
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 5) : []; } catch { return []; } };
const remember = (q: string) => { try { localStorage.setItem(RECENT, JSON.stringify([q, ...readRecent().filter(x => x !== q)].slice(0, 5))); } catch { /* storage off */ } };

function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}
const workoutHref = (w: HistoryItem) => w.link ?? (w.kind === "manual" || w.kind === "gym" || w.kind === "camera" ? "/workouts" : "/activities");

function Panel({ close }: { close: () => void }) {
  const router = useRouter(), { user } = useAccount(), date = useLocalDate(), [, setWellness] = useWellness(date), list = useId();
  const [query, setQuery] = useState(""), [active, setActive] = useState(0), [foods, setFoods] = useState<Hit[]>([]), [foodNote, setFoodNote] = useState("");
  const [workouts, setWorkouts] = useState<HistoryItem[]>([]), [status, setStatus] = useState(""), [recent] = useState(readRecent);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  // Your recent workouts, once.
  useEffect(() => { if (!user) return; let live = true; historyRequest("all", 0, 30).then(p => { if (live) setWorkouts(p.items); }).catch(() => {}); return () => { live = false; }; }, [user]);
  // Foods, a moment after typing stops.
  useEffect(() => {
    const q = query.trim(); setFoodNote("");
    if (q.length < 2) { setFoods([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      fetch(`/api/foods?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(12000) }).then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok || !Array.isArray(data.results)) { setFoods([]); setFoodNote(navigator.onLine === false ? t("Food search needs a connection.") : ""); return; }
        setFoods(data.results.slice(0, 5).map((f: { id: string; name: string; calories?: number; serving_size?: string }) => ({ kind: "food", id: `food:${f.id}`, title: f.name,
          detail: [typeof f.calories === "number" ? `${Math.round(f.calories)} kcal` : "", f.serving_size || "per 100 g"].filter(Boolean).join(" · "), href: `/food-library?q=${encodeURIComponent(f.name)}` })));
      }).catch(() => { if (live) { setFoods([]); setFoodNote(t("Food search needs a connection.")); } });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim();
    if (!q) return ACTIONS;                          // before typing: the quick actions
    const mine = workouts.map(w => ({ w, s: score(q, w.title, `${w.kind} ${w.detail} ${w.day}`) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4)
      .map(({ w }) => ({ kind: "workout" as const, id: `w:${w.id}`, title: w.title, detail: `${w.day} · ${[w.minutes ? `${w.minutes} min` : "", w.detail].filter(Boolean).join(" · ")}`, href: workoutHref(w) }));
    const local = searchLocal(q, 8);
    // Foods matched only through a regional name are shown when the words don't already name a page ("run" is not a food).
    const shownFoods = local.length ? foods.filter(f => score(q, f.title) > 0) : foods;
    return GROUPS.flatMap(([kind]) => [...local, ...shownFoods, ...mine].filter(h => h.kind === kind));
  }, [query, foods, workouts]);
  useEffect(() => { setActive(0); }, [query]);

  const choose = useCallback((hit: Hit) => {
    if (query.trim()) remember(query.trim());
    if (hit.action === "water") { setWellness(w => ({ ...w, water: w.water + 250 })); setStatus(t("Added 250 ml water to today.")); return; }
    if (hit.action === "quick-add") { close(); window.dispatchEvent(new Event("trackcal-quick-add")); return; }
    if (hit.href) { close(); router.push(hit.href); }
  }, [query, setWellness, close, router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); choose(hits[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }          // one press closes, even with text typed
  };
  useEffect(() => { document.getElementById(`${list}-${active}`)?.scrollIntoView?.({ block: "nearest" }); }, [active, list]);

  let index = -1;
  return <div className="cs-body">
    <div className="cs-field">
      <Search size={20} aria-hidden />
      <input ref={input} type="search" role="combobox" aria-label={t("Search TrackCal")} aria-expanded={hits.length > 0} aria-controls={list} aria-autocomplete="list"
        aria-activedescendant={hits.length ? `${list}-${active}` : undefined} placeholder={t("Search pages, foods, workouts…")} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} />
      <button type="button" className="cs-close" onClick={close} aria-label={t("Close search")}><X size={18} /></button>
    </div>
    {!query.trim() && recent.length > 0 && <div className="cs-recent"><p>{t("Recent")}</p>{recent.map(r => <button key={r} type="button" onClick={() => setQuery(r)}><Clock size={14} aria-hidden />{r}</button>)}</div>}
    <ul id={list} role="listbox" aria-label={t("Results")} className="cs-results">
      {GROUPS.map(([kind, label]) => {
        const group = hits.filter(h => h.kind === kind);
        if (!group.length) return null;
        return <li key={kind} role="presentation"><p className="cs-group" id={`${list}-g-${kind}`}>{label}</p>
          <ul role="group" aria-labelledby={`${list}-g-${kind}`}>{group.map(hit => {
            index++; const i = index, Icon = ICONS[hit.kind];
            return <li key={hit.id} id={`${list}-${i}`} role="option" aria-selected={i === active} className="cs-option" onMouseEnter={() => setActive(i)} onClick={() => choose(hit)}>
              <span className="cs-icon" aria-hidden><Icon size={18} /></span><span className="cs-text"><strong>{hit.title}</strong><small>{hit.detail}</small></span></li>;
          })}</ul></li>;
      })}
    </ul>
    {query.trim() && !hits.length && <p className="cs-empty">{t("Nothing found for \"{n}\". Try another word, like \"water\", \"run\" or \"recipe\".", { n: query.trim() })}</p>}
    {foodNote && <p className="cs-empty">{foodNote}</p>}
    <p className="cs-status" role="status">{status}</p>
    <p className="cs-hint" aria-hidden><kbd>↑</kbd><kbd>↓</kbd> {t("to move ·")}{" "}<kbd>{t("Enter")}</kbd> {t("to open ·")}{" "}<kbd>{t("Esc")}</kbd> {t("to close")}</p>
  </div>;
}

/** The search button, and the panel it opens. Ctrl+K, Cmd+K and "/" open it from anywhere. */
export function CommandSearch({ compact = false }: { compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), [open, setOpen] = useState(false), path = usePathname();
  const show = useCallback(() => { const d = dialog.current; if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); setOpen(true); } }, []);
  const close = useCallback(() => { const d = dialog.current; if (d?.close) d.close(); else d?.removeAttribute("open"); setOpen(false); }, []);
  useEffect(() => { close(); }, [path, close]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e))) {
        if (dialog.current?.open) return;
        e.preventDefault(); show();
      }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [show]);
  return <>
    <button type="button" className={`cs-button${compact ? " cs-compact" : ""}`} aria-label={t("Search")} title={t("Search (Ctrl+K or /)")} aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Control+K Meta+K /" onClick={show}>
      <Search size={18} aria-hidden /><span className="cs-label">{t("Search")}</span><kbd className="cs-kbd" aria-hidden>{t("Ctrl K")}</kbd></button>
    {createPortal(<dialog ref={dialog} className="cs-dialog" aria-label={t("Search")} onClose={() => setOpen(false)} onClick={e => { if (e.target === dialog.current) close(); }}>{open && <Panel close={close} />}</dialog>, document.body)}
  </>;
}

