import { useWellness } from "@/lib/days";
// One tap for the things people log every day: a glass of water, or a favourite they've already reviewed.
// Every tap can be undone, so a slip costs nothing.
import { useEffect, useState } from "react";
import { useAccount } from "@/components/account-session";
import { inputItem, wellnessRequest, type NutritionData } from "@/lib/wellness";

const GLASS_ML = 250, MOST_FAVOURITES = 3;
type Favourite = NutritionData["favorites"][number];
type Undo = { kind: "water" } | { kind: "meal"; id: string };

export function mealForHour(hour: number) { return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 22 ? "dinner" : "snack"; }

export function QuickLog({ date }: { date: string }) {
  const { user } = useAccount(), userId = user?.id;
  const [wellness, setWellness] = useWellness(date);
  const [favourites, setFavourites] = useState<Favourite[]>([]), [day, setDay] = useState("");
  const [notice, setNotice] = useState(""), [undo, setUndo] = useState<Undo | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!userId) return; let cancelled = false;
    wellnessRequest<NutritionData>("diary").then(data => { if (!cancelled) { setFavourites((data.favorites || []).slice(0, MOST_FAVOURITES)); setDay(data.today); } }, () => { /* water still works without the diary */ });
    return () => { cancelled = true; };
  }, [userId]);
  const addWater = () => { setError(""); setWellness({ ...wellness, water: wellness.water + GLASS_ML }); setNotice(`Water: ${wellness.water + GLASS_ML} ml today`); setUndo({ kind: "water" }); };
  const logFavourite = async (favourite: Favourite) => {
    setBusy(true); setError("");
    try {
      const id = crypto.randomUUID();
      await wellnessRequest("diary", { id, day, meal_type: mealForHour(new Date().getHours()), items: [inputItem(favourite.item)], notes: "", method: "saved" });
      setNotice(`Logged ${favourite.item.name}`); setUndo({ kind: "meal", id });
    } catch (reason) { setNotice(""); setUndo(null); setError(reason instanceof Error ? reason.message : "That didn’t save. Please try again."); } finally { setBusy(false); }
  };
  const takeBack = async () => {
    if (!undo) return; setBusy(true); setError("");
    try {
      if (undo.kind === "water") setWellness({ ...wellness, water: Math.max(0, wellness.water - GLASS_ML) });
      else await wellnessRequest(`diary/${undo.id}`, undefined, "DELETE");
      setNotice("Undone"); setUndo(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "That couldn’t be undone. Please try again."); } finally { setBusy(false); }
  };
  return <section className="quick-log" aria-label="Quick log">
    <div className="quick-log-row">
      <button className="quick-log-button" onClick={addWater}>+250 ml water</button>
      {favourites.map(favourite => <button key={favourite.id} className="quick-log-button" disabled={busy || !day} onClick={() => void logFavourite(favourite)} aria-label={`Log ${favourite.item.name}`}>{favourite.item.name}</button>)}
    </div>
    {notice && <p role="status" className="quick-log-notice">{notice}{undo && <button disabled={busy} onClick={() => void takeBack()}>Undo</button>}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
