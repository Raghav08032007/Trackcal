// Translation. The English text is the key: t("Today") looks it up in the chosen language's catalog and falls back to the English
// itself, so an untranslated text never breaks a screen. Placeholders: t("{count} days", { count: 3 }). Plural forms live in the
// catalog as { one, few, many, other } and are chosen by Intl.PluralRules for that language.
// Only the chosen language's catalog is downloaded. Changing language redraws the app once (main.tsx keys the router by language),
// so components call t() directly without subscribing to anything.
import { DEFAULT_LOCALE, isLocale, localeOf, LOCALES, type LocaleCode } from "./locales";
import { EN_PLURALS } from "./en-plurals";

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
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** The text in the chosen language; {placeholders} filled from vars; plural forms chosen by vars.count. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const entry = catalog[text], counted = vars && typeof vars.count === "number";
  let out = typeof entry === "string" ? entry
    : entry && counted ? (entry[plural.select(vars.count as number)] ?? entry.other ?? text)
    : counted && EN_PLURALS[text] ? EN_PLURALS[text][vars.count === 1 ? "one" : "other"] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? formatValue(vars[name]) : all));
  return out;
}
const formatValue = (v: string | number) => (typeof v === "number" ? number(v) : v);

/** Marks a text for translation where it is defined (in a list or table); t() translates it where it is shown. */
export const msg = (text: string) => text;

/** Numbers and dates in the chosen language's style: 1,00,000 for Indian languages, 100.000 in Brazil, Arabic digits for Arabic. */
export const number = (n: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(localeOf(current).format, options).format(n);
export const date = (d: Date | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(localeOf(current).format, options).format(typeof d === "string" ? new Date(d) : d);

/** For tests: switch with a catalog given directly. */
export function setCatalogForTests(code: LocaleCode, next: Catalog) { apply(code, next); }
export const LANGUAGE_STORAGE_KEY = STORE;
export const allLocales = () => LOCALES;
