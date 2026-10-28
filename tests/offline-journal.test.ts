import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
const html = readFileSync("public/offline.html", "utf8");
const script = readFileSync("public/offline.js", "utf8");
function openJournal() { document.body.innerHTML = html; new Function(script)(); }
function fill(name: string, value: string) { (document.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value; }
function save() { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
describe("standalone offline journal", () => {
  beforeEach(() => localStorage.clear());
  it("saves and reopens guest meals without reading private account storage", () => {
    localStorage.setItem("trackcal:account:private:trackcal:journal:2026-10-22", JSON.stringify([{name:"Private meal"}]));
    openJournal(); fill("date","2026-10-22"); fill("name","Rice bowl"); for(const key of ["calories","protein","carbs","fat"]) fill(key,"10"); save();
    expect(JSON.parse(localStorage.getItem("trackcal:journal:2026-10-22")!)[0].name).toBe("Rice bowl");
    openJournal(); fill("date","2026-10-22"); document.querySelector('[name="date"]')!.dispatchEvent(new Event("change"));
    expect(document.querySelector("ul")!.textContent).toContain("Rice bowl"); expect(document.querySelector("ul")!.textContent).not.toContain("Private meal");
  });
  it("preserves corrupted existing data and reports recovery instead of overwriting", () => {
    openJournal(); fill("date","2026-10-22"); localStorage.setItem("trackcal:journal:2026-10-22","broken"); fill("name","Meal"); for(const key of ["calories","protein","carbs","fat"]) fill(key,"10"); save();
    expect(localStorage.getItem("trackcal:journal:2026-10-22")).toBe("broken"); expect(document.querySelector('[role="status"]')!.textContent).not.toBe("");
  });
});
