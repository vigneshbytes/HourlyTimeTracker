// Floating mini timer: a small always-on-top window (Document Picture-in-Picture)
// with the home view packed inside. Rules: docs/MINI_TIMER.md.
//
// Architecture: this file is only a UI wrapper. Every action (start, stop,
// switch, new task, edit, add session, archive, resume, create-only mode)
// runs through the same createActions() logic as the full app, with this
// window's own inline forms / confirm bar plugged in as the "ui". Sorting,
// colours, totals and stats come from the same app.stats / app.overview, and
// form rules from logic/forms.js. Change the logic once and both follow.
//
// Two states:
//  • interactive – the window has focus or the cursor is over it: timer card,
//    ⌂ / + / 🔍 rail and the task list, all fitting Chromium's smallest
//    window (X × Y = 240 × 52, kMinWindowSize in Chromium's
//    picture_in_picture_window_manager.cc).
//  • widget – otherwise: 🔍 and the task list disappear and the timer card
//    takes their space.
// Sizes (CSS px): Y = card H1 + gap + 🔍 → H1 = 32, ⌂ = + = 14, 🔍 = task row = 16.
// X = card width + gap + rail width. No scrollbars are ever shown.
import { fmtClock, fmtDuration, toInputDate, toInputTime } from '../logic/time.js';
import { sessionDuration, sortMainList } from '../logic/tasks.js';
import { checkTask, checkManualSession } from '../logic/forms.js';
import { createActions } from './actions.js';

export const miniSupported = () => 'documentPictureInPicture' in window;

export const X = 240;                       // Chromium's minimum inner width
export const Y = 52;                        // Chromium's minimum inner height
export const GAP = 4;
export const H1 = ((Y - GAP) * 2) / 3;      // 32: timer card = ⌂ + gap + +
export const ICON = (H1 - GAP) / 2;         // 14: ⌂ and +
export const ROW = H1 / 2;                  // 16: 🔍, search box, task rows
export const RAIL = 18;                     // rail width; card width = X − GAP − RAIL

const PATHS = {
  stop: 'M7 7h10v10H7z',
  play: 'M8 5l11 7-11 7z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  home: 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
  close: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
};

