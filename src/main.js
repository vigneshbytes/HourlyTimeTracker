import './styles.css';
import { liveQuery } from 'dexie';
import { openDatabase, requestPersistence } from './db/index.js';
import { buildStats, sessionDuration } from './logic/tasks.js';
import { overviewStats } from './logic/stats.js';
import { fmtClock, fmtDuration } from './logic/time.js';
import { h, svgIcon, $ } from './ui/dom.js';
import { toast } from './ui/dialogs.js';
import { openMenu } from './ui/menu.js';
import { createActions } from './ui/actions.js';
import { createTaskListView } from './ui/taskList.js';
import { createHistoryView, createTaskDetailView } from './ui/history.js';
import { createSettingsView, createBulkArchiveView } from './ui/settings.js';
import { installDarkGuard } from './ui/darkguard.js';
import { setupLayout } from './ui/layout.js';
import { setupInstances } from './ui/instances.js';
import { helpButton } from './ui/help.js';
import { createMiniTimer, miniSupported } from './ui/miniTimer.js';

const helpBtn = helpButton();

const app = {
  version: __APP_VERSION__,
  data: { tasks: [], sessions: [], settings: {} },
  stats: new Map(),
  view: null,
  viewKey: null,
  running() { return app.data.sessions.find((s) => s.running === 1) || null; },
  navigate(hash) { if (location.hash !== hash) location.hash = hash; else route(); },
};

const mini = createMiniTimer(app, { onResume: () => resumeIfPaused() });
app.onMiniChange = () => renderChrome();
const toggleMini = () => (mini.isOpen ? mini.close() : mini.open().catch((e) => toast(`Couldn't open the mini timer: ${e.message}`, { error: true })));

function recompute() {
  app.stats = buildStats(app.data.tasks, app.data.sessions, app.data.settings);
  app.overview = overviewStats(app.data.sessions);
  renderStreak();
}

// Streak badge next to the logo: consecutive days with tracked time.
function renderStreak() {
  const el = $('#streak');
  const n = app.overview?.streak ?? 0;
  el.hidden = n === 0;
  if (!n) return;
  const text = `🔥 ${n}`;
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  el.title = `${n}-day streak: you tracked time ${n === 1 ? 'today' : `${n} days in a row`}`;
  el.setAttribute('aria-label', el.title);
}

// ── Routing ────────────────────────────────────────────────────────────────
const views = {};
function route() {
  const hash = location.hash || '#/';
  const [, section = '', sub = ''] = hash.split('/');
  let key, make;
  if (section === 'history' && sub) { key = `detail:${sub}`; make = () => createTaskDetailView(app, decodeURIComponent(sub)); }
  else if (section === 'history') { key = 'history'; make = () => createHistoryView(app); }
  else if (section === 'settings' && sub === 'archive') { key = 'bulk'; make = () => createBulkArchiveView(app); }
  else if (section === 'settings') { key = 'settings'; make = () => createSettingsView(app); }
  else { key = 'tasks'; make = () => views.tasks || (views.tasks = createTaskListView(app)); }
  if (key !== app.viewKey) {
    app.viewKey = key;
    app.view = make();
    $('#view').replaceChildren(app.view.root);
    $('#view').scrollTop = 0;
    window.scrollTo(0, 0);
  }
  renderChrome();
  app.view.render();
  if (key === 'tasks') resumeIfPaused().catch(() => {});
  tick();
}

// ── Header (adapts to desktop / touch / widget) ─────────────────────────────
function renderChrome() {
  const nav = $('#topbar-actions');
  const section = app.viewKey?.split(':')[0];
  const link = (href, icon, label, active) => h('a', { href, class: `icon-btn${active ? ' active' : ''}`, 'aria-label': label, title: label }, svgIcon(icon));
  // New task and History are always in the header, in every layout.
  const addBtn = h('button', { type: 'button', class: 'icon-btn add-btn', 'aria-label': 'New task', title: 'New task', onclick: () => app.actions.newTask() }, svgIcon('plus'));
  const historyLink = link('#/history', 'history', 'History', section === 'history' || section === 'detail');
  if (app.mode === 'widget') {
    const menuBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menu', title: 'Menu' }, svgIcon('menu'));
    menuBtn.addEventListener('click', () => openMenu({
      anchor: menuBtn, asSheet: false,
      items: [
        { label: 'Tasks', icon: 'clock', onClick: () => app.navigate('#/') },
        { label: 'Settings', icon: 'settings', onClick: () => app.navigate('#/settings') },
        ...(miniSupported() ? [{ label: mini.isOpen ? 'Close mini timer' : 'Mini timer (floats on top)', icon: 'popout', onClick: toggleMini }] : []),
      ],
    }));
    nav.replaceChildren(addBtn, historyLink, helpBtn, menuBtn);
  } else {
    const miniBtn = miniSupported() && app.mode !== 'touch'
      && h('button', { type: 'button', class: `icon-btn${mini.isOpen ? ' active' : ''}`, 'aria-label': 'Mini timer', title: mini.isOpen ? 'Close the mini timer' : 'Mini timer: a tiny window that floats on top', onclick: toggleMini }, svgIcon('popout'));
    nav.replaceChildren(addBtn, historyLink, ...(miniBtn ? [miniBtn] : []), helpBtn,
      link('#/settings', 'settings', 'Settings', section === 'settings' || section === 'bulk'));
  }
}

