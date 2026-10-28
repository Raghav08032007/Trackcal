import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const api = () => process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";
const access = "trackcal_access", refresh = "trackcal_refresh";
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
export async function upstream(path: string, init: RequestInit = {}, timeout = 12000) { return fetch(`${api()}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeout) }); }
export async function saveTokens(tokens: { access_token: string; refresh_token: string }) {
  const jar = await cookies(); const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  jar.set(access, tokens.access_token, { ...options, maxAge: 3600 }); jar.set(refresh, tokens.refresh_token, { ...options, maxAge: 30 * 86400 });
}
export async function clearTokens() { const jar = await cookies(); jar.delete(access); jar.delete(refresh); }
export async function authenticated(path: string, init: RequestInit = {}, timeout = 12000) {
  const jar = await cookies(); let token = jar.get(access)?.value;
  const send = () => upstream(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }, timeout);
  let response = token ? await send() : null;
  if ((!response || response.status === 401) && jar.get(refresh)?.value) {
    const renewed = await upstream("/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: jar.get(refresh)!.value }) });
    if (renewed.ok) { const tokens = await renewed.json(); await saveTokens(tokens); token = tokens.access_token; response = await send(); }
  }
  if (!response || response.status === 401) { await clearTokens(); return json({ error: "Please sign in to continue." }, 401); }
  return response;
}
export async function forward(response: Response) {
  const data = await response.json();
  if (!response.ok) return json({ error: typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : "Check the values and try again." }, response.status);
  return json(data, response.status);
}
export function sameOrigin(request: Request) {
  try { const origin = request.headers.get("origin"); if (!origin) return true; if (process.env.PUBLIC_APP_URL) return new URL(origin).origin === new URL(process.env.PUBLIC_APP_URL).origin; return new URL(origin).host === (request.headers.get("host") || new URL(request.url).host) && new URL(origin).protocol === new URL(request.url).protocol; }
  catch { return false; }
}
