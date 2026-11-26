// Floating mini timer: a small always-on-top window (Document Picture-in-Picture)
// that packs the home view: the running task as the biggest card (click it to
// stop), a scrollable grid of tasks (2 rows visible at the smallest size),
// search with full keyboard navigation, and a Home button back to the full app.
// Browsers give installed apps a minimum window width (about 500px in Chromium
// browsers); this window has no such limit and floats above other apps.
// Supported in Chromium-based browsers on a computer; the button is hidden elsewhere.
import { fmtClock, fmtDuration } from '../logic/time.js';
import { sessionDuration, sortMainList } from '../logic/tasks.js';

export const miniSupported = () => 'documentPictureInPicture' in window;

const ICON = {
  stop: 'M7 7h10v10H7z',
  play: 'M8 5l11 7-11 7z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  home: 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
  close: 'M18 6 6 18M6 6l12 12',
};

const STYLES = `
:root { color-scheme: only light; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #f4f6f9 !important; color: #1f2937; filter: none !important;
  font: 12px/1.25 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
body { display: flex; flex-direction: column; gap: 6px; padding: 6px; overflow: hidden; }
button { font: inherit; color: inherit; cursor: pointer; }
:focus-visible { outline: 2px solid #1a56db; outline-offset: 1px; }

/* Toolbar */
.bar { display: flex; align-items: center; gap: 4px; flex: none; min-height: 26px; }
.bar .when { flex: 1; min-width: 0; font-weight: 650; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.ibtn { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #dfe4ea; border-radius: 8px; background: #fff; color: #4b5563; padding: 0; transition: background .15s, color .15s, border-color .15s; }
.ibtn:hover, .ibtn[aria-pressed=true] { color: #1a56db; border-color: #b9cdf5; background: #eaf1fe; }
.search { flex: 1; min-width: 0; height: 26px; border: 1px solid #b9cdf5; border-radius: 8px; padding: 0 8px; font: inherit; background: #fff; color: #1f2937; }
.search::placeholder { color: #8a94a3; }

/* Main card: the running task (whole card = Stop), or the clock when idle */
.card { flex: none; width: 100%; border-radius: 12px; border: 2px solid #1a56db; background: linear-gradient(180deg, #f3f8ff, #fff); padding: 8px 10px;
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 10px; text-align: left; transition: transform .12s, border-color .15s, background .15s; }
.card .name { grid-column: 1 / -1; font-weight: 650; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #374151; }
.card .big { font-weight: 750; font-size: clamp(22px, 13vw, 54px); line-height: 1.05; font-variant-numeric: tabular-nums; letter-spacing: -.02em; display: flex; align-items: center; gap: 6px; white-space: nowrap; min-width: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; flex: none; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.card .act { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 9px; font-weight: 700; color: #fff; background: #c62828; white-space: nowrap; }
.card.running:hover { border-color: #c62828; }
.card.running:hover .act { background: #a91f1f; }
.card:active { transform: scale(.985); }
.card.idle { border: 1.5px dashed #c9d3df; background: #fbfcfe; cursor: default; }
.card.idle:active { transform: none; }
.card.idle .big { font-size: clamp(20px, 10vw, 40px); }
.card.idle .sub { color: #6b7280; font-weight: 600; white-space: nowrap; }
.card.paused { border-color: #f0d58a; background: #fffaf0; }
.card.paused .act { background: #16a34a; }

/* Task grid: two rows visible at the smallest size, scroll for more */
.grid-wrap { flex: 1; min-height: 76px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; border-radius: 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(120px, calc(50% - 2px)), 1fr)); grid-auto-rows: 36px; gap: 4px; }
.tile { display: grid; align-content: center; gap: 1px; min-width: 0; padding: 3px 8px; border: 1px solid #e2e7ee; border-radius: 8px; background: #fff; text-align: left; transition: border-color .15s, background .15s, transform .1s; }
.tile:hover, .tile.sel { border-color: #1a56db; background: #f3f8ff; }
.tile:active { transform: scale(.97); }
.tile .t1 { font-weight: 650; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .t2 { font-size: 10px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.tile.red { border-left: 3px solid #d93025; }
.tile.yellow { border-left: 3px solid #e0a800; }
.tile.on { border-color: #16a34a; background: #effaf2; }
.empty { color: #6b7280; padding: 8px 2px; font-size: 11px; }

/* Confirm / undo strip */
.strip { flex: none; display: flex; align-items: center; gap: 6px; background: #1f2937; color: #fff; border-radius: 9px; padding: 4px 4px 4px 8px; font-size: 11px; }
.strip span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.strip button { border: 0; border-radius: 7px; padding: 4px 8px; font-weight: 700; background: none; color: #8ab4ff; }
.strip button.primary { background: #1a56db; color: #fff; }
.strip[hidden] { display: none; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

export function createMiniTimer(app, { onResume } = {}) {
  let win = null;
  let d = null;
  const ui = {};
  let query = '';
  let searchOpen = false;
  let cardKey = '';
  let gridKey = '';
  let stripTimer = null;
  let selIndex = 0; // keyboard selection while searching

  // ── tiny DOM helpers bound to the mini window's document ──
  function el(tag, props, ...kids) {
    const e = d.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null && c !== false) e.append(c);
    return e;
  }
  function icon(name, size = 14) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = d.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true');
    const p = d.createElementNS(ns, 'path'); p.setAttribute('d', ICON[name]);
    if (name === 'stop' || name === 'play') p.setAttribute('fill', 'currentColor');
    else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    svg.append(p); return svg;
  }
  const taskName = (id) => app.data.tasks.find((t) => t.id === id)?.name ?? 'task';

  async function open() {
    if (win) { win.focus?.(); return; }
    win = await window.documentPictureInPicture.requestWindow({ width: 300, height: 250 });
    d = win.document;
    d.title = 'TimeTracker';
    d.head.append(el('meta', { name: 'color-scheme', content: 'only light' }), el('style', {}, STYLES));
    build();
    cardKey = gridKey = '';
    win.addEventListener('pagehide', () => { win = null; d = null; clearTimeout(stripTimer); app.onMiniChange?.(false); });
    app.onMiniChange?.(true);
    tick();
  }

  function close() { win?.close(); }

  function build() {
    ui.when = el('div', { class: 'when' });
    ui.search = el('input', { class: 'search', type: 'search', placeholder: 'Search tasks…', 'aria-label': 'Search tasks', hidden: true, autocomplete: 'off' });
    ui.searchBtn = el('button', { class: 'ibtn', type: 'button', title: 'Search tasks (/)', 'aria-label': 'Search tasks', 'aria-pressed': 'false' }, icon('search'));
    ui.homeBtn = el('button', { class: 'ibtn', type: 'button', title: 'Open the full app', 'aria-label': 'Open the full app' }, icon('home'));
    ui.card = el('button', { class: 'card idle', type: 'button' });
    ui.strip = el('div', { class: 'strip', role: 'status', hidden: true });
    ui.grid = el('div', { class: 'grid', role: 'grid', 'aria-label': 'Tasks' });
    ui.gridWrap = el('div', { class: 'grid-wrap' }, ui.grid);
    d.body.replaceChildren(el('div', { class: 'bar' }, ui.when, ui.search, ui.searchBtn, ui.homeBtn), ui.card, ui.strip, ui.gridWrap);

    ui.searchBtn.addEventListener('click', () => (searchOpen ? closeSearch() : openSearch()));
    ui.homeBtn.addEventListener('click', goHome);
    ui.card.addEventListener('click', onCardClick);
    ui.search.addEventListener('input', () => { query = ui.search.value; selIndex = 0; renderGrid(true); });
    ui.search.addEventListener('keydown', onSearchKey);
    ui.grid.addEventListener('keydown', onGridKey);
    d.addEventListener('keydown', (e) => {
      if (e.target === ui.search) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) { e.preventDefault(); openSearch(); }
      else if (e.key === 'Escape' && !ui.strip.hidden) hideStrip();
    });
  }

  // ── Home: bring the full app forward on the task list ──
  function goHome() {
    app.navigate('#/');
    try { window.focus(); } catch { /* some browsers only allow the built-in "back to tab" button */ }
  }

  // ── Main card ──
  async function onCardClick() {
    const running = app.running();
    if (running) {
      const name = taskName(running.taskId);
      const stopped = await app.repo.stopRunning();
      if (!stopped) return;
      const msg = stopped.dropped ? `Stopped ${name} (under 5 s, not saved)` : `Stopped ${name} · ${fmtDuration(stopped.session.end - stopped.session.start)}`;
      showStrip(msg, 'Undo', () => app.repo.undoStop(stopped));
    } else if (app.data.paused) {
      onResume?.();
    }
  }

  function renderCard() {
    const running = app.running();
    const paused = !running && app.data.paused;
    const k = running ? `run:${running.id}:${taskName(running.taskId)}` : paused ? `paused:${paused.taskId}:${taskName(paused.taskId)}` : 'idle';
    if (k !== cardKey) {
      cardKey = k;
      if (running) {
        const name = taskName(running.taskId);
        ui.card.className = 'card running';
        ui.card.disabled = false;
        ui.card.title = `Click to stop ${name}`;
        ui.card.setAttribute('aria-label', `Stop ${name}`);
        ui.card.replaceChildren(el('span', { class: 'name' }, name),
          el('span', { class: 'big' }, el('i', { class: 'dot' }), el('span', { class: 'clock' })),
          el('span', { class: 'act' }, icon('stop', 12), 'Stop'));
      } else if (paused) {
        const name = taskName(paused.taskId);
        ui.card.className = 'card paused';
        ui.card.disabled = false;
        ui.card.title = `Click to resume ${name}`;
        ui.card.setAttribute('aria-label', `Resume ${name}`);
        ui.card.replaceChildren(el('span', { class: 'name' }, `Paused · ${name}`),
          el('span', { class: 'big' }, el('span', { class: 'clock' }, 'Paused')),
          el('span', { class: 'act' }, icon('play', 12), 'Resume'));
      } else {
        ui.card.className = 'card idle';
        ui.card.disabled = true;
        ui.card.title = '';
        ui.card.setAttribute('aria-label', 'Nothing running');
        ui.card.replaceChildren(el('span', { class: 'big' }, el('span', { class: 'clock' })), el('span', { class: 'sub today' }));
      }
    }
    const now = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (running) {
      const clock = fmtClock(sessionDuration(running));
      ui.card.querySelector('.clock').textContent = clock;
      d.title = `${clock} · ${taskName(running.taskId)}`;
    } else {
      if (!paused) {
        ui.card.querySelector('.clock').textContent = time;
        ui.card.querySelector('.today').textContent = `Today ${fmtDuration(app.overview?.todayMs ?? 0)}`;
      }
      d.title = 'TimeTracker';
    }
    ui.when.textContent = running || paused ? `${time} · Today ${fmtDuration(app.overview?.todayMs ?? 0)}` : 'Pick a task to start';
  }

  // ── Task grid ──
  function visibleTasks() {
    const running = app.running();
    const active = app.data.tasks.filter((t) => t.status === 'active' && t.id !== running?.taskId);
    const sorted = sortMainList(active, app.stats);
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.name.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q));
  }

  function renderGrid(force = false) {
    const tasks = visibleTasks();
    const k = `${query}|${tasks.map((t) => `${t.id}:${t.name}:${app.stats.get(t.id)?.color}:${Math.floor((app.stats.get(t.id)?.totalMs || 0) / 60000)}`).join(',')}`;
    if (!force && k === gridKey) return;
    const hadFocus = ui.grid.contains(d.activeElement) ? d.activeElement.dataset.id : null;
    gridKey = k;
    if (selIndex >= tasks.length) selIndex = Math.max(0, tasks.length - 1);
    ui.grid.replaceChildren(...(tasks.length ? tasks.map((t, i) => {
      const st = app.stats.get(t.id) || {};
      const tile = el('button', {
        class: `tile${st.color ? ` ${st.color}` : ''}${searchOpen && query && i === selIndex ? ' sel' : ''}`,
        type: 'button', role: 'gridcell', 'data-id': t.id, tabindex: i === 0 ? '0' : '-1',
        title: `Start ${t.name}`,
      }, el('span', { class: 't1' }, t.name), el('span', { class: 't2' }, `${fmtDuration(st.totalMs || 0)}${st.color === 'red' ? ' · expiring' : st.color === 'yellow' ? ' · near limit' : ''}`));
      tile.addEventListener('click', () => startTask(t.id));
      return tile;
    }) : [el('div', { class: 'empty' }, query ? 'No tasks match.' : 'No other tasks.')]));
    if (hadFocus) ui.grid.querySelector(`[data-id="${CSS.escape(hadFocus)}"]`)?.focus();
  }

  const tiles = () => [...ui.grid.querySelectorAll('.tile')];
  const columns = () => getComputedStyle(ui.grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;

  function focusTile(i) {
    const all = tiles();
    if (!all.length) return;
    const n = Math.max(0, Math.min(all.length - 1, i));
    all.forEach((t, j) => { t.tabIndex = j === n ? 0 : -1; });
    all[n].focus();
    all[n].scrollIntoView({ block: 'nearest' });
  }

  function onGridKey(e) {
    const all = tiles();
    const i = all.indexOf(d.activeElement);
    if (i < 0) return;
    const cols = columns();
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: all.length - 1 - i };
    if (e.key in moves) {
      e.preventDefault();
      if (e.key === 'ArrowUp' && i < cols && searchOpen) { ui.search.focus(); return; }
      focusTile(i + moves[e.key]);
    } else if (e.key === 'Escape' && searchOpen) { e.preventDefault(); closeSearch(); }
    else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing on the grid jumps into search.
      openSearch(); ui.search.value += e.key; query = ui.search.value; selIndex = 0; renderGrid(true); e.preventDefault();
    }
  }

  function onSearchKey(e) {
    const all = tiles();
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = all[selIndex];
      if (t) startTask(t.dataset.id);
    } else if (e.key === 'ArrowDown' && all.length) {
      e.preventDefault();
      focusTile(Math.min(selIndex, all.length - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (ui.search.value) { ui.search.value = ''; query = ''; selIndex = 0; renderGrid(true); } else closeSearch();
    }
  }

  function openSearch() {
    searchOpen = true;
    ui.search.hidden = false;
    ui.when.hidden = true;
    ui.searchBtn.setAttribute('aria-pressed', 'true');
    ui.searchBtn.replaceChildren(icon('close'));
    ui.searchBtn.title = 'Close search (Esc)';
    ui.search.focus();
    ui.search.select();
  }

  function closeSearch() {
    searchOpen = false;
    query = ''; ui.search.value = ''; selIndex = 0;
    ui.search.hidden = true;
    ui.when.hidden = false;
    ui.searchBtn.setAttribute('aria-pressed', 'false');
    ui.searchBtn.replaceChildren(icon('search'));
    ui.searchBtn.title = 'Search tasks (/)';
    renderGrid(true);
    ui.gridWrap.scrollTop = 0;
    focusTile(0);
  }

  // ── Starting / switching (confirmed inside the mini window) ──
  async function startTask(taskId) {
    const running = app.running();
    if (running?.taskId === taskId) return;
    const go = async () => {
      hideStrip();
      const info = await app.repo.startTask(taskId);
      if (searchOpen) closeSearch();
      showStrip(`Started ${taskName(taskId)}`, 'Undo', () => app.repo.undoStart(info));
    };
    if (running) {
      showStrip(`Switch to ${taskName(taskId)}?`, 'Switch', go, { primary: true, cancel: true, sticky: true });
      ui.strip.querySelector('.primary')?.focus();
    } else {
      await go();
    }
  }

  function showStrip(text, actionLabel, onAction, { primary = false, cancel = false, sticky = false } = {}) {
    clearTimeout(stripTimer);
    const act = el('button', { type: 'button', class: primary ? 'primary' : '' }, actionLabel);
    act.addEventListener('click', async () => { hideStrip(); await onAction(); });
    const kids = [el('span', {}, text), act];
    if (cancel) {
      const c = el('button', { type: 'button' }, 'Cancel');
      c.addEventListener('click', hideStrip);
      kids.push(c);
    }
    ui.strip.replaceChildren(...kids);
    ui.strip.hidden = false;
    if (!sticky) stripTimer = setTimeout(hideStrip, 5000);
  }
  function hideStrip() { clearTimeout(stripTimer); if (ui.strip) ui.strip.hidden = true; }

  function tick() {
    if (!win || !d) return;
    renderCard();
    renderGrid();
  }

  return { open, close, tick, get isOpen() { return !!win; } };
}
