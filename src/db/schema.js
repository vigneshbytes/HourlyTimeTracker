// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SCHEMA — read docs/DATABASE.md before changing anything here.
//
// Rules that keep users' local data safe across app updates:
//  1. Never edit or remove an existing db.version(n) block. Add a new one.
//  2. Only list INDEXED fields in stores(). Records can hold any other fields
//     without a schema change.
//  3. Never delete a table (never pass null) and never drop fields in an
//     upgrade(). Fields the code no longer uses are simply ignored.
//  4. New fields get their defaults in records.js when read; an upgrade() is
//     only needed when a new INDEX must be back-filled.
// ─────────────────────────────────────────────────────────────────────────────
import Dexie from 'dexie';

export const DB_NAME = 'hourlytimetracker';

// Bump together with a new db.version() block below.
export const SCHEMA_VERSION = 1;

export function defineSchema(db) {
  db.version(1).stores({
    tasks: 'id, status, createdAt, lastUsedAt',
    // `running` is only present (=1) on the one session being timed (sparse index).
    sessions: 'id, taskId, start, createdAt, running',
    meta: 'key',
  });

  // Example of a future, additive change:
  // db.version(2).stores({ tasks: 'id, status, createdAt, lastUsedAt, clientId' })
  //   .upgrade((tx) => tx.table('tasks').toCollection().modify((t) => { t.clientId ??= null; }));
}

export function createDb(name = DB_NAME) {
  const db = new Dexie(name);
  defineSchema(db);
  return db;
}

// Dexie stores version n as IndexedDB version n*10.
export const idbVersionFor = (schemaVersion) => Math.round(schemaVersion * 10);
