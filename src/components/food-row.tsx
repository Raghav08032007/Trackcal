import { useState } from "react";
import { Plus } from "lucide-react";

export interface LibraryFood { id: string; name: string; cuisine: string; serving_size: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; source: string; verified?: boolean; portions?: { label: string; grams: number }[]; ingredients?: string[] }
export interface LoggedPortion { name: string; calories: number; protein: number; carbs: number; fat: number }
const CUSTOM = -1;
const one = (value: number) => Math.round(value * 10) / 10;

/** Pick a real serving or type grams, and see the calories for exactly that much, set against what's left today. */
export function FoodRow({ food, remaining, onLog }: { food: LibraryFood; remaining: number; onLog: (portion: LoggedPortion) => void }) {
  const portions = food.portions ?? [], base = parseFloat(food.serving_size) || 100;
  const [choice, setChoice] = useState(portions.length ? 0 : CUSTOM), [amount, setAmount] = useState("1"), [typed, setTyped] = useState(String(base));
  const grams = choice === CUSTOM ? Number(typed) || 0 : portions[choice].grams * (Number(amount) || 0), ratio = grams / base;
  const calories = Math.round(food.calories * ratio), share = remaining > 0 ? Math.round(calories / remaining * 100) : null;
  return <article className="food-row">
    <div className="food-row-name"><h3>{food.name}</h3><p>{food.source} · {food.calories} kcal per {base} g</p>{!!food.ingredients?.length && <details><summary>Ingredients</summary><p>{food.ingredients.join(", ")}</p></details>}</div>
    <div className="food-row-amount">
      <label>Serving<select aria-label={`Serving of ${food.name}`} value={choice} onChange={event => setChoice(Number(event.target.value))}>{portions.map((portion, i) => <option key={portion.label} value={i}>{portion.label} ({Math.round(portion.grams)} g)</option>)}<option value={CUSTOM}>Enter grams</option></select></label>
      {choice === CUSTOM ? <label>Grams<input type="number" min="1" max="10000" aria-label={`Grams of ${food.name}`} value={typed} onChange={event => setTyped(event.target.value)} /></label> : <label>How many<input type="number" min="0.25" max="50" step="0.25" aria-label={`How many servings of ${food.name}`} value={amount} onChange={event => setAmount(event.target.value)} /></label>}
    </div>
    <div className="food-row-result"><strong>{calories} kcal</strong><small>{Math.round(grams)} g · {one(food.protein * ratio)} P · {one(food.carbs * ratio)} C · {one(food.fat * ratio)} F</small>{share !== null && <small>{share}% of your {remaining} kcal left today</small>}</div>
    <button type="button" aria-label={`Log ${food.name}`} disabled={grams <= 0} onClick={() => onLog({ name: `${food.name} (${Math.round(grams)} g)`, calories, protein: one(food.protein * ratio), carbs: one(food.carbs * ratio), fat: one(food.fat * ratio) })}><Plus size={14} aria-hidden="true" /> Log</button>
  </article>;
}
