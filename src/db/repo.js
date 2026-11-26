// All reads and writes of app data go through this module.
// Writes use table.update() (partial updates) so fields this version of the
// app doesn't know about are never removed from stored records.

import { normalizeTask, normalizeSession, normalizeSettings, pick, EDITABLE_TASK_FIELDS, RECORD_VERSION } from './records.js';

export const MIN_SESSION_MS = 5000;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function createRepo(db, now = () => Date.now()) {
  const stamp = (o) => ({ ...o, updatedAt: now(), _v: RECORD_VERSION });

  async function getRunning() {
    const s = await db.sessions.where('running').equals(1).first();
    return s ? normalizeSession(s) : null;
  }

  // Ends the running session (if any). Sessions shorter than MIN_SESSION_MS are dropped.
  async function stopRunningInTx(t) {
    const running = await db.sessions.where('running').equals(1).toArray();
    let result = null;
    for (const s of running) {
      if (t - s.start < MIN_SESSION_MS) {
        await db.sessions.delete(s.id);
        result = { session: normalizeSession(s), dropped: true };
      } else {
        await db.sessions.update(s.id, stamp({ end: t, running: undefined }));
        result = { session: normalizeSession({ ...s, end: t }), dropped: false };
      }
      await db.tasks.update(s.taskId, { lastUsedAt: t });
    }
    return result;
  }

  return {
    db,

    async getSettings() {
      return normalizeSettings((await db.meta.get('settings'))?.value);
    },
    async updateSettings(changes) {
      await db.transaction('rw', db.meta, async () => {
        const cur = (await db.meta.get('settings'))?.value || {};
        await db.meta.put({ key: 'settings', value: { ...cur, ...changes } });
      });
    },

    async loadAll() {
      const [tasks, sessions, settings] = await Promise.all([db.tasks.toArray(), db.sessions.toArray(), this.getSettings()]);
      return { tasks: tasks.map(normalizeTask), sessions: sessions.map(normalizeSession), settings };
    },

    getRunning,

    async createTask(fields) {
      const t = now();
      const task = stamp(normalizeTask({ ...pick(fields, EDITABLE_TASK_FIELDS), id: uid(), createdAt: t, status: 'active' }));
      if (!task.name.trim()) throw new Error('Task name is required');
      await db.tasks.add(task);
      return task;
    },

    async updateTask(id, fields) {
      const changes = pick(fields, EDITABLE_TASK_FIELDS);
      if ('name' in changes && !String(changes.name).trim()) throw new Error('Task name is required');
      await db.tasks.update(id, stamp(changes));
    },

    // Starts timing a task, stopping whatever was running. Returns info for Undo.
    async startTask(taskId) {
      return db.transaction('rw', db.tasks, db.sessions, async () => {
        const t = now();
        const task = await db.tasks.get(taskId);
        if (!task) throw new Error('Task not found');
        const stopped = await stopRunningInTx(t);
        const session = stamp(normalizeSession({ id: uid(), taskId, start: t, createdAt: t, manual: false }));
        await db.sessions.add({ ...session, running: 1 });
        const prevLastUsedAt = task.lastUsedAt;
        await db.tasks.update(taskId, { lastUsedAt: t });
        return { startedId: session.id, stopped, prevLastUsedAt };
      });
    },

    async undoStart({ startedId, stopped }) {
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        await db.sessions.delete(startedId);
        if (stopped) await reopen(stopped.session);
      });
    },

    async stopRunning() {
      return db.transaction('rw', db.tasks, db.sessions, () => stopRunningInTx(now()));
    },

    async undoStop(stopped) {
      if (!stopped) return;
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        await stopRunningInTx(now()); // something else may have started meanwhile
        await reopen(stopped.session);
      });
    },

    // hours: number (required). date: 'YYYY-MM-DD' | ''. time: 'HH:MM' | ''.
    async logManual(taskId, { hours, date, time }) {
      if (!(hours > 0)) throw new Error('Hours must be greater than zero');
      const t = now();
      const s = stamp(normalizeSession({ id: uid(), taskId, createdAt: t, manual: true, ...manualTiming(hours, date, time, t) }));
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        await db.sessions.add(s);
        await db.tasks.update(taskId, { lastUsedAt: t });
      });
      return s;
    },

    async updateSession(id, changes) {
      const s = await db.sessions.get(id);
      if (!s) return;
      if (s.manual) {
        await db.sessions.update(id, stamp(manualTiming(changes.hours, changes.date, changes.time, s.createdAt)));
      } else {
        const start = changes.start ?? s.start;
        const end = s.running ? null : (changes.end ?? s.end);
        if (end != null && end <= start) throw new Error('End must be after start');
        await db.sessions.update(id, stamp({ start, end }));
      }
    },

    async deleteSession(id) { await db.sessions.delete(id); },

    async archiveTasks(ids) {
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        const running = await db.sessions.where('running').equals(1).first();
        if (running && ids.includes(running.taskId)) await stopRunningInTx(now());
        const t = now();
        for (const id of ids) await db.tasks.update(id, stamp({ status: 'archived', archivedAt: t }));
      });
    },

    async unarchiveTask(id) {
      await db.tasks.update(id, stamp({ status: 'active', archivedAt: null }));
    },

    // Only archived tasks can be removed permanently.
    async deleteTaskPermanently(id) {
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        const task = await db.tasks.get(id);
        if (!task || task.status !== 'archived') throw new Error('Only archived tasks can be deleted');
        await db.sessions.where('taskId').equals(id).delete();
        await db.tasks.delete(id);
      });
    },

    async eraseAll() {
      await db.transaction('rw', db.tasks, db.sessions, db.meta, async () => {
        await Promise.all([db.tasks.clear(), db.sessions.clear(), db.meta.clear()]);
      });
    },
  };

  async function reopen(session) {
    const exists = await db.sessions.get(session.id);
    if (exists) await db.sessions.update(session.id, stamp({ end: null, running: 1 }));
    else await db.sessions.add({ ...stamp(session), end: null, running: 1 });
    await db.tasks.update(session.taskId, { lastUsedAt: now() });
  }
}

export function manualTiming(hours, date, time, createdAt) {
  const durationMs = Math.round(Number(hours) * 3600000);
  if (!(durationMs > 0)) throw new Error('Hours must be greater than zero');
  const dateProvided = !!date;
  const timeProvided = !!time;
  let start = null;
  if (dateProvided || timeProvided) {
    const base = dateProvided ? parseLocalDate(date) : new Date(createdAt);
    const [h, m] = timeProvided ? time.split(':').map(Number) : [0, 0];
    base.setHours(h, m, 0, 0);
    start = base.getTime();
  }
  return { durationMs, start, end: start == null ? null : start + durationMs, dateProvided, timeProvided };
}

export function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
