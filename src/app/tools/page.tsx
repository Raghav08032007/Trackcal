import { t, msg } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import Link, { useSearch } from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { useLocalDate, useLocalState } from "@/lib/use-local-state";
import { PageHeader } from "@/components/page-header";
import { RecipeWorkbench, type ImportedRecipe } from "@/components/recipe-workbench";
import { MealPlanner } from "@/components/meal-planner";
import { PantryTools } from "@/components/pantry-tools";
import { MediaTools } from "@/components/media-tools";
import { FitnessTools } from "@/components/fitness-tools";
import { DeviceTools } from "@/components/device-tools";
import type { SavedRecipe, PantryEntry, ShoppingEntry } from "@/lib/smart-tools";
const tabs = [msg("Recipe import"), msg("Meal planner"), msg("Pantry & prices"), msg("Label & voice"), msg("Workouts"), msg("Device & sync")] as const;
/** Links can open a tab directly, e.g. /tools?tab=pantry. */
const TAB_LINKS: Record<string, typeof tabs[number]> = { import: "Recipe import", planner: "Meal planner", pantry: "Pantry & prices", label: "Label & voice", workouts: "Workouts", device: "Device & sync" };
export const metadata = { title:msg("TrackCal — Smart tools") };
export default function ToolsPage() { const { user, ready } = useAccount(); return !ready ? <main className="account-loading">{t("Opening smart tools…")}</main> : <SmartWorkspace key={user?.id || "guest"} />; }
function SmartWorkspace() {
  const { user } = useAccount(); const scope = useWorkspaceScope(), today = useLocalDate();
  const search = useSearch(), [tab, setTab] = useState<typeof tabs[number]>(() => TAB_LINKS[new URLSearchParams(search).get("tab") ?? ""] ?? "Recipe import"), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { const linked = TAB_LINKS[new URLSearchParams(search).get("tab") ?? ""]; if (linked) setTab(linked); }, [search]);
  const [recipes, setRecipes] = useLocalState<SavedRecipe[]>("trackcal:studio:recipes", []);
  const [pantry, setPantry] = useLocalState<PantryEntry[]>("trackcal:studio:pantry", []);
  const [shopping, setShopping] = useLocalState<ShoppingEntry[]>("trackcal:studio:shopping", []);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const notice = useCallback((value: string) => { setMessage(value); setError(""); }, []);
  const run = useCallback((task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(""); setMessage(""); void task().catch(reason => setError(reason instanceof Error ? reason.message : t("Something went wrong. Try again."))).finally(() => setBusy(false)); }, [busy]);
  return <main className="account-page smart-page"><PageHeader title={t("Smart tools")} text={t("Import a recipe, plan within a budget, keep your pantry and shopping list, and read labels.")} />{!user && <p className="studio-guest">{t("Manual recipe, pantry and workout entries work locally.")}{" "}<Link href="/login">{t("Sign in free")}</Link> {t("for server-powered imports, optimization and connected services.")}</p>}<nav aria-label={t("Smart tools")} className="studio-tabs">{tabs.map(item => <button aria-current={tab === item ? "page" : undefined} key={item} onClick={() => { setTab(item); setMessage(""); setError(""); }}>{t(item)}</button>)}</nav><div className="studio-feedback" aria-live="polite">{busy && <p role="status">{t("Working on it…")}</p>}{message && <p role="status" className="account-success">{message}</p>}{error && <p role="alert" className="account-error">{error}</p>}</div><div hidden={tab !== "Recipe import"}><RecipeWorkbench recipes={recipes} setRecipes={setRecipes} busy={busy} run={run} notice={notice} imported={imported} onImported={setImported} /></div><div hidden={tab !== "Meal planner"}><MealPlanner recipes={recipes} pantry={pantry} today={today} busy={busy} run={run} notice={notice} setShopping={setShopping} /></div><div hidden={tab !== "Pantry & prices"}><PantryTools pantry={pantry} setPantry={setPantry} shopping={shopping} setShopping={setShopping} today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Label & voice"}><MediaTools today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Workouts"}><FitnessTools active={tab === "Workouts"} today={today} busy={busy} run={run} notice={notice} /></div><div hidden={tab !== "Device & sync"}><DeviceTools scope={scope} signedIn={!!user} busy={busy} run={run} notice={notice} onRecipe={value => { setImported(value); setTab("Recipe import"); }} /></div></main>;
}
