import { h } from './dom.js';
import { modal } from './dialogs.js';
import { toInputDate, toInputTime, fmtDuration } from '../logic/time.js';
import { checkTask, checkManualSession } from '../logic/forms.js';

function field(label, input, hint) {
  const hintEl = h('small', { class: 'hint' }, hint || '');
  return { el: h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hintEl), hintEl };
}

// Add / edit task. Resolves with { name, notes, maxHours, expiresAt } or null.
export function taskForm(task = null) {
  return modal({
    title: task ? 'Edit task' : 'New task',
    build: (close) => {
      const name = h('input', { type: 'text', required: true, maxlength: 120, value: task?.name ?? '', autofocus: true, placeholder: 'e.g. Website redesign' });
      const notes = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'Optional' });
      notes.value = task?.notes ?? '';
      const limit = h('input', { type: 'text', inputmode: 'decimal', value: task?.maxHours ?? '', placeholder: 'Optional, e.g. 20 or 7:30' });
      const expiry = h('input', { type: 'text', value: task?.expiresAt ? toInputDate(task.expiresAt) : '', placeholder: 'Days (e.g. 14) or a date' });
      const picker = h('input', { type: 'date', class: 'date-picker', 'aria-label': 'Pick expiry date', tabindex: -1,
        onchange: () => { expiry.value = picker.value; update(); } });
      const fName = field('Name', name);
      const fNotes = field('Notes', notes);
      const fLimit = field('Max time (hours)', limit, 'Turns yellow at 70%, shows "Over limit" at 100%.');
      const fExpiry = field('Expiry', h('div', { class: 'input-row' }, expiry, h('span', { class: 'picker-wrap', title: 'Pick a date' }, '📅', picker)), '');
      const save = h('button', { class: 'btn btn-primary', type: 'submit' }, task ? 'Save' : 'Create task');

      function update() {
        const r = checkTask({ name: name.value, notes: notes.value, limit: limit.value, expiry: expiry.value });
        fLimit.hintEl.textContent = r.errors.limit || r.hints.limit;
        fLimit.hintEl.classList.toggle('err', !!r.errors.limit);
        fExpiry.hintEl.textContent = r.errors.expiry || r.hints.expiry;
        fExpiry.hintEl.classList.toggle('err', !!r.errors.expiry);
        save.disabled = !r.ok;
        return r.value;
      }
      for (const i of [name, limit, expiry]) i.addEventListener('input', update);
      update();
      return h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); const v = update(); if (v) close(v); } },
        fName.el, fNotes.el, fLimit.el, fExpiry.el,
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancel'), save));
    },
  });
}

// Manual session log. Resolves with { hours, date, time } or null.
export function manualLogForm(task, session = null) {
  return modal({
    title: session ? 'Edit manual session' : `Add session · ${task.name}`,
    build: (close) => {
      const hours = h('input', { type: 'text', inputmode: 'decimal', autofocus: true, placeholder: 'e.g. 1.5 or 1:30',
        value: session ? String(+(session.durationMs / 3600000).toFixed(4)) : '' });
      const date = h('input', { type: 'date', value: session?.dateProvided && session.start ? toInputDate(session.start) : '' });
      const time = h('input', { type: 'time', value: session?.timeProvided && session.start ? toInputTime(session.start) : '' });
      const fHours = field('Hours (required)', hours, '');
      const save = h('button', { class: 'btn btn-primary', type: 'submit' }, session ? 'Save' : 'Add session');
      const update = () => {
        const r = checkManualSession({ hours: hours.value, date: date.value, time: time.value });
        fHours.hintEl.textContent = r.error || r.hint;
        fHours.hintEl.classList.toggle('err', !!r.error);
        save.disabled = !r.ok;
        return r.value;
      };
      hours.addEventListener('input', update);
      update();
      return h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); const v = update(); if (v) close(v); } },
        fHours.el,
        h('div', { class: 'field-row' }, field('Start date', date).el, field('Start time', time).el),
        h('p', { class: 'hint' }, 'Date and time are optional. Without a date, the session is placed on the day you add it and shown in a different colour.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancel'), save));
    },
  });
}

// Edit a timed session's start/end. Resolves with { start, end } or null.
export function timedSessionForm(session) {
  return modal({
    title: 'Edit session',
    build: (close) => {
      const toLocal = (t) => (t == null ? '' : `${toInputDate(t)}T${toInputTime(t)}`);
      const start = h('input', { type: 'datetime-local', value: toLocal(session.start), autofocus: true });
      const end = h('input', { type: 'datetime-local', value: toLocal(session.end), disabled: session.end == null });
      const fEnd = field('End', end, session.end == null ? 'Still running' : '');
      const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save');
      const read = () => {
        const s = start.value ? new Date(start.value).getTime() : NaN;
        const e = session.end == null ? null : (end.value ? new Date(end.value).getTime() : NaN);
        const ok = !Number.isNaN(s) && (e === null || (!Number.isNaN(e) && e > s));
        fEnd.hintEl.textContent = ok ? (e ? `Duration ${fmtDuration(e - s)}` : 'Still running') : 'End must be after start';
        fEnd.hintEl.classList.toggle('err', !ok);
        save.disabled = !ok;
        return ok ? { start: s, end: e } : null;
      };
      start.addEventListener('input', read);
      end.addEventListener('input', read);
      read();
      return h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); const v = read(); if (v) close(v); } },
        field('Start', start).el, fEnd.el,
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancel'), save));
    },
  });
}
