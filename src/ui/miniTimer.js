// Floating mini timer: a small always-on-top window (Document Picture-in-Picture)
// with the home view packed inside.
//
// Architecture: this file is only a UI wrapper. Every action (start, stop,
// switch, new task, edit, add session, archive, resume, create-only mode, undo)
// runs through the same createActions() logic as the full app, with this
// window's own inline forms / confirm strip plugged in as the "ui". Sorting,
// colours, totals and stats come from the same app.stats / app.overview, and
// form rules from logic/forms.js. Change the logic once and both follow.
//
// Size: Chromium lets this window shrink to about 240×52, too small to use.
// MIN_W × MIN_H below is the smallest size that fits everything at legible
// text sizes (11px task names, two rows of tasks); below it the window is
// resized back up where the browser allows, and otherwise scrolls.
import { fmtClock, fmtDuration, shortDate, toInputDate, toInputTime } from '../logic/time.js';
import { sessionDuration, sortMainList } from '../logic/tasks.js';
import { checkTask, checkManualSession } from '../logic/forms.js';
import { createActions } from './actions.js';

export const miniSupported = () => 'documentPictureInPicture' in window;

// toolbar 22 + card 52 + two task rows (2×29 + 3) + gaps (3×4) + padding (2×4)
export const MIN_W = 240;
export const MIN_H = 156;

const ICON = {
  stop: 'M7 7h10v10H7z',
  play: 'M8 5l11 7-11 7z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  home: 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
  close: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};

