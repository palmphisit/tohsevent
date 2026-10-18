// Persists not-yet-uploaded files in IndexedDB so a guest who closes the tab mid-upload
// (iOS Safari has no Background Sync) gets the remaining photos uploaded on the next visit.
// Every call is best-effort: private browsing or blocked storage simply disables resuming.

const DB_NAME = "tohsevent-uploads";
const STORE = "pending";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingUpload {
  id: string;
  scope: string;
  file: Blob;
  name: string;
  addedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("scope", "scope");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function savePending(entry: PendingUpload): Promise<void> {
  try {
    await run("readwrite", (store) => store.put(entry));
  } catch {
    // storage unavailable: uploads still work, they just can't resume
  }
}

export async function removePending(id: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {}
}

/** Pending uploads for this scope, oldest first. Entries older than a week are dropped. */
export async function listPending(scope: string): Promise<PendingUpload[]> {
  try {
    const all = await run<PendingUpload[]>("readonly", (store) => store.index("scope").getAll(scope));
    const cutoff = Date.now() - MAX_AGE_MS;
    const stale = all.filter((p) => p.addedAt < cutoff);
    await Promise.all(stale.map((p) => removePending(p.id)));
    return all.filter((p) => p.addedAt >= cutoff).sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}
