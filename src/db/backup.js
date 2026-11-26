// Two kinds of export:
//  • Backup   – a readable JSON of tasks, logs and settings. Import MERGES:
//               records whose id already exists are skipped, nothing is deleted.
//  • Database – a raw copy of every table, exactly as stored. Import REPLACES
//               all current data (a safety snapshot is taken first).

import { SCHEMA_VERSION, DB_NAME } from './schema.js';
import { saveSnapshot } from './snapshot.js';

export const BACKUP_FORMAT = 'hourlytimetracker-backup';
export const DATABASE_FORMAT = 'hourlytimetracker-database';

export async function exportBackup(db, now = Date.now()) {
  const [tasks, sessions, settings] = await Promise.all([db.tasks.toArray(), db.sessions.toArray(), db.meta.get('settings')]);
  return { format: BACKUP_FORMAT, formatVersion: 1, schemaVersion: SCHEMA_VERSION, exportedAt: now, settings: settings?.value ?? {}, tasks, sessions };
}

export async function importBackup(db, data) {
  if (data?.format !== BACKUP_FORMAT) throw new Error('This is not a TimeTracker backup file.');
  if (!Array.isArray(data.tasks) || !Array.isArray(data.sessions)) throw new Error('Backup file is damaged.');
  return db.transaction('rw', db.tasks, db.sessions, async () => {
    const existingTasks = new Set(await db.tasks.toCollection().primaryKeys());
    const existingSessions = new Set(await db.sessions.toCollection().primaryKeys());
    const hasRunning = (await db.sessions.where('running').equals(1).count()) > 0;
    const tasks = data.tasks.filter((t) => t?.id && !existingTasks.has(t.id));
    const knownTaskIds = new Set([...existingTasks, ...tasks.map((t) => t.id)]);
    const sessions = data.sessions
      .filter((s) => s?.id && !existingSessions.has(s.id) && knownTaskIds.has(s.taskId))
      .map((s) => {
        if (s.running !== 1) return s;
        if (hasRunning) { const { running, ...rest } = s; return { ...rest, end: data.exportedAt ?? Date.now() }; }
        return s;
      });
    await db.tasks.bulkAdd(tasks);
    await db.sessions.bulkAdd(sessions);
    return { tasks: tasks.length, sessions: sessions.length, skipped: data.tasks.length - tasks.length + data.sessions.length - sessions.length };
  });
}

export async function exportDatabase(db, now = Date.now()) {
  const tables = {};
  for (const t of db.tables) tables[t.name] = await t.toArray();
  return { format: DATABASE_FORMAT, formatVersion: 1, database: DB_NAME, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables };
}

export async function importDatabase(db, data) {
  if (data?.format !== DATABASE_FORMAT || typeof data.tables !== 'object') throw new Error('This is not a TimeTracker database file.');
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error('This file was made by a newer version of the app. Update the app first.');
  const current = await exportDatabase(db);
  await saveSnapshot({ name: DB_NAME, tables: current.tables, schemaVersion: SCHEMA_VERSION }, 'before database import');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (Array.isArray(data.tables[t.name])) await t.bulkPut(data.tables[t.name]);
    }
  });
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pickJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve(JSON.parse(await file.text())); } catch { reject(new Error('Could not read that file as JSON.')); }
    };
    input.click();
  });
}
