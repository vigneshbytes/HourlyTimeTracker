import { h, svgIcon } from './dom.js';
import { openMenu, attachLongPress } from './menu.js';
import { sortMainList, sessionDuration } from '../logic/tasks.js';
import { fmtClock, fmtDuration, fmtHours, relativeExpiry } from '../logic/time.js';
import { overviewStats, quoteOfTheDay } from '../logic/stats.js';

// Main view: the task list. Cards are keyed by task id and re-used between
// renders so re-ordering can be animated (FLIP technique).
export function createTaskListView(app) {
  const root = h('section', { class: 'view view-tasks' });
  const list = h('ul', { class: 'task-list', 'aria-label': 'Tasks' });
  const empty = h('div', { class: 'empty' },
    h('p', { class: 'empty-title' }, 'No active tasks'),
    h('p', null, 'Archived tasks are in ', h('a', { href: '#/history' }, 'History'), '. Create a new one to keep tracking.'),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.actions.newTask() }, svgIcon('plus', 18), ' New task'));
  // The slot at the top is reserved for feedback: the running task's card when
  // tracking, otherwise this idle panel (idle timer, stats, quote, or an intro).
  const idleClock = h('span', { class: 'idle-clock' });
  const idleLabel = h('span', { class: 'idle-label' });
  const statsEl = h('div', { class: 'idle-stats' });
  const quoteEl = h('blockquote', { class: 'idle-quote' });
  const hero = h('div', { class: 'idle-panel', 'aria-live': 'polite' },
    h('div', { class: 'idle-top' }, h('span', { class: 'idle-dot', 'aria-hidden': 'true' }), idleLabel, idleClock),
    h('p', { class: 'idle-hint' }, 'Tap a task below to start tracking.'),
    statsEl, quoteEl);
  const intro = h('div', { class: 'idle-panel intro' },
    h('p', { class: 'intro-title' }, 'Track time on your tasks'),
    h('ol', { class: 'intro-steps' },
      h('li', null, 'Create a task with ', h('strong', null, '+'), '. It starts timing right away.'),
      h('li', null, 'Tap a task to start it. Only one runs at a time.'),
      h('li', null, 'Tap the running task (or Stop) to stop.'),
      h('li', null, 'See totals and every session in ', h('strong', null, 'History'), '.')),
    h('p', { class: 'idle-hint' }, 'Everything stays on this device. Nothing is sent anywhere.'),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.actions.newTask() }, svgIcon('plus', 18), ' New task'));
  const createOnlyBar = h('div', { class: 'create-only-bar', role: 'status' });
  root.append(createOnlyBar, hero, intro, list, empty, h('p', { class: 'touch-hint' }, 'Press and hold a task for more options.'));

  function renderHero() {
    const running = app.running();
    const hasTasks = app.data.tasks.length > 0;
    const showIntro = !hasTasks;
    intro.hidden = !showIntro;
    empty.hidden = true;
    const showIdle = hasTasks && !running;
    if (showIdle && hero.hidden !== false) hero.animate?.([{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    hero.hidden = !showIdle;
    if (!showIdle) return;
    const st = overviewStats(app.data.sessions);
    hero._lastEnd = st.lastEnd;
    const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
    statsEl.replaceChildren(
      stat('Today', fmtDuration(st.todayMs)),
      stat('This week', fmtDuration(st.weekMs)),
      stat('Logs today', String(st.todayLogs)),
      stat('Day streak', st.streak ? `${st.streak} 🔥` : '0'));
    const [q, who] = quoteOfTheDay();
    quoteEl.replaceChildren(h('span', null, `“${q}”`), h('cite', null, `— ${who}`));
    tickHero();
  }

  function tickHero() {
    if (hero.hidden) return;
    if (hero._lastEnd) { idleLabel.textContent = 'Idle for'; idleClock.textContent = fmtClock(Date.now() - hero._lastEnd); }
    else { idleLabel.textContent = 'Not tracking'; idleClock.textContent = ''; }
  }

  function tickCreateOnly() {
    const until = app.data.settings.createOnlyUntil || 0;
    const left = until - Date.now();
    createOnlyBar.hidden = left <= 0;
    if (left > 0) {
      createOnlyBar.replaceChildren(
        h('span', null, `Create-only mode: new tasks won’t start a timer for ${fmtClock(left).replace(/^0:/, '')}.`),
        h('button', { type: 'button', class: 'link', onclick: () => app.actions.endCreateOnly() }, 'Turn off'));
    }
  }
  const cards = new Map();

  function menuFor(task, anchor, asSheet) {
    openMenu({
      anchor, asSheet, title: task.name,
      items: [
        { label: 'Edit', icon: 'edit', onClick: () => app.actions.editTask(task.id) },
        { label: 'Log session manually', icon: 'clock', onClick: () => app.actions.logManual(task.id) },
        { label: 'View history', icon: 'history', onClick: () => app.navigate(`#/history/${task.id}`) },
        { label: 'Archive', icon: 'archive', onClick: () => app.actions.archive(task.id) },
      ],
    });
  }

  function createCard(taskId) {
    const nameEl = h('span', { class: 'task-name' });
    const metaEl = h('span', { class: 'task-meta' });
    const badges = h('span', { class: 'task-badges' });
    const timer = h('span', { class: 'task-timer js-session-timer' });
    const stopBtn = h('span', { class: 'stop-btn', 'aria-hidden': 'true' }, svgIcon('stop', 22), h('span', null, 'Stop'));
    const progress = h('span', { class: 'progress' }, h('i'));
    const main = h('button', { class: 'task-main', type: 'button' },
      h('span', { class: 'task-head' }, nameEl, badges),
      h('span', { class: 'task-running-row' }, timer, stopBtn),
      metaEl, progress);
    const more = h('button', { class: 'task-more', type: 'button', 'aria-label': 'Task options', title: 'Options' }, svgIcon('more', 20));
    const li = h('li', { class: 'task-card', dataset: { id: taskId } }, main, more);

    const wasLongPress = attachLongPress(main, () => menuFor(li._task, li, true));
    main.addEventListener('click', (e) => {
      if (wasLongPress()) { e.preventDefault(); return; }
      app.actions.activate(taskId);
    });
    main.addEventListener('contextmenu', (e) => {
      // Right-click with a mouse opens the dropdown at the ⋯ button.
      if (e.pointerType === 'touch' || e.pointerType === 'pen' || app.lastPointer === 'touch') return;
      e.preventDefault();
      menuFor(li._task, more, false);
    });
    more.addEventListener('click', (e) => { e.stopPropagation(); menuFor(li._task, more, app.lastPointer === 'touch'); });
    Object.assign(li, { _els: { nameEl, metaEl, badges, timer, progress, main } });
    return li;
  }

  function fill(li, task, st) {
    const { nameEl, metaEl, badges, progress, main } = li._els;
    li._task = task;
    const running = !!st.running;
    li.classList.toggle('is-running', running);
    li.classList.toggle('is-red', st.color === 'red');
    li.classList.toggle('is-yellow', st.color === 'yellow');
    nameEl.textContent = task.name;
    main.setAttribute('aria-label', running ? `Stop timing ${task.name}` : `Start timing ${task.name}`);
    main.title = running ? 'Tap anywhere on this card to stop' : 'Tap to start timing';

    const b = [];
    if (st.expired) b.push(['Expired', 'red']);
    else if (st.expiring) b.push([relativeExpiry(task.expiresAt), 'red']);
    if (st.overLimit) b.push(['Over limit', 'warn']);
    badges.replaceChildren(...b.map(([t, c]) => h('span', { class: `badge badge-${c}` }, t)));

    const parts = [];
    parts.push(h('span', { class: 'js-total', dataset: { task: task.id } }, fmtDuration(st.totalMs)));
    if (task.maxHours) parts.push(h('span', null, ` of ${fmtHours(task.maxHours)}`));
    parts.push(h('span', null, ` · ${st.sessions.length} ${st.sessions.length === 1 ? 'log' : 'logs'}`));
    if (task.expiresAt && !st.expiring) parts.push(h('span', null, ` · ${relativeExpiry(task.expiresAt).toLowerCase()}`));
    metaEl.replaceChildren(...parts);

    progress.hidden = !task.maxHours;
    progress.firstChild.style.width = `${Math.min(100, st.ratio * 100)}%`;
  }

  function render() {
    const { tasks } = app.data;
    const active = tasks.filter((t) => t.status === 'active');
    const sorted = sortMainList(active, app.stats);
    list.hidden = sorted.length === 0;
    renderHero();
    // All tasks archived: point to History.
    empty.hidden = !(app.data.tasks.length > 0 && sorted.length === 0);

    // FLIP: First — remember where every card was.
    const before = new Map();
    for (const [id, li] of cards) before.set(id, li.getBoundingClientRect());

    const seen = new Set();
    sorted.forEach((task, i) => {
      let li = cards.get(task.id);
      if (!li) { li = createCard(task.id); cards.set(task.id, li); li.classList.add('entering'); }
      fill(li, task, app.stats.get(task.id));
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
      seen.add(task.id);
    });
    for (const [id, li] of cards) {
      if (!seen.has(id)) { li.remove(); cards.delete(id); }
    }

    // Last, Invert, Play.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const [id, li] of cards) {
        const prev = before.get(id);
        if (li.classList.contains('entering')) {
          li.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
          li.classList.remove('entering');
          continue;
        }
        if (!prev) continue;
        const now = li.getBoundingClientRect();
        const dy = prev.top - now.top;
        const sy = prev.height / now.height;
        if (Math.abs(dy) > 1 || Math.abs(sy - 1) > 0.01) {
          li.animate([
            { transform: `translateY(${dy}px)`, transformOrigin: 'top' },
            { transform: 'none', transformOrigin: 'top' },
          ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      }
    } else {
      for (const li of cards.values()) li.classList.remove('entering');
    }
    tick();
  }

  function tick() {
    tickCreateOnly();
    tickHero();
    const running = app.running();
    if (!running) return;
    const li = cards.get(running.taskId);
    if (!li) return;
    li._els.timer.textContent = fmtClock(sessionDuration(running));
    const st = app.stats.get(running.taskId);
    const totalEl = li.querySelector('.js-total');
    if (totalEl && st) {
      const otherMs = st.sessions.filter((s) => s.id !== running.id).reduce((a, s) => a + sessionDuration(s), 0);
      totalEl.textContent = fmtDuration(otherMs + sessionDuration(running));
    }
  }

  return { root, render, tick };
}
