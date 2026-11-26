// Detects the app being open in more than one window/tab of this browser.
// The newest window asks whether to close the others. Windows that cannot
// close themselves (browsers only allow scripts to close windows they opened)
// show an "inactive" screen instead. If the user keeps them, all windows stay
// in sync automatically (the database pushes changes to every window).
import { h } from './dom.js';
import { confirmDialog } from './dialogs.js';

export function setupInstances() {
  if (!('BroadcastChannel' in window)) return;
  const id = crypto.randomUUID?.() ?? String(Math.random());
  const ch = new BroadcastChannel('htt-instances');
  const others = new Set();
  let overlay = null;
  let asked = false;

  ch.onmessage = async ({ data }) => {
    if (!data || data.id === id) return;
    if (data.type === 'hello') { others.add(data.id); ch.postMessage({ type: 'here', id }); }
    else if (data.type === 'here') { others.add(data.id); }
    else if (data.type === 'bye') { others.delete(data.id); }
    else if (data.type === 'close-others') { others.add(data.id); retire(); }
  };
  addEventListener('pagehide', () => ch.postMessage({ type: 'bye', id }));

  function retire() {
    window.close();
    setTimeout(() => {
      if (overlay) return;
      overlay = h('div', { class: 'inactive-overlay' },
        h('div', { class: 'inactive-card' },
          h('h2', null, 'Open in another window'),
          h('p', null, 'TimeTracker is being used in another window. You can close this one.'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: takeOver }, 'Use this window instead')));
      document.body.append(overlay);
    }, 300);
  }

  function takeOver() {
    overlay?.remove();
    overlay = null;
    ch.postMessage({ type: 'close-others', id });
  }

  ch.postMessage({ type: 'hello', id });
  setTimeout(async () => {
    if (!others.size || asked) return;
    asked = true;
    const n = others.size;
    const close = await confirmDialog({
      title: 'Already open elsewhere',
      message: `TimeTracker is also open in ${n} other window${n > 1 ? 's' : ''} or tab${n > 1 ? 's' : ''}. Close ${n > 1 ? 'them' : 'it'} and keep using this one? If you choose "Keep all", every window stays in sync.`,
      confirmText: 'Close others',
      cancelText: 'Keep all',
    });
    if (close) ch.postMessage({ type: 'close-others', id });
  }, 500);
}
