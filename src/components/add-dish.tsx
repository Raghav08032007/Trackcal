import { useState } from "react";
import type { LibraryFood } from "@/components/food-row";

/** Adds a dish the photo missed, using catalog values rather than another AI estimate. */
export function AddDish({ onAdd }: { onAdd: (food: LibraryFood, grams: number) => void }) {
  const [query, setQuery] = useState(""), [grams, setGrams] = useState(100), [foods, setFoods] = useState<LibraryFood[]>([]), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  async function find() {
    const name = query.trim();
    if (name.length < 2 || busy) return;
    setBusy(true); setNote(""); setFoods([]);
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(15000) });
      const found: LibraryFood[] = response.ok ? (await response.json()).results ?? [] : [];
      setFoods(found.slice(0, 5));
      if (!response.ok) setNote("Search isn't available right now. Try again.");
      else if (!found.length) setNote("No match. Try a simpler name.");
    } catch { setNote("Search isn't available right now. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="add-dish">
    <div className="add-dish-search">
      <label>Add a missing dish<input value={query} maxLength={100} placeholder="e.g. papad" onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void find(); } }} /></label>
      <label>Grams<input type="number" min="1" max="10000" value={grams} onChange={e => setGrams(Math.max(1, Math.min(10000, Math.floor(Number(e.target.value)) || 1)))} /></label>
      <button type="button" className="account-secondary" disabled={busy || query.trim().length < 2} onClick={() => void find()}>{busy ? "Finding…" : "Find"}</button>
    </div>
    {note && <p role="status">{note}</p>}
    {foods.map(food => <button type="button" className="account-secondary" key={food.id} onClick={() => { onAdd(food, grams); setFoods([]); setQuery(""); }}>Add {food.name} ({grams} g)</button>)}
  </div>;
}
