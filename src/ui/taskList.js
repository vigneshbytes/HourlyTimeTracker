import { h, svgIcon } from './dom.js';
import { openMenu, attachLongPress } from './menu.js';
import { sortMainList, sessionDuration } from '../logic/tasks.js';
import { fmtClock, fmtDuration, fmtHours, fmtTime, relativeExpiry } from '../logic/time.js';
import { overviewStats } from '../logic/stats.js';
import { fetchQuote } from '../logic/quotes.js';
import { howToSteps } from './help.js';

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
  // tracking, otherwise this idle panel (greeting, last task, stats, quote) or,
  // for new users, a short how-to.
  const greetEl = h('span', { class: 'idle-greet' });
  const timeEl = h('time', { class: 'idle-time' });
  const dateEl = h('span', { class: 'idle-date' });
  const statsEl = h('dl', { class: 'idle-stats' });
  const quoteText = h('p', { class: 'q-text' });
  const quoteWho = h('p', { class: 'q-who' });
  const quoteEl = h('figure', { class: 'idle-quote' }, quoteText, quoteWho);
  const hero = h('div', { class: 'idle-panel', 'aria-live': 'polite' },
    h('div', { class: 'idle-top' }, h('div', { class: 'idle-when' }, timeEl, dateEl), greetEl),
    statsEl, quoteEl);
  const intro = h('div', { class: 'idle-panel intro' },
    h('p', { class: 'intro-title' }, '👋 Welcome! Let’s track your time'),
    howToSteps(),
    h('div', { class: 'intro-foot' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.actions.newTask() }, svgIcon('plus', 18), ' Add your first task'),
      h('span', { class: 'idle-hint' }, '🔒 Private: stays on this device.')));
  const createOnlyBar = h('div', { class: 'create-only-bar', role: 'status' });
  root.append(createOnlyBar, hero, intro, list, empty, h('p', { class: 'touch-hint' }, 'Press and hold a task for more options.'));

  let wasIdle = false;
  async function loadQuote() {
    quoteEl.classList.remove('show');
    const q = await fetchQuote();
    quoteText.textContent = q.text;
    quoteWho.textContent = q.author;
    quoteEl.classList.add('show');
  }

  const greeting = () => {
    const hr = new Date().getHours();
    return hr < 5 ? 'Working late' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  };

  function renderHero() {
    const running = app.running();
    const hasTasks = app.data.tasks.length > 0;
    intro.hidden = hasTasks;
    empty.hidden = true;
    const showIdle = hasTasks && !running;
    if (showIdle && !wasIdle) {
      if (!reduceMotion()) hero.animate?.([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 120, easing: 'ease-out', fill: 'backwards' });
      loadQuote(); // a new quote every time the app becomes idle
    }
    wasIdle = showIdle;
    hero.hidden = !showIdle;
    if (!showIdle) return;

    clockKey = '';
    tickHero();

    const st = overviewStats(app.data.sessions);
    statsEl.replaceChildren(...[
      ['Today', fmtDuration(st.todayMs)],
      ['This week', fmtDuration(st.weekMs)],
      ['Logs today', String(st.todayLogs)],
      ['Day streak', st.streak ? `${st.streak} ${st.streak === 1 ? 'day' : 'days'}` : '–'],
    ].map(([label, value], i) => {
      const prevVal = statsEl.children[i]?.querySelector('.stat-value')?.textContent;
      const dd = h('dd', { class: `stat-value${prevVal != null && prevVal !== value ? ' changed' : ''}` }, value);
      return h('div', { class: 'stat' }, h('dt', { class: 'stat-label' }, label), dd);
    }));
  }

  // Clock: the device's own clock and time zone (set in the operating system).
  // It never depends on the network or IP address, so a VPN can't change it.
  // Text is only rewritten when the minute changes.
  let clockKey = '';
  function tickHero() {
    if (hero.hidden) return;
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    if (key === clockKey) return;
    clockKey = key;
    timeEl.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    timeEl.dateTime = now.toISOString();
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    greetEl.textContent = greeting();
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
    if (running && app.justResumed === task.id) {
      app.justResumed = null;
      li.classList.remove('resumed');
      void li.offsetWidth; // restart the animation
      li.classList.add('resumed');
      setTimeout(() => li.classList.remove('resumed'), 1600);
    }
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

  // One timing for the whole choreography so everything lands together.
  const MOVE_MS = 460;
  const MOVE_EASE = 'cubic-bezier(.2, .8, .2, 1)';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render() {
    const { tasks } = app.data;
    const active = tasks.filter((t) => t.status === 'active');
    const sorted = sortMainList(active, app.stats);
    const animate = !reduceMotion() && root.isConnected;

    // FLIP "First": remember where every card and the idle panel were.
    const before = new Map();
    if (animate) for (const [id, li] of cards) before.set(id, li.getBoundingClientRect());
    const heroWasVisible = !hero.hidden && hero.isConnected;
    const heroRect = heroWasVisible ? hero.getBoundingClientRect() : null;
    const ghost = animate && heroWasVisible ? hero.cloneNode(true) : null;

    list.hidden = sorted.length === 0;
    renderHero();
    // All tasks archived: point to History.
    empty.hidden = !(app.data.tasks.length > 0 && sorted.length === 0);

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

    if (!animate) { for (const li of cards.values()) li.classList.remove('entering'); tick(); return; }

    // The idle panel leaves: a copy fades and sinks back while the card arrives.
    if (ghost && hero.hidden) {
      const rootRect = root.getBoundingClientRect();
      Object.assign(ghost.style, { position: 'absolute', left: `${heroRect.left - rootRect.left}px`, top: `${heroRect.top - rootRect.top}px`,
        width: `${heroRect.width}px`, height: `${heroRect.height}px`, margin: 0, pointerEvents: 'none', zIndex: 0 });
      ghost.removeAttribute('aria-live');
      root.append(ghost);
      ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: MOVE_MS * 0.6, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => ghost.remove(), () => ghost.remove());
    }

    // "Last, Invert, Play": every card glides from its old place to the new one.
    for (const [id, li] of cards) {
      if (li.classList.contains('entering')) {
        li.classList.remove('entering');
        li.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
        continue;
      }
      const prev = before.get(id);
      if (!prev) continue;
      const now = li.getBoundingClientRect();
      const dy = prev.top - now.top;
      const grew = Math.abs(prev.height - now.height) > 1;
      if (Math.abs(dy) < 1 && !grew) continue;
      li.style.zIndex = grew ? 2 : 1; // the moving/expanding card travels above the others
      const frames = grew
        ? [{ transform: `translateY(${dy}px)`, height: `${prev.height}px`, overflow: 'hidden' },
           { transform: 'none', height: `${now.height}px`, overflow: 'hidden' }]
        : [{ transform: `translateY(${dy}px)` }, { transform: 'none' }];
      const anim = li.animate(frames, { duration: MOVE_MS, easing: MOVE_EASE });
      anim.finished.then(() => { li.style.zIndex = ''; }, () => { li.style.zIndex = ''; });
      // Expanded view: timer and Stop fade in as the card settles into the slot.
      if (grew && li.classList.contains('is-running')) {
        li._els.timer.parentElement.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, delay: MOVE_MS * 0.55, easing: 'ease-out', fill: 'backwards' });
      }
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
