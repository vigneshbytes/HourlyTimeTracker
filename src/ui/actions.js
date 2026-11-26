// User actions: the one place that decides what starting, stopping, creating,
// archiving… actually do. Every destructive or surprising action is either
// confirmed first or offers Undo.
//
// The logic is shared by every front end; only the "UI wrapper" differs. The
// full app passes its dialogs and toasts (the default below); the mini timer
// passes its own inline forms and strip. A change here reaches both.
import { confirmDialog, toast, errorToast, typeToConfirm } from './dialogs.js';
import { taskForm, manualLogForm, timedSessionForm } from './forms.js';
import { fmtDuration } from '../logic/time.js';

export const CREATE_ONLY_MS = 15 * 60000;

export const fullAppUi = (app) => ({
  toast, errorToast, confirm: confirmDialog, typeToConfirm, taskForm, manualLogForm, timedSessionForm,
  afterCreate: () => app.navigate('#/'),
  // A session just started from a click in the full app: pop the mini timer
  // open (the browser only allows that right after a click).
  afterStart: () => app.mini?.autoOpen?.(),
});

export function createActions(app, ui = fullAppUi(app)) {
  const { repo } = app;
  const name = (id) => app.data.tasks.find((t) => t.id === id)?.name ?? 'task';
  const { toast, errorToast, typeToConfirm, taskForm, manualLogForm, timedSessionForm } = ui;
  const confirmDialog = ui.confirm;

  const safe = (fn) => async (...args) => { try { return await fn(...args); } catch (e) { errorToast(e); } };

  const actions = {
    // Card click: start this task, stop it if it is running, or confirm a switch.
    activate: safe(async (taskId) => {
      const running = app.running();
      if (running?.taskId === taskId) {
        const stopped = await repo.stopRunning();
        const msg = stopped?.dropped ? `Stopped ${name(taskId)} (under 5 s, not saved)` : `Stopped ${name(taskId)} · ${fmtDuration(stopped.session.end - stopped.session.start)}`;
        toast(msg, { subtle: true, action: 'Undo', onAction: safe(() => repo.undoStop(stopped)) });
        return 'stopped';
      }
      if (running) {
        const ok = await confirmDialog({
          title: 'Switch task?',
          message: `Stop "${name(running.taskId)}" and start timing "${name(taskId)}"?`,
          confirmText: 'Switch',
          short: `Switch to ${name(taskId)}?`, // for compact UIs (mini timer)
        });
        if (!ok) return 'cancelled';
      }
      const info = await repo.startTask(taskId);
      ui.afterStart?.();
      toast(`Started ${name(taskId)}`, { subtle: true, action: 'Undo', onAction: safe(() => repo.undoStart(info)) });
      return 'started';
    }),

    stop: safe(async () => {
      const running = app.running();
      if (running) await actions.activate(running.taskId);
    }),

    // New tasks start timing immediately, unless "create only" mode is on.
    newTask: safe(async () => {
      const v = await taskForm();
      if (!v) return;
      const task = await repo.createTask(v);
      ui.afterCreate?.(task);
      const until = app.data.settings.createOnlyUntil || 0;
      if (Date.now() < until) {
        const mins = Math.ceil((until - Date.now()) / 60000);
        toast(`Created ${task.name}. Not tracking (create-only mode, ${mins} min left).`, {
          subtle: true,
          action: 'Start now', duration: 6000, onAction: safe(() => actions.activate(task.id)),
        });
        return;
      }
      const prev = app.running();
      const info = await repo.startTask(task.id);
      ui.afterStart?.();
      const stoppedNote = prev && info.stopped && !info.stopped.dropped ? ` (stopped ${name(prev.taskId)})` : '';
      toast(`Created and started ${task.name}${stoppedNote}`, {
        action: 'Create only, don\u2019t track yet',
        duration: 10000,
        onAction: safe(async () => {
          await repo.undoStart(info);
          await repo.updateSettings({ createOnlyUntil: Date.now() + CREATE_ONLY_MS });
          toast('Not tracking. New tasks won\u2019t start a timer for the next 15 minutes.', {
            subtle: true,
            action: 'Turn off', duration: 7000, onAction: safe(() => repo.updateSettings({ createOnlyUntil: 0 })),
          });
        }),
      });
    }),

    endCreateOnly: safe(() => repo.updateSettings({ createOnlyUntil: 0 })),

    // Resume a task paused from the top bar (as a new session).
    resume: safe(async () => {
      const paused = app.data.paused;
      if (!paused) return;
      app.justResumed = paused.taskId;
      const id = await repo.resumePaused();
      if (!id) { app.justResumed = null; return; }
      ui.afterStart?.();
      toast(`Resumed ${name(id)}`);
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
      toast(`Added a ${fmtDuration(v.hours * 3600000)} session to ${task.name}`, { subtle: true });
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
      const ok = await confirmDialog({ title: 'Delete this session?', message: 'The time in this session will be removed from the task total.', confirmText: 'Delete session', danger: true });
      if (!ok) return;
      await repo.deleteSession(session.id);
      toast('Session deleted', { action: 'Undo', onAction: safe(() => repo.db.sessions.add(session)) });
    }),

    archive: safe(async (taskIds) => {
      const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
      const prevRunning = app.running();
      await repo.archiveTasks(ids);
      const label = ids.length === 1 ? `Archived ${name(ids[0])}` : `Archived ${ids.length} tasks`;
      toast(label, {
        subtle: true,
        action: 'Undo',
        onAction: safe(async () => {
          for (const id of ids) await repo.unarchiveTask(id);
          if (prevRunning && ids.includes(prevRunning.taskId)) await repo.db.sessions.update(prevRunning.id, { end: null, running: 1 });
        }),
      });
    }),

    unarchive: safe(async (taskId) => {
      await repo.unarchiveTask(taskId);
      toast(`Restored ${name(taskId)} to the task list`, { subtle: true });
    }),

    deletePermanently: safe(async (taskId) => {
      const task = app.data.tasks.find((t) => t.id === taskId);
      const ok = await typeToConfirm({
        title: 'Delete task permanently?',
        message: `"${task.name}" and all of its sessions will be erased. This cannot be undone.`,
        phrase: task.name,
        confirmText: 'Delete forever',
      });
      if (!ok) return false;
      await repo.deleteTaskPermanently(taskId);
      toast(`Deleted ${task.name}`);
      return true;
    }),
  };
  return actions;
}
