import { h } from './dom.js';

// How-to content, shared by the welcome card and the "?" help popover.
export function howToSteps() {
  return h('ol', { class: 'howto' },
    h('li', null, h('span', { class: 'howto-emoji' }, '➕'), h('span', null, 'Tap ', h('strong', null, '+'), ' to add a task. It starts timing right away.')),
    h('li', null, h('span', { class: 'howto-emoji' }, '⏱️'), h('span', null, 'Tap any task to time it. One runs at a time.')),
    h('li', null, h('span', { class: 'howto-emoji' }, '🛑'), h('span', null, 'Done? Tap the running task to ', h('strong', null, 'stop'), ' it.')),
    h('li', null, h('span', { class: 'howto-emoji' }, '📊'), h('span', null, 'See totals and sessions in ', h('strong', null, 'History'), '.')));
}

export function moreTips() {
  return h('ul', { class: 'howto tips' },
    h('li', null, h('span', { class: 'howto-emoji more-dots' }, '⋯'), h('span', null, 'Hover a task (or press and hold on a phone) to edit it, add a session by hand, or archive it.')),
    h('li', null, h('span', { class: 'howto-emoji' }, '⏸️'), h('span', null, 'In History or Settings, pause from the top bar. Tracking resumes when you return.')),
    'documentPictureInPicture' in window && h('li', null, h('span', { class: 'howto-emoji' }, '🪟'), h('span', null, 'Mini timer (the ↗ button, or ☰ in a small window): a tiny window that stays on top of other apps.')),
    h('li', null, h('span', { class: 'swatch swatch-red', 'aria-hidden': 'true' }), h('span', null, h('strong', null, 'Red card'), ': expires soon (moves to the top).')),
    h('li', null, h('span', { class: 'swatch swatch-yellow', 'aria-hidden': 'true' }), h('span', null, h('strong', null, 'Yellow card'), ': 70% of its max hours used.')),
    h('li', null, h('span', { class: 'howto-emoji' }, '💾'), h('span', null, 'Your data lives only in this browser. Export a backup in Settings now and then.')));
}

// "?" button: hover (mouse) or tap (touch/keyboard) shows a short how-to.
export function helpButton() {
  const pop = h('div', { class: 'help-pop', role: 'dialog', 'aria-label': 'How to use TimeTracker', hidden: true },
    h('p', { class: 'help-title' }, '👋 How to use TimeTracker'),
    howToSteps(),
    h('p', { class: 'help-sub' }, 'Good to know'),
    moreTips());
  const btn = h('button', { type: 'button', class: 'icon-btn help-btn', 'aria-label': 'How to use', 'aria-expanded': 'false' }, '?');
  const wrap = h('span', { class: 'help-wrap' }, btn, pop);
  let pinned = false, hideTimer = null;
  const show = () => { clearTimeout(hideTimer); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => pop.classList.add('show')); };
  const hide = () => { pop.classList.remove('show'); btn.setAttribute('aria-expanded', 'false'); hideTimer = setTimeout(() => { pop.hidden = true; }, 150); pinned = false; };
  wrap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
  wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) hideTimer = setTimeout(hide, 200); });
  btn.addEventListener('click', () => { if (pinned) hide(); else { pinned = true; show(); } });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target) && !pop.hidden) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) hide(); });
  return wrap;
}
