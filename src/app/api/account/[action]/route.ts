import { authenticated, forward, json, saveTokens, clearTokens, upstream, sameOrigin } from "@/lib/server-account";
type Context = { params: Promise<{ action: string }> };
export async function GET(_request: Request, context: Context) {
  const { action } = await context.params;
  const paths: Record<string, string> = { session: "/auth/me", profile: "/users/profile", backup: "/users/workspace", export: "/users/export" };
  if (!Object.hasOwn(paths, action)) return json({ error: "Not found" }, 404);
  try { return await forward(await authenticated(paths[action])); }
  catch { return json({ error: "Account service is unavailable. Please try again shortly." }, 503); }
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  const { action } = await context.params;
  if (action === "logout") { await clearTokens(); return json({ status: "Signed out" }); }
  const allowed = ["login", "signup", "profile", "password", "backup", "forgot-password", "reset-password", "verify-email", "request-verification", "close"];
  if (!allowed.includes(action)) return json({ error: "Not found" }, 404);
  try {
    const raw = await request.text();
    if (raw.length > 1000000) return json({ error: "Backup is too large." }, 413);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request." }, 400);
    if (["forgot-password", "reset-password", "verify-email"].includes(action)) {
      const fields = action === "forgot-password" ? { email: body.email } : action === "reset-password" ? { token: body.token, new_password: body.new_password } : { token: body.token };
      return await forward(await upstream(`/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) }));
    }
    if (action === "request-verification") return await forward(await authenticated("/auth/request-verification", { method: "POST" }));
    if (action === "close") {
      if (body.confirmation !== "DELETE") return json({ error: "Type DELETE to confirm account closure." }, 400);
      const response = await authenticated("/users/account", { method: "DELETE" });
      if (response.ok) await clearTokens();
      return await forward(response);
    }
    if (action === "login" || action === "signup") {
      if (typeof body.email !== "string" || typeof body.password !== "string") return json({ error: "Email and password are required." }, 400);
      const login = action === "login";
      const response = await upstream(`/auth/${action}`, { method: "POST", headers: { "Content-Type": login ? "application/x-www-form-urlencoded" : "application/json" }, body: login ? new URLSearchParams({ username: body.email, password: body.password }) : JSON.stringify({ email: body.email, password: body.password, display_name: body.display_name }) });
      if (!response.ok) return await forward(response);
      await saveTokens(await response.json());
      return json({ status: login ? "Signed in" : "Account created" });
    }
    const paths: Record<string, string> = { profile: "/users/profile", password: "/auth/password", backup: "/users/workspace" };
    return await forward(await authenticated(paths[action], { method: action === "profile" ? "PATCH" : action === "backup" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  } catch { return json({ error: "Account service is unavailable. Please try again shortly." }, 503); }
}