const STYLES = `
:root { color-scheme: only light; --gap: ${GAP}px; --h1: ${H1}px; --icon: ${ICON}px; --row: ${ROW}px; --rail: ${RAIL}px; }
* { box-sizing: border-box; scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #f4f6f9 !important; color: #1f2937; filter: none !important;
  font: 10.5px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
body { display: grid; grid-template-columns: minmax(0, 1fr) var(--rail); grid-template-rows: var(--h1) minmax(0, 1fr); column-gap: var(--gap); row-gap: var(--gap); position: relative; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
[hidden] { display: none !important; }
:focus-visible { outline: 2px solid #1a56db; outline-offset: -2px; }

/* Rail: ⌂ and + level with the card, 🔍 level with the task list */
.rail { grid-column: 2; grid-row: 1 / 3; display: flex; flex-direction: column; gap: var(--gap); }
.ibtn { flex: none; width: var(--rail); height: var(--icon); display: grid; place-items: center; border: 1px solid #dfe4ea; border-radius: 4px; background: #fff; color: #4b5563; padding: 0; transition: background .15s, color .15s, border-color .15s; }
.ibtn:hover, .ibtn[aria-pressed=true] { color: #1a56db; border-color: #b9cdf5; background: #eaf1fe; }
.ibtn.add { color: #fff; background: #1a56db; border-color: #1a56db; }
.ibtn.add:hover { background: #1747b8; color: #fff; }
.ibtn.find { height: var(--row); }

/* Left column: card (row 1) and task list (row 2) */
.card, .list, .panel, .bar { grid-column: 1; }
.card { grid-row: 1; }
.list { grid-row: 2; min-height: 0; display: flex; flex-direction: column; gap: var(--gap); }
body.searching .card { display: none; }
body.searching .list { grid-row: 1 / 3; }

/* Main card: running task (whole card = Stop), paused (Resume), or idle clock + stats */
.card { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; container-type: size; border-radius: 6px; border: 1px solid #1a56db; background: linear-gradient(180deg, #f3f8ff, #fff);
  padding: 0 4px 0 6px; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; align-content: center; align-items: center; column-gap: 6px; text-align: left; }
.card .top { grid-column: 1; display: flex; gap: 4px; min-width: 0; font-size: 10px; line-height: 12px; }
.card .name { font-weight: 650; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.card .meta { color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
.card .big { grid-column: 1; font-weight: 750; font-size: clamp(15px, calc((100cqh - 14px) * .9), 64px); line-height: 1.1; font-variant-numeric: tabular-nums; letter-spacing: -.01em; display: flex; align-items: center; gap: 4px; white-space: nowrap; min-width: 0; overflow: hidden; }
.dot { width: .32em; height: .32em; max-width: 8px; max-height: 8px; border-radius: 50%; background: #16a34a; flex: none; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.card .act { grid-column: 2; grid-row: 1 / 3; display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px; border-radius: 5px; font-weight: 700; color: #fff; background: #c62828; white-space: nowrap; }
.card.running:hover { border-color: #c62828; }
.card.running:hover .act { background: #a91f1f; }
.card.paused { border-color: #f0d58a; background: #fffaf0; }
.card.paused .act { background: #16a34a; }
.card.idle { border: 1px dashed #c9d3df; background: #fbfcfe; cursor: default; }
.card.idle .big { font-size: clamp(14px, calc((100cqh - 14px) * .85), 56px); }
.card .stats { grid-column: 1 / -1; color: #4b5563; font-size: 10px; line-height: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.card .stats b { color: #1f2937; }
.card .corner { grid-column: 2; grid-row: 1; }
.chip { display: inline-flex; align-items: center; padding: 0 4px; height: 12px; border-radius: 99px; font-weight: 700; font-size: 9.5px; white-space: nowrap; cursor: pointer; background: #fff7e0; color: #5c4400; border: 1px solid #f0d58a; }
.bar-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #e5e9ef; }
.bar-progress i { display: block; height: 100%; background: #1a56db; }
.bar-progress.yellow i { background: #e0a800; } .bar-progress.over i { background: #d93025; }

/* Task list: one-line rows of H1/2, scrolls (without a visible scrollbar) */
.search { flex: none; width: 100%; height: var(--row); border: 1px solid #b9cdf5; border-radius: 4px; padding: 0 5px; background: #fff; font-size: 10.5px; }
.grid-wrap { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100px, calc(50% - 2px)), 1fr)); grid-auto-rows: var(--row); gap: var(--gap); }
.tile { position: relative; display: flex; align-items: center; gap: 4px; min-width: 0; padding: 0 4px; border: 1px solid #e2e7ee; border-radius: 4px; background: #fff; text-align: left; overflow: hidden; cursor: pointer; transition: border-color .15s, background .15s; }
.tile:hover, .tile.sel { border-color: #1a56db; background: #f3f8ff; }
.tile .t1 { flex: 1; min-width: 0; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .t2 { flex: none; font-size: 10px; color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tile .t2.bad { color: #b42318; font-weight: 600; }
.tile.red { border-left: 3px solid #d93025; }
.tile.yellow { border-left: 3px solid #e0a800; }
.tile .pg { position: absolute; left: 0; bottom: 0; height: 2px; background: #1a56db; opacity: .55; }
.tile.yellow .pg { background: #e0a800; opacity: 1; } .tile.over .pg { background: #d93025; opacity: 1; }
.empty { color: #6b7280; line-height: var(--row); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Panels (forms, task options, confirm) take the whole left column */
.panel, .bar { grid-row: 1 / 3; display: flex; flex-direction: column; justify-content: center; gap: var(--gap); min-height: 0; overflow: hidden; }
.row { display: flex; gap: var(--gap); align-items: center; min-width: 0; }
.row > * { flex: 1 1 0; min-width: 0; }
.row > .btn, .row > .x { flex: none; }
.inp { height: 22px; border: 1px solid #cfd6df; border-radius: 4px; padding: 0 5px; background: #fff; width: 100%; font-size: 10.5px; }
.inp:focus { border-color: #1a56db; outline: none; box-shadow: 0 0 0 2px #d7e5fd; }
.inp.err { border-color: #d93025; background: #fff5f4; }
.label { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
.btn { height: 22px; border: 1px solid #cfd6df; border-radius: 4px; padding: 0 6px; background: #fff; font-weight: 650; white-space: nowrap; }
.btn:hover { border-color: #1a56db; color: #1a56db; }
.btn.primary { background: #1a56db; border-color: #1a56db; color: #fff; }
.btn.primary:hover { color: #fff; background: #1747b8; }
.btn.primary:disabled { opacity: .45; cursor: default; }
.btn.danger { color: #b42318; }
.x { width: 22px; padding: 0; }
.bar { background: #1f2937; color: #fff; border-radius: 6px; padding: 0 6px; }
.bar.error { background: #b42318; }
.bar .msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.bar .btn { background: transparent; color: #fff; border-color: rgb(255 255 255 / .35); }

/* Widget state: only the timer card (with ⌂ and +); it takes the cleared space */
body.widget .list, body.widget .find, body.widget .panel, body.widget .bar { display: none !important; }
body.widget .card { display: grid !important; grid-row: 1 / 3; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

export function createMiniTimer(app) {
  let win = null;
  let d = null;
  const ui = {};
  let query = '';
  let searchOpen = false;
  let panel = null; // { close(result) } while a form / menu / confirm is open
  let cardKey = '';
  let gridKey = '';
  let selIndex = 0;
  let hovered = false;
  let errorTimer = null;

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
  function icon(name, size = 10) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = d.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true');
    const p = d.createElementNS(ns, 'path'); p.setAttribute('d', PATHS[name]);
    if (name === 'stop' || name === 'play') p.setAttribute('fill', 'currentColor');
    else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.6'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    svg.append(p); return svg;
  }
  const taskById = (id) => app.data.tasks.find((t) => t.id === id);
  const taskName = (id) => taskById(id)?.name ?? 'task';

  // ── The mini window's "ui" for the shared actions ──
  // No undo / info pop-ups in the mini timer: only errors and confirmations show.
  const miniUi = {
    toast: (message, { error } = {}) => { if (error) showError(message); },
    errorToast: (e) => { console.error(e); showError(e?.message || String(e)); },
    confirm: ({ short, message, title, confirmText = 'OK' }) => confirmBar(short || message || title, confirmText),
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
    win = await window.documentPictureInPicture.requestWindow({ width: X, height: Y });
    d = win.document;
    d.title = 'TimeTracker';
    d.head.append(el('meta', { name: 'color-scheme', content: 'only light' }), el('style', {}, STYLES));
    build();
    cardKey = gridKey = '';
    // Interactive while focused or hovered; widget otherwise.
    win.addEventListener('focus', updateState);
    win.addEventListener('blur', updateState);
    d.addEventListener('mouseover', () => { if (!hovered) { hovered = true; updateState(); } });
    d.documentElement.addEventListener('mouseleave', () => { hovered = false; updateState(); });
    d.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { hovered = false; updateState(); } });
    win.addEventListener('pagehide', () => { win = null; d = null; panel = null; clearTimeout(errorTimer); app.onMiniChange?.(false); });
    app.onMiniChange?.(true);
    updateState();
    tick();
  }

  function close() { win?.close(); }

  function updateState() {
    if (!d) return;
    const interactive = hovered || d.hasFocus();
    d.body.classList.toggle('widget', !interactive);
    d.body.classList.toggle('interactive', interactive);
  }

  function build() {
    ui.co = el('span', { class: 'chip', role: 'button', tabindex: '0', hidden: true });
    ui.homeBtn = el('button', { class: 'ibtn', type: 'button', title: 'Open the full app', 'aria-label': 'Open the full app' }, icon('home'));
    ui.addBtn = el('button', { class: 'ibtn add', type: 'button', title: 'New task (N)', 'aria-label': 'New task' }, icon('plus'));
    ui.searchBtn = el('button', { class: 'ibtn find', type: 'button', title: 'Search tasks (/)', 'aria-label': 'Search tasks', 'aria-pressed': 'false' }, icon('search'));
    ui.card = el('button', { class: 'card idle', type: 'button' });
    ui.search = el('input', { class: 'search', type: 'search', placeholder: 'Search tasks…', 'aria-label': 'Search tasks', hidden: true, autocomplete: 'off' });
    ui.grid = el('div', { class: 'grid', role: 'grid', 'aria-label': 'Tasks' });
    ui.list = el('div', { class: 'list' }, ui.search, el('div', { class: 'grid-wrap' }, ui.grid));
    ui.panel = el('div', { class: 'panel', hidden: true });
    ui.bar = el('div', { class: 'bar', role: 'alert', hidden: true });
    d.body.replaceChildren(ui.card, ui.list, ui.panel, ui.bar, el('div', { class: 'rail' }, ui.homeBtn, ui.addBtn, ui.searchBtn));

    ui.homeBtn.addEventListener('click', () => goHome('#/'));
    ui.addBtn.addEventListener('click', () => actions.newTask());
    ui.searchBtn.addEventListener('click', () => (searchOpen ? closeSearch() : openSearch()));
    const endCo = (e) => { e.stopPropagation(); e.preventDefault(); actions.endCreateOnly(); };
    ui.co.addEventListener('click', endCo);
    ui.co.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') endCo(e); });
    ui.card.addEventListener('click', onCardClick);
    ui.search.addEventListener('input', () => { query = ui.search.value; selIndex = 0; renderGrid(true); });
    ui.search.addEventListener('keydown', onSearchKey);
    ui.grid.addEventListener('keydown', onGridKey);
    d.addEventListener('keydown', onGlobalKey);
  }

  function onGlobalKey(e) {
    const typing = e.target.tagName === 'INPUT';
    if (e.key === 'Escape') {
      if (panel) { e.preventDefault(); panel.close(null); return; }
      if (!ui.bar.hidden) { e.preventDefault(); hideError(); return; }
      if (searchOpen && !typing) { e.preventDefault(); closeSearch(); }
      return;
    }
    if (typing || panel) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) { e.preventDefault(); openSearch(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); actions.newTask(); }
  }

  // ⌂ and "History": show the full app on that page.
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
    const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const k = running ? `run:${running.id}:${taskName(running.taskId)}` : paused ? `paused:${paused.taskId}:${taskName(paused.taskId)}` : 'idle';
    if (k !== cardKey) {
      cardKey = k;
      if (running) {
        const name = taskName(running.taskId);
        ui.card.className = 'card running';
        ui.card.disabled = false;
        ui.card.title = `Click anywhere to stop ${name}`;
        ui.card.setAttribute('aria-label', `Stop ${name}`);
        ui.card.replaceChildren(el('span', { class: 'top' }, el('span', { class: 'name' }, name), ui.co, el('span', { class: 'meta' })),
          el('span', { class: 'big' }, el('i', { class: 'dot' }), el('span', { class: 'clock' })),
          el('span', { class: 'act' }, icon('stop', 9), 'Stop'),
          el('span', { class: 'bar-progress', hidden: true }, el('i')));
      } else if (paused) {
        const name = taskName(paused.taskId);
        ui.card.className = 'card paused';
        ui.card.disabled = false;
        ui.card.title = `Click to resume ${name}`;
        ui.card.setAttribute('aria-label', `Resume ${name}`);
        ui.card.replaceChildren(el('span', { class: 'top' }, el('span', { class: 'name' }, `Paused · ${name}`)),
          el('span', { class: 'big' }, 'Paused'),
          el('span', { class: 'act' }, icon('play', 9), 'Resume'));
      } else {
        ui.card.className = 'card idle';
        ui.card.disabled = true;
        ui.card.title = '';
        ui.card.setAttribute('aria-label', 'Nothing running');
        ui.card.replaceChildren(el('span', { class: 'big clock' }), el('span', { class: 'corner' }, ui.co), el('span', { class: 'stats' }));
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
        ui.card.querySelector('.stats').replaceChildren('Today ', el('b', {}, fmtDuration(o.todayMs ?? 0)),
          ` · ${o.todaySessions ?? 0} ${o.todaySessions === 1 ? 'session' : 'sessions'} · avg `, el('b', {}, o.trackedDays ? fmtDuration(o.dailyAvgMs) : '–'));
      }
      d.title = 'TimeTracker';
    }
    const until = app.data.settings.createOnlyUntil || 0;
    ui.co.hidden = Date.now() >= until;
    if (!ui.co.hidden) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      ui.co.textContent = `⏳${mins}m`;
      ui.co.title = `Create-only mode: new tasks won't start a timer for ${mins} more min. Click to turn off.`;
    }
  }

  // ── Task list ──
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
      query ? 'No tasks match.' : app.data.tasks.some((t) => t.status === 'active') ? 'No other tasks.' : 'No tasks yet: + or N to add one.')]));
    if (focusedId) ui.grid.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  function tile(t, i) {
    const st = app.stats.get(t.id) || {};
    const flag = st.overLimit ? 'over limit' : st.expired ? 'expired' : st.expiring ? 'expiring' : st.nearLimit ? 'near limit' : '';
    const b = el('div', {
      class: `tile${st.color ? ` ${st.color}` : ''}${st.overLimit ? ' over' : ''}${searchOpen && query && i === selIndex ? ' sel' : ''}`,
      role: 'gridcell', 'data-id': t.id, tabindex: i === 0 ? '0' : '-1',
      title: `Start ${t.name} · ${fmtDuration(st.totalMs || 0)}${t.maxHours ? ` of ${fmtDuration(t.maxHours * 3600000)}` : ''}${flag ? ` · ${flag}` : ''}\nRight-click, press and hold, or Shift+F10 for options`,
      'aria-label': `Start ${t.name}`,
    }, el('span', { class: 't1' }, t.name), el('span', { class: `t2${st.overLimit || st.expiring ? ' bad' : ''}` }, fmtDuration(st.totalMs || 0)),
    t.maxHours ? el('i', { class: 'pg', style: `width:${Math.min(100, (st.ratio || 0) * 100)}%` }) : null);
    let pressTimer = null; let longPressed = false;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; optionsPanel(t.id); }, 550);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(pressTimer));
    b.addEventListener('click', () => { if (longPressed) { longPressed = false; return; } startTask(t.id); });
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
    d.body.classList.add('searching');
    ui.search.hidden = false;
    ui.searchBtn.setAttribute('aria-pressed', 'true');
    ui.searchBtn.replaceChildren(icon('close'));
    ui.searchBtn.title = 'Close search (Esc)';
    ui.search.focus();
    ui.search.select();
  }

  function closeSearch() {
    searchOpen = false;
    d.body.classList.remove('searching');
    query = ''; ui.search.value = ''; selIndex = 0;
    ui.search.hidden = true;
    ui.searchBtn.setAttribute('aria-pressed', 'false');
    ui.searchBtn.replaceChildren(icon('search'));
    ui.searchBtn.title = 'Search tasks (/)';
    renderGrid(true);
    focusTile(0);
  }

  async function startTask(taskId) {
    if (app.running()?.taskId === taskId) return;
    const result = await actions.activate(taskId); // same start / switch-confirm logic as the full app
    if (result === 'started' && searchOpen) closeSearch();
  }

  // ── Panels: two rows of 22px that fit the 52px window ──
  function openPanel(build) {
    if (panel) panel.close(null);
    return new Promise((resolve) => {
      const prevFocus = d.activeElement;
      const p = { close: (v) => { if (panel !== p) return; panel = null; ui.panel.hidden = true; ui.card.hidden = false; ui.list.hidden = false; ui.panel.replaceChildren(); resolve(v); prevFocus?.focus?.(); } };
      panel = p;
      hideError();
      ui.panel.replaceChildren(...build(p.close));
      ui.card.hidden = true; ui.list.hidden = true; ui.panel.hidden = false;
      (ui.panel.querySelector('[autofocus]') || ui.panel.querySelector('input, button'))?.focus();
    });
  }
  const closeBtn = (close) => el('button', { class: 'btn x', type: 'button', title: 'Cancel (Esc)', 'aria-label': 'Cancel', onclick: () => close(null) }, '✕');

  // New / edit task: same rules as the full app's dialog (notes stay in the full app).
  function taskPanel(task = null) {
    return openPanel((close) => {
      const name = el('input', { class: 'inp', placeholder: task ? 'Task name' : 'New task name', 'aria-label': task ? `Edit ${task.name}: name` : 'New task name', maxlength: '120', autofocus: true, value: task?.name ?? '' });
      const limit = el('input', { class: 'inp', placeholder: 'Max hrs', 'aria-label': 'Max time in hours (optional)', inputmode: 'decimal', value: task?.maxHours ?? '' });
      const expiry = el('input', { class: 'inp', placeholder: 'Expires: days/date', 'aria-label': 'Expiry: days or a date (optional)', value: task?.expiresAt ? toInputDate(task.expiresAt) : '' });
      const save = el('button', { class: 'btn primary', type: 'submit' }, task ? 'Save' : 'Create');
      const check = () => {
        const r = checkTask({ name: name.value, notes: task?.notes ?? '', limit: limit.value, expiry: expiry.value });
        limit.classList.toggle('err', !!r.errors.limit);
        expiry.classList.toggle('err', !!r.errors.expiry);
        limit.title = r.errors.limit || r.hints.limit;
        expiry.title = r.errors.expiry || r.hints.expiry;
        save.disabled = !r.ok;
        return r.value;
      };
      for (const i of [name, limit, expiry]) i.addEventListener('input', check);
      check();
      return [el('form', { style: 'display:contents', onsubmit: (e) => { e.preventDefault(); const v = check(); if (v) close(v); } },
        el('div', { class: 'row' }, name, save),
        el('div', { class: 'row' }, limit, expiry, closeBtn(close)))];
    });
  }

  // Add (or edit) a manual session: same rules as the full app's dialog.
  function sessionPanel(task, session = null) {
    return openPanel((close) => {
      const hours = el('input', { class: 'inp', placeholder: `Hours for ${task.name}`, 'aria-label': `Hours for ${task.name} (required)`, inputmode: 'decimal', autofocus: true,
        value: session ? String(+(session.durationMs / 3600000).toFixed(4)) : '' });
      const date = el('input', { class: 'inp', type: 'date', 'aria-label': 'Start date (optional)', title: 'Start date (optional)', value: session?.dateProvided && session.start ? toInputDate(session.start) : '' });
      const time = el('input', { class: 'inp', type: 'time', 'aria-label': 'Start time (optional)', title: 'Start time (optional)', value: session?.timeProvided && session.start ? toInputTime(session.start) : '' });
      const save = el('button', { class: 'btn primary', type: 'submit' }, session ? 'Save' : 'Add');
      const check = () => {
        const r = checkManualSession({ hours: hours.value, date: date.value, time: time.value });
        hours.classList.toggle('err', !!r.error);
        hours.title = r.error || r.hint || 'e.g. 1.5 or 1:30';
        save.disabled = !r.ok;
        return r.value;
      };
      hours.addEventListener('input', check);
      check();
      return [el('form', { style: 'display:contents', onsubmit: (e) => { e.preventDefault(); const v = check(); if (v) close(v); } },
        el('div', { class: 'row' }, hours, save),
        el('div', { class: 'row' }, date, time, closeBtn(close)))];
    });
  }

  // Task options: the same four as the full app's ⋯ menu.
  function optionsPanel(taskId) {
    const t = taskById(taskId);
    if (!t) return;
    let done = () => {};
    const item = (label, title, fn, cls = '') => el('button', { class: `btn ${cls}`, type: 'button', title, onclick: () => { done(); fn(); } }, label);
    openPanel((close) => {
      done = () => close(null);
      return [el('div', { class: 'row' }, el('span', { class: 'label' }, t.name), closeBtn(close)),
        el('div', { class: 'row', role: 'menu' },
          item('Edit', 'Edit name, max hours, expiry', () => actions.editTask(taskId)),
          item('+Session', 'Add a session manually', () => actions.logManual(taskId)),
          item('History', 'Open its history in the full app', () => goHome(`#/history/${encodeURIComponent(taskId)}`)),
          item('Archive', 'Archive this task', () => actions.archive(taskId), 'danger'))];
    });
  }

  // Confirm (e.g. switching tasks): two rows over the left column.
  function confirmBar(text, confirmText) {
    return openPanel((close) => {
      const yes = el('button', { class: 'btn primary', type: 'button', onclick: () => close(true) }, confirmText);
      setTimeout(() => yes.focus());
      return [el('div', { class: 'row' }, el('span', { class: 'label', title: text }, text)),
        el('div', { class: 'row' }, yes, el('button', { class: 'btn', type: 'button', onclick: () => close(false) }, 'Cancel'))];
    }).then((v) => !!v);
  }

  // Errors only (no undo pop-ups in the mini timer).
  function showError(text) {
    clearTimeout(errorTimer);
    ui.bar.className = 'bar error';
    ui.bar.replaceChildren(el('div', { class: 'row' }, el('span', { class: 'msg', title: text }, text), el('button', { class: 'btn x', type: 'button', 'aria-label': 'Dismiss', onclick: hideError }, '✕')));
    ui.bar.hidden = false;
    errorTimer = setTimeout(hideError, 5000);
  }
  function hideError() { clearTimeout(errorTimer); if (ui.bar) ui.bar.hidden = true; }

  function tick() {
    if (!win || !d) return;
    renderCard();
    renderGrid();
  }

  return { open, close, tick, get isOpen() { return !!win; } };
}
