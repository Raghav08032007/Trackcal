import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { deviceDb, mirrorDeviceWrite, hydrateDevice, flushDeviceWrites, queueBackup, pendingBackup, sendPendingBackup } from "../src/lib/offline-db";
beforeEach(async () => { await flushDeviceWrites(); await deviceDb.open(); await deviceDb.cache.clear(); await deviceDb.backups.clear(); await deviceDb.revisions.clear(); });
it("persists writes with the real Dexie transaction engine and restores only the selected account", async () => {
  mirrorDeviceWrite("trackcal:account:first:trackcal:target:calories", "1800");
  mirrorDeviceWrite("trackcal:account:second:trackcal:target:calories", "2400");
  await flushDeviceWrites(); await hydrateDevice("first");
  expect(localStorage.getItem("trackcal:account:first:trackcal:target:calories")).toBe("1800");
  expect(localStorage.getItem("trackcal:account:second:trackcal:target:calories")).toBeNull();
  localStorage.setItem("trackcal:account:first:trackcal:target:calories", "1900");
  await hydrateDevice("first"); expect((await deviceDb.cache.get("trackcal:account:first:trackcal:target:calories"))?.raw).toBe("1900");
});
it("removes mirrored values so deleted data cannot return on recovery", async () => {
  mirrorDeviceWrite("trackcal:target:calories", "1800"); await flushDeviceWrites(); mirrorDeviceWrite("trackcal:target:calories", null); await flushDeviceWrites(); await hydrateDevice("guest"); expect(localStorage.getItem("trackcal:target:calories")).toBeNull();
});
it("keeps a failed backup queued and includes its owner and expected cloud version", async () => {
  await queueBackup({ scope: "first", entries: { "trackcal:target:calories": 1800 }, expected_revision: "before" });
  const request = vi.fn().mockResolvedValue(Response.json({ error: "offline" }, { status: 503 }));
  await expect(sendPendingBackup("first", request)).rejects.toThrow("offline");
  expect((await pendingBackup("first"))?.status).toBe("queued");
  expect(JSON.parse(request.mock.calls[0][1].body).owner_id).toBe("first");
  expect(await pendingBackup("second")).toBeUndefined();
});
it("pauses conflicts without automatically overwriting the cloud", async () => {
  await queueBackup({ scope: "first", entries: {}, expected_revision: "before" });
  const request = vi.fn().mockResolvedValue(Response.json({ error: "Conflict" }, { status: 409 }));
  expect(await sendPendingBackup("first", request)).toBe("conflict");
  expect(await sendPendingBackup("first", request)).toBe("conflict"); expect(request).toHaveBeenCalledTimes(1);
});
it("acknowledges successful snapshots and stores the new cloud version", async () => {
  await queueBackup({ scope: "first", entries: {}, expected_revision: "before" });
  expect(await sendPendingBackup("first", vi.fn().mockResolvedValue(Response.json({ revision: "after" })))).toBe("synced");
  expect(await pendingBackup("first")).toBeUndefined(); expect((await deviceDb.revisions.get("first"))?.revision).toBe("after");
});
it("preserves a newer queued snapshot even when both updates share the same millisecond", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1);
  await queueBackup({ scope: "first", entries: { "trackcal:target:calories": 1800 }, expected_revision: "before" });
  const request = vi.fn(async () => { await queueBackup({ scope: "first", entries: { "trackcal:target:calories": 1900 }, expected_revision: "before" }); return Response.json({ revision: "after" }); });
  await sendPendingBackup("first", request);
  expect((await pendingBackup("first"))?.entries["trackcal:target:calories"]).toBe(1900);
  expect((await pendingBackup("first"))?.expected_revision).toBe("after");
});
