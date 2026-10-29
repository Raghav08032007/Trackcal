// Web push in the browser: support checks, the explicit (tap-only) permission flow and the settings API.
export type PushType = "daily_plan" | "workout" | "meal_log" | "rest_day" | "motivation" | "milestone";
export type PushSettings = {
  enabled: boolean; types: Record<PushType, { enabled: boolean; time: string | null }>; max_per_day: number; snooze_until: string | null;
  timezone: string; quiet_start: string; quiet_end: string; devices: { id: string; user_agent: string; created_at: string }[];
};
export const TYPE_LABELS: Record<PushType, string> = {
  daily_plan: "Today's plan", workout: "Activity reminder", meal_log: "Meal check-in", rest_day: "Rest-day note", motivation: "A thought for today", milestone: "Milestones",
};

/** What this browser can do. iOS/iPadOS deliver web push only to a site added to the Home Screen (iOS 16.4 or later). */
export function pushSupport(): "ok" | "ios-install" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !installed ? "ios-install" : "unsupported";
  return ios && !installed ? "ios-install" : "ok";
}

export async function pushRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/push/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Notification settings are unavailable. Nothing was changed.");
  return data as T;
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - base64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

/** Must be called from a tap: asks the browser for permission, subscribes this device and registers it. */
export async function enableOnThisDevice(publicKey: string): Promise<"granted" | "denied" | "default"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const json = subscription.toJSON();
  await pushRequest("subscribe", "POST", { endpoint: json.endpoint, keys: json.keys });
  return "granted";
}

export async function removeThisDevice() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await pushRequest("subscribe", "DELETE", { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}
