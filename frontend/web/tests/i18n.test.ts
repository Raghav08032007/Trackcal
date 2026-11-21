// Languages (wave 1): every text on a translated screen exists in every wave-1 language; no translation loses or invents a
// {placeholder}; plural forms are ones the language really uses; switching language changes the text, the page direction and how
// numbers look; anything missing falls back to English.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { keysOf } from "@/lib/i18n/keys";
import { CORE_FILES, RUNTIME_KEYS, TRANSLATED_FILES, WAVE_1, WAVE_2 } from "@/lib/i18n/coverage";
import { LOCALES } from "@/lib/i18n/locales";
import { EN_PLURALS } from "@/lib/i18n/en-plurals";
import { detectLocale, locale, number, setCatalogForTests, setLocale, t } from "@/lib/i18n";

const catalog = (code: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/messages/${code}.json`, "utf8")) as Record<string, string | Record<string, string>>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const keys = [...new Set([...TRANSLATED_FILES.flatMap(f => keysOf(f, fs.readFileSync(f, "utf8"))), ...RUNTIME_KEYS])];

afterEach(() => { setCatalogForTests("en", {}); try { localStorage.clear(); } catch { /* none */ } });

const coreKeys = [...new Set([...CORE_FILES.flatMap(f => keysOf(f, fs.readFileSync(f, "utf8"))), ...RUNTIME_KEYS])];
describe("wave 2 languages: core screens first", () => {
  for (const code of WAVE_2) it(`every core-screen text is translated in ${code}, keeping its placeholders`, () => {
    const c = catalog(code), missing = coreKeys.filter(k => !(k in c));
    expect(missing, `${code} is missing`).toEqual([]);
    for (const [key, value] of Object.entries(c)) if (typeof value === "string") expect(placeholders(value), `${code}: "${key}"`).toEqual(placeholders(key));
  });
});

describe("translated screens", () => {
  it("cover every wave-1 language and are listed in the picker", () => {
    expect(new Set(LOCALES.map(l => l.code))).toEqual(new Set(["en", ...WAVE_1, ...WAVE_2]));
    expect(keys.length).toBeGreaterThan(100);
  });
  for (const code of WAVE_1) it(`every text is translated in ${code}, keeping its placeholders`, () => {
    const c = catalog(code), missing = keys.filter(k => !(k in c));
    expect(missing, `${code} is missing`).toEqual([]);
    for (const [key, value] of Object.entries(c)) {
      const forms = typeof value === "string" ? [value] : Object.values(value);
      for (const form of forms) {
        expect(form.trim(), `${code}: "${key}"`).not.toBe("");
        if (typeof value === "string") expect(placeholders(form), `${code}: "${key}"`).toEqual(placeholders(key));
        else expect(placeholders(form).every(p => placeholders(key).includes(p)), `${code}: "${key}"`).toBe(true);
      }
      if (typeof value !== "string") {
        const used = new Set(new Intl.PluralRules(LOCALES.find(l => l.code === code)!.format).resolvedOptions().pluralCategories);
        expect(Object.keys(value).filter(f => f !== "zero" || code !== "ar").every(f => used.has(f as Intl.LDMLPluralRule)), `${code}: "${key}" forms`).toBe(true);
        expect(value.other, `${code}: "${key}" needs an other form`).toBeTruthy();
      }
    }
  });
});

describe("switching language", () => {
  it("translates, fills placeholders and picks the plural the language needs", () => {
    setCatalogForTests("ar", catalog("ar") as never);
    expect(t("Today")).toBe("اليوم");
    expect(t("{count} meals", { count: 2 })).toBe("وجبتان");
    expect(t("{count} meals", { count: 5 })).toBe(`${number(5)} وجبات`);   // digits in the style Intl uses for Arabic
    expect(document.documentElement.dir).toBe("rtl");
    expect(t("A text nobody translated")).toBe("A text nobody translated");
  });
  it("writes numbers the Indian way in Indian languages", () => {
    setCatalogForTests("hi", catalog("hi") as never);
    expect(number(150000)).toBe("1,50,000");
    expect(t("{n} kcal", { n: 2150 })).toBe("2,150 kcal");
    expect(document.documentElement.lang).toBe("hi");
    expect(document.documentElement.dir).toBe("ltr");
  });
  it("remembers the choice on this device and starts in it next time", async () => {
    await setLocale("ta");
    expect(locale()).toBe("ta");
    expect(detectLocale()).toBe("ta");
  });
  it("English says 1 meal, not 1 meals, and every counted text has singular forms in each language", () => {
    setCatalogForTests("en", {});
    expect(t("{count} meals logged today", { count: 1 })).toBe("1 meal logged today");
    expect(t("{count} meals logged today", { count: 3 })).toBe("3 meals logged today");
    expect(t("Copy {count} meals to today? You can edit or delete them afterwards.", { count: 1 })).toBe("Copy this meal to today? You can edit or delete it afterwards.");
    for (const key of Object.keys(EN_PLURALS)) {
      expect(placeholders(EN_PLURALS[key].one).every(p => placeholders(key).includes(p)), key).toBe(true);
      for (const code of WAVE_1) expect(typeof catalog(code)[key], `${code}: ${key}`).toBe("object");
    }
  });
  it("every text with plural forms is called with a count, so the right form is chosen", () => {
    const sources = TRANSLATED_FILES.map(f => fs.readFileSync(f, "utf8")).join("\n");
    const counted = Object.entries(catalog("hi")).filter(([, v]) => typeof v === "object").map(([k]) => k);
    for (const key of counted) {
      const at = sources.indexOf(`t(${JSON.stringify(key)}`);
      if (at < 0) continue;   // shown on a screen not yet in the coverage list
      expect(sources.slice(at, at + key.length + 120).includes("count"), key).toBe(true);
    }
  });
});

describe("telling the server the language", () => {
  it("adds the chosen language to same-origin /api requests only, and never overrides a caller's own header", async () => {
    const { sendLanguageToServer } = await import("@/lib/i18n");
    setCatalogForTests("hi", catalog("hi") as never);
    const seen: Array<[string, string | null]> = [];
    const target = { location: { href: "https://trackcal.test/today", origin: "https://trackcal.test" },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => { seen.push([String(input), new Headers(init?.headers).get("Accept-Language")]); return new Response("{}"); }) as typeof fetch };
    sendLanguageToServer(target); sendLanguageToServer(target);   // installing twice wraps once
    await target.fetch("/api/v1/today");
    await target.fetch("https://other.example/api/v1/x");
    await target.fetch("/assets/app.js");
    await target.fetch("/api/v1/today", { headers: { "Accept-Language": "es" } });
    expect(seen).toEqual([["/api/v1/today", "hi"], ["https://other.example/api/v1/x", null], ["/assets/app.js", null], ["/api/v1/today", "es"]]);
  });
});
