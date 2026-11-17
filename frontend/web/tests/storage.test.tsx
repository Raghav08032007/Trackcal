import { expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { exportLocalEntries, restoreLocalEntries, workspaceKey, useLocalDate, useLocalState, useStorageWarning } from "../src/lib/use-local-state";
it("functional updates are shared by subscribers without lost writes", () => {
  const first = renderHook(() => useLocalState("trackcal:target:test", 10));
  const second = renderHook(() => useLocalState("trackcal:target:test", 10));
  act(() => { first.result.current[1](v => v + 1); first.result.current[1](v => v + 1); });
  expect(first.result.current[0]).toBe(12); expect(second.result.current[0]).toBe(12);
  act(() => { localStorage.setItem("trackcal:target:test", "25"); window.dispatchEvent(new StorageEvent("storage")); }); expect(first.result.current[0]).toBe(25);
});
it("keeps damaged storage untouched and recovers with a new valid write", () => {
  localStorage.setItem("trackcal:target:test", "broken JSON"); const hook = renderHook(() => useLocalState("trackcal:target:test", 10)); expect(hook.result.current[0]).toBe(10); expect(localStorage.getItem("trackcal:target:test")).toBe("broken JSON"); act(() => hook.result.current[1](20)); expect(hook.result.current[0]).toBe(20);
});
it("retains an exportable session copy and warns when storage is full", () => {
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  const hook = renderHook(() => useLocalState("trackcal:target:test", 10)); const warning = renderHook(() => useStorageWarning()); act(() => hook.result.current[1](30)); expect(hook.result.current[0]).toBe(30); expect(warning.result.current).toBe(true); expect(exportLocalEntries()["trackcal:target:test"]).toBe(30);
  write.mockRestore(); act(() => hook.result.current[1](31)); expect(warning.result.current).toBe(false);
});
it("rolls the journal date over at midnight", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 50)); const hook = renderHook(() => useLocalDate()); expect(hook.result.current).toBe("2026-10-20"); act(() => vi.advanceTimersByTime(60000)); expect(hook.result.current).toBe("2026-10-21"); hook.unmount(); vi.useRealTimers();
});
it("isolates guest exports from every account and account exports from one another", () => {
  localStorage.setItem("trackcal:target:calories", "2100");
  localStorage.setItem(workspaceKey("trackcal:target:calories", "first"), "1800");
  localStorage.setItem(workspaceKey("trackcal:target:calories", "second"), "2400");
  expect(exportLocalEntries()).toEqual({ "trackcal:target:calories": 2100 });
  expect(exportLocalEntries("first")).toEqual({ "trackcal:target:calories": 1800 });
  expect(exportLocalEntries("second")).toEqual({ "trackcal:target:calories": 2400 });
});
it("restores only the selected workspace and rejects invalid data before writing", () => {
  localStorage.setItem("trackcal:target:calories", "2100");
  restoreLocalEntries({ "trackcal:target:calories": 1800 }, "first");
  expect(exportLocalEntries("first")).toEqual({ "trackcal:target:calories": 1800 });
  expect(exportLocalEntries()["trackcal:target:calories"]).toBe(2100);
  expect(() => restoreLocalEntries({ "trackcal:target:calories": -1 }, "first")).toThrow();
  expect(exportLocalEntries("first")["trackcal:target:calories"]).toBe(1800);
});
