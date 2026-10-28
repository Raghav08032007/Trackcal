/* Runs in the service worker; only explicitly queued snapshots are sent. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Imported by sw.js through importScripts.
async function syncTrackCalBackups(databaseFactory, request) {
  const open = databaseFactory.open("trackcal-device-v1");
  const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  try {
    if (!db.objectStoreNames.contains("backups") || !db.objectStoreNames.contains("revisions")) return;
    const read = db.transaction("backups").objectStore("backups").getAll();
    const rows = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    for (const item of rows) {
      if (item.status !== "queued" || item.scope === "guest") continue;
      const response = await request("/api/account/backup", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: item.entries, expected_revision: item.expected_revision, owner_id: item.scope }) });
      if (response.status === 401 || response.status === 403) continue;
      if (!response.ok && response.status !== 409) throw new Error("Backup remains queued until its owner signs in and reconnects.");
      const data = response.ok ? await response.json() : null;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(["backups", "revisions"], "readwrite"), backups = transaction.objectStore("backups"), current = backups.get(item.scope);
        current.onsuccess = () => {
          const latest = current.result;
          if (response.status === 409) { if (latest?.token === item.token) backups.put({ ...latest, status: "conflict" }); return; }
          if (typeof data?.revision !== "string") { transaction.abort(); return; }
          transaction.objectStore("revisions").put({ scope: item.scope, revision: data.revision });
          if (latest?.token === item.token) backups.delete(item.scope);
          else if (latest?.status === "queued" && latest.expected_revision === item.expected_revision) backups.put({ ...latest, expected_revision: data.revision });
        };
        transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(new Error("Backup revision was not confirmed."));
      });
    }
  } finally { db.close(); }
}
