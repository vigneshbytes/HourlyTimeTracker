// Storage layer: IndexedDB wrapper. All app data lives here, scoped to the
// site's origin. No network calls, no backend.

const DB_NAME = 'timetracker';
const DB_VERSION = 1;

// Object stores. Schema migrations go in upgrade() keyed by oldVersion.
export const STORES = {
  projects: 'projects', // { id, name, hourlyRate, currency, archived, createdAt }
  entries: 'entries',   // { id, projectId, start, end, note }
  meta: 'meta',         // { key, value } app settings and bookkeeping
};

let dbPromise = null;

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore(STORES.projects, { keyPath: 'id' });
    const entries = db.createObjectStore(STORES.entries, { keyPath: 'id' });
    entries.createIndex('projectId', 'projectId');
    entries.createIndex('start', 'start');
    db.createObjectStore(STORES.meta, { keyPath: 'key' });
  }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab.'));
  });
  return dbPromise;
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeNames, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; }, reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

export const uid = () => crypto.randomUUID();

export const get = (store, key) => tx(store, 'readonly', (t) => promisify(t.objectStore(store).get(key)));
export const getAll = (store) => tx(store, 'readonly', (t) => promisify(t.objectStore(store).getAll()));
export const put = (store, value) => tx(store, 'readwrite', (t) => promisify(t.objectStore(store).put(value)));
export const remove = (store, key) => tx(store, 'readwrite', (t) => promisify(t.objectStore(store).delete(key)));
export const count = (store) => tx(store, 'readonly', (t) => promisify(t.objectStore(store).count()));

export async function countAll() {
  const totals = await Promise.all(Object.values(STORES).map(count));
  return totals.reduce((a, b) => a + b, 0);
}

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false, persisted: false };
  const already = await navigator.storage.persisted();
  const persisted = already || await navigator.storage.persist();
  return { supported: true, persisted };
}

export async function isPersisted() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}

export async function estimate() {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
}

// DESTRUCTIVE. Only call this from the multi-step confirmation flow in erase.js.
export async function eraseAll(confirmToken) {
  if (confirmToken !== ERASE_TOKEN) throw new Error('eraseAll() must be called through the confirmation flow.');
  const names = Object.values(STORES);
  await tx(names, 'readwrite', (t) => Promise.all(names.map((n) => promisify(t.objectStore(n).clear()))));
}

// Internal guard so nothing can wipe data by calling eraseAll() casually.
export const ERASE_TOKEN = Symbol('erase-confirmed');
