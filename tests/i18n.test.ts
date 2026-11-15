// Languages (wave 1): every text on a translated screen exists in every wave-1 language; no translation loses or invents a
// {placeholder}; plural forms are ones the language really uses; switching language changes the text, the page direction and how
// numbers look; anything missing falls back to English.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { keysOf } from "@/lib/i18n/keys";
import { TRANSLATED_FILES, WAVE_1 } from "@/lib/i18n/coverage";
import { LOCALES } from "@/lib/i18n/locales";
import { detectLocale, locale, number, setCatalogForTests, setLocale, t } from "@/lib/i18n";

const catalog = (code: string) => JSON.parse(fs.readFileSync(`src/lib/i18n/messages/${code}.json`, "utf8")) as Record<string, string | Record<string, string>>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const keys = [...new Set(TRANSLATED_FILES.flatMap(f => keysOf(f, fs.readFileSync(f, "utf8"))))];

afterEach(() => { setCatalogForTests("en", {}); try { localStorage.clear(); } catch { /* none */ } });

describe("translated screens", () => {
  it("cover every wave-1 language and are listed in the picker", () => {
    expect(new Set(LOCALES.map(l => l.code))).toEqual(new Set(["en", ...WAVE_1]));
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
});
