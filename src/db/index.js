import { createDb } from './schema.js';
import { snapshotIfUpgrading } from './snapshot.js';
import { createRepo } from './repo.js';

export async function openDatabase() {
  let snapshot = null;
  try { snapshot = await snapshotIfUpgrading(); } catch (e) { console.warn('Snapshot failed', e); throw new Error(`Could not back up data before upgrading, so the upgrade was not attempted: ${e.message}`); }
  const db = createDb();
  await db.open();
  return { db, repo: createRepo(db), snapshot };
}

export async function requestPersistence() {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
