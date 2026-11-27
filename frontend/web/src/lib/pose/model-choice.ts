// Which pose model a phone starts with (KI-22). "full" is more accurate (Google's benchmark: 62.6 mAP on workout poses,
// against 45.0 for "lite"); "lite" is 5.6 MB instead of 9 MB and runs faster. The worker already switches a slow device
// from full to lite mid-workout, but by then the phone has downloaded the 9 MB model for nothing. So low-end phones,
// Data Saver and slow connections start with lite, and a phone that had to switch starts with lite for a while.
export type PoseVariant = "full" | "lite" | "heavy";

const REMEMBER_KEY = "trackcal:pose:lite-since";
const REMEMBER_DAYS = 14;   // then full is tried again: the slow session may have been a one-off (low battery, hot phone)

type Env = {
  deviceMemory?: number;                                   // GB, rounded by the browser (0.25 … 8); Chrome and Android only
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
  remembered?: number | null;                              // when this device last had to switch to lite (ms)
  now?: number;
};

function browserEnv(): Env {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: Env["connection"] };
  let remembered: number | null = null;
  try { const raw = localStorage.getItem(REMEMBER_KEY); remembered = raw ? Number(raw) : null; } catch { /* storage off: no memory */ }
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency, connection: nav.connection, remembered, now: Date.now() };
}

/** The model to start with on this device. Unknown values (most desktop browsers, Safari) mean "full". */
export function chooseVariant(env: Env = browserEnv()): PoseVariant {
  const now = env.now ?? Date.now();
  if (env.remembered && Number.isFinite(env.remembered) && now - env.remembered < REMEMBER_DAYS * 86_400_000) return "lite";
  if (env.connection?.saveData) return "lite";
  if (env.connection?.effectiveType && ["slow-2g", "2g", "3g"].includes(env.connection.effectiveType)) return "lite";
  if (typeof env.deviceMemory === "number" && env.deviceMemory <= 2) return "lite";
  if (typeof env.hardwareConcurrency === "number" && env.hardwareConcurrency > 0 && env.hardwareConcurrency <= 4) return "lite";
  return "full";
}

/** The worker had to switch this device to lite: start with lite next time (for REMEMBER_DAYS). */
export function rememberLite(now = Date.now()) {
  try { localStorage.setItem(REMEMBER_KEY, String(now)); } catch { /* storage off */ }
}
