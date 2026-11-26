# Mini timer (floating window)

A small always-on-top window (Document Picture-in-Picture, Chromium browsers on
a computer) that packs the home view. Code: `src/ui/miniTimer.js`.

## Size rules (decided with the project owner — keep them)

- **X × Y = 240 × 52 CSS px**: Chromium's own minimum for this window
  (`kMinWindowSize(240, 52)` in
  `chrome/browser/picture_in_picture/picture_in_picture_window_manager.cc`).
  The owner's Vivaldi screenshot of the smallest window, minus 20% (125%
  screen scaling), lands on about the same size.
- **Launch size:** X × Y until the user resizes the window; after that, the
  last size they left it at (Chromium reuses it while the browser is open; we
  also save it in localStorage `htt.miniSize` so it survives restarts). Do not
  pass `preferInitialWindowPlacement` (it would discard the user's size).
  Websites cannot choose the window's position.
- **Opens automatically when a task starts** from a click in the full app
  (start, switch, create-and-start, resume). Browsers only allow opening it
  right after a click or key press, so it can't open on page load or browser
  startup.
- **Everything fits inside X × Y** with no visible scrollbar (lists scroll with
  the wheel, arrows or touch, but scrollbars are hidden).
  - Horizontally: timer card + 4px gap + rail (18px) = X.
  - Vertically: ⌂ (14) + 4 + + (14) + 4 + 🔍 (16) = Y.
  - Card = **H1 = 32px** = ⌂ + gap + + (level with the card).
  - 🔍, the search box and every task row = **16px** (H1 / 2).
  - Every gap is the same 4px. Heights never change when the window grows;
    a bigger window only adds task columns and visible rows.
- **Two states** (owner's rule):
  - **Interactive** when the mini window is selected (focused) OR the cursor is
    over it: card, one row of tasks, ⌂ + 🔍 rail. Exactly the owner's rule; do
    not drop the "selected" half.
    The hover half is pure CSS (`html:hover`), so it switches on the same frame
    the cursor crosses the edge; focus is a `body.focused` class.
    No transitions or animations anywhere in the mini timer (owner's request).
  - **Widget** only while a session is running, when the cursor is outside AND
    the window is not selected (idle or paused: always interactive):
    🔍 and the task list disappear and the timer card fills that space
    (full height, bigger clock). ⌂ and + stay.
- **No undo pop-ups** in the mini timer. Only errors show (an error bar that
  hides after 5 s). Undo stays available in the full app's toasts.
- **No top bar.** Rail on the right, top to bottom: ⌂ Home, + New task, 🔍 Search.
- **Not in the mini timer (owner's decision):** streak, day and date.
- Task tiles are one line: name on the left, total on the right.
  Task options open with right-click, long-press or Shift+F10 (no ⋯ button).
- Forms are two 22px rows over the left column: New/Edit task = name + Create,
  then Max hrs + Expires + ✕ (notes stay in the full app). Add session = hours
  + Add, then date + time + ✕.
- Changes to the mini timer must not change the full app's UI.

## Architecture: shared logic, separate UI wrappers

Every action goes through `createActions(app, ui)` in `src/ui/actions.js`.
The full app passes its dialogs and toasts (`fullAppUi`); the mini timer passes
its own inline forms and an error-only bar. Form rules live in
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
| Undo after start / stop / archive | ✗ no undo pop-ups by request (full app only) |
| New task (name, max hours, expiry) | ✓ + button or N, inline form (notes: full app) |
| Auto-start new tasks, "create only" 15 min | ✓ same action; ⏳ chip on the card to turn off |
| Options: Edit, Add session, History, Archive | ✓ right-click / long-press / Shift+F10 |
| Idle: time, Today, Sessions today, Daily avg | ✓ (no date, by request) |
| Streak 🔥 | ✗ removed by request (full app only) |
| Paused task resumes | ✓ card shows Resume |
| Search (mini only) | ✓ 🔍, / or Ctrl+F, arrows, Enter, Esc |
| Back to the full app | ✓ ⌂ |
| Quote | ✗ no room; full app only |
| Help (?) | tooltips on every control instead |
| Delete permanently, settings, backups | full app only (on purpose) |
