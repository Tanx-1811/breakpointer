import { snapshotsToPrune, summarizeSnapshots, type Snapshot, type SnapshotPage } from '../state/snapshots';

/**
 * Baseline screenshots for the visual check, in this extension's own
 * IndexedDB: local to this browser, no permission needed, never synced or
 * exported. Screenshots are too large for chrome.storage.
 */
const DB_NAME = 'breakpointer';
const DB_VERSION = 1;
const STORE = 'snapshots';

let opening: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('page', 'page');
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another workspace tab upgrading the database: let it, and open again next time.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error('Could not open the snapshot database'));
    };
  });
  return opening;
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Snapshot storage failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Snapshot storage was aborted'));
  });
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Snapshot storage failed'));
  });
}

/** The baselines of one page (its address without #fragment). */
export async function snapshotsOf(page: string): Promise<Snapshot[]> {
  const db = await database();
  const index = db.transaction(STORE, 'readonly').objectStore(STORE).index('page');
  return read(index.getAll(IDBKeyRange.only(page)) as IDBRequest<Snapshot[]>);
}

async function allSnapshots(): Promise<Snapshot[]> {
  const db = await database();
  return read(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<Snapshot[]>);
}

/** Saves (or replaces) baselines, then removes the oldest ones beyond the limit. */
export async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
  const db = await database();
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  for (const snapshot of snapshots) store.put(snapshot);
  await finished(transaction);
  const prune = snapshotsToPrune(await allSnapshots());
  if (prune.length) await deleteSnapshots(prune);
}

export async function deleteSnapshots(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await database();
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await finished(transaction);
}

export async function deletePageSnapshots(page: string): Promise<void> {
  await deleteSnapshots((await snapshotsOf(page)).map((snapshot) => snapshot.id));
}

export async function clearSnapshots(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).clear();
  await finished(transaction);
}

/** Pages with baselines, newest first, with how many and how much room they take. */
export async function snapshotPages(): Promise<SnapshotPage[]> {
  return summarizeSnapshots(await allSnapshots());
}
