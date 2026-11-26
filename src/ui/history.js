import { h, svgIcon } from './dom.js';
import { filterHistory, completionDate, sessionDuration, sessionTime } from '../logic/tasks.js';
import { fmtDuration, fmtDate, fmtTime, fmtHours, relativeExpiry } from '../logic/time.js';
import { sessionGraph } from './graph.js';
import { openMenu } from './menu.js';

const state = { query: '', filter: 'all', sort: 'created' };

export function createHistoryView(app) {
  const root = h('section', { class: 'view view-history' });
  const search = h('input', { type: 'search', placeholder: 'Search tasks and notes', 'aria-label': 'Search', value: state.query,
    oninput: () => { state.query = search.value; renderResults(); } });
  const filters = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Filter' },
    ['all', 'active', 'archived'].map((f) => h('button', { type: 'button', class: 'seg-btn', role: 'radio', dataset: { f },
      onclick: () => { state.filter = f; renderResults(); } }, f[0].toUpperCase() + f.slice(1))));
  const sort = h('select', { 'aria-label': 'Sort by', onchange: () => { state.sort = sort.value; renderResults(); } },
    h('option', { value: 'created' }, 'Creation'),
    h('option', { value: 'completed' }, 'Completion'));
  sort.value = state.sort;
  const results = h('ul', { class: 'history-list' });
  const summary = h('p', { class: 'muted small' });
  root.append(
    h('div', { class: 'history-controls' },
      h('label', { class: 'search' }, svgIcon('search', 18), search),
      h('div', { class: 'controls-row' }, filters, h('label', { class: 'sort-label' }, h('span', null, 'Sort by:'), sort))),
    summary, results);

  function row(task) {
    const st = app.stats.get(task.id);
    const archived = task.status === 'archived';
    const done = completionDate(task, st);
    return h('li', { class: `history-row${archived ? ' is-archived' : ''}` },
      h('button', { type: 'button', class: 'history-open', onclick: () => app.navigate(`#/history/${task.id}`) },
        h('span', { class: 'hr-top' },
          h('span', { class: 'hr-name' }, task.name),
          h('span', { class: `chip ${archived ? 'chip-muted' : st.running ? 'chip-live' : 'chip-ok'}` }, archived ? 'Archived' : st.running ? 'Running' : 'Active')),
        h('span', { class: 'hr-total js-total', dataset: { task: task.id } }, fmtDuration(st.totalMs)),
        h('span', { class: 'hr-meta' }, `${st.sessions.length} ${st.sessions.length === 1 ? 'log' : 'logs'} · created ${fmtDate(task.createdAt)}${done ? ` · completed ${fmtDate(done)}` : ''}`),
        task.notes && h('span', { class: 'hr-notes' }, task.notes)),
      archived && h('button', { type: 'button', class: 'btn btn-small', onclick: () => app.actions.unarchive(task.id) }, svgIcon('restore', 16), ' Unarchive'));
  }

  function renderResults() {
    filters.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.f === state.filter)));
    const list = filterHistory(app.data.tasks, app.stats, state);
    const totalMs = list.reduce((a, t) => a + app.stats.get(t.id).totalMs, 0);
    summary.textContent = list.length ? `${list.length} ${list.length === 1 ? 'task' : 'tasks'} · ${fmtDuration(totalMs)} tracked` : '';
    results.replaceChildren(...(list.length ? list.map(row) : [h('li', { class: 'empty small' }, state.query ? 'No tasks match your search.' : 'Nothing here yet.')]));
  }

  return { root, render: renderResults, tick() {} };
}

