# Changelog

Versions follow `0.MAJOR.MINOR` until 1.0:
**Major** = a new feature or a visible redesign (middle number goes up).
**Minor** = a small fix or tweak (last number goes up).
Every commit subject starts with `Major:` or `Minor:` and names the new version, e.g. `(v0.5.2)`.

## 0.12.0 — Major
- Mini timer works fully at its smallest size: a minimum of 240 × 156 (two rows of tasks at legible text sizes); smaller windows are resized back up where the browser allows, otherwise the content scrolls.
- Mini timer gains the rest of the home page: + New task (or N) with name, max hours, expiry and notes; task options (⋯, right-click, long-press or Shift+F10): Edit, Add session, History, Archive; Undo for every change; "Switch to …?" confirm; create-only ⏳ chip; 🔥 streak; idle stats (Today, sessions, daily avg); progress toward max hours; over-limit / expiring labels.
- Architecture: the full app and the mini timer share one set of actions and form rules (`createActions(app, ui)`, `logic/forms.js`); only their UI wrappers differ. Rules recorded in docs/MINI_TIMER.md.

## 0.11.0 — Major
- Mini timer now packs the home view (the main app is unchanged):
  - The running task is the biggest card, full width; click anywhere on it to stop (Enter/Space too). Paused shows Resume; idle shows the time and today's total.
  - A scrollable grid of tasks in the same order as the home list, two lines each (name, total), red/yellow edges for expiring/near-limit. Two rows (4 tasks) visible at the smallest size, more columns when wider.
  - Click a task to start it. If another is running, "Switch to …?" is asked inside the mini window. Undo after every start and stop.
  - 🔍 search (or press / or Ctrl+F): filters by name and notes; Enter starts the first match, ↓ moves into the grid, arrow keys move between tasks, Esc clears then closes. Typing while on the grid jumps into search.
  - ⌂ brings the full app forward on the task list.

## 0.10.1 — Minor
- Top card: a "+ New task" button (where the greeting was) when nothing is running, and a ↗ mini-timer button that is always there, idle or running (next to ⋯ on the running card). It lights up while the mini timer is open.
- The mini-timer button moved out of the header into the card (still under ☰ in a small window).

## 0.10.0 — Major
- Mini timer: a tiny always-on-top window (Document Picture-in-Picture, Chromium browsers on a computer) that can be shrunk far below the browser's ~500px minimum window width. Running: task name, timer, Stop. Paused: Resume. Idle: the time, today's total and a one-tap start of your last task. Buttons turn icon-only when it's very narrow. Open it with the ↗ header button (or ☰ → Mini timer in a small window).

## 0.9.1 — Minor
- Small window: the + (new task) and History buttons are always in the header again; the ☰ menu keeps Tasks and Settings.
- Very narrow windows: the top-bar timer keeps its digits visible (task name and streak step aside).

## 0.9.0 — Major
- Small window: the top card is now 84px instead of 128px (time, date and one row of stats when idle; name, timer and Stop when running). Smaller header buttons.
- Idle card stats are now Today · Sessions today · Daily avg. Daily avg = all tracked time ÷ days with any tracked time, so days off don't lower it.
- New 🔥 streak badge next to the logo (days in a row with tracked time), on every page.
- History opens with This week and This month totals.
- "Logs" are called "sessions" everywhere ("Add session manually", "Sessions today", etc.).
- Fix: toasts were squeezed to half the screen width on small phones; the header no longer overflows on narrow phones.

## 0.8.1 — Minor
- Idle card date: no year, 3-letter month (e.g. "Thursday, Nov 26" or "Thursday, 26 Nov", following the device's language).
- Quotes are no longer cut off on phones. The quote uses all the free space in the card and its text shrinks slightly if needed, so a long quote never changes the card size or moves anything around it.

## 0.8.0 — Major
- Starting a task: the card slides from its place in the list up into the top slot and grows into the expanded running view, while the other cards glide into their new places and the idle panel fades away (one 0.46 s motion). Stopping plays it in reverse.
- New tasks drop into the list; the timer and Stop fade in once the card has landed.
- Subtle motion: page fade-in, button press, card hover lift, menu items, dialogs and backdrop, top-bar timer pill, create-only banner, history rows, graph bars, changing stats, help popover, bulk-select highlight.
- All motion is turned off when the device asks for reduced motion.

## 0.7.0 — Major
- Idle card: the current time (hour:minute AM/PM, from the device's own clock and time zone) and full date lead the card; the "Last task" line is removed; greeting moves to the side.
- Help: red 🛑 for stop, ⏱️ for timing, and real colour swatches matching the red/yellow cards instead of emoji squares (which render differently on each OS).

## 0.6.1 — Minor
- Fix: the app could get stuck on "Loading…" after an update. The offline cache could save an outdated copy of the page (GitHub Pages caches pages for 10 minutes) that pointed at files that no longer existed. The cache now always downloads fresh files and checks they match before switching over.
- Updates now install by themselves; a "TimeTracker was updated · Reload" message appears.
- Safety net: if the app hasn't started after 8 seconds, a "Repair and reload" button clears only the cached app files (tasks are untouched).
- Fix: quote API request used an invalid tag.

## 0.6.0 — Major
- Welcome card rewritten with emojis and simpler wording.
- New ? button next to Settings: hover (or tap) for a quick how-to and tips.
- The top card keeps one fixed size whether it shows the welcome, idle or running state; it only changes with the window/layout.
- Long toast messages are limited to two lines.

## 0.5.2 — Minor
- Versions are tracked by commit names and this changelog (no Git tags).

## 0.5.1 — Minor
- Subtle toasts for routine feedback (start/stop, archive, logs); important ones stay bright; errors are red.
- Settings autosave on Enter, click-outside or scroll, with a confirmation.

## 0.5.0 — Major
- Idle panel redesign: greeting, last task with Continue, stats strip, fresh quote each time you go idle.
- History rows: status on the left edge, aligned columns, wider desktop layout.

## 0.4.0 — Major
- Top-bar timer with task name and Pause on History/Settings; auto-resume on the task list.

## 0.3.0 — Major
- New tasks start immediately, with a 15-minute "create only" mode.
- Idle panel in the running-task slot; persistent-storage explanation.
- (0.2.1–0.2.3, Minor: service-worker takeover fixes; "Sort by: Creation / Completion".)

## 0.2.0 — Major
- Full task tracker: task list, timers, history with graphs, settings, backups, layouts, multi-window sync.

## 0.1.0 — Major
- Scaffold: PWA shell, IndexedDB storage, GitHub Pages deploy, GPL-3.0.
