// User actions shared by several views. Every destructive or surprising
// action is either confirmed first or offers Undo.
import { confirmDialog, toast, errorToast, typeToConfirm } from './dialogs.js';
import { taskForm, manualLogForm, timedSessionForm } from './forms.js';
import { fmtDuration } from '../logic/time.js';

export function createActions(app) {
  const { repo } = app;
  const name = (id) => app.data.tasks.find((t) => t.id === id)?.name ?? 'task';

  const safe = (fn) => async (...args) => { try { return await fn(...args); } catch (e) { errorToast(e); } };

  return {
    // Card click: start this task, stop it if it is running, or confirm a switch.
    activate: safe(async (taskId) => {
      const running = app.running();
      if (running?.taskId === taskId) {
        const stopped = await repo.stopRunning();
        const msg = stopped?.dropped ? `Stopped ${name(taskId)} (under 5 s, not saved)` : `Stopped ${name(taskId)} · ${fmtDuration(stopped.session.end - stopped.session.start)}`;
        toast(msg, { action: 'Undo', onAction: safe(() => repo.undoStop(stopped)) });
        return;
      }
      if (running) {
        const ok = await confirmDialog({
          title: 'Switch task?',
          message: `Stop "${name(running.taskId)}" and start timing "${name(taskId)}"?`,
          confirmText: 'Switch',
        });
        if (!ok) return;
      }
      const info = await repo.startTask(taskId);
      toast(`Started ${name(taskId)}`, { action: 'Undo', onAction: safe(() => repo.undoStart(info)) });
    }),

    stop: safe(async () => {
      const running = app.running();
      if (running) await app.actions.activate(running.taskId);
    }),

    newTask: safe(async () => {
      const v = await taskForm();
      if (v) await repo.createTask(v);
    }),

    editTask: safe(async (taskId) => {
      const task = app.data.tasks.find((t) => t.id === taskId);
      const v = await taskForm(task);
      if (v) await repo.updateTask(taskId, v);
    }),

    logManual: safe(async (taskId) => {
      const task = app.data.tasks.find((t) => t.id === taskId);
      const v = await manualLogForm(task);
      if (!v) return;
      await repo.logManual(taskId, v);
      toast(`Logged ${fmtDuration(v.hours * 3600000)} on ${task.name}`);
    }),

    editSession: safe(async (session) => {
      if (session.manual) {
        const task = app.data.tasks.find((t) => t.id === session.taskId);
        const v = await manualLogForm(task, session);
        if (v) await repo.updateSession(session.id, v);
      } else {
        const v = await timedSessionForm(session);
        if (v) await repo.updateSession(session.id, v);
      }
    }),

    deleteSession: safe(async (session) => {
      const ok = await confirmDialog({ title: 'Delete this log?', message: 'The time in this session will be removed from the task total.', confirmText: 'Delete log', danger: true });
      if (!ok) return;
      await repo.deleteSession(session.id);
      toast('Log deleted', { action: 'Undo', onAction: safe(() => repo.db.sessions.add(session)) });
    }),

    archive: safe(async (taskIds) => {
      const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
      const prevRunning = app.running();
      await repo.archiveTasks(ids);
      const label = ids.length === 1 ? `Archived ${name(ids[0])}` : `Archived ${ids.length} tasks`;
      toast(label, {
        action: 'Undo',
        onAction: safe(async () => {
          for (const id of ids) await repo.unarchiveTask(id);
          if (prevRunning && ids.includes(prevRunning.taskId)) await repo.db.sessions.update(prevRunning.id, { end: null, running: 1 });
        }),
      });
    }),

    unarchive: safe(async (taskId) => {
      await repo.unarchiveTask(taskId);
      toast(`Restored ${name(taskId)} to the task list`);
    }),

    deletePermanently: safe(async (taskId) => {
      const task = app.data.tasks.find((t) => t.id === taskId);
      const ok = await typeToConfirm({
        title: 'Delete task permanently?',
        message: `"${task.name}" and all of its logs will be erased. This cannot be undone.`,
        phrase: task.name,
        confirmText: 'Delete forever',
      });
      if (!ok) return false;
      await repo.deleteTaskPermanently(taskId);
      toast(`Deleted ${task.name}`);
      return true;
    }),
  };
}
