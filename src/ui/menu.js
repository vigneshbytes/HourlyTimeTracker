import { h, svgIcon } from './dom.js';

let openMenuEl = null;

export function closeMenu() {
  if (!openMenuEl) return;
  const el = openMenuEl;
  openMenuEl = null;
  el.classList.remove('show');
  el._cleanup?.();
  setTimeout(() => el.remove(), 160);
}

// items: [{ label, icon, onClick, danger }]
// asSheet: bottom sheet (touch) instead of an anchored dropdown (mouse).
export function openMenu({ anchor, items, title, asSheet }) {
  closeMenu();
  const list = h('div', { class: 'menu-items', role: 'menu' },
    items.map((it) => h('button', {
      class: `menu-item${it.danger ? ' danger' : ''}`, type: 'button', role: 'menuitem',
      onclick: (e) => { e.stopPropagation(); closeMenu(); it.onClick(); },
    }, it.icon && svgIcon(it.icon, 18), h('span', null, it.label))));

  let el;
  if (asSheet) {
    el = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === el) closeMenu(); } },
      h('div', { class: 'sheet' }, h('div', { class: 'sheet-handle' }), title && h('div', { class: 'sheet-title' }, title), list));
  } else {
    el = h('div', { class: 'menu' }, list);
  }
  document.body.append(el);

  if (!asSheet) {
    const r = anchor.getBoundingClientRect();
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let top = r.bottom + 4;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    const left = Math.min(Math.max(8, r.right - mw), innerWidth - mw - 8);
    Object.assign(el.style, { top: `${top}px`, left: `${left}px` });
  }

  const onDown = (e) => { if (!el.contains(e.target) && e.target !== anchor && !anchor?.contains(e.target)) closeMenu(); };
  const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
  const onScroll = () => { if (!asSheet) closeMenu(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closeMenu);
  });
  el._cleanup = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', closeMenu);
  };
  openMenuEl = el;
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('.menu-item')?.focus({ preventScroll: true });
}

// Long-press (touch/pen only) helper. Calls onLongPress(event) after `ms`.
// Returns a function that tells whether the last press was a long press (to swallow the click).
export function attachLongPress(el, onLongPress, ms = 450) {
  let timer = null, startX = 0, startY = 0, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    if (e.pointerType === 'mouse') return;
    startX = e.clientX; startY = e.clientY;
    cancel();
    el.classList.add('pressing');
    timer = setTimeout(() => {
      fired = true;
      el.classList.remove('pressing');
      navigator.vibrate?.(12);
      swallowNextClick();
      onLongPress(e);
    }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) { cancel(); el.classList.remove('pressing'); }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { cancel(); el.classList.remove('pressing'); });
  // Android also fires contextmenu on long-press; we handle it ourselves.
  el.addEventListener('contextmenu', (e) => { if (fired || timer) e.preventDefault(); });
  return () => { const f = fired; fired = false; return f; };
}

// After a long-press the browser still fires a click when the finger lifts.
// Swallow it so it neither starts a timer nor closes the menu that just opened.
function swallowNextClick() {
  const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); cleanup(); };
  const cleanup = () => { document.removeEventListener('click', stop, true); clearTimeout(t); };
  document.addEventListener('click', stop, true);
  const t = setTimeout(cleanup, 1500);
}
