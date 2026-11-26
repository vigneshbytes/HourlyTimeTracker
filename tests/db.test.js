import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { createDb, defineSchema } from '../src/db/schema.js';
import { createRepo, MIN_SESSION_MS } from '../src/db/repo.js';
import { snapshotIfUpgrading, listSnapshots } from '../src/db/snapshot.js';
import { exportBackup, importBackup, exportDatabase, importDatabase } from '../src/db/backup.js';

let n = 0;
let clock;
function setup() {
  const name = `test-${++n}`;
  const db = createDb(name);
  clock = { t: new Date(2026, 10, 26, 9, 0, 0).getTime() };
  return { db, name, repo: createRepo(db, () => clock.t) };
}
const advance = (ms) => { clock.t += ms; };

describe('timer sessions', () => {
  let db, repo;
  beforeEach(() => ({ db, repo } = setup()));

  it('only one task runs at a time; switching stops the previous one', async () => {
    const a = await repo.createTask({ name: 'A' });
    const b = await repo.createTask({ name: 'B' });
    await repo.startTask(a.id);
    advance(60000);
    await repo.startTask(b.id);
    const running = await db.sessions.where('running').equals(1).toArray();
    expect(running).toHaveLength(1);
    expect(running[0].taskId).toBe(b.id);
    const aSessions = await db.sessions.where('taskId').equals(a.id).toArray();
    expect(aSessions[0].end - aSessions[0].start).toBe(60000);
    expect('running' in aSessions[0]).toBe(false);
  });

  it('drops sessions shorter than 5 seconds', async () => {
    const a = await repo.createTask({ name: 'A' });
    await repo.startTask(a.id);
    advance(MIN_SESSION_MS - 1);
    const r = await repo.stopRunning();
    expect(r.dropped).toBe(true);
    expect(await db.sessions.count()).toBe(0);
  });

  it('undo start removes the new session and resumes the previous one', async () => {
    const a = await repo.createTask({ name: 'A' });
    const b = await repo.createTask({ name: 'B' });
    await repo.startTask(a.id);
    advance(60000);
    const info = await repo.startTask(b.id);
    advance(2000);
    await repo.undoStart(info);
    const running = await repo.getRunning();
    expect(running.taskId).toBe(a.id);
    expect(running.end).toBeNull();
    expect(await db.sessions.count()).toBe(1);
  });

  it('undo stop resumes the same session, even one that was dropped', async () => {
    const a = await repo.createTask({ name: 'A' });
    await repo.startTask(a.id);
    advance(1000);
    const stopped = await repo.stopRunning();
    await repo.undoStop(stopped);
    expect((await repo.getRunning()).id).toBe(stopped.session.id);
  });

  it('manual logs without a date have no start and keep the duration', async () => {
    const a = await repo.createTask({ name: 'A' });
    const s = await repo.logManual(a.id, { hours: 1.5, date: '', time: '' });
    expect(s.start).toBeNull();
    expect(s.durationMs).toBe(5400000);
    expect(s.dateProvided).toBe(false);
    const s2 = await repo.logManual(a.id, { hours: 2, date: '2026-11-20', time: '14:30' });
    expect(new Date(s2.start).getHours()).toBe(14);
    expect(s2.end - s2.start).toBe(7200000);
  });

  it('archiving the running task stops it; only archived tasks can be deleted', async () => {
    const a = await repo.createTask({ name: 'A' });
    await repo.startTask(a.id);
    advance(60000);
    await expect(repo.deleteTaskPermanently(a.id)).rejects.toThrow();
    await repo.archiveTasks([a.id]);
    expect(await repo.getRunning()).toBeNull();
    expect((await db.tasks.get(a.id)).status).toBe('archived');
    await repo.deleteTaskPermanently(a.id);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('forward/backward compatibility', () => {
  it('keeps fields this version does not know about when updating', async () => {
    const { db, repo } = setup();
    await db.tasks.add({ id: 'x', name: 'Old', status: 'active', createdAt: 1, futureField: { a: 1 } });
    await repo.updateTask('x', { name: 'New' });
    const raw = await db.tasks.get('x');
    expect(raw.futureField).toEqual({ a: 1 });
    expect(raw.name).toBe('New');
  });

  it('fills defaults for fields older versions never wrote', async () => {
    const { db, repo } = setup();
    await db.tasks.add({ id: 'y', name: 'Legacy', status: 'active', createdAt: 1 });
    const { tasks } = await repo.loadAll();
    expect(tasks[0].maxHours).toBeNull();
    expect(tasks[0].notes).toBe('');
  });

  it('a future additive schema version opens old data intact', async () => {
    const { db, name } = setup();
    await db.tasks.add({ id: 'z', name: 'Keep me', status: 'active', createdAt: 1, gone: 'removed-in-v2' });
    await db.sessions.add({ id: 's', taskId: 'z', start: 1, end: 2, createdAt: 1 });
    db.close();
    const snap = await snapshotIfUpgrading(name, 20);
    expect(snap).toMatch(/before upgrade/);
    const v2 = new Dexie(name);
    defineSchema(v2);
    v2.version(2).stores({ tasks: 'id, status, createdAt, lastUsedAt, clientId', projects: 'id' });
    await v2.open();
    const t = await v2.table('tasks').get('z');
    expect(t.name).toBe('Keep me');
    expect(t.gone).toBe('removed-in-v2');
    expect(await v2.table('sessions').count()).toBe(1);
    const snaps = await listSnapshots();
    expect(snaps.at(-1).dump.tables.tasks[0].id).toBe('z');
    v2.close();
  });
});

describe('backup and database export/import', () => {
  it('backup import merges and skips existing records', async () => {
    const src = setup();
    const a = await src.repo.createTask({ name: 'A' });
    await src.repo.logManual(a.id, { hours: 1, date: '', time: '' });
    const file = await exportBackup(src.db);
    const dst = setup();
    const r1 = await importBackup(dst.db, JSON.parse(JSON.stringify(file)));
    expect(r1).toMatchObject({ tasks: 1, sessions: 1 });
    const r2 = await importBackup(dst.db, file);
    expect(r2).toMatchObject({ tasks: 0, sessions: 0 });
  });

  it('database import replaces everything', async () => {
    const src = setup();
    await src.repo.createTask({ name: 'From file' });
    const file = await exportDatabase(src.db);
    const dst = setup();
    await dst.repo.createTask({ name: 'Will be replaced' });
    await importDatabase(dst.db, JSON.parse(JSON.stringify(file)));
    const names = (await dst.db.tasks.toArray()).map((t) => t.name);
    expect(names).toEqual(['From file']);
  });

  it('refuses database files from a newer app version', async () => {
    const { db } = setup();
    await expect(importDatabase(db, { format: 'hourlytimetracker-database', schemaVersion: 99, tables: {} })).rejects.toThrow(/newer/);
  });
});

describe('pause and resume', () => {
  it('pausing ends the log; resuming starts a new log for the same task', async () => {
    const { db, repo } = setup();
    const a = await repo.createTask({ name: 'A' });
    await repo.startTask(a.id);
    advance(60000);
    await repo.pause();
    expect(await repo.getRunning()).toBeNull();
    expect((await repo.loadAll()).paused.taskId).toBe(a.id);
    advance(600000);
    expect(await repo.resumePaused()).toBe(a.id);
    const running = await repo.getRunning();
    expect(running.taskId).toBe(a.id);
    expect(await db.sessions.count()).toBe(2);
    expect((await repo.loadAll()).paused).toBeNull();
  });
  it('archiving a paused task forgets the pause', async () => {
    const { repo } = setup();
    const a = await repo.createTask({ name: 'A' });
    await repo.startTask(a.id);
    advance(60000);
    await repo.pause();
    await repo.archiveTasks([a.id]);
    expect(await repo.resumePaused()).toBeNull();
  });
});
