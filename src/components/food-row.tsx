import { t } from "@/lib/i18n";
import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

export interface LibraryFood { id: string; name: string; cuisine: string; serving_size: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; source: string; verified?: boolean; portions?: { label: string; grams: number }[]; ingredients?: string[] }
export interface LoggedPortion { name: string; calories: number; protein: number; carbs: number; fat: number }
const CUSTOM = -1, TINTS = 4;
const one = (value: number) => Math.round(value * 10) / 10;

/** A quiet row: the food, its calories, one tap to log. The serving controls open only when someone wants them. */
export function FoodRow({ food, remaining, onLog }: { food: LibraryFood; remaining: number; onLog: (portion: LoggedPortion) => void }) {
  const portions = food.portions ?? [], base = parseFloat(food.serving_size) || 100;
  const [open, setOpen] = useState(false), [choice, setChoice] = useState(portions.length ? 0 : CUSTOM), [amount, setAmount] = useState("1"), [typed, setTyped] = useState(String(base));
  const grams = choice === CUSTOM ? Number(typed) || 0 : portions[choice].grams * (Number(amount) || 0), ratio = grams / base;
  const calories = Math.round(food.calories * ratio), share = remaining > 0 ? Math.round(calories / remaining * 100) : null;
  const serving = choice === CUSTOM ? `${Math.round(grams)} g` : `${amount === "1" ? "" : `${amount} × `}${portions[choice].label}`;
  return <article className="food-row" data-tint={food.name.length % TINTS} data-open={open || undefined}>
    <button type="button" className="food-row-main" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="food-row-mark" aria-hidden="true">{food.name.charAt(0)}</span>
      <span className="food-row-name"><strong>{food.name}</strong><small>{serving}</small></span>
      <span className="food-row-kcal"><strong>{calories}</strong><small>kcal</small></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    <button type="button" className="food-row-add" aria-label={t("Log {name}", { name: food.name })} disabled={grams <= 0} onClick={() => onLog({ name: `${food.name} (${Math.round(grams)} g)`, calories, protein: one(food.protein * ratio), carbs: one(food.carbs * ratio), fat: one(food.fat * ratio) })}><Plus size={18} aria-hidden="true" /></button>
    {open && <div className="food-row-panel">
      <div className="food-row-amount">
        <label>{t("Serving")}<select aria-label={t("Serving of {name}", { name: food.name })} value={choice} onChange={event => setChoice(Number(event.target.value))}>{portions.map((portion, i) => <option key={portion.label} value={i}>{portion.label} ({Math.round(portion.grams)} g)</option>)}<option value={CUSTOM}>{t("Enter grams")}</option></select></label>
        {choice === CUSTOM ? <label>{t("Grams")}<input type="number" min="1" max="10000" aria-label={t("Grams of {name}", { name: food.name })} value={typed} onChange={event => setTyped(event.target.value)} /></label> : <label>{t("How many")}<input type="number" min="0.25" max="50" step="0.25" aria-label={t("How many servings of {name}", { name: food.name })} value={amount} onChange={event => setAmount(event.target.value)} /></label>}
      </div>
      <ul className="food-row-macros" aria-label={t("Nutrition for this amount")}><li><strong>{one(food.protein * ratio)} g</strong> {t("protein")}</li><li><strong>{one(food.carbs * ratio)} g</strong> {t("carbs")}</li><li><strong>{one(food.fat * ratio)} g</strong> {t("fat")}</li></ul>
      {share !== null && <p>{t("{share}% of the {remaining} kcal you have left today. {n} g in total.", { share, remaining, n: Math.round(grams) })}</p>}
      {!!food.ingredients?.length && <p className="food-row-ingredients">{food.ingredients.join(", ")}</p>}
      <small>{t("{source}. {calories} kcal per {base} g.", { source: food.source, calories: food.calories, base })}</small>
    </div>}
  </article>;
}
