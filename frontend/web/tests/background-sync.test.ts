import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeEach, it, expect, vi } from "vitest";
import { deviceDb, queueBackup, pendingBackup } from "../src/lib/offline-db";
const sync = new Function(`${readFileSync("public/backup-sync.js","utf8")}; return syncTrackCalBackups;`)() as (database: IDBFactory, request: typeof fetch) => Promise<void>;
beforeEach(async()=>{await deviceDb.open(); await deviceDb.backups.clear(); await deviceDb.revisions.clear();});
it("background uploads only queued snapshots with owner binding and preserves newer snapshots",async()=>{
  await queueBackup({scope:"first",entries:{},expected_revision:"old"});
  const request=vi.fn<typeof fetch>(async()=>{await queueBackup({scope:"first",entries:{"trackcal:target:calories":2000},expected_revision:"old"}); return Response.json({revision:"new"});});
  await sync(indexedDB,request); const pending=await pendingBackup("first"); expect(pending?.entries["trackcal:target:calories"]).toBe(2000); expect(pending?.expected_revision).toBe("new"); expect(JSON.parse(request.mock.calls[0][1]!.body as string).owner_id).toBe("first");
});
it("pauses conflicts and does not send them again",async()=>{
  await queueBackup({scope:"first",entries:{},expected_revision:"old"}); const request=vi.fn().mockResolvedValue(new Response(null,{status:409}));
  await sync(indexedDB,request); expect((await pendingBackup("first"))?.status).toBe("conflict"); await sync(indexedDB,request); expect(request).toHaveBeenCalledTimes(1);
});
it("keeps another account queued and completes the authorized account",async()=>{
  await queueBackup({scope:"first",entries:{},expected_revision:"old"}); await queueBackup({scope:"second",entries:{},expected_revision:"old"});
  const request=vi.fn(async(_url: RequestInfo | URL, options?: RequestInit)=>JSON.parse(options?.body as string).owner_id==="first" ? new Response(null,{status:403}) : Response.json({revision:"new"}));
  await sync(indexedDB,request); expect((await pendingBackup("first"))?.status).toBe("queued"); expect(await pendingBackup("second")).toBeUndefined();
});