const STYLES = `
:root { color-scheme: only light; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #f4f6f9 !important; color: #1f2937; filter: none !important;
  font: 11px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
body { display: flex; flex-direction: column; gap: 4px; padding: 4px; overflow: hidden; position: relative; min-width: ${MIN_W - 8}px; }
body.cramped { overflow-y: auto; }
body.cramped > * { flex-shrink: 0; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
[hidden] { display: none !important; }
:focus-visible { outline: 2px solid #1a56db; outline-offset: 1px; }

/* Toolbar */
.bar { display: flex; align-items: center; gap: 3px; flex: none; height: 22px; }
.when { flex: 1; min-width: 0; font-weight: 650; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; padding-left: 2px; }
.chip { flex: none; height: 20px; display: inline-flex; align-items: center; gap: 2px; padding: 0 6px; border-radius: 99px; font-weight: 700; font-size: 10.5px; white-space: nowrap; border: 1px solid transparent; background: none; }
.streak { background: #fff3e6; color: #9a4a00; border-color: #ffd9b0; cursor: default; }
.co { background: #fff7e0; color: #5c4400; border-color: #f0d58a; }
.co:hover { background: #ffefc2; }
.ibtn { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #dfe4ea; border-radius: 7px; background: #fff; color: #4b5563; padding: 0; transition: background .15s, color .15s, border-color .15s; }
.ibtn:hover, .ibtn[aria-pressed=true] { color: #1a56db; border-color: #b9cdf5; background: #eaf1fe; }
.ibtn.add { color: #fff; background: #1a56db; border-color: #1a56db; }
.ibtn.add:hover { background: #1747b8; color: #fff; }
.search { flex: 1; min-width: 0; height: 22px; border: 1px solid #b9cdf5; border-radius: 7px; padding: 0 6px; background: #fff; }

/* Main card: running task (whole card = Stop), paused (Resume), or idle clock + stats */
.card { position: relative; flex: none; width: 100%; min-height: 52px; border-radius: 10px; border: 1.5px solid #1a56db; background: linear-gradient(180deg, #f3f8ff, #fff);
  padding: 4px 8px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0 8px; text-align: left; transition: transform .12s, border-color .15s; }
.card .top { grid-column: 1 / -1; display: flex; gap: 6px; min-width: 0; font-size: 11px; line-height: 14px; }
.card .name { font-weight: 650; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.card .meta { color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
.card .big { font-weight: 750; font-size: clamp(20px, min(11vw, 16vh), 56px); line-height: 1.1; font-variant-numeric: tabular-nums; letter-spacing: -.02em; display: flex; align-items: center; gap: 5px; white-space: nowrap; min-width: 0; overflow: hidden; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; flex: none; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.card .act { display: inline-flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 8px; font-weight: 700; color: #fff; background: #c62828; white-space: nowrap; }
.card.running:hover { border-color: #c62828; }
.card.running:hover .act { background: #a91f1f; }
.card:active { transform: scale(.985); }
.card.paused { border-color: #f0d58a; background: #fffaf0; }
.card.paused .act { background: #16a34a; }
.card.idle { border: 1.5px dashed #c9d3df; background: #fbfcfe; cursor: default; }
.card.idle:active { transform: none; }
.card.idle .big { font-size: clamp(18px, min(9vw, 14vh), 44px); }
.card .stats { grid-column: 1 / -1; color: #4b5563; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.card .stats b { color: #1f2937; }
.bar-progress { position: absolute; left: 8px; right: 8px; bottom: 3px; height: 2px; border-radius: 2px; background: #e5e9ef; overflow: hidden; }
.bar-progress i { display: block; height: 100%; background: #1a56db; }
.bar-progress.yellow i { background: #e0a800; } .bar-progress.over i { background: #d93025; }

/* Task grid: two rows always visible, scroll for more; grows with the window */
.area { flex: 1; min-height: 61px; position: relative; display: flex; flex-direction: column; }
.grid-wrap { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(120px, calc(50% - 2px)), 1fr)); grid-auto-rows: clamp(29px, 10vh, 40px); gap: 3px; }
.tile { position: relative; display: grid; align-content: center; gap: 1px; min-width: 0; padding: 2px 6px; border: 1px solid #e2e7ee; border-radius: 7px; background: #fff; text-align: left; overflow: hidden; transition: border-color .15s, background .15s, transform .1s; }
.tile:hover, .tile.sel { border-color: #1a56db; background: #f3f8ff; }
.tile:active { transform: scale(.97); }
.tile .t1 { font-weight: 650; font-size: clamp(11px, 3.4vw, 13px); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; }
.tile .t2 { font-size: clamp(10px, 3vw, 12px); line-height: 1.2; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.tile .t2 .bad { color: #b42318; font-weight: 600; }
.tile.red { border-left: 3px solid #d93025; }
.tile.yellow { border-left: 3px solid #e0a800; }
.tile .pg { position: absolute; left: 0; bottom: 0; height: 2px; background: #1a56db; opacity: .55; }
.tile.yellow .pg { background: #e0a800; opacity: 1; } .tile.over .pg { background: #d93025; opacity: 1; }
.tile .dots { position: absolute; top: 1px; right: 1px; width: 18px; height: 16px; display: grid; place-items: center; border: 0; border-radius: 5px; background: transparent; color: #6b7280; padding: 0; opacity: 0; transition: opacity .15s; }
.tile:hover .dots, .tile:focus-within .dots, .tile:focus .dots { opacity: 1; }
.tile .dots:hover { background: #e5ecf7; color: #1a56db; }
.empty { color: #6b7280; padding: 6px 2px; }

/* Panels (forms, task options) take the space below the toolbar */
.panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; background: #fff; border: 1px solid #dfe4ea; border-radius: 10px; padding: 5px 6px; overflow-y: auto; }
.panel h2 { margin: 0; font-size: 11.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row { display: flex; gap: 4px; }
.row > * { flex: 1; min-width: 0; }
.inp { height: 24px; border: 1px solid #cfd6df; border-radius: 6px; padding: 0 6px; background: #fff; width: 100%; }
.inp:focus { border-color: #1a56db; outline: none; box-shadow: 0 0 0 2px #d7e5fd; }
.inp.err { border-color: #d93025; }
.foot { display: flex; align-items: center; gap: 4px; margin-top: auto; }
.hint { flex: 1; min-width: 0; color: #6b7280; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hint.err { color: #b42318; }
.btn { height: 24px; border: 1px solid #cfd6df; border-radius: 7px; padding: 0 10px; background: #fff; font-weight: 650; flex: none; }
.btn.primary { background: #1a56db; border-color: #1a56db; color: #fff; }
.btn.primary:disabled { opacity: .45; cursor: default; }
.btn.danger { color: #b42318; }
.menu { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.menu .btn { width: 100%; text-align: left; padding: 0 8px; }

/* Feedback strip (undo / confirm / errors), over the bottom of the grid */
.strip { position: absolute; left: 4px; right: 4px; bottom: 4px; z-index: 5; display: flex; align-items: center; gap: 4px; background: #1f2937; color: #fff; border-radius: 8px; padding: 3px 3px 3px 8px; min-height: 26px; box-shadow: 0 4px 14px rgb(0 0 0 / .2); }
.strip span { flex: 1; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.2; }
.strip button { border: 0; border-radius: 6px; padding: 3px 7px; font-weight: 700; background: none; color: #8ab4ff; flex: none; }
.strip button.primary { background: #1a56db; color: #fff; }
.strip.subtle { background: #fff; color: #1f2937; border: 1px solid #dfe4ea; }
.strip.subtle button { color: #1a56db; }
.strip.error { background: #b42318; }
.strip.error button { color: #fff; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

export function createMiniTimer(app) {
  let win = null;
  let d = null;
  const ui = {};
  let query = '';
  let searchOpen = false;
  let panel = null; // { close(result) } while a form / menu is open
  let cardKey = '';
  let gridKey = '';
  let stripTimer = null;
  let stripResolve = null;
  let selIndex = 0;

  // ── DOM helpers bound to the mini window's document ──
  function el(tag, props, ...kids) {
    const e = d.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  function icon(name, size = 13) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = d.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true');
    const p = d.createElementNS(ns, 'path'); p.setAttribute('d', ICON[name]);
    if (name === 'stop' || name === 'play') p.setAttribute('fill', 'currentColor');
    else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', name === 'more' ? '3' : '2.2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    svg.append(p); return svg;
  }
  const taskById = (id) => app.data.tasks.find((t) => t.id === id);
  const taskName = (id) => taskById(id)?.name ?? 'task';

  // ── The mini window's "ui" for the shared actions ──
  const miniUi = {
    toast: (message, opts = {}) => showStrip(message, opts),
    errorToast: (e) => { console.error(e); showStrip(e?.message || String(e), { error: true, duration: 6000 }); },
    confirm: ({ short, message, title, confirmText = 'OK' }) => new Promise((resolve) => {
      showStrip(short || message || title, { action: confirmText, primary: true, cancel: true, sticky: true, onResolve: resolve });
      ui.strip.querySelector('.primary')?.focus();
    }),
    typeToConfirm: async () => false, // permanent deletion stays in the full app
    taskForm: (task) => taskPanel(task),
    manualLogForm: (task, session) => sessionPanel(task, session),
    timedSessionForm: async () => null,
    afterCreate: () => {},
  };
  let actions = null; // created on open(), once the database is ready

  async function open() {
    if (win) { win.focus?.(); return; }
    actions ??= createActions(app, miniUi);
    win = await window.documentPictureInPicture.requestWindow({ width: 300, height: MIN_H + 34 });
    d = win.document;
    d.title = 'TimeTracker';
    d.head.append(el('meta', { name: 'color-scheme', content: 'only light' }), el('style', {}, STYLES));
    build();
    cardKey = gridKey = '';
    win.addEventListener('resize', enforceMinSize);
    // Resizing needs a user gesture in most browsers, so also retry on the next click.
    d.addEventListener('pointerdown', enforceMinSize, true);
    win.addEventListener('pagehide', () => { win = null; d = null; panel = null; clearTimeout(stripTimer); app.onMiniChange?.(false); });
    app.onMiniChange?.(true);
    enforceMinSize();
    tick();
  }

  function close() { win?.close(); }

  // Keep at least MIN_W × MIN_H; if the browser refuses to resize, scroll instead.
  function enforceMinSize() {
    if (!win) return;
    const short = win.innerHeight < MIN_H;
    const narrow = win.innerWidth < MIN_W;
    d.body.classList.toggle('cramped', short || narrow);
    if (!short && !narrow) return;
    try {
      win.resizeTo(win.outerWidth + Math.max(0, MIN_W - win.innerWidth), win.outerHeight + Math.max(0, MIN_H - win.innerHeight));
    } catch { /* not allowed without a user gesture: scrolling keeps everything reachable */ }
  }

  function build() {
    ui.streak = el('span', { class: 'chip streak', role: 'img' });
    ui.when = el('div', { class: 'when' });
    ui.search = el('input', { class: 'search', type: 'search', placeholder: 'Search tasks…', 'aria-label': 'Search tasks', hidden: true, autocomplete: 'off' });
    ui.co = el('button', { class: 'chip co', type: 'button', hidden: true });
    ui.addBtn = el('button', { class: 'ibtn add', type: 'button', title: 'New task (N)', 'aria-label': 'New task' }, icon('plus'));
    ui.searchBtn = el('button', { class: 'ibtn', type: 'button', title: 'Search tasks (/)', 'aria-label': 'Search tasks', 'aria-pressed': 'false' }, icon('search'));
    ui.homeBtn = el('button', { class: 'ibtn', type: 'button', title: 'Open the full app', 'aria-label': 'Open the full app' }, icon('home'));
    ui.card = el('button', { class: 'card idle', type: 'button' });
    ui.grid = el('div', { class: 'grid', role: 'grid', 'aria-label': 'Tasks' });
    ui.gridWrap = el('div', { class: 'grid-wrap' }, ui.grid);
    ui.panel = el('div', { class: 'panel', hidden: true });
    ui.area = el('div', { class: 'area' }, ui.gridWrap);
    ui.strip = el('div', { class: 'strip', role: 'status', hidden: true });
    d.body.replaceChildren(el('div', { class: 'bar' }, ui.streak, ui.when, ui.search, ui.co, ui.addBtn, ui.searchBtn, ui.homeBtn), ui.card, ui.area, ui.panel, ui.strip);

    ui.addBtn.addEventListener('click', () => actions.newTask());
    ui.searchBtn.addEventListener('click', () => (searchOpen ? closeSearch() : openSearch()));
    ui.homeBtn.addEventListener('click', () => goHome('#/'));
    ui.co.addEventListener('click', () => actions.endCreateOnly());
    ui.card.addEventListener('click', onCardClick);
    ui.search.addEventListener('input', () => { query = ui.search.value; selIndex = 0; renderGrid(true); });
    ui.search.addEventListener('keydown', onSearchKey);
    ui.grid.addEventListener('keydown', onGridKey);
    d.addEventListener('keydown', onGlobalKey);
  }

  function onGlobalKey(e) {
    const typing = e.target.tagName === 'INPUT';
    if (e.key === 'Escape') {
      if (!ui.strip.hidden) { e.preventDefault(); resolveStrip(false); return; }
      if (panel) { e.preventDefault(); panel.close(null); return; }
      if (searchOpen && !typing) { e.preventDefault(); closeSearch(); }
      return;
    }
    if (typing || panel) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) { e.preventDefault(); openSearch(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); actions.newTask(); }
  }

  // ⌂ and "View history": show the full app on that page.
  function goHome(hash) {
    app.navigate(hash);
    try { window.focus(); } catch { /* some browsers only allow their own "back to tab" button */ }
  }

  // ── Main card ──
  function onCardClick() {
    if (app.running()) actions.stop();
    else if (app.data.paused) actions.resume();
  }

  function renderCard() {
    const running = app.running();
    const paused = !running && app.data.paused;
    const o = app.overview || {};
    const now = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const k = running ? `run:${running.id}:${taskName(running.taskId)}` : paused ? `paused:${paused.taskId}:${taskName(paused.taskId)}` : 'idle';
    if (k !== cardKey) {
      cardKey = k;
      if (running) {
        const name = taskName(running.taskId);
        ui.card.className = 'card running';
        ui.card.disabled = false;
        ui.card.title = `Click anywhere to stop ${name}`;
        ui.card.setAttribute('aria-label', `Stop ${name}`);
        ui.card.replaceChildren(el('span', { class: 'top' }, el('span', { class: 'name' }, name), el('span', { class: 'meta' })),
          el('span', { class: 'big' }, el('i', { class: 'dot' }), el('span', { class: 'clock' })),
          el('span', { class: 'act' }, icon('stop', 10), 'Stop'),
          el('span', { class: 'bar-progress', hidden: true }, el('i')));
      } else if (paused) {
        const name = taskName(paused.taskId);
        ui.card.className = 'card paused';
        ui.card.disabled = false;
        ui.card.title = `Click to resume ${name}`;
        ui.card.setAttribute('aria-label', `Resume ${name}`);
        ui.card.replaceChildren(el('span', { class: 'top' }, el('span', { class: 'name' }, `Paused · ${name}`)),
          el('span', { class: 'big' }, 'Paused'),
          el('span', { class: 'act' }, icon('play', 10), 'Resume'));
      } else {
        ui.card.className = 'card idle';
        ui.card.disabled = true;
        ui.card.title = '';
        ui.card.setAttribute('aria-label', 'Nothing running');
        ui.card.replaceChildren(el('span', { class: 'big clock' }), el('span'), el('span', { class: 'stats' }));
      }
    }
    if (running) {
      const st = app.stats.get(running.taskId);
      const clock = fmtClock(sessionDuration(running));
      ui.card.querySelector('.clock').textContent = clock;
      const total = st ? st.sessions.filter((s) => s.id !== running.id).reduce((a, s) => a + sessionDuration(s), 0) + sessionDuration(running) : 0;
      const task = taskById(running.taskId);
      ui.card.querySelector('.meta').textContent = `${fmtDuration(total)}${task?.maxHours ? ` / ${fmtDuration(task.maxHours * 3600000)}` : ''}`;
      const pg = ui.card.querySelector('.bar-progress');
      pg.hidden = !task?.maxHours;
      if (task?.maxHours) {
        const ratio = total / (task.maxHours * 3600000);
        pg.firstChild.style.width = `${Math.min(100, ratio * 100)}%`;
        pg.className = `bar-progress${ratio >= 1 ? ' over' : ratio >= (app.data.settings.yellowThreshold ?? 0.7) ? ' yellow' : ''}`;
      }
      d.title = `${clock} · ${taskName(running.taskId)}`;
    } else {
      if (!paused) {
        ui.card.querySelector('.clock').textContent = time;
        const stats = ui.card.querySelector('.stats');
        stats.replaceChildren('Today ', el('b', {}, fmtDuration(o.todayMs ?? 0)), ` · ${o.todaySessions ?? 0} ${o.todaySessions === 1 ? 'session' : 'sessions'} · avg `, el('b', {}, o.trackedDays ? fmtDuration(o.dailyAvgMs) : '–'));
      }
      d.title = 'TimeTracker';
    }
    // Toolbar: date when idle (the card shows the time), time + today while timing.
    ui.when.textContent = running || paused ? `${time} · ${fmtDuration(o.todayMs ?? 0)} today` : shortDate(now);
    ui.streak.hidden = !o.streak;
    ui.streak.textContent = `🔥${o.streak ?? 0}`;
    ui.streak.title = `${o.streak}-day streak`;
    const until = app.data.settings.createOnlyUntil || 0;
    ui.co.hidden = Date.now() >= until;
    if (!ui.co.hidden) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      ui.co.textContent = `⏳${mins}m`;
      ui.co.title = `Create-only mode: new tasks won't start a timer for ${mins} more min. Click to turn off.`;
    }
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
    const k = `${query}|${tasks.map((t) => { const st = app.stats.get(t.id) || {}; return `${t.id}:${t.name}:${st.color}:${st.overLimit}:${Math.floor((st.totalMs || 0) / 60000)}:${t.maxHours}`; }).join(',')}`;
    if (!force && k === gridKey) return;
    const focusedId = ui.grid.contains(d.activeElement) ? d.activeElement.closest('.tile')?.dataset.id : null;
    gridKey = k;
    if (selIndex >= tasks.length) selIndex = Math.max(0, tasks.length - 1);
    ui.grid.replaceChildren(...(tasks.length ? tasks.map((t, i) => tile(t, i)) : [el('div', { class: 'empty' },
      query ? 'No tasks match.' : app.data.tasks.some((t) => t.status === 'active') ? 'No other tasks.' : 'No tasks yet. Press + (or N) to add one.')]));
    if (focusedId) ui.grid.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  function tile(t, i) {
    const st = app.stats.get(t.id) || {};
    const flags = [];
    if (st.overLimit) flags.push(el('span', { class: 'bad' }, ' · over limit'));
    else if (st.expiring) flags.push(el('span', { class: 'bad' }, st.expired ? ' · expired' : ' · expiring'));
    else if (st.nearLimit) flags.push(' · near limit');
    const dots = el('button', { class: 'dots', type: 'button', tabindex: '-1', 'aria-label': `Options for ${t.name}`, title: 'Options' }, icon('more', 12));
    const b = el('div', {
      class: `tile${st.color ? ` ${st.color}` : ''}${st.overLimit ? ' over' : ''}${searchOpen && query && i === selIndex ? ' sel' : ''}`,
      role: 'gridcell', 'data-id': t.id, tabindex: i === 0 ? '0' : '-1',
      title: `Start ${t.name} · right-click or ⋯ for options`, 'aria-label': `Start ${t.name}`,
    }, el('span', { class: 't1' }, t.name), el('span', { class: 't2' }, fmtDuration(st.totalMs || 0), t.maxHours ? ` / ${fmtDuration(t.maxHours * 3600000)}` : '', ...flags), dots,
    t.maxHours ? el('i', { class: 'pg', style: `width:${Math.min(100, (st.ratio || 0) * 100)}%` }) : null);
    let pressTimer = null; let longPressed = false;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.dots')) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; optionsPanel(t.id); }, 550);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(pressTimer));
    b.addEventListener('click', (e) => {
      if (e.target.closest('.dots')) { e.stopPropagation(); optionsPanel(t.id); return; }
      if (longPressed) { longPressed = false; return; }
      startTask(t.id);
    });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); optionsPanel(t.id); });
    return b;
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
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: all.length - 1 - i, PageDown: cols * 2, PageUp: -cols * 2 };
    if (e.key in moves) {
      e.preventDefault();
      if ((e.key === 'ArrowUp' || e.key === 'PageUp') && i < cols && searchOpen) { ui.search.focus(); return; }
      focusTile(i + moves[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); startTask(all[i].dataset.id);
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault(); optionsPanel(all[i].dataset.id);
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !/^[/nN]$/.test(e.key)) {
      // Typing on the grid jumps into search.
      e.preventDefault(); openSearch(); ui.search.value += e.key; query = ui.search.value; selIndex = 0; renderGrid(true);
    }
  }

  function onSearchKey(e) {
    const all = tiles();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (all[selIndex]) startTask(all[selIndex].dataset.id);
    } else if (e.key === 'ArrowDown' && all.length) {
      e.preventDefault(); focusTile(Math.min(selIndex, all.length - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (ui.search.value) { ui.search.value = ''; query = ''; selIndex = 0; renderGrid(true); } else closeSearch();
    }
  }

  function openSearch() {
    if (panel) panel.close(null);
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

  async function startTask(taskId) {
    if (app.running()?.taskId === taskId) return;
    const result = await actions.activate(taskId); // same start / switch-confirm / undo logic as the full app
    if (result === 'started' && searchOpen) closeSearch();
  }

  // ── Panels: inline forms and the task options menu ──
  function openPanel(build) {
    if (panel) panel.close(null);
    return new Promise((resolve) => {
      const prevFocus = d.activeElement;
      const p = { close: (v) => { if (panel !== p) return; panel = null; ui.panel.hidden = true; ui.card.hidden = false; ui.area.hidden = false; ui.panel.replaceChildren(); resolve(v); prevFocus?.focus?.(); } };
      panel = p;
      hideStrip(true);
      ui.panel.replaceChildren(...build(p.close));
      ui.card.hidden = true; ui.area.hidden = true; ui.panel.hidden = false;
      (ui.panel.querySelector('[autofocus]') || ui.panel.querySelector('input, button'))?.focus();
    });
  }

  // New / edit task: same fields and rules as the full app's dialog.
  function taskPanel(task = null) {
    return openPanel((close) => {
      const name = el('input', { class: 'inp', placeholder: 'Task name', 'aria-label': 'Name', maxlength: '120', autofocus: true, value: task?.name ?? '' });
      const limit = el('input', { class: 'inp', placeholder: 'Max hours', 'aria-label': 'Max time in hours (optional)', inputmode: 'decimal', value: task?.maxHours ?? '' });
      const expiry = el('input', { class: 'inp', placeholder: 'Expires: days or date', 'aria-label': 'Expiry: days or a date (optional)', value: task?.expiresAt ? toInputDate(task.expiresAt) : '' });
      const notes = el('input', { class: 'inp', placeholder: 'Notes (optional)', 'aria-label': 'Notes', maxlength: '2000', value: task?.notes ?? '' });
      const hint = el('span', { class: 'hint' });
      const save = el('button', { class: 'btn primary', type: 'submit' }, task ? 'Save' : 'Create');
      const check = () => {
        const r = checkTask({ name: name.value, notes: notes.value, limit: limit.value, expiry: expiry.value });
        limit.classList.toggle('err', !!r.errors.limit);
        expiry.classList.toggle('err', !!r.errors.expiry);
        const focusHint = d.activeElement === expiry ? (r.errors.expiry || r.hints.expiry) : d.activeElement === limit ? (r.errors.limit || r.hints.limit) : (r.errors.limit || r.errors.expiry || '');
        hint.textContent = focusHint || (task ? '' : 'Enter to create');
        hint.classList.toggle('err', !!(r.errors.limit || r.errors.expiry));
        save.disabled = !r.ok;
        return r.value;
      };
      for (const i of [name, limit, expiry, notes]) { i.addEventListener('input', check); i.addEventListener('focus', check); }
      check();
      const form = el('form', { class: 'panel-form', style: 'display:contents', onsubmit: (e) => { e.preventDefault(); const v = check(); if (v) close(v); } },
        el('h2', {}, task ? `Edit · ${task.name}` : 'New task'),
        name, el('div', { class: 'row' }, limit, expiry), notes,
        el('div', { class: 'foot' }, hint, el('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancel'), save));
      return [form];
    });
  }

  // Add (or edit) a manual session: same rules as the full app's dialog.
  function sessionPanel(task, session = null) {
    return openPanel((close) => {
      const hours = el('input', { class: 'inp', placeholder: 'Hours, e.g. 1.5 or 1:30', 'aria-label': 'Hours (required)', inputmode: 'decimal', autofocus: true,
        value: session ? String(+(session.durationMs / 3600000).toFixed(4)) : '' });
      const date = el('input', { class: 'inp', type: 'date', 'aria-label': 'Start date (optional)', value: session?.dateProvided && session.start ? toInputDate(session.start) : '' });
      const time = el('input', { class: 'inp', type: 'time', 'aria-label': 'Start time (optional)', value: session?.timeProvided && session.start ? toInputTime(session.start) : '' });
      const hint = el('span', { class: 'hint' });
      const save = el('button', { class: 'btn primary', type: 'submit' }, session ? 'Save' : 'Add');
      const check = () => {
        const r = checkManualSession({ hours: hours.value, date: date.value, time: time.value });
        hours.classList.toggle('err', !!r.error);
        hint.textContent = r.error || r.hint || 'Date and time are optional';
        hint.classList.toggle('err', !!r.error);
        save.disabled = !r.ok;
        return r.value;
      };
      hours.addEventListener('input', check);
      check();
      return [el('form', { style: 'display:contents', onsubmit: (e) => { e.preventDefault(); const v = check(); if (v) close(v); } },
        el('h2', {}, `${session ? 'Edit session' : 'Add session'} · ${task.name}`),
        hours, el('div', { class: 'row' }, date, time),
        el('div', { class: 'foot' }, hint, el('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancel'), save))];
    });
  }

  // Task options: the same four as the full app's ⋯ menu.
  function optionsPanel(taskId) {
    const t = taskById(taskId);
    if (!t) return;
    const item = (label, fn, cls = '') => el('button', { class: `btn ${cls}`, type: 'button', onclick: () => { closePanel(); fn(); } }, label);
    let closePanel = () => {};
    openPanel((close) => {
      closePanel = () => close(null);
      return [el('h2', {}, t.name),
        el('div', { class: 'menu', role: 'menu' },
          item('✏️ Edit', () => actions.editTask(taskId)),
          item('➕ Add session', () => actions.logManual(taskId)),
          item('📊 History', () => goHome(`#/history/${encodeURIComponent(taskId)}`)),
          item('🗄️ Archive', () => actions.archive(taskId), 'danger')),
        el('div', { class: 'foot' }, el('span', { class: 'hint' }, 'Esc to go back'), el('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Back'))];
    });
  }

  // ── Feedback strip: undo / confirm / errors ──
  function showStrip(text, { action, onAction, onResolve, duration = 5000, subtle = false, error = false, primary = false, cancel = false, sticky = false } = {}) {
    resolveStrip(false, true);
    clearTimeout(stripTimer);
    stripResolve = onResolve || null;
    const kids = [el('span', { title: text }, text)];
    if (action) {
      const b = el('button', { type: 'button', class: primary ? 'primary' : '' }, action);
      b.addEventListener('click', () => { const r = stripResolve; stripResolve = null; hideStrip(); r?.(true); onAction?.(); });
      kids.push(b);
    }
    if (cancel) kids.push(el('button', { type: 'button', onclick: () => resolveStrip(false) }, 'Cancel'));
    ui.strip.className = `strip${subtle ? ' subtle' : ''}${error ? ' error' : ''}`;
    ui.strip.setAttribute('role', error ? 'alert' : 'status');
    ui.strip.replaceChildren(...kids);
    ui.strip.hidden = false;
    if (!sticky) stripTimer = setTimeout(hideStrip, duration);
  }
  function resolveStrip(value, silent = false) {
    const r = stripResolve;
    stripResolve = null;
    if (!silent) hideStrip();
    r?.(value);
  }
  // Closing an unanswered confirm counts as Cancel.
  function hideStrip(cancelPending = false) { clearTimeout(stripTimer); if (cancelPending) { const r = stripResolve; stripResolve = null; r?.(false); } if (ui.strip) ui.strip.hidden = true; }

  function tick() {
    if (!win || !d) return;
    renderCard();
    renderGrid();
  }

  return { open, close, tick, get isOpen() { return !!win; } };
}
