import { authenticated, forward, json, sameOrigin } from "@/lib/server-account";
type Context = { params: Promise<{ action: string }> };
const readActions = new Set(["status", "grocy", "mealie", "mealie-recipe", "exercises", "prices"]);
const writeActions = new Set(["ingredients", "recipe-import", "plan", "shopping", "transcribe", "label"]);
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (!readActions.has(action)) return json({ error: "Not found" }, 404);
  const query = new URL(request.url).searchParams;
  const permitted = new URLSearchParams();
  for (const name of ["query", "code", "currency", "slug"]) { const value = query.get(name); if (value !== null && value.length <= 250) permitted.set(name, value); }
  try { return await forward(await authenticated(`/integrations/${action}?${permitted}`, {}, 20000)); }
  catch { return json({ error: "The integration service is unavailable. Check that the API is running." }, 503); }
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  const { action } = await context.params;
  if (!writeActions.has(action)) return json({ error: "Not found" }, 404);
  try {
    const raw = await request.text();
    if (raw.length > (action === "label" || action === "transcribe" ? 14000500 : 2000000)) return json({ error: "Request is too large." }, 413);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid input" }, 400);
    return await forward(await authenticated(`/integrations/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, action === "label" || action === "transcribe" ? 100000 : 30000));
  } catch { return json({ error: "The integration request failed or timed out. Your saved data is unchanged." }, 503); }
}
