// Meal plans: plan the week's meals from your recipes and pantry, within your targets and budget.
import { t, msg } from "@/lib/i18n";
import { useCallback, useState } from "react";
import { useLocalDate, useLocalState } from "@/lib/use-local-state";
import { MealPlanner } from "@/components/meal-planner";
import { PageHeader } from "@/components/page-header";
import Link from "@/lib/navigation";
import type { SavedRecipe, PantryEntry, ShoppingEntry } from "@/lib/smart-tools";

export const metadata = { title:msg("TrackCal — Meal plans") };

export default function Page() {
  const today = useLocalDate();
  const [recipes] = useLocalState<SavedRecipe[]>("trackcal:studio:recipes", []);
  const [pantry] = useLocalState<PantryEntry[]>("trackcal:studio:pantry", []);
  const [, setShopping] = useLocalState<ShoppingEntry[]>("trackcal:studio:shopping", []);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const notice = useCallback((value: string) => { setMessage(value); setError(""); }, []);
  const run = useCallback((task: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    void task().catch(reason => setError(reason instanceof Error ? reason.message : t("Something went wrong. Try again."))).finally(() => setBusy(false));
  }, [busy]);
  return <main className="account-page page-shell">
    <PageHeader title={t("Meal plans")} text={t("Plan the week's meals from your recipes and pantry, within your targets and budget.")}
      actions={<><Link href="/recipes" className="account-secondary">{t("Recipes")}</Link><Link href="/tools?tab=pantry" className="account-secondary">{t("Pantry and shopping")}</Link></>} />
    {message && <p role="status" className="account-success">{message}</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
    <MealPlanner recipes={recipes} pantry={pantry} today={today} busy={busy} run={run} notice={notice} setShopping={setShopping} />
  </main>;
}
