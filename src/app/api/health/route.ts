export async function GET() {
  const api = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";
  try {
    const response = await fetch(`${api.replace(/\/api\/v1\/?$/, "")}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return Response.json({ status: response.ok ? "ok" : "degraded" }, { status: response.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
