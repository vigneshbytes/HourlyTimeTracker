# Changelog

Versions follow `0.MAJOR.MINOR` until 1.0:
**Major** = a new feature or a visible redesign (middle number goes up).
**Minor** = a small fix or tweak (last number goes up).
Every commit subject starts with `Major:` or `Minor:` and names the new version, e.g. `(v0.5.2)`.

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
