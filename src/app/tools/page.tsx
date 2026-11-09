import { useCallback, useEffect, useState } from "react";
import Link, { useSearch } from "@/lib/navigation";
import { Leaf, Sparkles } from "lucide-react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { useLocalDate, useLocalState } from "@/lib/use-local-state";
import { RecipeWorkbench, type ImportedRecipe } from "@/components/recipe-workbench";
import { MealPlanner } from "@/components/meal-planner";
import { PantryTools } from "@/components/pantry-tools";
import { MediaTools } from "@/components/media-tools";
import { FitnessTools } from "@/components/fitness-tools";
import { DeviceTools } from "@/components/device-tools";
import type { SavedRecipe, PantryEntry, ShoppingEntry } from "@/lib/smart-tools";
const tabs = ["Recipe import", "Meal planner", "Pantry & prices", "Label & voice", "Workouts", "Device & sync"] as const;
/** Links can open a tab directly, e.g. /tools?tab=pantry. */
const TAB_LINKS: Record<string, typeof tabs[number]> = { import: "Recipe import", planner: "Meal planner", pantry: "Pantry & prices", label: "Label & voice", workouts: "Workouts", device: "Device & sync" };
export default function ToolsPage() { const { user, ready } = useAccount(); return !ready ? <main className="account-loading">Opening smart tools…</main> : <SmartWorkspace key={user?.id || "guest"} />; }
function SmartWorkspace() {
  const { user } = useAccount(); const scope = useWorkspaceScope(), today = useLocalDate();
  const search = useSearch(), [tab, setTab] = useState<typeof tabs[number]>(() => TAB_LINKS[new URLSearchParams(search).get("tab") ?? ""] ?? "Recipe import"), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { const linked = TAB_LINKS[new URLSearchParams(search).get("tab") ?? ""]; if (linked) setTab(linked); }, [search]);
  const [recipes, setRecipes] = useLocalState<SavedRecipe[]>("trackcal:studio:recipes", []);
  const [pantry, setPantry] = useLocalState<PantryEntry[]>("trackcal:studio:pantry", []);
  const [shopping, setShopping] = useLocalState<ShoppingEntry[]>("trackcal:studio:shopping", []);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const notice = useCallback((value: string) => { setMessage(value); setError(""); }, []);
  const run = useCallback((task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(""); setMessage(""); void task().catch(reason => setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.")).finally(() => setBusy(false)); }, [busy]);
  return <main className="account-page smart-page"><section className="smart-heading"><div><p className="eyebrow"><Sparkles size={14} /> A LITTLE SMARTER, EVERY DAY</p><h1>From your pantry<br />to a better plan<span>.</span></h1><p>Import recipes. Plan within your budget. Make the most of what you have.</p></div><div className="smart-orb" aria-hidden="true"><Leaf size={62} strokeWidth={1.2} /></div></section>{!user && <p className="studio-guest">Manual recipe, pantry and workout entries work locally. <Link href="/login">Sign in free</Link> for server-powered imports, optimization and connected services.</p>}<nav aria-label="Smart tools" className="studio-tabs">{tabs.map(item => <button aria-current={tab === item ? "page" : undefined} key={item} onClick={() => { setTab(item); setMessage(""); setError(""); }}>{item}</button>)}</nav><div className="studio-feedback" aria-live="polite">{busy && <p role="status">Working on it…</p>}{message && <p role="status" className="account-success">{message}</p>}{error && <p role="alert" className="account-error">{error}</p>}</div><div hidden={tab !== "Recipe import"}><RecipeWorkbench recipes={recipes} setRecipes={setRecipes} busy={busy} run={run} notice={notice} imported={imported} onImported={setImported} /></div><div hidden={tab !== "Meal planner"}><MealPlanner recipes={recipes} pantry={pantry} today={today} busy={busy} run={run} notice={notice} setShopping={setShopping} /></div><div hidden={tab !== "Pantry & prices"}><PantryTools pantry={pantry} setPantry={setPantry} shopping={shopping} setShopping={setShopping} today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Label & voice"}><MediaTools today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Workouts"}><FitnessTools active={tab === "Workouts"} today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Device & sync"}><DeviceTools scope={scope} signedIn={!!user} busy={busy} run={run} notice={notice} onRecipe={value => { setImported(value); setTab("Recipe import"); }} /></div></main>;
}
