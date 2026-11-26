// Before the app upgrades the database to a new schema version, it copies every
// table into a separate "snapshots" database. If an upgrade ever misbehaves,
// the user's data can be restored from Settings.

import { DB_NAME, SCHEMA_VERSION, idbVersionFor } from './schema.js';

export const SNAPSHOT_DB = `${DB_NAME}-snapshots`;
const KEEP = 5;

// Current on-disk version of a database without creating or upgrading it. 0 = missing.
export function getIdbVersion(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    let created = false;
    req.onupgradeneeded = () => { created = true; req.transaction.abort(); };
    req.onsuccess = () => { const v = req.result.version; req.result.close(); resolve(v); };
    req.onerror = (e) => {
      if (created) { e.preventDefault(); resolve(0); } else reject(req.error);
    };
  });
}

function dumpRaw(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const names = [...db.objectStoreNames];
      const out = { name, version: db.version, tables: {} };
      if (!names.length) { db.close(); return resolve(out); }
      const tx = db.transaction(names, 'readonly');
      for (const n of names) {
        const r = tx.objectStore(n).getAll();
        r.onsuccess = () => { out.tables[n] = r.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

function openSnapshots() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SNAPSHOT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export async function saveSnapshot(dump, reason) {
  const sdb = await openSnapshots();
  try {
    const tx = sdb.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    await reqP(store.add({ createdAt: Date.now(), reason, dump }));
    const keys = await reqP(store.getAllKeys());
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) store.delete(k);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } finally { sdb.close(); }
}

export async function listSnapshots() {
  const sdb = await openSnapshots();
  try { return await reqP(sdb.transaction('snapshots').objectStore('snapshots').getAll()); } finally { sdb.close(); }
}

// Call before opening Dexie. Returns the snapshot reason if one was taken.
export async function snapshotIfUpgrading(name = DB_NAME, target = idbVersionFor(SCHEMA_VERSION)) {
  const current = await getIdbVersion(name);
  if (current === 0 || current >= target) return null;
  const dump = await dumpRaw(name);
  const reason = `before upgrade v${current / 10} → v${target / 10}`;
  await saveSnapshot(dump, reason);
  return reason;
}
