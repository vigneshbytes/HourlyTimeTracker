# Mini timer (floating window)

A small always-on-top window (Document Picture-in-Picture, Chromium browsers on
a computer) that packs the home view. Code: `src/ui/miniTimer.js`.

## Size rules (decided with the project owner — keep them)

- Chromium lets this window shrink to about **240 × 52** CSS px (measured from
  a Vivaldi screenshot: 300 × 62 screen px at 125% scaling). That is too small.
- **Fixed heights (owner's rule):** nothing changes height when the window is
  resized, larger or smaller; only widths stretch.
  - Main (timer) card = **H1 = 60px**.
  - ⌂ and + stacked = H1 (two 28px icons + one 4px gap), level with the card.
  - 🔍 = **H1 / 2 = 30px**; the search box and every task row are also 30px.
  - Every gap is the same 4px (between ⌂, + and 🔍, and everywhere else).
- The mini timer enforces a minimum of **240 × 136** (`MIN_W` × `MIN_H`):
  4 + card 60 + 4 + two task rows (30 + 4 + 30) + 4. Text stays legible
  (11px task names, 10px secondary text).
  (History: 240 × 156 with a top bar, then 240 × 128 before the fixed heights.)
- **No top bar.** A slim rail on the right holds, top to bottom: ⌂ Home, + New
  task (these two level with the card), then 🔍 Search level with the first
  task row. The search box opens in that row, beside 🔍.
- **Not in the mini timer (owner's decision):** streak, day and date.
- Below that size the window is resized back up where the browser allows it
  (resizing needs a user gesture, so it also retries on the next click);
  otherwise the content scrolls so nothing becomes unreachable.
- Smallest legible text: 11 px task names, 10 px secondary text.
- The smallest size must be fully usable. Larger windows only add width
  (more task columns) and more visible rows; heights and fonts stay fixed.
- Changes to the mini timer must not change the full app's UI.

## Architecture: shared logic, separate UI wrappers

Every action goes through `createActions(app, ui)` in `src/ui/actions.js`.
The full app passes its dialogs and toasts (`fullAppUi`); the mini timer passes
its own inline forms and feedback strip. Form rules live in
`src/logic/forms.js`; sorting, colours and totals come from `app.stats`
(`logic/tasks.js`) and `app.overview` (`logic/stats.js`). A change to the logic
reaches both front ends automatically. Do not call `app.repo` directly from a UI.

## Feature parity with the home page

| Home page feature | Mini timer |
|---|---|
| Task list, recent first, expiring first | ✓ grid, same order (`sortMainList`) |
| Click a task to start | ✓ click / Enter / Space |
| One task at a time, confirm before switching | ✓ inline "Switch to …?" |
| Running task big, whole card = Stop | ✓ biggest card, click or Enter to stop |
| Total / max hours, progress | ✓ on the card and tiles |
| Red (expiring) / yellow (70%) / over limit | ✓ tile edge + label + progress |
| Undo after start / stop / archive | ✓ strip with Undo |
| New task (name, notes, max hours, expiry) | ✓ + button or N, inline form |
| Auto-start new tasks, "create only" 15 min | ✓ same action; ⏳ chip on the card to turn off |
| Options: Edit, Add session, History, Archive | ✓ ⋯ / right-click / long-press / Shift+F10 |
| Idle: time, Today, Sessions today, Daily avg | ✓ (no date, by request) |
| Streak 🔥 | ✗ removed by request (full app only) |
| Paused task resumes | ✓ card shows Resume |
| Search (mini only) | ✓ 🔍, / or Ctrl+F, arrows, Enter, Esc |
| Back to the full app | ✓ ⌂ |
| Quote | ✗ no room; full app only |
| Help (?) | tooltips on every control instead |
| Delete permanently, settings, backups | full app only (on purpose) |