// ── Live clock + top-bar timer ─────────────────────────────────────────────
// Away from the task list, the top bar shows the running task's name and time,
// with the only Pause button. A paused task resumes when you return home.
const bar = {
  name: h('span', { class: 'tb-name' }),
  clock: h('span', { class: 'tb-clock' }),
  btn: h('button', { type: 'button', class: 'tb-btn' }),
};
bar.link = h('a', { href: '#/', class: 'tb-link', title: 'Back to tasks' }, h('span', { class: 'tb-dot', 'aria-hidden': 'true' }), bar.name, bar.clock);
bar.btn.addEventListener('click', async () => {
  if (app.running()) {
    await app.repo.pause();
    toast('Paused. Tracking resumes when you go back to the task list.', { action: 'Resume now', onAction: () => resumeIfPaused() });
  } else {
    await resumeIfPaused();
  }
});

async function resumeIfPaused() {
  if (!app.data.paused) return;
  app.justResumed = app.data.paused.taskId;
  const id = await app.repo.resumePaused();
  if (!id) { app.justResumed = null; return; }
  const t = app.data.tasks.find((x) => x.id === id);
  toast(`Resumed ${t?.name ?? 'task'}`);
}

let lastStatsAt = 0;
let dayKey = new Date().toDateString();
function tick() {
  // A new day can change today's totals and the streak, even with nothing running.
  if (new Date().toDateString() !== dayKey) { dayKey = new Date().toDateString(); recompute(); app.view?.render(); }
  const running = app.running();
  const status = $('#topbar-status');
  const onHome = app.viewKey === 'tasks';
  const paused = !running && app.data.paused;
  if (!status.contains(bar.link)) status.replaceChildren(bar.link, bar.btn);
  if (running) {
    const task = app.data.tasks.find((t) => t.id === running.taskId);
    const clock = fmtClock(sessionDuration(running));
    document.title = `${clock} · ${task?.name ?? ''}`;
    // Running totals anywhere on screen.
    const st = app.stats.get(running.taskId);
    if (st) {
      const other = st.sessions.filter((s) => s.id !== running.id).reduce((a, s) => a + sessionDuration(s), 0);
      document.querySelectorAll(`.js-total[data-task="${CSS.escape(running.taskId)}"]`).forEach((el) => { el.textContent = fmtDuration(other + sessionDuration(running)); });
    }
    document.querySelectorAll('.js-session-timer-detail').forEach((el) => { el.textContent = fmtDuration(sessionDuration(running)); });
    if (Date.now() - lastStatsAt > 30000) { lastStatsAt = Date.now(); recompute(); app.view?.render(); }
  } else {
    document.title = 'TimeTracker';
  }
  status.hidden = onHome || !(running || paused);
  status.classList.toggle('is-paused', !!paused);
  if (!status.hidden) {
    const taskId = running ? running.taskId : paused.taskId;
    const task = app.data.tasks.find((t) => t.id === taskId);
    bar.name.textContent = task?.name ?? '';
    bar.clock.textContent = running ? fmtClock(sessionDuration(running)) : 'Paused';
    bar.btn.replaceChildren(svgIcon(running ? 'pause' : 'play', 16), h('span', null, running ? 'Pause' : 'Resume'));
    bar.btn.setAttribute('aria-label', running ? `Pause ${task?.name ?? ''}` : `Resume ${task?.name ?? ''}`);
  }
  app.view?.tick();
  mini.tick();
}

// ── Service worker / updates ───────────────────────────────────────────────
let updateRequested = false;
function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  });
  // A new version activates by itself; this page keeps working, and offers a reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || updateRequested) return;
    toast('TimeTracker was updated.', { action: 'Reload', duration: 60000, onAction: () => { updateRequested = true; location.reload(); } });
  });
}

function fatal(message) {
  $('#view').replaceChildren(h('div', { class: 'card fatal' }, h('h2', null, 'Something went wrong'), h('p', null, message),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, 'Reload')));
}

async function boot() {
  window.__httBooted = true;
  installDarkGuard();
  setupLayout(app, () => { if (app.view) { renderChrome(); app.view.render(); } });
  let opened;
  try {
    opened = await openDatabase();
  } catch (e) {
    const msg = e?.name === 'VersionError'
      ? 'Your data was saved by a newer version of TimeTracker. Reload to get the latest version. Your data is safe.'
      : `The local database could not be opened: ${e.message}. Your data has not been changed.`;
    fatal(msg);
    registerSW();
    return;
  }
  const { db, repo, snapshot } = opened;
  Object.assign(app, { db, repo });
  app.actions = createActions(app);
  db.on('versionchange', () => {
    db.close();
    fatal('TimeTracker was updated in another window. Reload to continue. Your data is safe.');
    return false;
  });
  if (snapshot) console.info('Safety copy saved:', snapshot);

  requestPersistence().catch(() => {});
  addEventListener('pointerdown', () => requestPersistence().catch(() => {}), { once: true });

  liveQuery(() => repo.loadAll()).subscribe({
    next: (data) => {
      app.data = data;
      recompute();
      lastStatsAt = Date.now();
      if (!app.view) route(); else app.view.render();
      tick();
    },
    error: (e) => fatal(e.message),
  });
  addEventListener('hashchange', route);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setupInstances();
  registerSW();
}

boot();
