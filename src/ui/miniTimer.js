// Floating mini timer: a tiny always-on-top window (Document Picture-in-Picture).
// Browsers give installed apps a minimum window width (about 500px in Chromium
// browsers); this window has no such limit and floats above other apps.
// Supported in Chromium-based browsers (Chrome, Edge, Vivaldi, Opera…); the
// button is hidden where it isn't.
import { fmtClock, fmtDuration } from '../logic/time.js';
import { sessionDuration } from '../logic/tasks.js';

export const miniSupported = () => 'documentPictureInPicture' in window;

const CSS = `
:root { color-scheme: only light; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #fff !important; color: #1f2937; filter: none !important;
  font: 14px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
body { container-type: size; }
.mini { height: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 10px; overflow: hidden; }
.mini.running { background: linear-gradient(180deg, #f3f8ff, #fff); }
.info { flex: 1; min-width: 0; display: grid; gap: 1px; }
.name { font-weight: 650; font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #374151; }
.big { font-weight: 750; font-size: clamp(1rem, min(28cqh, 13cqw), 3rem); font-variant-numeric: tabular-nums; letter-spacing: -.01em; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.dot { width: .45em; height: .45em; border-radius: 50%; background: #16a34a; flex: none; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.sub { font-size: .75rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button { font: inherit; border: 0; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; padding: 8px 12px; flex: none; transition: transform .12s, background .15s; }
button:active { transform: scale(.96); }
.stop { background: #c62828; color: #fff; }
.stop:hover { background: #a91f1f; }
.go { background: #e8f0fe; color: #1a56db; max-width: 55%; }
.go span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.go:hover { background: #d7e5fd; }
svg { flex: none; }
/* Very narrow: icon-only buttons. Very short: hide the second line. */
@container (max-width: 210px) { button .lbl { display: none; } button { padding: 8px; } .go { max-width: none; } }
@container (max-height: 64px) { .name, .sub { display: none; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } button { transition: none; } }
`;

export function createMiniTimer(app, { onResume } = {}) {
  let win = null;
  let root = null;
  let key = '';

  async function open() {
    if (win) { win.focus?.(); return; }
    win = await window.documentPictureInPicture.requestWindow({ width: 300, height: 84 });
    const d = win.document;
    d.title = 'TimeTracker';
    const meta = d.createElement('meta'); meta.name = 'color-scheme'; meta.content = 'only light'; d.head.append(meta);
    const style = d.createElement('style'); style.textContent = CSS; d.head.append(style);
    root = d.createElement('div'); root.className = 'mini';
    d.body.append(root);
    key = '';
    win.addEventListener('pagehide', () => { win = null; root = null; app.onMiniChange?.(false); });
    app.onMiniChange?.(true);
    tick();
  }

  function close() { win?.close(); }

  function el(tag, cls, ...kids) {
    const e = win.document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of kids) if (k != null && k !== false) e.append(k);
    return e;
  }
  function icon(path) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = win.document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', 16); svg.setAttribute('height', 16);
    const p = win.document.createElementNS(ns, 'path'); p.setAttribute('d', path); p.setAttribute('fill', 'currentColor');
    svg.append(p); return svg;
  }

  // Builds the layout only when the state changes; the clock text updates every second.
  function tick() {
    if (!win || !root) return;
    const running = app.running();
    const paused = !running && app.data.paused;
    const task = (id) => app.data.tasks.find((t) => t.id === id);
    if (running) {
      const t = task(running.taskId);
      const k = `run:${running.id}:${t?.name}`;
      if (k !== key) {
        key = k;
        root.className = 'mini running';
        const stop = el('button', 'stop', icon('M7 7h10v10H7z'), el('span', 'lbl', 'Stop'));
        stop.title = `Stop ${t?.name ?? ''}`;
        stop.onclick = () => app.actions.stop();
        root.replaceChildren(el('div', 'info', el('div', 'name', t?.name ?? ''), el('div', 'big', el('i', 'dot'), el('span', 'clock'))), stop);
      }
      root.querySelector('.clock').textContent = fmtClock(sessionDuration(running));
      win.document.title = `${fmtClock(sessionDuration(running))} · ${t?.name ?? ''}`;
      return;
    }
    const now = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const today = fmtDuration(app.overview?.todayMs ?? 0);
    if (paused) {
      const t = task(paused.taskId);
      const k = `paused:${paused.taskId}:${t?.name}`;
      if (k !== key) {
        key = k;
        root.className = 'mini';
        const go = el('button', 'go', icon('M8 5l11 7-11 7z'), el('span', 'lbl', 'Resume'));
        go.title = `Resume ${t?.name ?? ''}`;
        go.onclick = () => onResume?.();
        root.replaceChildren(el('div', 'info', el('div', 'name', `Paused · ${t?.name ?? ''}`), el('div', 'big', el('span', 'clock'))), go);
      }
    } else {
      // Idle: the time, today's total, and one tap to restart the most recent task.
      const last = app.data.tasks.filter((t) => t.status !== 'archived').sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))[0];
      const k = `idle:${last?.id}:${last?.name}`;
      if (k !== key) {
        key = k;
        root.className = 'mini';
        const kids = [el('div', 'info', el('div', 'big', el('span', 'clock')), el('div', 'sub today'))];
        if (last) {
          const go = el('button', 'go', icon('M8 5l11 7-11 7z'), el('span', 'lbl', last.name));
          go.title = `Start ${last.name}`;
          go.onclick = () => app.actions.activate(last.id);
          kids.push(go);
        }
        root.replaceChildren(...kids);
      }
      root.querySelector('.today').textContent = `Today ${today}`;
    }
    root.querySelector('.clock').textContent = time;
    win.document.title = 'TimeTracker';
  }

  return { open, close, tick, get isOpen() { return !!win; } };
}
