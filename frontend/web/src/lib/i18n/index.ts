// Translation. The English text is the key: t("Today") looks it up in the chosen language's catalog and falls back to the English
// itself, so an untranslated text never breaks a screen. Placeholders: t("{count} days", { count: 3 }). Plural forms live in the
// catalog as { one, few, many, other } and are chosen by Intl.PluralRules for that language.
// Only the chosen language's catalog is downloaded. Changing language redraws the app once (main.tsx keys the router by language),
// so components call t() directly without subscribing to anything.
import { DEFAULT_LOCALE, isLocale, localeOf, LOCALES, type LocaleCode } from "./locales";
import { EN_PLURALS } from "./en-plurals";
import { forgetInflight, shareGet } from "../request-share";

export { LOCALES, type LocaleCode } from "./locales";
type Forms = Partial<Record<Intl.LDMLPluralRule, string>>;
type Catalog = Record<string, string | Forms>;
const STORE = "trackcal:locale";
const catalogs = import.meta.glob<{ default: Catalog }>("./messages/*.json");

let current: LocaleCode = DEFAULT_LOCALE, catalog: Catalog = {}, plural = new Intl.PluralRules(localeOf(DEFAULT_LOCALE).format);
const listeners = new Set<() => void>();

/** The language to start in: the one chosen before on this device, else the first of the browser's languages we speak. */
export function detectLocale(): LocaleCode {
  try { const saved = localStorage.getItem(STORE); if (isLocale(saved)) return saved; } catch { /* storage unavailable */ }
  const wanted = typeof navigator === "undefined" ? [] : [...(navigator.languages ?? []), navigator.language];
  for (const tag of wanted) { const base = (tag || "").toLowerCase().split("-")[0]; if (isLocale(base)) return base; }
  return DEFAULT_LOCALE;
}

async function load(code: LocaleCode): Promise<Catalog> {
  if (code === "en") return {};
  const file = catalogs[`./messages/${code}.json`];
  return file ? (await file()).default : {};
}

function apply(code: LocaleCode, next: Catalog) {
  current = code; catalog = next; plural = new Intl.PluralRules(localeOf(code).format);
  if (typeof document !== "undefined") { document.documentElement.lang = code; document.documentElement.dir = localeOf(code).dir; }
  listeners.forEach(fn => fn());
}

/** Before the first draw: load the language this device uses, so nothing flashes in English first. */
export async function initI18n() { const code = detectLocale(); apply(code, await load(code).catch(() => ({}))); }

/** Switch language (the app redraws in it). Remembered on this device; the account copy is saved by the caller. */
export async function setLocale(code: LocaleCode) {
  const next = await load(code);
  try { localStorage.setItem(STORE, code); } catch { /* storage unavailable: still switches for now */ }
  apply(code, next);
}

export const locale = () => current;

/** Lets the server answer in the chosen language: same-origin /api requests carry it as Accept-Language (unless a caller set
 * one). Installed once at start-up, so the many plain fetch() calls need no change. Also shares identical GETs
 * that are in flight together (lib/request-share.ts). */
export function sendLanguageToServer(target: { fetch: typeof fetch; location: { href: string; origin: string } } = window) {
  const original = target.fetch.bind(target) as typeof fetch & { trackcalLanguage?: true };
  if ((target.fetch as typeof original).trackcalLanguage) return;
  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, target.location.href);
    if (url.origin !== target.location.origin || !url.pathname.startsWith("/api/")) return original(input, init);
    const headers = new Headers(init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
    if (!headers.has("Accept-Language")) headers.set("Accept-Language", current);
    const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET") { forgetInflight(); return original(input, { ...init, headers }); }
    if (typeof Request !== "undefined" && input instanceof Request) return original(input, { ...init, headers });
    // Identical GETs in flight at the same moment share one request (lib/request-share.ts).
    const key = `${url.href}|${headers.get("Accept-Language")}|${headers.get("Authorization") ?? ""}`;
    return shareGet(key, signal => original(input, { ...init, headers, signal }), init?.signal);
  }) as typeof original;
  wrapped.trackcalLanguage = true;
  target.fetch = wrapped;
}
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** The text in the chosen language; {placeholders} filled from vars; plural forms chosen by vars.count. */
export function t(text: string, vars?: Record<string, string | number | null | undefined>): string {
  const entry = catalog[text], counted = vars && typeof vars.count === "number";
  let out = typeof entry === "string" ? entry
    : entry && counted ? (entry[plural.select(vars.count as number)] ?? entry.other ?? text)
    : counted && EN_PLURALS[text] ? EN_PLURALS[text][vars.count === 1 ? "one" : "other"] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? formatValue(vars[name]) : all));
  return out;
}
const formatValue = (v: string | number | null | undefined) => (typeof v === "number" ? number(v) : v ?? "");

/** Marks a text for translation where it is defined (in a list or table); t() translates it where it is shown. */
export const msg = (text: string) => text;

/** Makes the named fields of each row read in the chosen language (texts and lists of texts), for data tables shown in many
 *  places, like exercise names. The English stays stored, so ids, saving and comparisons are unchanged; each read is t(). */
export function localized<T extends object>(rows: Iterable<T>, fields: readonly string[]) {
  for (const row of rows) for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    let raw = (row as Record<string, unknown>)[field];
    if (typeof raw !== "string" && !Array.isArray(raw)) continue;
    Object.defineProperty(row, field, {
      enumerable: true, configurable: true,
      get: () => typeof raw === "string" ? t(raw) : Array.isArray(raw) ? raw.map(x => typeof x === "string" ? t(x) : x) : raw,
      set: (value: unknown) => { raw = value; },
    });
  }
}
/** The same for a table of texts by key ({ easy: "Easy", … }). */
export const localizedMap = (table: Record<string, string>) => localized([table], Object.keys(table));

/** Numbers and dates in the chosen language's style: 1,00,000 for Indian languages, 100.000 in Brazil, Arabic digits for Arabic. */
export const number = (n: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(localeOf(current).format, options).format(n);
export const date = (d: Date | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(localeOf(current).format, options).format(typeof d === "string" ? new Date(d) : d);

/** For tests: switch with a catalog given directly. */
export function setCatalogForTests(code: LocaleCode, next: Catalog) { apply(code, next); }
export const LANGUAGE_STORAGE_KEY = STORE;
export const allLocales = () => LOCALES;
