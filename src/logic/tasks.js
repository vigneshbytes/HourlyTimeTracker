import { daysUntil } from './time.js';

export function sessionDuration(s, now = Date.now()) {
  if (s.manual) return s.durationMs || 0;
  if (s.start == null) return 0;
  return Math.max(0, (s.end ?? now) - s.start);
}

// Effective time used to place a session chronologically.
export const sessionTime = (s) => s.start ?? s.createdAt;

// Derive per-task stats from all sessions.
export function buildStats(tasks, sessions, settings, now = Date.now()) {
  const byTask = new Map(tasks.map((t) => [t.id, { totalMs: 0, sessions: [], running: null, lastSessionAt: null }]));
  for (const s of sessions) {
    const st = byTask.get(s.taskId);
    if (!st) continue;
    st.totalMs += sessionDuration(s, now);
    st.sessions.push(s);
    if (s.running === 1) st.running = s;
    const t = s.end ?? sessionTime(s);
    if (st.lastSessionAt == null || t > st.lastSessionAt) st.lastSessionAt = t;
  }
  const out = new Map();
  for (const task of tasks) {
    const st = byTask.get(task.id);
    st.sessions.sort((a, b) => sessionTime(a) - sessionTime(b));
    out.set(task.id, { ...st, ...taskStatus(task, st.totalMs, settings, now) });
  }
  return out;
}

export function taskStatus(task, totalMs, settings, now = Date.now()) {
  const limitMs = task.maxHours ? task.maxHours * 3600000 : null;
  const ratio = limitMs ? totalMs / limitMs : 0;
  const expired = task.expiresAt != null && task.expiresAt < now;
  const expiring = task.expiresAt != null && (expired || daysUntil(task.expiresAt, now) <= settings.expiryWarnDays);
  const nearLimit = limitMs != null && ratio >= settings.yellowThreshold;
  const overLimit = limitMs != null && ratio >= 1;
  return { ratio, expired, expiring, nearLimit, overLimit, color: expiring ? 'red' : nearLimit ? 'yellow' : null };
}

const activity = (t) => t.lastUsedAt ?? t.createdAt;

// Main list order: running task, then expiring (soonest first), then most recently used.
export function sortMainList(tasks, stats) {
  const rank = (t) => (stats.get(t.id)?.running ? 0 : stats.get(t.id)?.expiring ? 1 : 2);
  return [...tasks].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 1) return a.expiresAt - b.expiresAt;
    return activity(b) - activity(a);
  });
}

// Bulk archive order: oldest activity first.
export const sortOldestActivity = (tasks) => [...tasks].sort((a, b) => activity(a) - activity(b));

export function completionDate(task, stat) {
  return task.status === 'archived' ? (stat?.lastSessionAt ?? task.archivedAt) : null;
}

export function filterHistory(tasks, stats, { query = '', filter = 'all', sort = 'created' }) {
  const q = query.trim().toLowerCase();
  const list = tasks.filter((t) => (filter === 'all' || (filter === 'active' ? t.status === 'active' : t.status === 'archived'))
    && (!q || t.name.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)));
  const key = sort === 'completed' ? (t) => completionDate(t, stats.get(t.id)) ?? -Infinity : (t) => t.createdAt;
  return list.sort((a, b) => key(b) - key(a));
}

// Range selection for shift+click: returns ids between the two indexes inclusive.
export function rangeIds(orderedIds, fromId, toId) {
  const a = orderedIds.indexOf(fromId), b = orderedIds.indexOf(toId);
  if (a < 0 || b < 0) return [toId];
  return orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1);
}