export function createTaskDetailView(app, taskId) {
  const root = h('section', { class: 'view view-detail' });

  function render() {
    const task = app.data.tasks.find((t) => t.id === taskId);
    if (!task) { root.replaceChildren(h('p', { class: 'empty' }, 'This task no longer exists. ', h('a', { href: '#/history' }, 'Back to history'))); return; }
    const st = app.stats.get(taskId);
    const archived = task.status === 'archived';
    const done = completionDate(task, st);
    const moreBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Task options' }, svgIcon('more'));
    moreBtn.addEventListener('click', () => openMenu({
      anchor: moreBtn, asSheet: app.lastPointer === 'touch', title: task.name,
      items: [
        { label: 'Edit', icon: 'edit', onClick: () => app.actions.editTask(taskId) },
        { label: 'Log session manually', icon: 'clock', onClick: () => app.actions.logManual(taskId) },
        archived ? { label: 'Unarchive', icon: 'restore', onClick: () => app.actions.unarchive(taskId) }
          : { label: 'Archive', icon: 'archive', onClick: () => app.actions.archive(taskId) },
        archived && { label: 'Delete permanently…', icon: 'trash', danger: true, onClick: async () => { if (await app.actions.deletePermanently(taskId)) app.navigate('#/history'); } },
      ].filter(Boolean),
    }));

    const sessionsDesc = [...st.sessions].sort((a, b) => sessionTime(b) - sessionTime(a));
    root.replaceChildren(...[
      h('div', { class: 'detail-head' },
        h('a', { href: '#/history', class: 'icon-btn', 'aria-label': 'Back to history' }, svgIcon('back')),
        h('h2', { class: 'detail-name' }, task.name),
        moreBtn),
      h('div', { class: 'detail-total' },
        h('span', { class: 'big-total js-total', dataset: { task: taskId } }, fmtDuration(st.totalMs)),
        h('span', { class: 'muted' }, `${st.sessions.length} ${st.sessions.length === 1 ? 'log' : 'logs'}${task.maxHours ? ` · limit ${fmtHours(task.maxHours)}` : ''}`)),
      h('div', { class: 'chips' },
        h('span', { class: `chip ${archived ? 'chip-muted' : st.running ? 'chip-live' : 'chip-ok'}` }, archived ? 'Archived' : st.running ? 'Running' : 'Active'),
        st.overLimit && h('span', { class: 'chip chip-warn' }, 'Over limit'),
        task.expiresAt && h('span', { class: `chip ${st.expiring ? 'chip-red' : 'chip-muted'}` }, `${relativeExpiry(task.expiresAt)} (${fmtDate(task.expiresAt)})`),
        h('span', { class: 'chip chip-muted' }, `Created ${fmtDate(task.createdAt)}`),
        done && h('span', { class: 'chip chip-muted' }, `Completed ${fmtDate(done)}`)),
      task.notes && h('p', { class: 'detail-notes' }, task.notes),
      archived && h('button', { type: 'button', class: 'btn', onclick: () => app.actions.unarchive(taskId) }, svgIcon('restore', 16), ' Unarchive'),
      h('h3', { class: 'section-title' }, 'Logs'),
      sessionGraph(st.sessions),
      h('ul', { class: 'session-list' }, sessionsDesc.map((s) => sessionRow(s))),
      h('button', { type: 'button', class: 'btn', onclick: () => app.actions.logManual(taskId) }, svgIcon('clock', 16), ' Log session manually'),
    ].filter((x) => x instanceof Node));
  }

  function sessionRow(s) {
    const dur = sessionDuration(s);
    const when = s.manual
      ? (s.dateProvided ? `${fmtDate(s.start)}${s.timeProvided ? ` · ${fmtTime(s.start)}` : ''}` : `No date · added ${fmtDate(s.createdAt)}`)
      : `${fmtDate(s.start)} · ${fmtTime(s.start)}–${s.end ? fmtTime(s.end) : 'now'}`;
    const kind = s.running === 1 ? 'running' : s.manual && !s.dateProvided ? 'manual-nodate' : s.manual ? 'manual' : 'timed';
    return h('li', { class: `session-row kind-${kind}` },
      h('i', { class: `lg lg-${kind}` }),
      h('span', { class: 'sr-when' }, when, s.manual && h('span', { class: 'chip chip-muted chip-xs' }, 'manual')),
      h('span', { class: `sr-dur${s.running === 1 ? ' js-session-timer-detail' : ''}` }, fmtDuration(dur)),
      h('span', { class: 'sr-actions' },
        h('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Edit log', onclick: () => app.actions.editSession(s) }, svgIcon('edit', 16)),
        s.running !== 1 && h('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Delete log', onclick: () => app.actions.deleteSession(s) }, svgIcon('trash', 16))));
  }

  return { root, render, tick() {} };
}
