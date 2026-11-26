import { h } from './dom.js';

// Generic modal. `build(close)` returns the body; buttons call close(value).
// Resolves with the value passed to close(), or null on cancel/Escape.
export function modal({ title, build, className = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const dlg = h('dialog', { class: `modal ${className}`, 'aria-label': title });
    const close = (value = null) => {
      if (done) return;
      done = true;
      dlg.classList.add('closing');
      setTimeout(() => { dlg.close(); dlg.remove(); }, 140);
      resolve(value);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(null); }); // backdrop
    dlg.append(h('div', { class: 'modal-inner' }, h('h2', { class: 'modal-title' }, title), build(close)));
    document.body.append(dlg);
    dlg.showModal();
    const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, textarea, select');
    first?.focus();
  });
}

export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return modal({
    title,
    build: (close) => h('div', null,
      message && h('p', { class: 'modal-msg' }, message),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => close(false), autofocus: danger || null }, cancelText),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => close(true), autofocus: !danger || null }, confirmText))),
  }).then((v) => v === true);
}

// Requires typing an exact phrase (paste disabled).
export function typeToConfirm({ title, message, phrase, confirmText }) {
  return modal({
    title,
    build: (close) => {
      const btn = h('button', { class: 'btn btn-danger', type: 'button', disabled: true, onclick: () => close(true) }, confirmText);
      const input = h('input', {
        type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Confirmation text',
        oninput: () => { btn.disabled = input.value.trim() !== phrase; },
        onpaste: (e) => e.preventDefault(),
        onkeydown: (e) => { if (e.key === 'Enter' && !btn.disabled) close(true); },
      });
      return h('div', null,
        h('p', { class: 'modal-msg' }, message),
        h('p', null, 'Type ', h('code', null, phrase), ' to confirm.'),
        input,
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close(false), autofocus: true }, 'Cancel'), btn));
    },
  }).then((v) => v === true);
}

// Three-step guard used for every operation that erases data.
export async function multiStepErase({ what, phrase = 'DELETE ALL MY DATA', confirmText = 'Erase everything' }) {
  const s1 = await confirmDialog({ title: 'Erase data? (step 1 of 3)', message: `${what} There is no undo and no cloud copy. Export a backup first if you might need it.`, confirmText: 'Continue', danger: true });
  if (!s1) return false;
  const s2 = await modal({
    title: 'Are you sure? (step 2 of 3)',
    build: (close) => {
      const btn = h('button', { class: 'btn btn-danger', type: 'button', disabled: true, onclick: () => close(true) }, 'Continue');
      return h('div', null,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { btn.disabled = !e.target.checked; } }), ' I understand this cannot be undone.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close(false), autofocus: true }, 'Cancel'), btn));
    },
  });
  if (s2 !== true) return false;
  return typeToConfirm({ title: 'Final confirmation (step 3 of 3)', message: 'Last chance.', phrase, confirmText });
}

// Bottom toast with optional action (e.g. Undo). Only one at a time.
let currentToast = null;
// subtle: light, quiet style for routine feedback. error: red.
export function toast(message, { action, onAction, duration = 5000, subtle = false, error = false } = {}) {
  currentToast?.dismiss();
  const bar = h('div', { class: 'toast-bar' });
  const el = h('div', { class: `toast${subtle ? ' toast-subtle' : ''}${error ? ' toast-error' : ''}`, role: error ? 'alert' : 'status' },
    h('span', { class: 'toast-msg' }, message),
    action && h('button', { class: 'toast-action', type: 'button', onclick: () => { t.dismiss(); onAction?.(); } }, action),
    bar);
  bar.style.animationDuration = `${duration}ms`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const timer = setTimeout(() => t.dismiss(), duration);
  const t = {
    dismiss() {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
      if (currentToast === t) currentToast = null;
    },
  };
  currentToast = t;
  return t;
}

export function errorToast(e) {
  console.error(e);
  toast(e?.message || String(e), { duration: 6000, error: true });
}
