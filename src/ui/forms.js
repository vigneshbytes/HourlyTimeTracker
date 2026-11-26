import { h } from './dom.js';
import { modal } from './dialogs.js';
import { parseHours, parseExpiry, fmtDate, toInputDate, toInputTime, relativeExpiry, fmtDuration } from '../logic/time.js';

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
        let ok = !!name.value.trim();
        const hrs = limit.value.trim() ? parseHours(limit.value) : null;
        if (limit.value.trim() && !(hrs > 0)) { fLimit.hintEl.textContent = 'Enter hours like 20, 2.5 or 7:30'; fLimit.hintEl.classList.add('err'); ok = false; }
        else { fLimit.hintEl.textContent = hrs ? `= ${fmtDuration(hrs * 3600000)}. Turns yellow at 70%.` : 'Turns yellow at 70%, shows "Over limit" at 100%.'; fLimit.hintEl.classList.remove('err'); }
        const ex = parseExpiry(expiry.value);
        if (ex.error) { fExpiry.hintEl.textContent = ex.error; fExpiry.hintEl.classList.add('err'); ok = false; }
        else { fExpiry.hintEl.textContent = ex.value ? `${fmtDate(ex.value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${relativeExpiry(ex.value)}` : 'Optional. Turns red when it is close.'; fExpiry.hintEl.classList.remove('err'); }
        save.disabled = !ok;
        return ok ? { name: name.value.trim(), notes: notes.value.trim(), maxHours: hrs, expiresAt: ex.value } : null;
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
        const v = parseHours(hours.value);
        const ok = v > 0;
        fHours.hintEl.textContent = hours.value.trim() && !ok ? 'Enter hours like 2, 1.5 or 1:30' : ok ? `= ${fmtDuration(v * 3600000)}` : '';
        fHours.hintEl.classList.toggle('err', !!hours.value.trim() && !ok);
        save.disabled = !ok;
        return ok ? { hours: v, date: date.value, time: time.value } : null;
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
